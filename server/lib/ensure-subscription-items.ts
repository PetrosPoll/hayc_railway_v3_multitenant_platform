import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";
import { subscriptions as subscriptionsTable, type Subscription } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";

export type SubscriptionPriceMaps = {
  /** plan slug -> { monthly, yearly } Stripe price ids */
  planPrices: Record<string, { monthly?: string | null; yearly?: string | null }>;
  /** all setup-fee Stripe price ids to skip */
  setupFeePriceIds: string[];
  /** Stripe price id -> addon product id */
  priceToAddon: Record<string, string>;
};

export type EnsureSubscriptionItemsInput = {
  userId: number;
  stripeSubscription: Stripe.Subscription;
  maps: SubscriptionPriceMaps;
  /** Prefer website from an existing row for this Stripe sub when creating missing items. */
  websiteProgressId?: number | null;
  billing?: {
    vatNumber?: string | null;
    city?: string | null;
    street?: string | null;
    number?: string | null;
    postalCode?: string | null;
    invoiceType?: string | null;
  };
  createdAt?: Date;
};

export type EnsureSubscriptionItemsResult = {
  rows: Subscription[];
  created: number;
  updated: number;
  skipped: Array<{ priceId: string; reason: string }>;
};

type ClassifiedItem =
  | { kind: "skip"; reason: string }
  | {
      kind: "plan" | "addon";
      productId: string;
      billingPeriod: "monthly" | "yearly";
      priceCents: number | null;
      itemId: string;
      priceId: string;
    };

function classifyStripeItem(
  item: Stripe.SubscriptionItem,
  maps: SubscriptionPriceMaps,
): ClassifiedItem {
  const price = item.price;
  const priceId = typeof price === "string" ? price : price?.id;
  if (!priceId) {
    return { kind: "skip", reason: "missing price id" };
  }

  if (maps.setupFeePriceIds.includes(priceId)) {
    return { kind: "skip", reason: "setup fee" };
  }

  const unitAmount =
    typeof price === "string" ? null : (price.unit_amount ?? null);
  const interval =
    typeof price === "string" ? null : price.recurring?.interval ?? null;
  const billingPeriod: "monthly" | "yearly" =
    interval === "year" ? "yearly" : "monthly";

  const addonId = maps.priceToAddon[priceId];
  if (addonId) {
    return {
      kind: "addon",
      productId: addonId,
      billingPeriod,
      priceCents: unitAmount,
      itemId: item.id,
      priceId,
    };
  }

  for (const [planSlug, prices] of Object.entries(maps.planPrices)) {
    if (priceId === prices.monthly || priceId === prices.yearly) {
      return {
        kind: "plan",
        productId: planSlug,
        billingPeriod: priceId === prices.yearly ? "yearly" : "monthly",
        priceCents: unitAmount,
        itemId: item.id,
        priceId,
      };
    }
  }

  // One-time / unknown recurring prices are not local subscription products.
  if (typeof price !== "string" && !price.recurring) {
    return { kind: "skip", reason: "one-time price" };
  }

  return { kind: "skip", reason: `unknown price id ${priceId}` };
}

/**
 * Ensure one local `subscriptions` row per recurring Stripe subscription item.
 * Backfills missing addon/plan rows and fills null item/product ids on legacy plan rows.
 */
export async function ensureSubscriptionItemsFromStripe(
  input: EnsureSubscriptionItemsInput,
): Promise<EnsureSubscriptionItemsResult> {
  const { userId, stripeSubscription, maps, billing, createdAt } = input;
  const skipped: EnsureSubscriptionItemsResult["skipped"] = [];
  let created = 0;
  let updated = 0;

  const existingForSub = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.id));

  let websiteProgressId =
    input.websiteProgressId ??
    existingForSub.find((row) => row.websiteProgressId != null)?.websiteProgressId ??
    null;

  const resultRows: Subscription[] = [];

  for (const item of stripeSubscription.items.data) {
    const classified = classifyStripeItem(item, maps);
    if (classified.kind === "skip") {
      skipped.push({
        priceId:
          typeof item.price === "string" ? item.price : item.price?.id || "",
        reason: classified.reason,
      });
      continue;
    }

    const byItemId = existingForSub.find(
      (row) => row.stripeSubscriptionItemId === classified.itemId,
    );

    // Legacy: one plan row for this Stripe sub with null item id.
    const legacyPlanRow =
      classified.kind === "plan"
        ? existingForSub.find(
            (row) =>
              row.productType === "plan" &&
              !row.stripeSubscriptionItemId &&
              row.userId === userId,
          )
        : undefined;

    const existing = byItemId ?? legacyPlanRow;

    if (existing) {
      const [saved] = await db
        .update(subscriptionsTable)
        .set({
          productType: classified.kind,
          productId: classified.productId,
          tier: classified.kind === "plan" ? classified.productId : existing.tier,
          stripeSubscriptionId: stripeSubscription.id,
          stripeSubscriptionItemId: classified.itemId,
          status: stripeSubscription.status,
          price: classified.priceCents ?? existing.price,
          billingPeriod: classified.billingPeriod,
          websiteProgressId: existing.websiteProgressId ?? websiteProgressId,
          ...(billing?.vatNumber !== undefined
            ? { vatNumber: billing.vatNumber || existing.vatNumber }
            : {}),
          ...(billing?.city !== undefined
            ? { city: billing.city || existing.city }
            : {}),
          ...(billing?.street !== undefined
            ? { street: billing.street || existing.street }
            : {}),
          ...(billing?.number !== undefined
            ? { number: billing.number || existing.number }
            : {}),
          ...(billing?.postalCode !== undefined
            ? { postalCode: billing.postalCode || existing.postalCode }
            : {}),
          ...(billing?.invoiceType !== undefined
            ? { invoiceType: billing.invoiceType || existing.invoiceType }
            : {}),
        })
        .where(eq(subscriptionsTable.id, existing.id))
        .returning();

      if (saved) {
        updated += 1;
        resultRows.push(saved);
        if (saved.websiteProgressId) websiteProgressId = saved.websiteProgressId;
        const idx = existingForSub.findIndex((row) => row.id === saved.id);
        if (idx >= 0) existingForSub[idx] = saved;
      }
      continue;
    }

    const saved = await storage.createSubscription({
      userId,
      websiteProgressId,
      productType: classified.kind,
      productId: classified.productId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeSubscriptionItemId: classified.itemId,
      tier: classified.kind === "plan" ? classified.productId : null,
      status: stripeSubscription.status,
      price: classified.priceCents,
      vatNumber: billing?.vatNumber ?? null,
      city: billing?.city ?? null,
      street: billing?.street ?? null,
      number: billing?.number ?? null,
      postalCode: billing?.postalCode ?? null,
      invoiceType: billing?.invoiceType ?? "invoice",
      billingPeriod: classified.billingPeriod,
      createdAt: createdAt ?? new Date(stripeSubscription.created * 1000),
    });

    created += 1;
    resultRows.push(saved);
    existingForSub.push(saved);
  }

  // If we learned a website id mid-pass, attach any still-unlinked rows for this sub.
  if (websiteProgressId != null) {
    await db
      .update(subscriptionsTable)
      .set({ websiteProgressId })
      .where(
        and(
          eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.id),
          eq(subscriptionsTable.userId, userId),
          isNull(subscriptionsTable.websiteProgressId),
        ),
      );
  }

  const fresh = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.id));

  return {
    rows: fresh.length ? fresh : resultRows,
    created,
    updated,
    skipped,
  };
}
