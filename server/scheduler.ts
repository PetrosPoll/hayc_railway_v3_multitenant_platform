import { db } from "./db";
import { newsletterCampaigns, websiteProgress, subscriptions as subscriptionsTable, emailTemplates, campaignMessages } from "@shared/schema";
import { eq, and, lte, ne, or, sql } from "drizzle-orm";
import { EmailService } from "./email-service";
import type { IStorage } from "./storage";
import { generateUnsubscribeUrl, generateUnsubscribeFooter } from "./unsubscribe-utils";
import { getEmailLimitWithAddOns } from "./email-limits";

let schedulerInterval: NodeJS.Timeout | null = null;

export function startCampaignScheduler(storage: IStorage) {
  console.log('[SCHEDULER] Starting campaign scheduler...');
  
  // Run every minute
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndSendScheduledCampaigns(storage);
    } catch (error) {
      console.error('[SCHEDULER] Error in scheduler:', error);
    }
  }, 60000); // Check every minute

  // Also run immediately on startup
  checkAndSendScheduledCampaigns(storage).catch(error => {
    console.error('[SCHEDULER] Error in initial check:', error);
  });
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
      console.error(`[SCHEDULER] Campaign ${campaign.id} has no email content, skipping`);
      return;
    }

    // Get the website to determine its owner
    const [website] = await db
      .select()
      .from(websiteProgress)
      .where(eq(websiteProgress.id, campaign.websiteProgressId))
      .limit(1);

    if (!website) {
      console.error(`[SCHEDULER] Website not found for campaign ${campaign.id}`);
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
      console.error(`[SCHEDULER] No active subscription found for campaign ${campaign.id}`);
      return;
    }

    // Determine email limit based on tier
    const tier = currentSubscription.tier as "basic" | "essential" | "pro";
    const emailLimit = await getEmailLimitWithAddOns(tier, currentSubscription.websiteProgressId);
    
    if (tier === "basic") {
      console.error(`[SCHEDULER] Campaign ${campaign.id} requires Essential or Pro tier`);
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

    // Get contacts for the campaign's tags
    let recipients: any[] = [];
    
    // Support both legacy groupName and new tagIds
    if (campaign.tagIds && campaign.tagIds.length > 0) {
      // New tags-based system
      const allContacts = await storage.getContactsByTags(campaign.websiteProgressId, campaign.tagIds);
      // Accept contacts with status 'active', 'confirmed', or 'pending'
      recipients = allContacts.filter(c => c.status === 'active' || c.status === 'confirmed' || c.status === 'pending');
    } else if (campaign.groupName) {
      // Legacy group-based system (fallback)
      const subscribers = await storage.getNewsletterSubscribersByGroup(campaign.groupName, campaign.websiteProgressId);
      recipients = subscribers.filter(s => s.status === 'active' || s.status === 'confirmed' || s.status === 'pending');
    } else {
      console.error(`[SCHEDULER] Campaign ${campaign.id} has no tags or group specified`);
      return;
    }
    
    // Filter out excluded subscribers/contacts
    const excludedIds = campaign.excludedSubscriberIds || [];
    const finalRecipients = recipients.filter(r => !excludedIds.includes(r.id.toString()));

    if (finalRecipients.length === 0) {
      console.error(`[SCHEDULER] Campaign ${campaign.id} has no active recipients after exclusions`);
      return;
    }

    // Check if sending this campaign would exceed the email limit
    const remainingQuota = emailLimit - currentUsage;
    if (finalRecipients.length > remainingQuota) {
      console.error(`[SCHEDULER] Campaign ${campaign.id} would exceed email limit (${finalRecipients.length} emails needed, ${remainingQuota} remaining)`);
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

      // Determine base URL for unsubscribe links (use VITE_APP_URL for production)
      const baseUrl = process.env.VITE_APP_URL || 'https://hayc.gr';

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
            fromEmail: campaign.senderEmail,
            fromName: campaign.senderName,
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
