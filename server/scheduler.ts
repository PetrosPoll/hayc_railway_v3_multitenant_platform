import { db } from "./db";
import { newsletterCampaigns, websiteProgress, subscriptions as subscriptionsTable, emailTemplates, campaignMessages } from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { EmailService } from "./email-service";
import type { IStorage } from "./storage";
import { generateUnsubscribeUrl, generateUnsubscribeFooter, resolveUnsubscribeBaseUrl } from "./unsubscribe-utils";
import { getEmailLimitWithAddOns } from "./email-limits";
import {
  NEWSLETTER_FROM_EMAIL,
  getNewsletterReplyToAddresses,
} from "@shared/newsletter";

async function markScheduledCampaignFailed(
  campaignId: number,
  websiteProgressId: number,
  reason: string,
): Promise<void> {
  await db
    .update(newsletterCampaigns)
    .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
    .where(
      and(
        eq(newsletterCampaigns.id, campaignId),
        eq(newsletterCampaigns.websiteProgressId, websiteProgressId),
        eq(newsletterCampaigns.status, "scheduled"),
      ),
    );
  console.log(`[SCHEDULER] Campaign #${campaignId} failed: ${reason}`);
}

let schedulerInterval: NodeJS.Timeout | null = null;
let lastBillingNightlyKey: string | null = null;
let lastBillingDigestKey: string | null = null;

function athensHourMinute(now = new Date()): { dateKey: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

async function runBillingCalendarNightly(): Promise<void> {
  console.log("[SCHEDULER] Billing calendar nightly (Athens 03:00) starting…");
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2023-10-16" as any,
  });
  const { reconcileStripeCalendar } = await import("./services/billing-calendar-sync");
  const {
    materializeAllActiveCustomSeries,
    ageCustomObligations,
  } = await import("./services/billing-custom-materialize");
  const { createAdminNotification } = await import("./services/billing-admin-notify");

  const { synced } = await reconcileStripeCalendar(stripe, { source: "reconcile" });
  const customCreated = await materializeAllActiveCustomSeries();
  const aged = await ageCustomObligations();

  // Card expiring flags + email (once per card via billing_email_log)
  try {
    const { claimBillingEmailSend } = await import("./services/billing-admin-notify");
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const paymentMethods = await stripe.paymentMethods.list({ type: "card", limit: 100 });
    for (const pm of paymentMethods.data) {
      if (!pm.card || !pm.customer) continue;
      if (
        pm.card.exp_year === date.getFullYear() &&
        pm.card.exp_month === date.getMonth() + 1
      ) {
        const key = `card-expiring:${pm.id}:${pm.card.exp_year}-${pm.card.exp_month}`;
        const first = await claimBillingEmailSend({
          template: "card-expiring",
          attemptKey: key,
        });
        if (!first) continue;
        await createAdminNotification({
          type: "card_expiring",
          title: `Card expiring …${pm.card.last4}`,
          payload: { paymentMethodId: pm.id },
        });
      }
    }
  } catch (e) {
    console.error("[SCHEDULER] card expiry scan failed:", e);
  }

  console.log(
    `[SCHEDULER] Billing nightly done: stripeSubs=${synced} customCreated=${customCreated} aged=${aged}`,
  );
}

async function runBillingAdminDigest(): Promise<void> {
  const { listUnreadAdminNotifications, createAdminNotification } = await import(
    "./services/billing-admin-notify"
  );
  const unread = await listUnreadAdminNotifications(100);
  if (!unread.length) return;
  const byType = new Map<string, number>();
  for (const n of unread) {
    byType.set(n.type, (byType.get(n.type) || 0) + 1);
  }
  const lines = Array.from(byType.entries())
    .map(([t, c]) => `${t}: ${c}`)
    .join("\n");
  await createAdminNotification({
    type: "daily_digest",
    title: `Billing digest: ${unread.length} open items`,
    body: lines,
  });
  console.log("[SCHEDULER] Billing digest prepared");
}

export function startCampaignScheduler(storage: IStorage) {
  console.log('[SCHEDULER] Starting campaign scheduler...');
  
  // Run every minute
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndSendScheduledCampaigns(storage);
    } catch (error) {
      console.error('[SCHEDULER] Error in scheduler:', error);
    }
    try {
      const { processDueAutomationJobs } = await import("./lib/automation-engine");
      await processDueAutomationJobs();
    } catch (error) {
      console.error('[SCHEDULER] Error processing automation jobs:', error);
    }
    try {
      const { dateKey, hour, minute } = athensHourMinute();
      if (hour === 3 && minute === 0 && lastBillingNightlyKey !== dateKey) {
        lastBillingNightlyKey = dateKey;
        await runBillingCalendarNightly();
      }
      if (hour === 9 && minute === 0 && lastBillingDigestKey !== dateKey) {
        lastBillingDigestKey = dateKey;
        await runBillingAdminDigest();
      }
    } catch (error) {
      console.error("[SCHEDULER] Billing calendar job error:", error);
    }
  }, 60000); // Check every minute

  // Also run immediately on startup
  checkAndSendScheduledCampaigns(storage).catch(error => {
    console.error('[SCHEDULER] Error in initial check:', error);
  });
  import("./lib/automation-engine")
    .then(({ processDueAutomationJobs }) => processDueAutomationJobs())
    .catch((error) => console.error("[SCHEDULER] Error in initial automation check:", error));
}

export function stopCampaignScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[SCHEDULER] Campaign scheduler stopped');
  }
}

async function checkAndSendScheduledCampaigns(storage: IStorage) {
  try {
    // Find all campaigns that are scheduled and their scheduled time has passed
    const now = new Date();
    console.log(`[SCHEDULER] Checking for scheduled campaigns at ${now.toISOString()}`);
    
    // First, let's see ALL scheduled campaigns regardless of time
    const allScheduledCampaigns = await db
      .select()
      .from(newsletterCampaigns)
      .where(eq(newsletterCampaigns.status, 'scheduled'));
    
    console.log(`[SCHEDULER] Found ${allScheduledCampaigns.length} campaign(s) with 'scheduled' status`);
    
    if (allScheduledCampaigns.length > 0) {
      allScheduledCampaigns.forEach(campaign => {
        const scheduledTime = campaign.scheduledFor ? new Date(campaign.scheduledFor) : null;
        console.log(`[SCHEDULER]   - Campaign #${campaign.id} "${campaign.title}": scheduledFor=${scheduledTime?.toISOString() || 'NULL'}, isPast=${scheduledTime && scheduledTime <= now}`);
      });
    }
    
    const scheduledCampaigns = await db
      .select()
      .from(newsletterCampaigns)
      .where(
        and(
          eq(newsletterCampaigns.status, 'scheduled'),
          lte(newsletterCampaigns.scheduledFor, now)
        )
      );

    if (scheduledCampaigns.length === 0) {
      console.log('[SCHEDULER] No campaigns ready to send at this time');
      return; // No campaigns to send
    }

    console.log(`[SCHEDULER] Found ${scheduledCampaigns.length} campaign(s) ready to send`);

    for (const campaign of scheduledCampaigns) {
      try {
        await sendScheduledCampaign(campaign, storage);
      } catch (error) {
        console.error(`[SCHEDULER] Error sending campaign ${campaign.id}:`, error);
        // Continue with other campaigns even if one fails
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Error checking scheduled campaigns:', error);
  }
}

async function sendScheduledCampaign(campaign: any, storage: IStorage) {
  console.log(`[SCHEDULER] Sending scheduled campaign: ${campaign.title} (ID: ${campaign.id})`);

  try {
    // Check if campaign is already being sent or was sent (race condition protection)
    if (campaign.status === 'sent') {
      console.log(`[SCHEDULER] Campaign ${campaign.id} has already been sent, skipping`);
      return;
    }

    if (campaign.status === 'sending') {
      console.log(`[SCHEDULER] Campaign ${campaign.id} is already being sent, skipping`);
      return;
    }

    // Perform all validation BEFORE claiming the campaign

    // Check if campaign has either a template selected OR email content saved directly
    if (!campaign.templateId && !campaign.emailHtml) {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        "Campaign has no email template or HTML content.",
      );
      return;
    }

    // Get the website to determine its owner
    const [website] = await db
      .select()
      .from(websiteProgress)
      .where(eq(websiteProgress.id, campaign.websiteProgressId))
      .limit(1);

    if (!website) {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        "Website not found for this campaign.",
      );
      return;
    }

    // Get subscription for the website owner to check tier and limits
    // IMPORTANT: Filter by productType='plan' to get the main plan, not add-ons
    const [currentSubscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.websiteProgressId, campaign.websiteProgressId),
          eq(subscriptionsTable.userId, website.userId),
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionsTable.productType, "plan")
        )
      )
      .limit(1);

    if (!currentSubscription) {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        "No active subscription found for this website.",
      );
      return;
    }

    // Determine email limit based on tier
    const tier = currentSubscription.tier as "basic" | "essential" | "pro";
    const emailLimit = await getEmailLimitWithAddOns(tier, currentSubscription.websiteProgressId);
    
    if (tier === "basic") {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        "Newsletter sending requires Essential or Pro plan tier.",
      );
      return;
    }

    const currentUsage = currentSubscription.emailsSentThisMonth || 0;

    // Fetch template if campaign has one
    let templateHtml = null;
    if (campaign.templateId) {
      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, campaign.templateId));
      if (template) {
        templateHtml = template.html;
      }
    }

    // Get contacts for the campaign (by tags if specified, legacy group, or all contacts — matches /send route)
    let recipients: any[] = [];

    if (campaign.tagIds && campaign.tagIds.length > 0) {
      const allContacts = await storage.getContactsByTags(campaign.websiteProgressId, campaign.tagIds);
      recipients = allContacts.filter(
        (c) => c.status === "active" || c.status === "confirmed" || c.status === "pending" || c.status === "subscribed",
      );
    } else if (campaign.groupName) {
      const subscribers = await storage.getNewsletterSubscribersByGroup(
        campaign.groupName,
        campaign.websiteProgressId,
      );
      recipients = subscribers.filter(
        (s) => s.status === "active" || s.status === "confirmed" || s.status === "pending" || s.status === "subscribed",
      );
    } else {
      const allContacts = await storage.getContacts(campaign.websiteProgressId);
      recipients = allContacts.filter(
        (c) => c.status === "active" || c.status === "confirmed" || c.status === "pending" || c.status === "subscribed",
      );
    }

    const excludedTagIds = campaign.excludedTagIds || [];
    const excludedTagIdsNormalized = excludedTagIds
      .map((id: any) => (typeof id === "number" ? id : parseInt(id)))
      .filter((id: number) => !isNaN(id));
    if (excludedTagIdsNormalized.length > 0) {
      const contactsWithExcludedTags = await storage.getContactsByTags(
        campaign.websiteProgressId,
        excludedTagIdsNormalized,
      );
      const excludedContactIdsByTag = new Set(contactsWithExcludedTags.map((c) => c.id));
      recipients = recipients.filter((c) => !excludedContactIdsByTag.has(c.id));
    }

    const excludedIds = campaign.excludedSubscriberIds || [];
    const finalRecipients = recipients.filter((r) => !excludedIds.includes(r.id.toString()));

    if (finalRecipients.length === 0) {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        "No recipients to send to after applying exclusions.",
      );
      return;
    }

    // Check if sending this campaign would exceed the email limit
    const remainingQuota = emailLimit - currentUsage;
    if (finalRecipients.length > remainingQuota) {
      await markScheduledCampaignFailed(
        campaign.id,
        campaign.websiteProgressId,
        `Monthly email quota would be exceeded (${finalRecipients.length} recipients needed, ${remainingQuota} remaining).`,
      );
      return;
    }

    // ALL VALIDATION PASSED - Now atomically claim the campaign by setting status to 'sending'
    // Use conditional update to prevent race conditions
    const claimResult = await db
      .update(newsletterCampaigns)
      .set({ status: 'sending' })
      .where(
        and(
          eq(newsletterCampaigns.id, campaign.id),
          eq(newsletterCampaigns.websiteProgressId, campaign.websiteProgressId),
          // Only update if status is 'scheduled' (not already 'sent' or 'sending')
          eq(newsletterCampaigns.status, 'scheduled')
        )
      )
      .returning({ id: newsletterCampaigns.id });

    if (!claimResult || claimResult.length === 0) {
      // Another process already claimed this campaign
      console.log(`[SCHEDULER] Campaign ${campaign.id} already claimed by another process, skipping`);
      return;
    }

    console.log(`[SCHEDULER] Atomically marked campaign ${campaign.id} as 'sending'`);

    // Campaign has been claimed - wrap send logic in try/catch to revert on failure
    try {
      // Send emails to all subscribers
      let successCount = 0;
      let failCount = 0;

      // Determine base URL for unsubscribe links.
      const baseUrl = resolveUnsubscribeBaseUrl();

      for (const subscriber of finalRecipients) {
        try {
          // Generate personalized unsubscribe link for this recipient
          const unsubscribeUrl = generateUnsubscribeUrl(
            baseUrl,
            subscriber.id,
            campaign.websiteProgressId,
            subscriber.email
          );
          
          // Inject unsubscribe footer into email HTML
          let emailHtml = templateHtml || campaign.emailHtml || '';
          if (emailHtml) {
            // Detect language from campaign or default to English
            const language = (campaign.language === 'gr' || campaign.language === 'el') ? 'gr' : 'en';
            const unsubscribeFooter = generateUnsubscribeFooter(unsubscribeUrl, language as 'en' | 'gr');
            
            // Insert footer before closing body tag, or append if no body tag
            if (emailHtml.includes('</body>')) {
              emailHtml = emailHtml.replace('</body>', `${unsubscribeFooter}</body>`);
            } else {
              emailHtml = emailHtml + unsubscribeFooter;
            }
          }
          
          const result = await EmailService.sendEmail({
            to: subscriber.email,
            subject: campaign.subject,
            message: campaign.message,
            fromEmail: NEWSLETTER_FROM_EMAIL,
            fromName: campaign.senderName || undefined,
            replyToAddresses: getNewsletterReplyToAddresses(campaign.senderEmail),
            html: emailHtml || undefined,
          });

          if (result.success) {
            successCount++;
            
            // Store message ID for analytics tracking (if available)
            if (result.messageId) {
              try {
                await db.insert(campaignMessages).values({
                  campaignId: campaign.id,
                  messageId: result.messageId,
                  recipientEmail: subscriber.email,
                });
              } catch (trackError) {
                console.error('[SCHEDULER] Failed to store message ID for tracking:', trackError);
              }
            }
          } else {
            failCount++;
            console.error(`[SCHEDULER] Failed to send to ${subscriber.email}:`, result.error);
          }
        } catch (emailError) {
          failCount++;
          console.error(`[SCHEDULER] Error sending to ${subscriber.email}:`, emailError);
        }
      }

      // Update campaign status and counts
      await storage.updateNewsletterCampaign(campaign.id, campaign.websiteProgressId, {
        status: 'sent',
        sentAt: new Date(),
        recipientCount: successCount,
      });
      
      // Update subscription email usage
      await db
        .update(subscriptionsTable)
        .set({
          emailsSentThisMonth: currentUsage + successCount,
        })
        .where(eq(subscriptionsTable.id, currentSubscription.id));

      console.log(`[SCHEDULER] Campaign ${campaign.id} sent: ${successCount} succeeded, ${failCount} failed`);
    } catch (sendError) {
      // Revert campaign status to 'scheduled' if sending fails
      console.error(`[SCHEDULER] Error during campaign send, reverting status:`, sendError);
      try {
        await storage.updateNewsletterCampaign(campaign.id, campaign.websiteProgressId, {
          status: 'scheduled',
        });
        console.log(`[SCHEDULER] Reverted campaign ${campaign.id} status back to 'scheduled'`);
      } catch (revertError) {
        console.error(`[SCHEDULER] Failed to revert campaign status:`, revertError);
      }
      throw sendError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error(`[SCHEDULER] Error in sendScheduledCampaign for campaign ${campaign.id}:`, error);
    throw error;
  }
}
