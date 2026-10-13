/**
 * Shared Stripe → payment_obligations sync (webhook, Sync Invoices, nightly reconcile).
 * One code path for amounts and status transitions.
 */
import type Stripe from "stripe";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  PaymentObligationStatus,
  PaymentOrigin,
  paymentObligations,
  subscriptions as subscriptionsTable,
  transactions as transactionsTable,
  users,
  type PaymentObligation,
} from "@shared/schema";
import { applyStatusChange } from "./billing-obligation-history";
import { createAdminNotification, claimBillingEmailSend } from "./billing-admin-notify";
import { chargedCentsForInvoiceLine } from "../lib/stripe-invoice-amount";

export type SyncSource = "webhook" | "reconcile" | "sync" | "system";

const HORIZON_DAYS = 90;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function findLocalSubsByStripeId(stripeSubscriptionId: string) {
  return db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId));
}

async function upsertStripeObligation(input: {
  subscriptionId: number;
  userId: number | null;
  clientName: string;
  amountDueCents: number;
  currency: string;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date | null;
  stripeSubscriptionId: string;
  stripeScheduleId?: string | null;
  stripeInvoiceId?: string | null;
  status: string;
  source: SyncSource;
  stripeEventId?: string | null;
  patch?: Partial<PaymentObligation>;
}): Promise<PaymentObligation> {
  const [existing] = await db
    .select()
    .from(paymentObligations)
    .where(
      and(
        eq(paymentObligations.origin, PaymentOrigin.STRIPE),
        eq(paymentObligations.subscriptionId, input.subscriptionId),
        eq(paymentObligations.periodStart, input.periodStart),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status !== input.status || input.patch) {
      return applyStatusChange(existing.id, input.status, {
        source: input.source,
        stripeEventId: input.stripeEventId,
        note: `Stripe sync (${input.source})`,
        patch: {
          amountDue: input.amountDueCents,
          currency: input.currency,
          dueDate: input.dueDate,
          periodEnd: input.periodEnd,
          stripeInvoiceId: input.stripeInvoiceId ?? existing.stripeInvoiceId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeScheduleId: input.stripeScheduleId ?? existing.stripeScheduleId,
          clientName: input.clientName,
          ...(input.patch || {}),
        },
      });
    }
    const [updated] = await db
      .update(paymentObligations)
      .set({
        amountDue: input.amountDueCents,
        dueDate: input.dueDate,
        periodEnd: input.periodEnd,
        stripeInvoiceId: input.stripeInvoiceId ?? existing.stripeInvoiceId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        updatedAt: new Date(),
        ...(input.patch || {}),
      })
      .where(eq(paymentObligations.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(paymentObligations)
    .values({
      customPaymentId: null,
      subscriptionId: input.subscriptionId,
      userId: input.userId,
      clientName: input.clientName,
      amountDue: input.amountDueCents,
      amountPaidCents: 0,
      amountRefundedCents: 0,
      currency: input.currency,
      dueDate: input.dueDate,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: input.status,
      origin: PaymentOrigin.STRIPE,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeScheduleId: input.stripeScheduleId ?? null,
      vatIncluded: true,
      assumedPaid: false,
    })
    .returning();

  await applyStatusChange(created.id, input.status, {
    source: input.source,
    stripeEventId: input.stripeEventId,
    note: "Created from Stripe sync",
  });

  return created;
}

/** Ensure a paid transactions row exists for this obligation/invoice (idempotent). */
export async function ensureTransactionForSettledObligation(opts: {
  subscriptionId: number;
  amountCents: number;
  currency: string;
  stripeInvoiceId: string;
  paidAt: Date;
}): Promise<void> {
  const existing = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.stripeInvoiceId, opts.stripeInvoiceId),
        eq(transactionsTable.subscriptionId, opts.subscriptionId),
      ),
    )
    .limit(1);
  if (existing.length) return;

  await db.insert(transactionsTable).values({
    subscriptionId: opts.subscriptionId,
    amount: opts.amountCents,
    currency: opts.currency,
    status: "paid",
    pdfUrl: null,
    stripeInvoiceId: opts.stripeInvoiceId,
    paidAt: opts.paidAt,
    createdAt: opts.paidAt,
  });
}

/**
 * Sync one local subscription from a Stripe subscription (or schedule phases).
 * Materializes the next charge within HORIZON_DAYS.
 */
export async function syncObligationFromStripeSubscription(
  stripe: Stripe,
  localSub: typeof subscriptionsTable.$inferSelect,
  opts: { source: SyncSource; stripeEventId?: string | null } = { source: "system" },
): Promise<PaymentObligation | null> {
  if (!localSub.stripeSubscriptionId) return null;

  const user = localSub.userId
    ? (await db.select().from(users).where(eq(users.id, localSub.userId)).limit(1))[0]
    : null;
  const clientName = user?.username || user?.email || "Unknown";

  // Schedule path
  if (localSub.stripeSubscriptionId.startsWith("sub_sched_")) {
    const schedule = await stripe.subscriptionSchedules.retrieve(localSub.stripeSubscriptionId);
    const phase = schedule.phases[0];
    if (!phase?.items?.length) return null;
    const priceRef = phase.items[0].price;
    let amount = localSub.price ?? 0;
    if (typeof priceRef === "object" && priceRef && "unit_amount" in priceRef) {
      amount = (priceRef as Stripe.Price).unit_amount || amount;
    } else if (typeof priceRef === "string") {
      const p = await stripe.prices.retrieve(priceRef);
      amount = p.unit_amount || amount;
    }
    const due = new Date(phase.start_date * 1000);
    const horizon = addDays(new Date(), HORIZON_DAYS);
    if (due > horizon) return null;
    const status =
      localSub.cancelAtPeriodEnd
        ? PaymentObligationStatus.WILL_NOT_RENEW
        : PaymentObligationStatus.UPCOMING;
    return upsertStripeObligation({
      subscriptionId: localSub.id,
      userId: localSub.userId,
      clientName,
      amountDueCents: amount,
      currency: "eur",
      dueDate: due,
      periodStart: due,
      periodEnd: null,
      stripeSubscriptionId: localSub.stripeSubscriptionId,
      stripeScheduleId: localSub.stripeSubscriptionId,
      status,
      source: opts.source,
      stripeEventId: opts.stripeEventId,
    });
  }

  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(localSub.stripeSubscriptionId);
  } catch {
    return null;
  }

  if (["canceled", "incomplete_expired"].includes(stripeSub.status)) {
    // Stop future unpaid rows
    const rows = await db
      .select()
      .from(paymentObligations)
      .where(
        and(
          eq(paymentObligations.subscriptionId, localSub.id),
          eq(paymentObligations.origin, PaymentOrigin.STRIPE),
          sql`${paymentObligations.status} NOT IN ('settled','refunded','partially_refunded','written_off','stopped')`,
          gte(paymentObligations.dueDate, startOfDay(new Date())),
        ),
      );
    for (const row of rows) {
      await applyStatusChange(row.id, PaymentObligationStatus.STOPPED, {
        source: opts.source,
        stripeEventId: opts.stripeEventId,
        note: "Subscription canceled/ended",
      });
    }
    return null;
  }

  let amountCents = localSub.price ?? 0;
  let dueDate: Date | null = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : null;
  let periodStart = stripeSub.current_period_start
    ? new Date(stripeSub.current_period_start * 1000)
    : dueDate;
  let invoiceId: string | null = null;

  if (user?.stripeCustomerId) {
    try {
      const upcoming = await stripe.invoices.retrieveUpcoming({
        customer: user.stripeCustomerId,
        subscription: localSub.stripeSubscriptionId,
      });
      invoiceId = ((upcoming as unknown as Stripe.Invoice).id as string | undefined) || null;
      if (upcoming.period_end) dueDate = new Date(upcoming.period_end * 1000);
      if (upcoming.period_start) periodStart = new Date(upcoming.period_start * 1000);
      const line = upcoming.lines.data.find((l) => {
        return localSub.price != null
          ? l.amount === localSub.price ||
              (typeof l.price !== "string" && l.price?.unit_amount === localSub.price)
          : false;
      }) || upcoming.lines.data[0];
      if (line) {
        amountCents = chargedCentsForInvoiceLine(upcoming as any, line as any) || line.amount || amountCents;
      } else if (upcoming.amount_due > 0) {
        amountCents = upcoming.amount_due;
      }
    } catch {
      // no upcoming invoice
    }
  }

  if (!dueDate || !periodStart || amountCents <= 0) return null;
  const horizon = addDays(new Date(), HORIZON_DAYS);
  if (dueDate > horizon) return null;

  let status: string = PaymentObligationStatus.UPCOMING;
  if (stripeSub.pause_collection) {
    status = PaymentObligationStatus.PAUSED;
  } else if (stripeSub.cancel_at_period_end) {
    status = PaymentObligationStatus.WILL_NOT_RENEW;
  }

  const riskFlags: string[] = [];
  if (stripeSub.status === "past_due" || stripeSub.status === "unpaid") {
    riskFlags.push("customer_past_due");
  }

  return upsertStripeObligation({
    subscriptionId: localSub.id,
    userId: localSub.userId,
    clientName,
    amountDueCents: amountCents,
    currency: stripeSub.currency || "eur",
    dueDate,
    periodStart,
    periodEnd: dueDate,
    stripeSubscriptionId: localSub.stripeSubscriptionId,
    status,
    source: opts.source,
    stripeEventId: opts.stripeEventId,
    stripeInvoiceId: invoiceId,
    patch: { riskFlags },
  });
}

/** Apply Stripe invoice state onto the matching obligation(s). */
export async function syncObligationFromStripeInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  opts: { source: SyncSource; stripeEventId?: string | null; eventType?: string },
): Promise<void> {
  if (!invoice.subscription) return;
  const stripeSubId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

  let localSubs = await findLocalSubsByStripeId(stripeSubId);

  // Remap schedule → sub if needed
  if (!localSubs.length) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      if (stripeSub.schedule) {
        const schedId =
          typeof stripeSub.schedule === "string"
            ? stripeSub.schedule
            : stripeSub.schedule.id;
        const schedSubs = await findLocalSubsByStripeId(schedId);
        for (const s of schedSubs) {
          await db
            .update(subscriptionsTable)
            .set({ stripeSubscriptionId: stripeSubId })
            .where(eq(subscriptionsTable.id, s.id));
          await db
            .update(paymentObligations)
            .set({
              stripeSubscriptionId: stripeSubId,
              stripeScheduleId: schedId,
              updatedAt: new Date(),
            })
            .where(eq(paymentObligations.subscriptionId, s.id));
        }
        localSubs = await findLocalSubsByStripeId(stripeSubId);
      }
    } catch {
      /* ignore */
    }
  }

  if (!localSubs.length) return;

  const eventType = opts.eventType || "";
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date(invoice.created * 1000);
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000)
    : paidAt;
  const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : paidAt;

  for (const sub of localSubs) {
    const user = sub.userId
      ? (await db.select().from(users).where(eq(users.id, sub.userId)).limit(1))[0]
      : null;
    const clientName = user?.username || user?.email || "Unknown";
    const amount =
      invoice.lines.data.find((l) => l.amount === sub.price)?.amount ??
      sub.price ??
      invoice.amount_due ??
      invoice.amount_paid ??
      0;

    if (
      eventType === "invoice.payment_succeeded" ||
      eventType === "invoice.paid" ||
      (invoice.paid && invoice.amount_paid > 0)
    ) {
      const row = await upsertStripeObligation({
        subscriptionId: sub.id,
        userId: sub.userId,
        clientName,
        amountDueCents: amount,
        currency: invoice.currency,
        dueDate: paidAt,
        periodStart,
        periodEnd,
        stripeSubscriptionId: stripeSubId,
        stripeInvoiceId: invoice.id,
        status: PaymentObligationStatus.SETTLED,
        source: opts.source,
        stripeEventId: opts.stripeEventId,
        patch: {
          amountPaidCents: amount,
          attemptCount: invoice.attempt_count ?? 0,
        },
      });
      await ensureTransactionForSettledObligation({
        subscriptionId: sub.id,
        amountCents: amount,
        currency: invoice.currency,
        stripeInvoiceId: invoice.id,
        paidAt,
      });
      void row;
      continue;
    }

    if (eventType === "invoice.payment_failed") {
      const hasRetry = invoice.next_payment_attempt != null;
      const status = hasRetry
        ? PaymentObligationStatus.RETRYING
        : PaymentObligationStatus.DELINQUENT;
      const nextAttempt = hasRetry
        ? new Date(invoice.next_payment_attempt! * 1000)
        : null;
      const row = await upsertStripeObligation({
        subscriptionId: sub.id,
        userId: sub.userId,
        clientName,
        amountDueCents: invoice.amount_due || amount,
        currency: invoice.currency,
        dueDate: new Date(invoice.created * 1000),
        periodStart,
        periodEnd,
        stripeSubscriptionId: stripeSubId,
        stripeInvoiceId: invoice.id,
        status,
        source: opts.source,
        stripeEventId: opts.stripeEventId,
        patch: {
          attemptCount: invoice.attempt_count ?? 1,
          nextAttemptAt: nextAttempt,
          nextRetryDate: nextAttempt,
          lastFailureReason: invoice.billing_reason || "payment_failed",
        },
      });
      await createAdminNotification({
        type: "payment_failed",
        title: `Payment failed: ${clientName}`,
        body: `Invoice ${invoice.id} → ${status}`,
        payload: { obligationId: row.id, invoiceId: invoice.id },
      });
      // Email is sent from routes (sendSubscriptionEmail) after claim via shouldSendFailedEmail
      (row as any)._failedEmailAttempt = invoice.attempt_count ?? 1;
      continue;
    }

    if (eventType === "invoice.payment_action_required") {
      await upsertStripeObligation({
        subscriptionId: sub.id,
        userId: sub.userId,
        clientName,
        amountDueCents: invoice.amount_due || amount,
        currency: invoice.currency,
        dueDate: new Date(invoice.created * 1000),
        periodStart,
        periodEnd,
        stripeSubscriptionId: stripeSubId,
        stripeInvoiceId: invoice.id,
        status: PaymentObligationStatus.ACTION_REQUIRED,
        source: opts.source,
        stripeEventId: opts.stripeEventId,
      });
      await createAdminNotification({
        type: "action_required",
        title: `Action required: ${clientName}`,
        body: invoice.hosted_invoice_url || invoice.id,
        payload: { invoiceId: invoice.id },
      });
      continue;
    }

    if (eventType === "invoice.marked_uncollectible") {
      const [existing] = await db
        .select()
        .from(paymentObligations)
        .where(eq(paymentObligations.stripeInvoiceId, invoice.id))
        .limit(1);
      if (existing) {
        await applyStatusChange(existing.id, PaymentObligationStatus.WRITTEN_OFF, {
          source: opts.source,
          stripeEventId: opts.stripeEventId,
          note: "Invoice marked uncollectible — subscription will be auto-canceled",
        });
      }
      continue;
    }

    if (eventType === "invoice.voided") {
      const [existing] = await db
        .select()
        .from(paymentObligations)
        .where(eq(paymentObligations.stripeInvoiceId, invoice.id))
        .limit(1);
      if (existing) {
        await applyStatusChange(existing.id, PaymentObligationStatus.STOPPED, {
          source: opts.source,
          stripeEventId: opts.stripeEventId,
          note: "Invoice voided",
        });
      }
      continue;
    }

    if (eventType === "invoice.created" || eventType === "invoice.finalized") {
      await upsertStripeObligation({
        subscriptionId: sub.id,
        userId: sub.userId,
        clientName,
        amountDueCents: invoice.amount_due || amount,
        currency: invoice.currency,
        dueDate: periodEnd,
        periodStart,
        periodEnd,
        stripeSubscriptionId: stripeSubId,
        stripeInvoiceId: invoice.id,
        status: PaymentObligationStatus.UPCOMING,
        source: opts.source,
        stripeEventId: opts.stripeEventId,
      });
    }
  }
}

export async function handleSubscriptionUpdatedForCalendar(
  stripe: Stripe,
  sub: Stripe.Subscription,
  prev: Partial<Stripe.Subscription> | undefined,
  opts: { source: SyncSource; stripeEventId?: string | null },
): Promise<void> {
  const localSubs = await findLocalSubsByStripeId(sub.id);
  for (const local of localSubs) {
    await syncObligationFromStripeSubscription(stripe, local, opts);

    if (prev && prev.cancel_at_period_end === false && sub.cancel_at_period_end === true) {
      await createAdminNotification({
        type: "will_not_renew",
        title: `Cancel scheduled: sub #${local.id}`,
        payload: { subscriptionId: local.id },
      });
    }
    if (prev && prev.cancel_at_period_end === true && sub.cancel_at_period_end === false) {
      await createAdminNotification({
        type: "cancel_reverted",
        title: `Cancellation reverted: sub #${local.id}`,
        payload: { subscriptionId: local.id },
      });
    }
  }
}

export async function handleChargeRefundedForCalendar(
  charge: Stripe.Charge,
  opts: { source: SyncSource; stripeEventId?: string | null },
): Promise<void> {
  const invoiceId =
    typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
  if (!invoiceId) return;
  const [row] = await db
    .select()
    .from(paymentObligations)
    .where(eq(paymentObligations.stripeInvoiceId, invoiceId))
    .limit(1);
  if (!row) return;
  const refunded = charge.amount_refunded || 0;
  const full = refunded >= (row.amountPaidCents || row.amountDue);
  await applyStatusChange(
    row.id,
    full ? PaymentObligationStatus.REFUNDED : PaymentObligationStatus.PARTIALLY_REFUNDED,
    {
      source: opts.source,
      stripeEventId: opts.stripeEventId,
      note: `Refund ${refunded} cents`,
      patch: { amountRefundedCents: refunded },
    },
  );
  await createAdminNotification({
    type: "refund",
    title: `Refund: ${row.clientName}`,
    body: `${refunded / 100} ${row.currency}`,
    payload: { obligationId: row.id },
  });
}

export async function handleDisputeForCalendar(
  dispute: Stripe.Dispute,
  closed: boolean,
  opts: { source: SyncSource; stripeEventId?: string | null },
): Promise<void> {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;
  // Match via stripe invoice on obligations is best-effort; use notes + status
  const rows = await db
    .select()
    .from(paymentObligations)
    .where(
      and(
        eq(paymentObligations.origin, PaymentOrigin.STRIPE),
        or(
          eq(paymentObligations.status, PaymentObligationStatus.SETTLED),
          eq(paymentObligations.status, PaymentObligationStatus.DISPUTED),
        ),
      ),
    )
    .limit(50);

  // Without charge→invoice join here, mark by payment_intent if stored
  for (const row of rows) {
    if (row.stripePaymentIntentId && dispute.payment_intent === row.stripePaymentIntentId) {
      if (!closed) {
        await applyStatusChange(row.id, PaymentObligationStatus.DISPUTED, {
          source: opts.source,
          stripeEventId: opts.stripeEventId,
          note: "Dispute opened",
        });
        await createAdminNotification({
          type: "dispute_opened",
          title: `Dispute: ${row.clientName}`,
          payload: { obligationId: row.id },
        });
      } else if (dispute.status === "won") {
        await applyStatusChange(row.id, PaymentObligationStatus.SETTLED, {
          source: opts.source,
          stripeEventId: opts.stripeEventId,
          note: "Dispute won",
        });
      } else if (dispute.status === "lost") {
        await applyStatusChange(row.id, PaymentObligationStatus.REFUNDED, {
          source: opts.source,
          stripeEventId: opts.stripeEventId,
          note: "Dispute lost",
          patch: { amountRefundedCents: row.amountPaidCents || row.amountDue },
        });
      }
    }
  }
}

/** Reconcile Stripe obligations for active/trialing/past_due local subs. */
export async function reconcileStripeCalendar(
  stripe: Stripe,
  opts: { source: SyncSource } = { source: "reconcile" },
): Promise<{ synced: number }> {
  const localSubs = await db
    .select()
    .from(subscriptionsTable)
    .where(
      sql`LOWER(${subscriptionsTable.status}) IN ('active','trialing','past_due')`,
    );

  let synced = 0;
  for (const sub of localSubs) {
    try {
      await syncObligationFromStripeSubscription(stripe, sub, opts);
      synced++;
    } catch (e) {
      console.error("[billing-calendar] reconcile sub failed", sub.id, e);
    }
  }
  return { synced };
}

export async function shouldSendFailedEmail(
  obligationId: number,
  attemptCount: number,
): Promise<boolean> {
  return claimBillingEmailSend({
    template: "failed",
    attemptKey: `${obligationId}:failed:${attemptCount}`,
    obligationId,
  });
}

export { HORIZON_DAYS };
