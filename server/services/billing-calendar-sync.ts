/**
 * Shared Stripe → payment_obligations sync (webhook, Sync Invoices, nightly reconcile).
 * One code path for amounts and status transitions.
 */
import type Stripe from "stripe";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
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
import {
  OPEN_OBLIGATION_STATUSES,
  isLocalSubCancelled,
} from "./billing-calendar-matching";

export type SyncSource = "webhook" | "reconcile" | "sync" | "system";
export { isLocalSubCancelled, isOpenObligationStatus } from "./billing-calendar-matching";

const HORIZON_DAYS = 90;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Stop all open Stripe-origin (and linked) obligations for a local subscription.
 * Used on cancel / orphan sweep so upcoming never outlives an inactive sub.
 */
export async function stopOpenObligationsForSubscription(
  subscriptionId: number,
  opts: {
    source: SyncSource;
    stripeEventId?: string | null;
    note?: string;
  },
): Promise<number> {
  const rows = await db
    .select()
    .from(paymentObligations)
    .where(
      and(
        eq(paymentObligations.subscriptionId, subscriptionId),
        inArray(paymentObligations.status, [...OPEN_OBLIGATION_STATUSES]),
      ),
    );

  let stopped = 0;
  for (const row of rows) {
    await applyStatusChange(row.id, PaymentObligationStatus.STOPPED, {
      source: opts.source,
      stripeEventId: opts.stripeEventId,
      note: opts.note || "Subscription canceled/ended",
    });
    stopped++;
  }
  return stopped;
}

/**
 * Stop open Stripe obligations whose local subscription is no longer active.
 * Idempotent; safe to run on every reconcile.
 */
export async function sweepOrphanStripeObligations(
  opts: { source: SyncSource } = { source: "reconcile" },
): Promise<number> {
  const openRows = await db
    .select({
      id: paymentObligations.id,
      subscriptionId: paymentObligations.subscriptionId,
      subStatus: subscriptionsTable.status,
    })
    .from(paymentObligations)
    .leftJoin(
      subscriptionsTable,
      eq(paymentObligations.subscriptionId, subscriptionsTable.id),
    )
    .where(
      and(
        eq(paymentObligations.origin, PaymentOrigin.STRIPE),
        inArray(paymentObligations.status, [...OPEN_OBLIGATION_STATUSES]),
      ),
    );

  let stopped = 0;
  const handledSubs = new Set<number>();

  for (const row of openRows) {
    const cancelled =
      !row.subscriptionId ||
      row.subStatus == null ||
      isLocalSubCancelled(row.subStatus);

    if (!cancelled) continue;

    if (row.subscriptionId) {
      if (handledSubs.has(row.subscriptionId)) continue;
      handledSubs.add(row.subscriptionId);
      stopped += await stopOpenObligationsForSubscription(row.subscriptionId, {
        source: opts.source,
        note: "Orphan sweep: local subscription not active",
      });
    } else {
      await applyStatusChange(row.id, PaymentObligationStatus.STOPPED, {
        source: opts.source,
        note: "Orphan sweep: missing subscription link",
      });
      stopped++;
    }
  }

  return stopped;
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
  // Prefer invoice id match, then (subscription + period day) — avoids timestamp ms mismatches
  let existing: PaymentObligation | undefined;
  if (input.stripeInvoiceId) {
    const [byInvoice] = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.stripeInvoiceId, input.stripeInvoiceId))
      .limit(1);
    existing = byInvoice;
  }
  if (!existing) {
    const periodDay = input.periodStart.toISOString().slice(0, 10);
    const [byPeriod] = await db
      .select()
      .from(paymentObligations)
      .where(
        and(
          eq(paymentObligations.origin, PaymentOrigin.STRIPE),
          eq(paymentObligations.subscriptionId, input.subscriptionId),
          sql`(${paymentObligations.periodStart})::date = ${periodDay}::date`,
        ),
      )
      .limit(1);
    existing = byPeriod;
  }

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
      amountPaidCents: input.patch?.amountPaidCents ?? 0,
      amountRefundedCents: input.patch?.amountRefundedCents ?? 0,
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
      riskFlags: input.patch?.riskFlags ?? undefined,
      attemptCount: input.patch?.attemptCount ?? undefined,
      notes: input.patch?.notes ?? undefined,
    })
    .returning();

  await applyStatusChange(created.id, input.status, {
    source: input.source,
    stripeEventId: input.stripeEventId,
    note: "Created from Stripe sync",
    patch: input.patch,
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

  if (isLocalSubCancelled(localSub.status)) {
    await stopOpenObligationsForSubscription(localSub.id, {
      source: opts.source,
      stripeEventId: opts.stripeEventId,
      note: "Local subscription canceled",
    });
    return null;
  }

  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(localSub.stripeSubscriptionId);
  } catch {
    await stopOpenObligationsForSubscription(localSub.id, {
      source: opts.source,
      stripeEventId: opts.stripeEventId,
      note: "Stripe subscription retrieve failed — stopping open obligations",
    });
    return null;
  }

  if (["canceled", "incomplete_expired"].includes(stripeSub.status)) {
    await stopOpenObligationsForSubscription(localSub.id, {
      source: opts.source,
      stripeEventId: opts.stripeEventId,
      note: "Subscription canceled/ended",
    });
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

  const customerId =
    user?.stripeCustomerId ||
    (typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : stripeSub.customer?.id) ||
    null;

  if (customerId) {
    try {
      const upcoming = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
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
    } catch (e) {
      console.warn(
        `[billing-calendar] retrieveUpcoming failed for sub ${localSub.id}:`,
        (e as Error)?.message || e,
      );
    }
  }

  if (amountCents <= 0) {
    const unit = stripeSub.items.data[0]?.price?.unit_amount;
    if (unit && unit > 0) amountCents = unit;
  }

  if (!dueDate || !periodStart) {
    console.warn(`[billing-calendar] skip sub ${localSub.id}: missing period dates`);
    return null;
  }
  if (amountCents <= 0) {
    console.warn(`[billing-calendar] skip sub ${localSub.id}: amount <= 0`);
    return null;
  }
  const horizon = addDays(new Date(), HORIZON_DAYS);
  if (dueDate > horizon) {
    console.warn(
      `[billing-calendar] skip sub ${localSub.id}: due ${dueDate.toISOString()} beyond ${HORIZON_DAYS}d horizon`,
    );
    return null;
  }

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
    let amount =
      invoice.lines.data.find((l) => l.amount === sub.price)?.amount ??
      sub.price ??
      0;
    if (amount <= 0) {
      amount = invoice.amount_paid || invoice.amount_due || 0;
    }

    if (
      eventType === "invoice.payment_succeeded" ||
      eventType === "invoice.paid" ||
      (invoice.paid && invoice.amount_paid > 0)
    ) {
      if (amount <= 0) continue;
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

export type ReconcileStats = {
  attempted: number;
  upcomingUpserted: number;
  upcomingSkipped: number;
  invoicesSynced: number;
  fromTransactions: number;
  orphansStopped: number;
  errors: number;
};

/**
 * Materialize settled calendar rows from existing paid `transactions`
 * (so past months show without relying only on live Stripe list).
 */
export async function materializeSettledFromTransactions(
  opts: { source: SyncSource } = { source: "sync" },
): Promise<number> {
  const paidTx = await db
    .select({
      id: transactionsTable.id,
      subscriptionId: transactionsTable.subscriptionId,
      amount: transactionsTable.amount,
      currency: transactionsTable.currency,
      stripeInvoiceId: transactionsTable.stripeInvoiceId,
      paidAt: transactionsTable.paidAt,
      createdAt: transactionsTable.createdAt,
      userId: subscriptionsTable.userId,
      stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
      username: users.username,
      email: users.email,
    })
    .from(transactionsTable)
    .innerJoin(
      subscriptionsTable,
      eq(transactionsTable.subscriptionId, subscriptionsTable.id),
    )
    .leftJoin(users, eq(subscriptionsTable.userId, users.id))
    .where(eq(transactionsTable.status, "paid"));

  let created = 0;
  for (const tx of paidTx) {
    if (tx.amount <= 0) continue;
    const paidAt = tx.paidAt || tx.createdAt || new Date();
    const periodStart = paidAt;

    if (tx.stripeInvoiceId) {
      const [existingInv] = await db
        .select({ id: paymentObligations.id })
        .from(paymentObligations)
        .where(eq(paymentObligations.stripeInvoiceId, tx.stripeInvoiceId))
        .limit(1);
      if (existingInv) continue;
    }

    const periodDay = periodStart.toISOString().slice(0, 10);
    const [existingPeriod] = await db
      .select({ id: paymentObligations.id })
      .from(paymentObligations)
      .where(
        and(
          eq(paymentObligations.origin, PaymentOrigin.STRIPE),
          eq(paymentObligations.subscriptionId, tx.subscriptionId),
          sql`(${paymentObligations.periodStart})::date = ${periodDay}::date`,
        ),
      )
      .limit(1);
    if (existingPeriod) continue;

    await upsertStripeObligation({
      subscriptionId: tx.subscriptionId,
      userId: tx.userId,
      clientName: tx.username || tx.email || "Unknown",
      amountDueCents: tx.amount,
      currency: tx.currency || "eur",
      dueDate: paidAt,
      periodStart,
      periodEnd: paidAt,
      stripeSubscriptionId: tx.stripeSubscriptionId || `local_sub_${tx.subscriptionId}`,
      stripeInvoiceId: tx.stripeInvoiceId || `txn_${tx.id}`,
      status: PaymentObligationStatus.SETTLED,
      source: opts.source,
      patch: { amountPaidCents: tx.amount },
    });
    created++;
  }
  return created;
}

/** Reconcile: upcoming + all paid Stripe invoices (paginated) + local transactions. */
export async function reconcileStripeCalendar(
  stripe: Stripe,
  opts: { source: SyncSource } = { source: "reconcile" },
): Promise<ReconcileStats> {
  const activeSubs = await db
    .select()
    .from(subscriptionsTable)
    .where(
      sql`LOWER(${subscriptionsTable.status}) IN ('active','trialing','past_due')`,
    );

  // All customers with a Stripe id (incl. cancelled) so past paid invoices appear
  const customerRows = await db
    .selectDistinct({ stripeCustomerId: users.stripeCustomerId })
    .from(subscriptionsTable)
    .innerJoin(users, eq(subscriptionsTable.userId, users.id))
    .where(sql`${users.stripeCustomerId} IS NOT NULL`);

  const stats: ReconcileStats = {
    attempted: 0,
    upcomingUpserted: 0,
    upcomingSkipped: 0,
    invoicesSynced: 0,
    fromTransactions: 0,
    orphansStopped: 0,
    errors: 0,
  };

  for (const sub of activeSubs) {
    stats.attempted++;
    try {
      const row = await syncObligationFromStripeSubscription(stripe, sub, opts);
      if (row) stats.upcomingUpserted++;
      else stats.upcomingSkipped++;
    } catch (e) {
      stats.errors++;
      console.error("[billing-calendar] reconcile sub failed", sub.id, e);
    }
  }

  try {
    stats.orphansStopped = await sweepOrphanStripeObligations(opts);
  } catch (e) {
    stats.errors++;
    console.error("[billing-calendar] orphan sweep failed", e);
  }

  for (const { stripeCustomerId } of customerRows) {
    if (!stripeCustomerId) continue;
    try {
      let startingAfter: string | undefined;
      for (let page = 0; page < 20; page++) {
        const invoices = await stripe.invoices.list({
          customer: stripeCustomerId,
          status: "paid",
          limit: 100,
          starting_after: startingAfter,
        });
        for (const invoice of invoices.data) {
          if (!invoice.subscription || !(invoice.amount_paid > 0)) continue;
          try {
            await syncObligationFromStripeInvoice(stripe, invoice, {
              source: opts.source,
              eventType: "invoice.payment_succeeded",
            });
            stats.invoicesSynced++;
          } catch (e) {
            stats.errors++;
            console.error("[billing-calendar] reconcile invoice failed", invoice.id, e);
          }
        }
        if (!invoices.has_more || invoices.data.length === 0) break;
        startingAfter = invoices.data[invoices.data.length - 1].id;
      }
    } catch (e) {
      stats.errors++;
      console.error("[billing-calendar] list invoices failed", stripeCustomerId, e);
    }
  }

  try {
    stats.fromTransactions = await materializeSettledFromTransactions(opts);
  } catch (e) {
    stats.errors++;
    console.error("[billing-calendar] materialize from transactions failed", e);
  }

  console.log("[billing-calendar] reconcile stats", stats);
  return stats;
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
