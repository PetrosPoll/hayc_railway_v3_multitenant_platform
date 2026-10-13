import type Stripe from "stripe";
import {
  syncObligationFromStripeInvoice,
  handleSubscriptionUpdatedForCalendar,
  handleChargeRefundedForCalendar,
  handleDisputeForCalendar,
  syncObligationFromStripeSubscription,
  shouldSendFailedEmail,
} from "./billing-calendar-sync";
import { failureReasonFromCharge } from "./billing-calendar-matching";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { subscriptions as subscriptionsTable } from "@shared/schema";

const HANDLED = new Set([
  "invoice.created",
  "invoice.finalized",
  "invoice.payment_succeeded",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.marked_uncollectible",
  "invoice.voided",
  /** Failed payment attempt — calendar overdue/retrying (not auto-cancel). */
  "charge.failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "subscription_schedule.created",
  "subscription_schedule.updated",
  "subscription_schedule.released",
  "subscription_schedule.canceled",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
]);

export function isCalendarStripeEvent(type: string): boolean {
  return HANDLED.has(type);
}

export async function handleCalendarStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  if (!HANDLED.has(event.type)) return;

  const source = "webhook" as const;
  const stripeEventId = event.id;

  switch (event.type) {
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.payment_succeeded":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
    case "invoice.marked_uncollectible":
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      await syncObligationFromStripeInvoice(stripe, invoice, {
        source,
        stripeEventId,
        eventType: event.type === "invoice.paid" ? "invoice.payment_succeeded" : event.type,
      });
      break;
    }
    case "charge.failed": {
      // Payment attempt failed → overdue/retrying on calendar for that invoice/day.
      // (invoice.marked_uncollectible / subscription.deleted = give up / cancel — separate.)
      const charge = event.data.object as Stripe.Charge;
      const invoiceId =
        typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
      if (!invoiceId) {
        console.warn(
          "[billing-calendar] charge.failed without invoice, skip calendar:",
          charge.id,
        );
        break;
      }
      const failureReason = failureReasonFromCharge(charge);
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ["lines.data"],
      });
      await syncObligationFromStripeInvoice(stripe, invoice, {
        source,
        stripeEventId,
        eventType: "invoice.payment_failed",
        failureReason,
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const sub = event.data.object as Stripe.Subscription;
      const locals = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
      for (const local of locals) {
        await syncObligationFromStripeSubscription(stripe, local, {
          source,
          stripeEventId,
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const prev = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined;
      await handleSubscriptionUpdatedForCalendar(stripe, sub, prev, {
        source,
        stripeEventId,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const locals = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
      for (const local of locals) {
        await syncObligationFromStripeSubscription(stripe, local, {
          source,
          stripeEventId,
        });
      }
      break;
    }
    case "subscription_schedule.created":
    case "subscription_schedule.updated":
    case "subscription_schedule.released":
    case "subscription_schedule.canceled": {
      const schedule = event.data.object as Stripe.SubscriptionSchedule;
      const locals = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.stripeSubscriptionId, schedule.id));
      for (const local of locals) {
        await syncObligationFromStripeSubscription(stripe, local, {
          source,
          stripeEventId,
        });
      }
      break;
    }
    case "charge.refunded": {
      await handleChargeRefundedForCalendar(event.data.object as Stripe.Charge, {
        source,
        stripeEventId,
      });
      break;
    }
    case "charge.dispute.created": {
      await handleDisputeForCalendar(event.data.object as Stripe.Dispute, false, {
        source,
        stripeEventId,
      });
      break;
    }
    case "charge.dispute.closed": {
      await handleDisputeForCalendar(event.data.object as Stripe.Dispute, true, {
        source,
        stripeEventId,
      });
      break;
    }
    default:
      break;
  }
}

export { shouldSendFailedEmail };
