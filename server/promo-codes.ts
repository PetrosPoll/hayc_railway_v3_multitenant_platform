import Stripe from "stripe";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  ambassadors,
  getSubscriptionPlansWithPriceIds,
  promoCodes,
  promoRedemptions,
  subscriptions as subscriptionsTable,
  transactions as transactionsTable,
  type PromoCode,
  type SubscriptionTier,
} from "@shared/schema";

const PLAN_TIERS: SubscriptionTier[] = ["basic", "essential", "pro"];

/** Stripe product IDs for hosting plans only (excludes setup fee, add-ons, speed-up). */
export async function getPlanStripeProductIds(stripe: Stripe): Promise<string[]> {
  const plans = getSubscriptionPlansWithPriceIds();
  const productIds = new Set<string>();

  await Promise.all(
    PLAN_TIERS.map(async (tier) => {
      const priceId = plans[tier].priceId.monthly;
      if (!priceId) return;
      const price = await stripe.prices.retrieve(priceId);
      const productId =
        typeof price.product === "string" ? price.product : price.product.id;
      productIds.add(productId);
    }),
  );

  if (productIds.size === 0) {
    throw new Error("Could not resolve Stripe plan product IDs for promo coupons");
  }

  return [...productIds];
}

export type ResolvedPromoCode = PromoCode & {
  ambassadorName: string | null;
};

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function resolveActivePromoCode(
  stripe: Stripe,
  rawCode: string,
): Promise<ResolvedPromoCode | null> {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;

  const rows = await db
    .select({
      promo: promoCodes,
      ambassadorName: ambassadors.name,
      ambassadorActive: ambassadors.active,
    })
    .from(promoCodes)
    .innerJoin(ambassadors, eq(promoCodes.ambassadorId, ambassadors.id))
    .where(eq(promoCodes.code, code))
    .limit(1);

  const row = rows[0];
  if (!row || !row.promo.active || !row.ambassadorActive) {
    return null;
  }

  if (row.promo.maxRedemptions != null) {
    const [redemptionCount] = await db
      .select({ value: count() })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.promoCodeId, row.promo.id));
    if (Number(redemptionCount?.value ?? 0) >= row.promo.maxRedemptions) {
      return null;
    }
  }

  try {
    const stripePromo = await stripe.promotionCodes.retrieve(
      row.promo.stripePromotionCodeId,
    );
    if (!stripePromo.active) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    ...row.promo,
    ambassadorName: row.ambassadorName,
  };
}

export function discountSummary(promo: PromoCode) {
  if (promo.discountType === "percent" && promo.percentOff != null) {
    return {
      discountType: "percent" as const,
      discountValue: promo.percentOff,
      label: `${promo.percentOff}% off plan`,
    };
  }
  if (promo.discountType === "fixed" && promo.amountOff != null) {
    const euros = promo.amountOff / 100;
    return {
      discountType: "fixed" as const,
      discountValue: euros,
      label: `${euros}€ off plan`,
    };
  }
  return {
    discountType: promo.discountType as "percent" | "fixed",
    discountValue: 0,
    label: "Discount",
  };
}

export async function applyPromoToCheckoutSession(
  sessionConfig: Stripe.Checkout.SessionCreateParams,
  promo: ResolvedPromoCode,
): Promise<void> {
  sessionConfig.discounts = [{ promotion_code: promo.stripePromotionCodeId }];
  sessionConfig.metadata = {
    ...(sessionConfig.metadata || {}),
    promoCodeId: String(promo.id),
    promoCode: promo.code,
    ambassadorId: String(promo.ambassadorId),
    stripePromotionCodeId: promo.stripePromotionCodeId,
  };
}

export type CheckoutEmailPricing = {
  currency: string;
  amount: string;
  baseAmount: string;
  baseAmountOriginal: string;
  planDiscountAmount: string;
  hasPlanPromo: boolean;
  promoCode: string;
  setupFee: string;
  hasSetupFee: boolean;
  addOns: Array<{ name: string; price: number }>;
};

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function getPromoCodeForSessionMetadata(
  session: Stripe.Checkout.Session,
): Promise<PromoCode | null> {
  const idStr = session.metadata?.promoCodeId;
  if (!idStr) return null;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return null;
  const [row] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);
  return row ?? null;
}

/** Build subscription-purchased email amounts from Stripe checkout (not local catalog prices). */
export function buildCheckoutEmailPricing(input: {
  session: Stripe.Checkout.Session;
  lineItems: Stripe.LineItem[];
  planMonthlyPriceId: string;
  planYearlyPriceId: string;
  setupFeePriceId: string;
  speedDevPriceId?: string;
  priceToAddonMap: Record<string, string>;
  resolveAddonName: (addonId: string) => string;
  planListFallbackCents?: number;
  promoFromDb?: Pick<PromoCode, "discountType" | "percentOff" | "amountOff"> | null;
}): CheckoutEmailPricing {
  const planPriceIds = [input.planMonthlyPriceId, input.planYearlyPriceId].filter(
    Boolean,
  );
  const currency = (input.session.currency ?? "eur").toUpperCase();
  const paidTotalCents = input.session.amount_total ?? 0;
  const sessionDiscountCents = input.session.total_details?.amount_discount ?? 0;
  const promoCode = input.session.metadata?.promoCode?.trim() ?? "";

  const planLineItem = input.lineItems.find(
    (item) => item.price?.id && planPriceIds.includes(item.price.id),
  );

  const planListCents =
    planLineItem?.amount_subtotal ??
    planLineItem?.price?.unit_amount ??
    input.planListFallbackCents ??
    0;

  let planDiscountCents = 0;
  if (planLineItem?.discount_amounts?.length) {
    planDiscountCents = planLineItem.discount_amounts.reduce(
      (sum, d) => sum + d.amount,
      0,
    );
  } else {
    planDiscountCents = Math.max(
      0,
      (planLineItem?.amount_subtotal ?? 0) - (planLineItem?.amount_total ?? 0),
    );
  }

  // Plan-only coupons often appear only on session.total_details, not line item totals
  if (planDiscountCents === 0 && sessionDiscountCents > 0) {
    planDiscountCents = sessionDiscountCents;
  }

  const setupFeeLineItem = input.lineItems.find(
    (item) => item.price?.id === input.setupFeePriceId,
  );
  const setupFeeInCents = setupFeeLineItem?.amount_total ?? 0;

  const addOns: Array<{ name: string; price: number }> = [];
  let nonPlanPaidCents = setupFeeInCents;
  for (const item of input.lineItems) {
    const priceId = item.price?.id;
    if (!priceId || planPriceIds.includes(priceId)) continue;
    if (priceId === input.setupFeePriceId) continue;
    if (input.speedDevPriceId && priceId === input.speedDevPriceId) {
      nonPlanPaidCents += item.amount_total ?? 0;
      continue;
    }
    const addonId = input.priceToAddonMap[priceId];
    if (addonId) {
      const addonPaidCents = item.amount_total ?? 0;
      nonPlanPaidCents += addonPaidCents;
      addOns.push({
        name: input.resolveAddonName(addonId),
        price: addonPaidCents / 100,
      });
    }
  }

  // Derive plan discount from what Stripe actually charged (most reliable for subscription checkout)
  if (paidTotalCents > 0 && planListCents > 0) {
    const planPaidFromTotalCents = Math.max(0, paidTotalCents - nonPlanPaidCents);
    const discountFromTotalCents = Math.max(0, planListCents - planPaidFromTotalCents);
    if (discountFromTotalCents > planDiscountCents) {
      planDiscountCents = discountFromTotalCents;
    }
  }

  // Last resort: compute from our promo record when metadata says promo was used
  if (planDiscountCents === 0 && input.promoFromDb && planListCents > 0) {
    if (
      input.promoFromDb.discountType === "percent" &&
      input.promoFromDb.percentOff != null
    ) {
      planDiscountCents = Math.round(
        (planListCents * input.promoFromDb.percentOff) / 100,
      );
    } else if (
      input.promoFromDb.discountType === "fixed" &&
      input.promoFromDb.amountOff != null
    ) {
      planDiscountCents = Math.min(planListCents, input.promoFromDb.amountOff);
    }
  }

  const planPaidCents = Math.max(0, planListCents - planDiscountCents);

  const hasPromoMeta = !!(
    promoCode ||
    input.session.metadata?.promoCodeId ||
    input.session.metadata?.stripePromotionCodeId
  );
  const hasPlanPromo =
    hasPromoMeta || planDiscountCents > 0 || sessionDiscountCents > 0;

  return {
    currency,
    amount: formatCents(paidTotalCents),
    baseAmount: formatCents(planPaidCents),
    baseAmountOriginal: formatCents(planListCents),
    planDiscountAmount: formatCents(planDiscountCents),
    hasPlanPromo,
    promoCode,
    setupFee: formatCents(setupFeeInCents),
    hasSetupFee: setupFeeInCents > 0,
    addOns,
  };
}

export async function recordPromoRedemption(params: {
  promoCodeId: number;
  ambassadorId: number;
  userId: number;
  subscriptionId: number | null;
  checkoutSessionId: string;
  stripePromotionCodeId: string | null;
  codeSnapshot: string;
}): Promise<void> {
  try {
    await db.insert(promoRedemptions).values({
      promoCodeId: params.promoCodeId,
      ambassadorId: params.ambassadorId,
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      checkoutSessionId: params.checkoutSessionId,
      stripePromotionCodeId: params.stripePromotionCodeId,
      codeSnapshot: params.codeSnapshot,
    });
  } catch (err: any) {
    const isDuplicate =
      err?.cause?.code === "23505" ||
      err?.message?.includes("duplicate key") ||
      err?.message?.includes("promo_redemptions_checkout_session_unique");
    if (isDuplicate) {
      console.log(
        "ℹ️ Promo redemption already recorded for checkout session:",
        params.checkoutSessionId,
      );
      return;
    }
    throw err;
  }
}

export async function createAmbassadorPromoCode(
  stripe: Stripe,
  input: {
    ambassadorId: number;
    code: string;
    percentOff?: number;
    amountOff?: number;
    duration?: "once" | "repeating" | "forever";
    durationInMonths?: number;
    maxRedemptions?: number | null;
  },
): Promise<PromoCode> {
  const code = normalizePromoCode(input.code);
  if (!code || code.length < 3) {
    throw new Error("Promo code must be at least 3 characters");
  }
  if (!input.percentOff && !input.amountOff) {
    throw new Error("Either percentOff or amountOff is required");
  }
  if (input.percentOff && input.amountOff) {
    throw new Error("Provide percentOff or amountOff, not both");
  }

  const [ambassador] = await db
    .select()
    .from(ambassadors)
    .where(eq(ambassadors.id, input.ambassadorId))
    .limit(1);
  if (!ambassador) {
    throw new Error("Ambassador not found");
  }

  const duration = input.duration ?? "once";
  const planProductIds = await getPlanStripeProductIds(stripe);
  const couponParams: Stripe.CouponCreateParams = {
    name: `${ambassador.name} — ${code}`,
    duration,
    applies_to: { products: planProductIds },
    metadata: {
      ambassadorId: String(ambassador.id),
      promoCode: code,
    },
  };

  if (duration === "repeating") {
    if (!input.durationInMonths || input.durationInMonths < 1) {
      throw new Error("durationInMonths is required for repeating coupons");
    }
    couponParams.duration_in_months = input.durationInMonths;
  }

  let discountType: "percent" | "fixed";
  if (input.percentOff != null) {
    discountType = "percent";
    couponParams.percent_off = input.percentOff;
  } else {
    discountType = "fixed";
    couponParams.amount_off = input.amountOff!;
    couponParams.currency = "eur";
  }

  const coupon = await stripe.coupons.create(couponParams);

  try {
    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      active: true,
      max_redemptions: input.maxRedemptions ?? undefined,
      metadata: {
        ambassadorId: String(ambassador.id),
        promoCode: code,
      },
    });

    const [created] = await db
      .insert(promoCodes)
      .values({
        ambassadorId: ambassador.id,
        code,
        stripeCouponId: coupon.id,
        stripePromotionCodeId: promotionCode.id,
        discountType,
        percentOff: input.percentOff ?? null,
        amountOff: input.amountOff ?? null,
        currency: "eur",
        duration,
        durationInMonths: duration === "repeating" ? input.durationInMonths ?? null : null,
        maxRedemptions: input.maxRedemptions ?? null,
        active: true,
      })
      .returning();

    return created;
  } catch (err) {
    try {
      await stripe.coupons.del(coupon.id);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

export async function getPromoAttributionStats(opts: {
  ambassadorId?: number;
  promoCodeId?: number;
  from?: Date;
  to?: Date;
}) {
  const redemptionConditions = [];
  if (opts.ambassadorId != null) {
    redemptionConditions.push(eq(promoRedemptions.ambassadorId, opts.ambassadorId));
  }
  if (opts.promoCodeId != null) {
    redemptionConditions.push(eq(promoRedemptions.promoCodeId, opts.promoCodeId));
  }
  if (opts.from) {
    redemptionConditions.push(gte(promoRedemptions.redeemedAt, opts.from));
  }
  if (opts.to) {
    redemptionConditions.push(lte(promoRedemptions.redeemedAt, opts.to));
  }

  const redemptionWhere =
    redemptionConditions.length > 0 ? and(...redemptionConditions) : undefined;

  const [signupStats] = await db
    .select({
      redemptions: count(),
      uniqueUsers: sql<number>`count(distinct ${promoRedemptions.userId})`,
    })
    .from(promoRedemptions)
    .where(redemptionWhere);

  // Cohort for revenue: everyone attributed to this promo/ambassador (optionally up to `to`)
  const cohortConditions = [];
  if (opts.ambassadorId != null) {
    cohortConditions.push(eq(promoRedemptions.ambassadorId, opts.ambassadorId));
  }
  if (opts.promoCodeId != null) {
    cohortConditions.push(eq(promoRedemptions.promoCodeId, opts.promoCodeId));
  }
  if (opts.to) {
    cohortConditions.push(lte(promoRedemptions.redeemedAt, opts.to));
  }
  const cohortWhere =
    cohortConditions.length > 0 ? and(...cohortConditions) : undefined;

  const attributedUsers = await db
    .selectDistinct({ userId: promoRedemptions.userId })
    .from(promoRedemptions)
    .where(cohortWhere);

  const userIds = attributedUsers.map((u) => u.userId);
  let revenueCents = 0;
  let transactionCount = 0;

  if (userIds.length > 0) {
    const txConditions = [
      inArray(subscriptionsTable.userId, userIds),
      eq(transactionsTable.status, "paid"),
    ];
    if (opts.from) {
      txConditions.push(gte(transactionsTable.paidAt, opts.from));
    }
    if (opts.to) {
      txConditions.push(lte(transactionsTable.paidAt, opts.to));
    }

    const [revenueStats] = await db
      .select({
        total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)`,
        txCount: count(),
      })
      .from(transactionsTable)
      .innerJoin(
        subscriptionsTable,
        eq(transactionsTable.subscriptionId, subscriptionsTable.id),
      )
      .where(and(...txConditions));

    revenueCents = Number(revenueStats?.total ?? 0);
    transactionCount = Number(revenueStats?.txCount ?? 0);
  }

  return {
    redemptions: Number(signupStats?.redemptions ?? 0),
    uniqueUsers: Number(signupStats?.uniqueUsers ?? 0),
    revenueCents,
    revenueEuros: revenueCents / 100,
    transactionCount,
  };
}
