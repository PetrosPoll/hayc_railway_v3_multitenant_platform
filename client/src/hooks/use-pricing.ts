import { useQuery } from "@tanstack/react-query";
import { type StripePrice } from "@shared/schema";

export interface PricingData {
  prices: StripePrice[];
}

/**
 * Hook to fetch dynamic pricing from Stripe
 * Prices are cached for 15 minutes on the server
 */
export function usePricing() {
  return useQuery<StripePrice[]>({
    queryKey: ["/api/pricing"],
    staleTime: 15 * 60 * 1000, // Match server cache TTL
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

/**
 * Helper function to get price for a specific tier and billing period
 */
export function getPrice(
  prices: StripePrice[] | undefined,
  tier: "basic" | "essential" | "pro",
  billingPeriod: "monthly" | "yearly"
): StripePrice | undefined {
  if (!prices) return undefined;
  return prices.find(
    (p) => p.tier === tier && p.billingPeriod === billingPeriod
  );
}

/**
 * Helper function to calculate savings when switching to yearly
 */
export function calculateYearlySavings(
  monthlyPrice: number,
  yearlyPrice: number
): { savings: number; percentage: number } {
  const yearlyFromMonthly = monthlyPrice * 12;
  const savings = yearlyFromMonthly - yearlyPrice;
  const percentage = (savings / yearlyFromMonthly) * 100;
  
  return {
    savings: Math.max(0, savings), // Never show negative savings
    percentage: Math.max(0, percentage),
  };
}
