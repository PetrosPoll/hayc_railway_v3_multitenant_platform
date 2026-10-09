import { eq } from "drizzle-orm";
import { db } from "../db";
import { stripePriceMap, getSubscriptionPlansWithPriceIds, availableAddOns } from "@shared/schema";

export type PriceKind = "core" | "addon" | "setup";

export type PriceMapEntry = {
  stripePriceId: string;
  kind: PriceKind;
  tier: string | null;
};

/** Build seed rows from current env price IDs (no Stripe API writes). */
export function buildPriceMapSeedFromEnv(): PriceMapEntry[] {
  const plans = getSubscriptionPlansWithPriceIds();
  const rows: PriceMapEntry[] = [];

  for (const tier of ["basic", "essential", "pro"] as const) {
    const plan = plans[tier];
    if (plan.priceId.monthly) {
      rows.push({ stripePriceId: plan.priceId.monthly, kind: "core", tier });
    }
    if (plan.priceId.yearly) {
      rows.push({ stripePriceId: plan.priceId.yearly, kind: "core", tier });
    }
    if (plan.setupFeeId) {
      rows.push({
        stripePriceId: plan.setupFeeId,
        kind: "setup",
        tier: "setup_fee",
      });
    }
  }

  const addonEnv: Array<[string, string | undefined]> = [
    ["booking", process.env.STRIPE_BOOKING_ADDON_PRICE_ID],
    ["booking", process.env.STRIPE_BOOKING_ADDON_YEARLY_PRICE_ID],
    ["lms", process.env.STRIPE_LMS_ADDON_PRICE_ID],
    ["lms", process.env.STRIPE_LMS_ADDON_YEARLY_PRICE_ID],
    ["realestate", process.env.STRIPE_REALESTATE_ADDON_PRICE_ID],
    ["realestate", process.env.STRIPE_REALESTATE_ADDON_YEARLY_PRICE_ID],
    ["transport", process.env.STRIPE_TRANSPORT_ADDON_PRICE_ID],
    ["transport", process.env.STRIPE_TRANSPORT_ADDON_YEARLY_PRICE_ID],
    ["newsletter", process.env.STRIPE_NEWSLETTER_ADDON_PRICE_ID],
    ["newsletter", process.env.STRIPE_NEWSLETTER_ADDON_YEARLY_PRICE_ID],
    ["newsletter_100", process.env.STRIPE_NEWSLETTER_EMAILS_100K_ADDON_MONTHLY_PRICE_ID],
    ["newsletter_100", process.env.STRIPE_NEWSLETTER_100K_ADDON_YEARLY_PRICE_ID],
    ["marketplace", process.env.STRIPE_MARKETPLACE_ADDON_YEARLY_PRICE_ID],
    ["restaurant", process.env.STRIPE_RESTAURANT_ADDON_YEARLY_PRICE_ID],
    ["jobboard", process.env.STRIPE_JOBBOARD_ADDON_YEARLY_PRICE_ID],
    ["webinar", process.env.STRIPE_WEBINAR_ADDON_YEARLY_PRICE_ID],
  ];

  for (const [tier, priceId] of addonEnv) {
    if (priceId) {
      rows.push({ stripePriceId: priceId, kind: "addon", tier });
    }
  }

  // Dedupe by price id (setup fee shared across tiers)
  const byId = new Map<string, PriceMapEntry>();
  for (const row of rows) {
    if (!byId.has(row.stripePriceId)) byId.set(row.stripePriceId, row);
  }
  return Array.from(byId.values());
}

export async function upsertPriceMapSeed(): Promise<number> {
  const seed = buildPriceMapSeedFromEnv().filter((r) => r.stripePriceId);
  for (const row of seed) {
    await db
      .insert(stripePriceMap)
      .values(row)
      .onConflictDoUpdate({
        target: stripePriceMap.stripePriceId,
        set: { kind: row.kind, tier: row.tier },
      });
  }
  return seed.length;
}

export async function lookupPriceMap(
  stripePriceId: string,
): Promise<PriceMapEntry | null> {
  const [row] = await db
    .select()
    .from(stripePriceMap)
    .where(eq(stripePriceMap.stripePriceId, stripePriceId))
    .limit(1);
  if (!row) return null;
  return {
    stripePriceId: row.stripePriceId,
    kind: row.kind as PriceKind,
    tier: row.tier,
  };
}

export function warnUnknownPrice(stripePriceId: string, context: string) {
  console.warn(
    `[stripe_price_map] Unknown price_id=${stripePriceId} in ${context}; skipping MRR change (no guess)`,
  );
}

/** Known addon ids for reference in reports. */
export function knownAddonTiers(): string[] {
  return availableAddOns.map((a) => a.id);
}
