import type Stripe from "stripe";

export function cancelledAtFromStripe(
  stripeSub?: Pick<Stripe.Subscription, "canceled_at"> | null,
): Date {
  if (stripeSub?.canceled_at) {
    return new Date(stripeSub.canceled_at * 1000);
  }
  return new Date();
}

export function accessUntilFromStripePeriodEnd(
  stripeSub?: Pick<Stripe.Subscription, "current_period_end"> | null,
): Date | null {
  if (stripeSub?.current_period_end) {
    return new Date(stripeSub.current_period_end * 1000);
  }
  return null;
}

export function isStripeSubscriptionCancelled(status: string | undefined | null): boolean {
  const normalized = (status || "").toLowerCase();
  return normalized === "cancelled" || normalized === "canceled";
}

export function normalizedSubscriptionStatus(stripeStatus: string): string {
  return stripeStatus === "canceled" ? "cancelled" : stripeStatus;
}

export function stripeCancellationUpdate(
  stripeSub: Stripe.Subscription,
  options: {
    cancellationReason: string;
    accessUntil?: Date | null;
    cancelledAt?: Date;
  },
) {
  return {
    status: "cancelled" as const,
    cancellationReason: options.cancellationReason,
    accessUntil:
      options.accessUntil ?? accessUntilFromStripePeriodEnd(stripeSub),
    cancelledAt: options.cancelledAt ?? cancelledAtFromStripe(stripeSub),
  };
}

export function addonItemCancellationUpdate(
  accessUntil: Date,
  cancellationReason = "User requested cancellation",
) {
  return {
    status: "cancelled" as const,
    cancellationReason,
    accessUntil,
    cancelledAt: new Date(),
  };
}

export function stripeImportCancellationFields(stripeSub: Stripe.Subscription) {
  if (!isStripeSubscriptionCancelled(stripeSub.status)) {
    return {};
  }

  return {
    cancelledAt: cancelledAtFromStripe(stripeSub),
    accessUntil: accessUntilFromStripePeriodEnd(stripeSub),
  };
}

/**
 * Map Stripe subscription.cancellation_details.reason to a local cancellationReason.
 * Returns null when Stripe did not provide a reason.
 */
export function cancellationReasonFromStripe(
  stripeSub: Pick<Stripe.Subscription, "cancellation_details">,
): string | null {
  const reason = stripeSub.cancellation_details?.reason;
  if (!reason) return null;
  if (reason === "payment_failed") return "payment_failed";
  if (reason === "payment_disputed") return "payment_disputed";
  if (reason === "cancellation_requested") return "cancellation_requested";
  return reason;
}

export function formatPaymentFailedReason(detail?: string | null): string {
  const trimmed = detail?.trim();
  if (!trimmed) return "payment_failed";
  return `payment_failed (${trimmed})`;
}

/**
 * Best-effort decline/failure detail from recent invoices on a cancelled subscription.
 */
export async function paymentFailureDetailFromStripe(
  stripe: Stripe,
  stripeSubscriptionId: string,
): Promise<string | null> {
  try {
    const invoices = await stripe.invoices.list({
      subscription: stripeSubscriptionId,
      limit: 5,
    });

    for (const invoice of invoices.data) {
      const piRef = invoice.payment_intent;
      if (piRef) {
        const piId = typeof piRef === "string" ? piRef : piRef.id;
        const pi =
          typeof piRef === "string"
            ? await stripe.paymentIntents.retrieve(piId)
            : piRef;
        const err = pi.last_payment_error;
        const detail =
          err?.decline_code || err?.code || err?.message || null;
        if (detail) return detail;
      }

      const chargeRef = invoice.charge;
      if (chargeRef) {
        const chargeId = typeof chargeRef === "string" ? chargeRef : chargeRef.id;
        const charge =
          typeof chargeRef === "string"
            ? await stripe.charges.retrieve(chargeId)
            : chargeRef;
        const detail =
          charge.failure_code ||
          charge.outcome?.reason ||
          charge.failure_message ||
          null;
        if (detail) return detail;
      }
    }
  } catch (err) {
    console.warn(
      "Could not resolve payment failure detail from Stripe invoices:",
      err,
    );
  }
  return null;
}

export async function resolveStripeCancellationReason(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
): Promise<string | null> {
  const base = cancellationReasonFromStripe(stripeSub);
  if (base !== "payment_failed") return base;

  const detail = await paymentFailureDetailFromStripe(stripe, stripeSub.id);
  return formatPaymentFailedReason(detail);
}
