import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  analyticsDailySummaries,
  analyticsEvents,
  contactTags,
  contacts,
  emailTemplates,
  newsletterCampaigns,
  newsletterSubscribers,
  subscriptions,
  tags,
  users,
  websiteAutomationWorkflows,
  websiteEmailTemplates,
  websiteFormAutomations,
  websiteProgress,
  websiteStages,
  type AutomationGraph,
  type WebsiteProgress,
} from "@shared/schema";
import { storage } from "../storage";

export type DuplicateDemoWebsiteInput = {
  sourceWebsiteId: number;
  demoSlug: string;
  projectName?: string;
  domain?: string;
  /** Defaults to source owner (same demo user). */
  targetUserId?: number;
};

export type DuplicateDemoWebsiteResult = {
  website: WebsiteProgress;
  counts: {
    stages: number;
    subscriptions: number;
    tags: number;
    contacts: number;
    contactTags: number;
    newsletterSubscribers: number;
    emailTemplates: number;
    campaigns: number;
    formAutomations: number;
    websiteEmailTemplates: number;
    workflows: number;
    analyticsSummaries: number;
    analyticsEvents: number;
  };
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function remapTagIds(
  ids: number[] | null | undefined,
  tagIdMap: Map<number, number>,
): number[] {
  if (!ids?.length) return [];
  return ids
    .map((id) => tagIdMap.get(id))
    .filter((id): id is number => typeof id === "number");
}

function remapAutomationGraph(
  graph: AutomationGraph,
  websiteEmailTemplateIdMap: Map<number, number>,
): AutomationGraph {
  const nodes = (graph?.nodes ?? []).map((node) => {
    if (node.type !== "email") return node;
    const raw = node.data?.templateId;
    const oldId =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseInt(raw, 10)
          : NaN;
    if (!Number.isFinite(oldId)) return node;
    const mapped = websiteEmailTemplateIdMap.get(oldId);
    if (mapped == null) return node;
    return {
      ...node,
      data: { ...node.data, templateId: mapped },
    };
  });
  return {
    nodes,
    edges: graph?.edges ?? [],
  };
}

/**
 * Deep-clone a demo website project (tenant-scoped data) for reuse without reseeding.
 * Same owner by default. Clears siteId / Stripe Connect / custom domain.
 * Skips invoices, transactions, campaign messages, automation jobs, contact submissions.
 */
export async function duplicateDemoWebsite(
  input: DuplicateDemoWebsiteInput,
): Promise<DuplicateDemoWebsiteResult> {
  const demoSlug = slugify(input.demoSlug);
  if (!demoSlug) {
    throw Object.assign(new Error("Demo slug is required"), { status: 400 });
  }

  const [source] = await db
    .select()
    .from(websiteProgress)
    .where(eq(websiteProgress.id, input.sourceWebsiteId))
    .limit(1);

  if (!source || !source.isDemo) {
    throw Object.assign(new Error("Demo website not found"), { status: 404 });
  }

  const owner = await storage.getUserById(source.userId);
  if (!owner?.isDemo) {
    throw Object.assign(new Error("Source owner is not a demo user"), {
      status: 400,
    });
  }

  const targetUserId = input.targetUserId ?? source.userId;
  if (targetUserId !== source.userId) {
    const target = await storage.getUserById(targetUserId);
    if (!target?.isDemo) {
      throw Object.assign(new Error("Target user must be a demo account"), {
        status: 400,
      });
    }
  }

  const projectName =
    (input.projectName?.trim() ||
      `${source.projectName || source.domain} (copy)`).slice(0, 200);
  const domain = (
    input.domain?.trim() ||
    `${slugify(source.domain || "demo")}-copy-${Date.now().toString(36)}`
  ).slice(0, 200);

  const counts = {
    stages: 0,
    subscriptions: 0,
    tags: 0,
    contacts: 0,
    contactTags: 0,
    newsletterSubscribers: 0,
    emailTemplates: 0,
    campaigns: 0,
    formAutomations: 0,
    websiteEmailTemplates: 0,
    workflows: 0,
    analyticsSummaries: 0,
    analyticsEvents: 0,
  };

  const tagIdMap = new Map<number, number>();
  const contactIdMap = new Map<number, number>();
  const emailTemplateIdMap = new Map<number, number>();
  const websiteEmailTemplateIdMap = new Map<number, number>();

  let newWebsite: WebsiteProgress;

  try {
    newWebsite = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(websiteProgress)
        .values({
          userId: targetUserId,
          domain,
          projectName,
          websiteLanguage: source.websiteLanguage,
          currentStage: source.currentStage,
          media: source.media ?? [],
          bonusEmails: source.bonusEmails ?? 0,
          bonusEmailsExpiry: source.bonusEmailsExpiry,
          bookingEnabled: source.bookingEnabled,
          paymentsEnabled: source.paymentsEnabled,
          digitalProductsEnabled: source.digitalProductsEnabled,
          siteId: null,
          customDomain: null,
          contactEmail: source.contactEmail,
          dashboardPreviewImage: source.dashboardPreviewImage,
          hdpDemoBuyer: source.hdpDemoBuyer,
          isDemo: true,
          demoSlug,
          demoEnabled: true,
          stripeAccountId: null,
          stripeAccountStatus: "disconnected",
          stripeConnectedAt: null,
          billingVatNumber: source.billingVatNumber,
          billingCity: source.billingCity,
          billingStreet: source.billingStreet,
          billingNumber: source.billingNumber,
          billingPostalCode: source.billingPostalCode,
          billingInvoiceType: source.billingInvoiceType,
          billingClassificationType: source.billingClassificationType,
          billingInvoiceTypeCode: source.billingInvoiceTypeCode,
          billingProductName: source.billingProductName,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const sourceStages = await tx
        .select()
        .from(websiteStages)
        .where(eq(websiteStages.websiteProgressId, source.id));
      if (sourceStages.length) {
        await tx.insert(websiteStages).values(
          sourceStages.map((s) => ({
            websiteProgressId: created.id,
            stageNumber: s.stageNumber,
            title: s.title,
            description: s.description,
            status: s.status,
            waiting_info: s.waiting_info,
            reminder_interval: s.reminder_interval,
            completedAt: s.completedAt,
          })),
        );
        counts.stages = sourceStages.length;
      }

      const sourceSubs = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.websiteProgressId, source.id));
      for (const sub of sourceSubs) {
        await tx.insert(subscriptions).values({
          userId: targetUserId,
          websiteProgressId: created.id,
          productType: sub.productType,
          productId: sub.productId,
          stripeSubscriptionId: null,
          stripeSubscriptionItemId: null,
          tier: sub.tier,
          status:
            sub.status === "canceled" || sub.status === "cancelled"
              ? "active"
              : sub.status,
          price: sub.price,
          vatNumber: sub.vatNumber,
          city: sub.city,
          street: sub.street,
          number: sub.number,
          postalCode: sub.postalCode,
          pdfUrl: null,
          invoiceType: sub.invoiceType,
          classificationType: sub.classificationType,
          invoiceTypeCode: sub.invoiceTypeCode,
          productName: sub.productName,
          firstName: sub.firstName,
          lastName: sub.lastName,
          billingPeriod: sub.billingPeriod,
          cancellationReason: null,
          accessUntil: sub.accessUntil,
          cancelledAt: null,
          emailsSentThisMonth: 0,
          emailLimitResetDate: new Date(),
          isLegacy: sub.isLegacy,
          notes: sub.notes
            ? `${sub.notes} (cloned from website #${source.id})`
            : `Cloned from demo website #${source.id}`,
          reactivationOf: null,
          createdAt: new Date(),
        });
        counts.subscriptions += 1;
      }

      const sourceTags = await tx
        .select()
        .from(tags)
        .where(eq(tags.websiteProgressId, source.id));
      for (const tag of sourceTags) {
        const [newTag] = await tx
          .insert(tags)
          .values({
            websiteProgressId: created.id,
            name: tag.name,
            description: tag.description,
            color: tag.color,
            isSystem: tag.isSystem,
            createdAt: new Date(),
          })
          .returning();
        tagIdMap.set(tag.id, newTag.id);
        counts.tags += 1;
      }

      const sourceContacts = await tx
        .select()
        .from(contacts)
        .where(eq(contacts.websiteProgressId, source.id));
      for (const contact of sourceContacts) {
        const [newContact] = await tx
          .insert(contacts)
          .values({
            websiteProgressId: created.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            status: contact.status,
            confirmationToken: contact.confirmationToken
              ? randomBytes(24).toString("hex")
              : null,
            subscribedAt: contact.subscribedAt,
            confirmedAt: contact.confirmedAt,
            unsubscribedAt: contact.unsubscribedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        contactIdMap.set(contact.id, newContact.id);
        counts.contacts += 1;
      }

      const oldContactIds = Array.from(contactIdMap.keys());
      if (oldContactIds.length && tagIdMap.size) {
        const sourceContactTags = await tx
          .select()
          .from(contactTags)
          .where(inArray(contactTags.contactId, oldContactIds));
        const relevant = sourceContactTags.filter((ct) => tagIdMap.has(ct.tagId));
        if (relevant.length) {
          await tx.insert(contactTags).values(
            relevant.map((ct) => ({
              contactId: contactIdMap.get(ct.contactId)!,
              tagId: tagIdMap.get(ct.tagId)!,
              assignedAt: ct.assignedAt ?? new Date(),
            })),
          );
          counts.contactTags = relevant.length;
        }
      }

      const sourceSubscribers = await tx
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.websiteProgressId, source.id));
      if (sourceSubscribers.length) {
        await tx.insert(newsletterSubscribers).values(
          sourceSubscribers.map((s) => ({
            websiteProgressId: created.id,
            name: s.name,
            email: s.email,
            status: s.status,
            confirmationToken: s.confirmationToken
              ? randomBytes(24).toString("hex")
              : null,
            subscribedAt: s.subscribedAt,
            confirmedAt: s.confirmedAt,
            updatedAt: new Date(),
          })),
        );
        counts.newsletterSubscribers = sourceSubscribers.length;
      }

      const sourceEmailTemplates = await tx
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.websiteProgressId, source.id));
      for (const tpl of sourceEmailTemplates) {
        const [newTpl] = await tx
          .insert(emailTemplates)
          .values({
            websiteProgressId: created.id,
            name: tpl.name,
            html: tpl.html,
            design: tpl.design,
            thumbnail: tpl.thumbnail,
            category: tpl.category,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        emailTemplateIdMap.set(tpl.id, newTpl.id);
        counts.emailTemplates += 1;
      }

      const sourceCampaigns = await tx
        .select()
        .from(newsletterCampaigns)
        .where(eq(newsletterCampaigns.websiteProgressId, source.id));
      for (const campaign of sourceCampaigns) {
        const mappedTemplateId = campaign.templateId
          ? emailTemplateIdMap.get(campaign.templateId) ?? null
          : null;
        const excludedContactIds = (campaign.excludedContactIds ?? [])
          .map((id) => contactIdMap.get(id))
          .filter((id): id is number => typeof id === "number");

        await tx.insert(newsletterCampaigns).values({
          websiteProgressId: created.id,
          title: campaign.title,
          description: campaign.description,
          purpose: campaign.purpose,
          tagIds: remapTagIds(campaign.tagIds, tagIdMap),
          excludedTagIds: remapTagIds(campaign.excludedTagIds, tagIdMap),
          senderName: campaign.senderName,
          senderEmail: campaign.senderEmail,
          excludedSubscriberIds: campaign.excludedSubscriberIds ?? [],
          excludedContactIds,
          subject: campaign.subject,
          message: campaign.message,
          templateId: mappedTemplateId,
          emailHtml: campaign.emailHtml,
          emailDesign: campaign.emailDesign,
          status:
            campaign.status === "sending" || campaign.status === "scheduled"
              ? "draft"
              : campaign.status,
          scheduledFor: null,
          failureReason: null,
          sentAt: campaign.sentAt,
          sentCount: campaign.sentCount,
          deliveredCount: campaign.deliveredCount,
          openCount: campaign.openCount,
          clickCount: campaign.clickCount,
          bounceCount: campaign.bounceCount,
          complaintCount: campaign.complaintCount,
          recipientCount: campaign.recipientCount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        counts.campaigns += 1;
      }

      const sourceFormAutomations = await tx
        .select()
        .from(websiteFormAutomations)
        .where(eq(websiteFormAutomations.websiteProgressId, source.id));
      if (sourceFormAutomations.length) {
        await tx.insert(websiteFormAutomations).values(
          sourceFormAutomations.map((a) => ({
            websiteProgressId: created.id,
            formId: a.formId,
            enabled: a.enabled,
            visitorSubject: a.visitorSubject,
            visitorBody: a.visitorBody,
            logoUrl: a.logoUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
        counts.formAutomations = sourceFormAutomations.length;
      }

      const sourceWebsiteEmailTemplates = await tx
        .select()
        .from(websiteEmailTemplates)
        .where(eq(websiteEmailTemplates.websiteProgressId, source.id));
      for (const tpl of sourceWebsiteEmailTemplates) {
        const [newTpl] = await tx
          .insert(websiteEmailTemplates)
          .values({
            websiteProgressId: created.id,
            name: tpl.name,
            subject: tpl.subject,
            body: tpl.body,
            logoUrl: tpl.logoUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        websiteEmailTemplateIdMap.set(tpl.id, newTpl.id);
        counts.websiteEmailTemplates += 1;
      }

      const sourceWorkflows = await tx
        .select()
        .from(websiteAutomationWorkflows)
        .where(eq(websiteAutomationWorkflows.websiteProgressId, source.id));
      if (sourceWorkflows.length) {
        await tx.insert(websiteAutomationWorkflows).values(
          sourceWorkflows.map((w) => ({
            websiteProgressId: created.id,
            name: w.name,
            enabled: w.enabled,
            triggerFormId: w.triggerFormId,
            graph: remapAutomationGraph(
              (w.graph ?? { nodes: [], edges: [] }) as AutomationGraph,
              websiteEmailTemplateIdMap,
            ),
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
        counts.workflows = sourceWorkflows.length;
      }

      const sourceSummaries = await tx
        .select()
        .from(analyticsDailySummaries)
        .where(eq(analyticsDailySummaries.websiteProgressId, source.id));
      if (sourceSummaries.length) {
        await tx.insert(analyticsDailySummaries).values(
          sourceSummaries.map((s) => ({
            websiteProgressId: created.id,
            date: s.date,
            pageviews: s.pageviews,
            uniqueVisitors: s.uniqueVisitors,
            topPages: s.topPages,
            topReferrers: s.topReferrers,
            createdAt: new Date(),
          })),
        );
        counts.analyticsSummaries = sourceSummaries.length;
      }

      const sourceEvents = await tx
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.websiteProgressId, source.id))
        .limit(5000);
      if (sourceEvents.length) {
        const chunkSize = 200;
        for (let i = 0; i < sourceEvents.length; i += chunkSize) {
          const chunk = sourceEvents.slice(i, i + chunkSize);
          await tx.insert(analyticsEvents).values(
            chunk.map((e) => ({
              websiteProgressId: created.id,
              eventType: e.eventType,
              page: e.page,
              referrer: e.referrer,
              userAgent: e.userAgent,
              deviceType: e.deviceType,
              sessionId: e.sessionId,
              metadata: e.metadata,
              ipHash: e.ipHash,
              timestamp: e.timestamp,
              createdAt: new Date(),
            })),
          );
        }
        counts.analyticsEvents = sourceEvents.length;
      }

      await tx.update(users).set({ isDemo: true }).where(eq(users.id, targetUserId));

      return created;
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      throw Object.assign(new Error("Demo slug already in use"), { status: 409 });
    }
    throw err;
  }

  try {
    await storage.createAnalyticsKey(newWebsite.id, domain);
  } catch (err) {
    console.warn("Demo clone: analytics key create failed (non-fatal)", err);
  }

  return { website: newWebsite, counts };
}
