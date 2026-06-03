import Stripe from "stripe";
import { type SubscriptionTier } from "@shared/schema";
import { storage } from "../storage";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

export interface NormalizedPrice {
  tier: string;
  billingPeriod: "monthly" | "yearly";
  priceId: string;
  unitAmount: number;
  currency: string;
}

// Map of known price IDs from environment variables to tier/addonId and billing period
const PRICE_ID_MAP: Record<string, { tier: string; billingPeriod: "monthly" | "yearly" }> = {
  // Subscription plans
  [process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || ""]: { tier: "basic", billingPeriod: "monthly" },
  [process.env.STRIPE_BASIC_YEARLY_PRICE_ID || ""]: { tier: "basic", billingPeriod: "yearly" },
  [process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID || ""]: { tier: "essential", billingPeriod: "monthly" },
  [process.env.STRIPE_ESSENTIAL_YEARLY_PRICE_ID || ""]: { tier: "essential", billingPeriod: "yearly" },
  [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || ""]: { tier: "pro", billingPeriod: "monthly" },
  [process.env.STRIPE_PRO_YEARLY_PRICE_ID || ""]: { tier: "pro", billingPeriod: "yearly" },
  // One-time fees
  [process.env.STRIPE_SETUP_FEE_PRICE_ID || ""]: { tier: "setup_fee", billingPeriod: "monthly" },
  // Add-ons
  [process.env.STRIPE_BOOKING_ADDON_PRICE_ID || ""]: { tier: "booking", billingPeriod: "monthly" },
  [process.env.STRIPE_BOOKING_ADDON_YEARLY_PRICE_ID || ""]: { tier: "booking", billingPeriod: "yearly" },
  [process.env.STRIPE_LMS_ADDON_PRICE_ID || ""]: { tier: "lms", billingPeriod: "monthly" },
  [process.env.STRIPE_LMS_ADDON_YEARLY_PRICE_ID || ""]: { tier: "lms", billingPeriod: "yearly" },
  [process.env.STRIPE_NEWSLETTER_ADDON_PRICE_ID || ""]: { tier: "newsletter", billingPeriod: "monthly" },
  [process.env.STRIPE_NEWSLETTER_ADDON_YEARLY_PRICE_ID || ""]: { tier: "newsletter", billingPeriod: "yearly" },
  [process.env.STRIPE_NEWSLETTER_EMAILS_100K_ADDON_MONTHLY_PRICE_ID || ""]: { tier: "newsletter_100", billingPeriod: "monthly" },
  [process.env.STRIPE_NEWSLETTER_100K_ADDON_YEARLY_PRICE_ID || ""]: { tier: "newsletter_100", billingPeriod: "yearly" },
};

/**
 * Public plan slugs matching PRICE_ID_MAP / `getPrice(tier, billingPeriod)`.
 * Use in outbound links (`/get-started?plan=<slug>&billing=<monthly|yearly>`).
 */
export const STRIPE_PUBLIC_PLAN_IDS = ["basic", "essential", "pro"] as const satisfies readonly SubscriptionTier[];

export type StripePublicPlanSlug = (typeof STRIPE_PUBLIC_PLAN_IDS)[number];

export function isStripePublicPlanSlug(slug: unknown): slug is StripePublicPlanSlug {
  return typeof slug === "string" && (STRIPE_PUBLIC_PLAN_IDS as readonly string[]).includes(slug);
}

/**
 * Fetches all subscription prices from Stripe and saves them to database
 */
async function fetchPricesFromStripe(): Promise<NormalizedPrice[]> {
  console.log("📊 Fetching prices from Stripe using known price IDs...");
  
  try {
    const normalizedPrices: NormalizedPrice[] = [];
    
    // Fetch each price directly using the price IDs from environment variables
    for (const [priceId, mapping] of Object.entries(PRICE_ID_MAP)) {
      // Skip empty price IDs
      if (!priceId) {
        console.warn(`⚠️ Missing price ID for ${mapping.tier} ${mapping.billingPeriod}`);
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(priceId);
        
        // Validate the price is active and has a unit amount (one-time prices have no recurring field)
        if (!price.active || !price.unit_amount) {
          console.warn(`⚠️ Price ${priceId} is inactive or missing required data`);
          continue;
        }

        normalizedPrices.push({
          tier: mapping.tier,
          billingPeriod: mapping.billingPeriod,
          priceId: price.id,
          unitAmount: price.unit_amount / 100, // Convert cents to euros
          currency: price.currency,
        });
        
        console.log(`✅ Fetched ${mapping.tier} ${mapping.billingPeriod} price: €${price.unit_amount / 100}`);
      } catch (error) {
        console.error(`❌ Error fetching price ${priceId} for ${mapping.tier} ${mapping.billingPeriod}:`, error);
        // Continue to fetch other prices even if one fails
      }
    }

    console.log(`✅ Successfully fetched ${normalizedPrices.length} prices from Stripe`);
    
    // Save to database
    if (normalizedPrices.length > 0) {
      await storage.saveStripePrices(normalizedPrices.map(p => ({
        tier: p.tier,
        billingPeriod: p.billingPeriod,
        priceId: p.priceId,
        unitAmount: Math.round(p.unitAmount * 100), // Store as cents
        currency: p.currency,
      })));
      console.log("💾 Saved prices to database");
    }
    
    return normalizedPrices;
  } catch (error) {
    console.error("❌ Error fetching prices from Stripe:", error);
    throw error;
  }
}

/**
 * Gets prices from database, or fetches from Stripe if database is empty
 */
export async function getPrices(forceRefresh = false): Promise<NormalizedPrice[]> {
  // If forcing refresh, fetch from Stripe and save to database
  if (forceRefresh) {
    console.log("🔄 Force refreshing prices from Stripe...");
    return await fetchPricesFromStripe();
  }

  // Try to get prices from database first
  try {
    const dbPrices = await storage.getAllStripePrices();

    if (dbPrices.length > 0) {
      // Verify every configured price ID is cached — if any are missing, the map
      // was extended since the last fetch (e.g. add-ons were added) and we need a refresh.
      const dbPriceIds = new Set(dbPrices.map(p => p.priceId));
      const expectedPriceIds = Object.keys(PRICE_ID_MAP).filter(id => id !== "");
      const allCached = expectedPriceIds.every(id => dbPriceIds.has(id));

      if (allCached) {
        console.log(`📦 Loaded ${dbPrices.length} prices from database`);
        return dbPrices.map(p => ({
          tier: p.tier,
          billingPeriod: p.billingPeriod as "monthly" | "yearly",
          priceId: p.priceId,
          unitAmount: p.unitAmount / 100,
          currency: p.currency,
        }));
      }

      console.log(`🔄 Pricing cache is incomplete (${dbPrices.length} cached, ${expectedPriceIds.length} expected) — refreshing from Stripe...`);
    }
  } catch (error) {
    console.error("⚠️ Error loading prices from database:", error);
  }

  // DB is empty or incomplete — fetch from Stripe
  console.log("📥 Fetching prices from Stripe...");
  return await fetchPricesFromStripe();
}

/**
 * Get price for a specific tier and billing period
 */
export async function getPrice(
  tier: SubscriptionTier,
  billingPeriod: "monthly" | "yearly"
): Promise<NormalizedPrice | undefined> {
  const prices = await getPrices();
  return prices.find(
    (p) => p.tier === tier && p.billingPeriod === billingPeriod
  );
}

/**
 * Initialize the pricing cache on server startup
 */
export async function initializePricingCache(): Promise<void> {
  console.log("🚀 Initializing pricing from database...");
  try {
    await getPrices();
    console.log("✅ Pricing initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize pricing:", error);
    // Don't throw - let the server start even if Stripe is down
  }
}
