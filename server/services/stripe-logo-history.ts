/**
 * Build customer logo-churn / MRR transitions from Stripe subscription history.
 * Logo active = ≥1 core (mapped) subscription covering the instant.
 */
import type Stripe from "stripe";
import { lookupPriceMap } from "./stripe-price-map";
import { unitAmountExVatCents } from "./customer-mrr";
import {
  buildLogoTransitions,
  type LogoTransition,
  type SubInterval,
} from "./stripe-logo-timeline";

export { buildLogoTransitions };
export type { LogoTransition, SubInterval };

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
      return 52 / 12 / count;
    case "day":
      return 365 / 12 / count;
    default:
      return null;
  }
}

export async function analyzeStripeSubscription(
  sub: Stripe.Subscription,
): Promise<{
  mrrCents: number;
  hasCore: boolean;
  tier: string | null;
  unknownPriceIds: string[];
  usedVatFallback: boolean;
}> {
  let mrrCents = 0;
  let hasCore = false;
  let tier: string | null = null;
  const unknownPriceIds: string[] = [];
  let usedVatFallback = false;

  for (const item of sub.items.data) {
    const price = typeof item.price === "string" ? null : item.price;
    if (!price?.id || !price.recurring) continue;

    const mapped = await lookupPriceMap(price.id);
    if (!mapped) {
      unknownPriceIds.push(price.id);
      continue;
    }
    if (mapped.kind === "setup") continue;

    const factor = intervalToMonthlyFactor(
      price.recurring.interval,
      price.recurring.interval_count,
    );
    if (factor == null) continue;

    let percentOff: number | null = null;
    const discount = (sub as { discount?: { coupon?: { percent_off?: number } } })
      .discount;
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
    mrrCents += Math.round(cents * factor);

    if (mapped.kind === "core") {
      hasCore = true;
      if (mapped.tier) tier = mapped.tier;
    }
  }

  return { mrrCents, hasCore, tier, unknownPriceIds, usedVatFallback };
}

export function subscriptionCoverage(sub: Stripe.Subscription): {
  startMs: number;
  endMs: number | null;
  skip: boolean;
} {
  const startMs = (sub.start_date ?? sub.created) * 1000;
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  if (live) {
    return { startMs, endMs: null, skip: false };
  }
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") {
    if (!sub.canceled_at && !sub.ended_at) {
      return { startMs, endMs: null, skip: true };
    }
  }
  const endSec = sub.ended_at ?? sub.canceled_at ?? sub.cancel_at;
  if (endSec == null) {
    return { startMs, endMs: null, skip: true };
  }
  const endMs = endSec * 1000;
  if (endMs <= startMs) {
    return { startMs, endMs, skip: true };
  }
  return { startMs, endMs, skip: false };
}

export async function intervalsFromStripeSubscriptions(
  subs: Stripe.Subscription[],
): Promise<{
  intervals: SubInterval[];
  unknownPriceIds: string[];
  usedVatFallback: boolean;
}> {
  const intervals: SubInterval[] = [];
  const unknownPriceIds: string[] = [];
  let usedVatFallback = false;

  for (const sub of subs) {
    const cover = subscriptionCoverage(sub);
    if (cover.skip) continue;

    const analyzed = await analyzeStripeSubscription(sub);
    unknownPriceIds.push(...analyzed.unknownPriceIds);
    if (analyzed.usedVatFallback) usedVatFallback = true;

    if (!analyzed.hasCore && analyzed.mrrCents === 0) continue;

    intervals.push({
      startMs: cover.startMs,
      endMs: cover.endMs,
      mrrCents: analyzed.mrrCents,
      tier: analyzed.tier,
      hasCore: analyzed.hasCore,
      subId: sub.id,
    });
  }

  return {
    intervals,
    unknownPriceIds: [...new Set(unknownPriceIds)],
    usedVatFallback,
  };
}
