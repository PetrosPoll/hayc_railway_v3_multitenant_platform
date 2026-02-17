/**
 * Shared email limit logic used by both draft sends (routes) and scheduled campaigns (scheduler).
 * Limit = plan base + all active add-on caps + bonus emails (everything added together).
 */
import { getEmailLimit } from "@shared/schema";
import { db } from "./db";
import { websiteProgress, subscriptions as subscriptionsTable } from "@shared/schema";
import { eq, and, or, gte, inArray } from "drizzle-orm";

/**
 * Get email limit by adding plan base + newsletter add-on caps + admin bonus.
 * - Plan: base tier limit (e.g. Essential 3k, Pro 10k)
 * - newsletter add-on = +15,000, newsletter_100 add-on = +100,000 (each active add-on adds its cap)
 * - Admin bonus emails are added on top
 * Returns baseLimit + addonTotal + bonusEmails.
 */
export async function getEmailLimitWithAddOns(
  tier: string | null,
  websiteProgressId: number | null
): Promise<number> {
  const baseLimit = getEmailLimit(tier);

  if (!websiteProgressId) {
    return baseLimit;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const [websiteData] = await db
    .select({
      bonusEmails: websiteProgress.bonusEmails,
      bonusEmailsExpiry: websiteProgress.bonusEmailsExpiry,
    })
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId));

  let bonusEmails = 0;
  if (websiteData?.bonusEmails && websiteData.bonusEmailsExpiry) {
    const now = Date.now();
    const expiryTime = new Date(websiteData.bonusEmailsExpiry).getTime();
    if (expiryTime > now) {
      bonusEmails = websiteData.bonusEmails;
    }
  }

  const newsletterAddOns = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.websiteProgressId, websiteProgressId),
        eq(subscriptionsTable.productType, "addon"),
        inArray(subscriptionsTable.productId, ["newsletter", "newsletter_100"]),
        or(
          eq(subscriptionsTable.status, "active"),
          and(
            eq(subscriptionsTable.status, "cancelled"),
            gte(subscriptionsTable.accessUntil, tomorrow)
          )
        )
      )
    );

  // Sum each active add-on's cap (plan + add-ons + bonus = total)
  let addonTotal = 0;
  for (const addon of newsletterAddOns) {
    if (addon.productId === "newsletter_100") {
      addonTotal += 100000;
    } else if (addon.productId === "newsletter") {
      addonTotal += 15000;
    }
  }

  return baseLimit + addonTotal + bonusEmails;
}
