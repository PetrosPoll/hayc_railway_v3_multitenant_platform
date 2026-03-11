import { eq } from "drizzle-orm";
import { db } from "../db";
import { websiteProgress } from "@shared/schema";

/**
 * Returns the Stripe Connect account ID for a website if it is connected.
 * Used by addons (e.g. hayc-digital) when creating checkout sessions on behalf of a site.
 */
export async function getConnectedAccountId(websiteProgressId: number): Promise<string | null> {
  const [wp] = await db
    .select({ stripeAccountId: websiteProgress.stripeAccountId, stripeAccountStatus: websiteProgress.stripeAccountStatus })
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId));
  if (!wp || wp.stripeAccountStatus !== "connected" || !wp.stripeAccountId) {
    return null;
  }
  return wp.stripeAccountId;
}
