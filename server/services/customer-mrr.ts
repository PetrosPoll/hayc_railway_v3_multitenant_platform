import type Stripe from "stripe";
import { lookupPriceMap, warnUnknownPrice } from "./stripe-price-map";

export type CustomerMrrSnapshot = {
  mrrCentsExVat: number;
  coreTier: string | null;
  activeCoreSubscriptionIds: string[];
  unknownPriceIds: string[];
  usedVatFallback: boolean;
};

function intervalToMonthlyFactor(
  interval: Stripe.Price.Recurring.Interval | undefined,
  intervalCount: number | undefined,
): number | null {
  if (!interval) return null;
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case "month":
      return 1 / count;
    case "year":
      return 1 / (12 * count);
    case "week":
      return (52 / 12) / count;
    case "day":
      return (365 / 12) / count;
    default:
      return null;
  }
}

/**
 * Net recurring unit amount in cents excluding VAT, after percent/amount discounts on the item when available.
 * Prefer price unit_amount with tax_behavior exclusive; if inclusive, divide by 1.24 and flag fallback.
 */
export function unitAmountExVatCents(
  price: Stripe.Price,
  quantity: number,
  discountPercentOff?: number | null,
  discountAmountOff?: number | null,
): { cents: number; usedVatFallback: boolean } {
  let unit = price.unit_amount ?? 0;
  let usedVatFallback = false;

  if (price.tax_behavior === "inclusive" && unit > 0) {
    unit = Math.round(unit / 1.24);
    usedVatFallback = true;
  }

  let line = unit * Math.max(quantity, 1);
  if (discountPercentOff && discountPercentOff > 0) {
    line = Math.round(line * (1 - discountPercentOff / 100));
  }
  if (discountAmountOff && discountAmountOff > 0) {
    line = Math.max(0, line - discountAmountOff);
  }
  return { cents: line, usedVatFallback };
}

/**
 * Recompute customer-level MRR from all current Stripe subscriptions (core + addons).
 * Setup / one-time prices contribute 0. Unknown price ids are logged and skipped for MRR.
 */
export async function computeCustomerMrrFromStripe(
  stripe: Stripe,
  stripeCustomerId: string,
  context: string,
): Promise<CustomerMrrSnapshot> {
  const unknownPriceIds: string[] = [];
  let mrrCentsExVat = 0;
  let usedVatFallback = false;
  const activeCoreSubscriptionIds: string[] = [];
  let coreTier: string | null = null;

  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  });

  for (const sub of subs.data) {
    if (!["active", "trialing", "past_due"].includes(sub.status)) {
      // paused via pause_collection still "active" in Stripe usually
      if (sub.status !== "active") continue;
    }
    if (sub.pause_collection) continue;

    let subHasCore = false;

    for (const item of sub.items.data) {
      const price =
        typeof item.price === "string"
          ? await stripe.prices.retrieve(item.price)
          : item.price;
      if (!price?.id) continue;
      if (!price.recurring) continue; // one-time / setup

      const factor = intervalToMonthlyFactor(
        price.recurring.interval,
        price.recurring.interval_count,
      );
      if (factor == null) continue;

      // Coupon on subscription: apply percent_off if present (best-effort)
      let percentOff: number | null = null;
      const discount = (sub as any).discount;
      if (discount?.coupon?.percent_off) {
        percentOff = discount.coupon.percent_off;
      }

      const { cents, usedVatFallback: fb } = unitAmountExVatCents(
        price,
        item.quantity ?? 1,
        percentOff,
        null,
      );
      if (fb) usedVatFallback = true;
      const monthlyCents = Math.round(cents * factor);

      const mapped = await lookupPriceMap(price.id);
      if (!mapped) {
        unknownPriceIds.push(price.id);
        warnUnknownPrice(price.id, context);
        // Legacy / retired prices: ≥ €20/mo ≈ core plan; below ≈ add-on.
        if (monthlyCents >= 2000) {
          mrrCentsExVat += monthlyCents;
          subHasCore = true;
        } else if (monthlyCents > 0) {
          mrrCentsExVat += monthlyCents;
        }
        continue;
      }
      if (mapped.kind === "setup") continue;

      mrrCentsExVat += monthlyCents;

      if (mapped.kind === "core") {
        subHasCore = true;
        if (!coreTier && mapped.tier) coreTier = mapped.tier;
      }
    }

    if (subHasCore) {
      activeCoreSubscriptionIds.push(sub.id);
    }
  }

  return {
    mrrCentsExVat,
    coreTier,
    activeCoreSubscriptionIds,
    unknownPriceIds: Array.from(new Set(unknownPriceIds)),
    usedVatFallback,
  };
}

export function stripeCustomerIdFromSub(
  sub: Stripe.Subscription,
): string | null {
  if (typeof sub.customer === "string") return sub.customer;
  if (sub.customer && !("deleted" in sub.customer && sub.customer.deleted)) {
    return sub.customer.id;
  }
  return null;
}
