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
