import Stripe from "stripe";
import { type SubscriptionTier } from "@shared/schema";
import { storage } from "../storage";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

export interface NormalizedPrice {
  tier: SubscriptionTier;
  billingPeriod: "monthly" | "yearly";
  priceId: string;
  unitAmount: number;
  currency: string;
}

// Map of known price IDs from environment variables to tier and billing period
const PRICE_ID_MAP: Record<string, { tier: SubscriptionTier; billingPeriod: "monthly" | "yearly" }> = {
  [process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || ""]: { tier: "basic", billingPeriod: "monthly" },
  [process.env.STRIPE_BASIC_YEARLY_PRICE_ID || ""]: { tier: "basic", billingPeriod: "yearly" },
  [process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID || ""]: { tier: "essential", billingPeriod: "monthly" },
  [process.env.STRIPE_ESSENTIAL_YEARLY_PRICE_ID || ""]: { tier: "essential", billingPeriod: "yearly" },
  [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || ""]: { tier: "pro", billingPeriod: "monthly" },
  [process.env.STRIPE_PRO_YEARLY_PRICE_ID || ""]: { tier: "pro", billingPeriod: "yearly" },
};

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
        
        // Validate the price is active and has required data
        if (!price.active || !price.unit_amount || !price.recurring) {
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
      console.log(`📦 Loaded ${dbPrices.length} prices from database`);
      return dbPrices.map(p => ({
        tier: p.tier as SubscriptionTier,
        billingPeriod: p.billingPeriod as "monthly" | "yearly",
        priceId: p.priceId,
        unitAmount: p.unitAmount / 100, // Convert from cents to euros
        currency: p.currency,
      }));
    }
  } catch (error) {
    console.error("⚠️ Error loading prices from database:", error);
  }

  // Database is empty, fetch from Stripe
  console.log("📥 No prices in database, fetching from Stripe...");
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
