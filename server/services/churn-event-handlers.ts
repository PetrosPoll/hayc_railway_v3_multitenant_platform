import type Stripe from "stripe";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  subscriptionEvents,
  subscriptions as subscriptionsTable,
} from "@shared/schema";
import {
  customerHasPriorChurn,
  ensureCustomerStripeAccount,
  eventTimestampFromStripe,
  insertSubscriptionEvent,
  latestCancelScheduledReason,
  mapStripePortalFeedbackToReasonCode,
  recordStripeEventReceipt,
  resolveHaycCustomerIdFromStripeCustomer,
  resolvePreLaunchForCustomer,
  webhookMayWriteEvent,
} from "./subscription-events";
import {
  computeCustomerMrrFromStripe,
  stripeCustomerIdFromSub,
} from "./customer-mrr";
import { classifyInvoicePaidEvent } from "./invoice-paid-classification";

async function previousMrrAfter(
  customerId: number,
  before: Date,
): Promise<number> {
  const [row] = await db
    .select({ mrr: subscriptionEvents.mrrAfterCents })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.customerId, customerId),
        isNotNull(subscriptionEvents.mrrAfterCents),
        sql`${subscriptionEvents.effectiveAt} < ${before}`,
      ),
    )
    .orderBy(desc(subscriptionEvents.effectiveAt), desc(subscriptionEvents.id))
    .limit(1);
  return row?.mrr ?? 0;
}

async function wasPastDueForSubscription(
  customerId: number,
  stripeSubscriptionId: string | null,
  opts?: { attemptCount?: number | null },
): Promise<boolean> {
  if (stripeSubscriptionId) {
    const [row] = await db
      .select({ id: subscriptionEvents.id })
      .from(subscriptionEvents)
      .where(
        and(
          eq(subscriptionEvents.customerId, customerId),
          eq(subscriptionEvents.stripeSubscriptionId, stripeSubscriptionId),
          eq(subscriptionEvents.type, "payment_failed"),
        ),
      )
      .limit(1);
    if (row) return true;
  }
  // Stripe often leaves attempt_count > 1 after dunning retries on the paid invoice
  return Boolean(opts?.attemptCount && opts.attemptCount > 1);
}

export async function handleChurnStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const relevant = [
    "invoice.payment_succeeded",
    "invoice.paid",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ].includes(event.type);
  if (!relevant) return;

  const { alreadyProcessed } = await recordStripeEventReceipt(event.id);
  if (alreadyProcessed) return;

  switch (event.type) {
    case "invoice.payment_succeeded":
    case "invoice.paid":
      await onInvoicePaid(stripe, event);
      break;
    case "customer.subscription.updated":
      await onSubscriptionUpdated(stripe, event);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(stripe, event);
      break;
    default:
      break;
  }
}

async function onInvoicePaid(stripe: Stripe, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.subscription) return;

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!stripeCustomerId) return;

  const customerId =
    await resolveHaycCustomerIdFromStripeCustomer(stripeCustomerId);
  if (!customerId) {
    console.warn(
      `[churn-events] No HAYC customer for Stripe customer ${stripeCustomerId} on invoice.paid`,
    );
    return;
  }
  await ensureCustomerStripeAccount(customerId, stripeCustomerId);

  const effectiveAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : eventTimestampFromStripe(event);

  if (!(await webhookMayWriteEvent(effectiveAt))) {
    return;
  }

  const snap = await computeCustomerMrrFromStripe(
    stripe,
    stripeCustomerId,
    `invoice.paid ${event.id}`,
  );
  const prevMrr = await previousMrrAfter(customerId, effectiveAt);
  const hasChurn = await customerHasPriorChurn(customerId);
  const stripeSubId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  const wasPastDue = await wasPastDueForSubscription(customerId, stripeSubId, {
    attemptCount: invoice.attempt_count,
  });

  const classification = classifyInvoicePaidEvent({
    billingReason: invoice.billing_reason,
    hasPriorChurn: hasChurn,
    wasPastDue,
    mrrAfterCents: snap.mrrCentsExVat,
    mrrBeforeCents: prevMrr,
  });

  if (classification.kind === "none") return;

  if (classification.kind === "payment_recovered") {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: stripeSubId,
      stripeEventId: `${event.id}:payment_recovered`,
      type: "payment_recovered",
      effectiveAt,
      source: "webhook",
    });
    return;
  }

  if (classification.kind === "new" || classification.kind === "reactivation") {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: stripeSubId,
      stripeEventId: event.id,
      type: classification.kind,
      effectiveAt,
      statusAfter: "active",
      mrrAfterCents: snap.mrrCentsExVat,
      mrrDeltaCents: snap.mrrCentsExVat - prevMrr,
      tierAfter: snap.coreTier,
      source: "webhook",
    });
    return;
  }

  // expansion | contraction
  await insertSubscriptionEvent({
    customerId,
    stripeSubscriptionId: stripeSubId,
    stripeEventId: event.id,
    type: classification.kind,
    effectiveAt,
    statusAfter: "active",
    mrrAfterCents: snap.mrrCentsExVat,
    mrrDeltaCents: snap.mrrCentsExVat - prevMrr,
    tierAfter: snap.coreTier,
    source: "webhook",
  });
}

async function onSubscriptionUpdated(stripe: Stripe, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const prev = (event.data.previous_attributes || {}) as Partial<Stripe.Subscription> & {
    cancel_at_period_end?: boolean;
    pause_collection?: Stripe.Subscription.PauseCollection | null;
    items?: unknown;
    status?: string;
  };

  const stripeCustomerId = stripeCustomerIdFromSub(sub);
  if (!stripeCustomerId) return;
  const customerId =
    await resolveHaycCustomerIdFromStripeCustomer(stripeCustomerId);
  if (!customerId) return;
  await ensureCustomerStripeAccount(customerId, stripeCustomerId);

  const effectiveAt = eventTimestampFromStripe(event);
  if (!(await webhookMayWriteEvent(effectiveAt))) {
    // Still sync local cancel_at_period_end flags for UI even before/without cutover business events
    await syncLocalCancelFlags(sub, prev);
    return;
  }

  const snap = await computeCustomerMrrFromStripe(
    stripe,
    stripeCustomerId,
    `subscription.updated ${event.id}`,
  );
  const prevMrr = await previousMrrAfter(customerId, effectiveAt);

  const cancelScheduled =
    prev.cancel_at_period_end === false && sub.cancel_at_period_end === true;
  const cancelReverted =
    prev.cancel_at_period_end === true && sub.cancel_at_period_end === false;

  if (cancelScheduled) {
    const reasonCode = mapStripePortalFeedbackToReasonCode(
      sub.cancellation_details?.feedback ?? null,
    );
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:cancel_scheduled`,
      type: "cancel_scheduled",
      effectiveAt,
      reasonCode,
      reasonNote: sub.cancellation_details?.comment ?? null,
      source: "webhook",
    });
  }

  if (cancelReverted) {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:cancel_reverted`,
      type: "cancel_reverted",
      effectiveAt,
      source: "webhook",
    });
  }

  await syncLocalCancelFlags(sub, prev);

  if (prev.status && prev.status !== "past_due" && sub.status === "past_due") {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:payment_failed`,
      type: "payment_failed",
      effectiveAt,
      source: "webhook",
    });
  }

  if (prev.status && prev.status !== "unpaid" && sub.status === "unpaid") {
    const preLaunch = await resolvePreLaunchForCustomer(customerId, effectiveAt);
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:churn_unpaid`,
      type: "churn",
      effectiveAt,
      statusAfter: "churned",
      mrrAfterCents: 0,
      mrrDeltaCents: -prevMrr,
      tierAfter: snap.coreTier,
      churnKind: "involuntary",
      reasonCode: "payment_failed",
      preLaunch,
      source: "webhook",
    });
  }

  if (prev.pause_collection === null && sub.pause_collection) {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:pause`,
      type: "pause",
      effectiveAt,
      statusAfter: "paused",
      mrrAfterCents: 0,
      mrrDeltaCents: -prevMrr,
      tierAfter: snap.coreTier,
      source: "webhook",
    });
  }
  if (prev.pause_collection && !sub.pause_collection) {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: `${event.id}:resume`,
      type: "resume",
      effectiveAt,
      statusAfter: "active",
      mrrAfterCents: snap.mrrCentsExVat,
      mrrDeltaCents: snap.mrrCentsExVat,
      tierAfter: snap.coreTier,
      source: "webhook",
    });
  }

  if (prev.items != null || (prev as any).plan != null) {
    if (snap.mrrCentsExVat !== prevMrr && !cancelScheduled && !cancelReverted) {
      await insertSubscriptionEvent({
        customerId,
        stripeSubscriptionId: sub.id,
        stripeEventId: `${event.id}:mrr`,
        type: snap.mrrCentsExVat > prevMrr ? "expansion" : "contraction",
        effectiveAt,
        statusAfter: "active",
        mrrAfterCents: snap.mrrCentsExVat,
        mrrDeltaCents: snap.mrrCentsExVat - prevMrr,
        tierAfter: snap.coreTier,
        source: "webhook",
      });
    }
  }
}

async function syncLocalCancelFlags(
  sub: Stripe.Subscription,
  prev: { cancel_at_period_end?: boolean },
) {
  if (prev.cancel_at_period_end === false && sub.cancel_at_period_end === true) {
    await db
      .update(subscriptionsTable)
      .set({
        cancelAtPeriodEnd: true,
        accessUntil: new Date(sub.current_period_end * 1000),
        cancellationReason: "User requested cancellation",
      })
      .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
  }
  if (prev.cancel_at_period_end === true && sub.cancel_at_period_end === false) {
    await db
      .update(subscriptionsTable)
      .set({
        cancelAtPeriodEnd: false,
        cancellationReason: null,
      })
      .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
  }
}

async function onSubscriptionDeleted(stripe: Stripe, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const stripeCustomerId = stripeCustomerIdFromSub(sub);
  if (!stripeCustomerId) return;
  const customerId =
    await resolveHaycCustomerIdFromStripeCustomer(stripeCustomerId);
  if (!customerId) return;
  await ensureCustomerStripeAccount(customerId, stripeCustomerId);

  const effectiveAt = sub.ended_at
    ? new Date(sub.ended_at * 1000)
    : sub.canceled_at
      ? new Date(sub.canceled_at * 1000)
      : eventTimestampFromStripe(event);

  // Local subscription row sync (access ended) — always, independent of cutover business events
  await db
    .update(subscriptionsTable)
    .set({ cancelAtPeriodEnd: false })
    .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));

  if (!(await webhookMayWriteEvent(effectiveAt))) {
    return;
  }

  const snap = await computeCustomerMrrFromStripe(
    stripe,
    stripeCustomerId,
    `subscription.deleted ${event.id}`,
  );
  const prevMrr = await previousMrrAfter(customerId, effectiveAt);
  const stillHasCore = snap.activeCoreSubscriptionIds.length > 0;

  if (stillHasCore) {
    await insertSubscriptionEvent({
      customerId,
      stripeSubscriptionId: sub.id,
      stripeEventId: event.id,
      type: "contraction",
      effectiveAt,
      statusAfter: "active",
      mrrAfterCents: snap.mrrCentsExVat,
      mrrDeltaCents: snap.mrrCentsExVat - prevMrr,
      tierAfter: snap.coreTier,
      source: "webhook",
    });
    return;
  }

  const cancelReason = sub.cancellation_details?.reason;
  const involuntary =
    cancelReason === "payment_failed" ||
    (await wasPastDueForSubscription(customerId, sub.id));

  const scheduled = await latestCancelScheduledReason(customerId, sub.id);
  const reasonCode = involuntary
    ? "payment_failed"
    : scheduled?.reasonCode ||
      mapStripePortalFeedbackToReasonCode(
        sub.cancellation_details?.feedback ?? null,
      );

  const preLaunch = await resolvePreLaunchForCustomer(customerId, effectiveAt);

  await insertSubscriptionEvent({
    customerId,
    stripeSubscriptionId: sub.id,
    stripeEventId: event.id,
    type: "churn",
    effectiveAt,
    statusAfter: "churned",
    mrrAfterCents: 0,
    mrrDeltaCents: -prevMrr,
    tierAfter: snap.coreTier,
    churnKind: involuntary ? "involuntary" : "voluntary",
    reasonCode,
    reasonNote: scheduled?.reasonNote ?? sub.cancellation_details?.comment ?? null,
    preLaunch,
    source: "webhook",
  });
}
