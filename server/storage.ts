import { users, subscriptions, transactions, websiteInvoices, emails, newsletterSubscribers, newsletterCampaigns, emailTemplates, websiteAnalyticsKeys, analyticsEvents, analyticsDailySummaries, templates, stripePrices, contacts, tags, contactTags, customPayments, paymentObligations, paymentSettlements, type User, type InsertUser, type Subscription, type Transaction, type InsertTransaction, type WebsiteInvoice, type InsertWebsiteInvoice, type Email, type InsertEmail, UserRole, type NewsletterCampaign, type InsertNewsletterCampaign, type WebsiteAnalyticsKey, type AnalyticsEvent, type AnalyticsDailySummary, type InsertAnalyticsEvent, type StripePrice, type InsertStripePrice, type Contact, type InsertContact, type Tag, type InsertTag, type ContactTag, type InsertContactTag, type CustomPayment, type InsertCustomPayment, type PaymentObligation, type InsertPaymentObligation, type PaymentSettlement, type InsertPaymentSettlement } from "@shared/schema";
import { db } from "./db";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getUserSubscriptions(userId: number): Promise<Subscription[]>;
  createSubscription(subscription: { 
    userId: number; 
    productType: string;
    productId: string;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    tier?: string | null;
    status: string; 
    price?: number | null;
    vatNumber?: string | null;
    city?: string | null;
    street?: string | null;
    number?: string | null;
    postalCode?: string | null;
    invoiceType?: string | null;
    pdfUrl?: string | null;
    billingPeriod?: string;
    createdAt?: Date;
    cancellationReason?: string | null;
    websiteProgressId?: number | null;
  }): Promise<Subscription>;
  updateSubscriptionPdf(id: number, pdfUrl: string): Promise<Subscription>;
  updateSubscriptionVatNumber(id: number, vatNumber: string): Promise<Subscription>;
  getAllSubscriptions(): Promise<Subscription[]>;
  getSubscriptionTransactions(subscriptionId: number): Promise<Transaction[]>;
  createTransaction(transaction: {
    subscriptionId: number;
    amount: number;
    currency: string;
    status: string;
    pdfUrl?: string | null;
    stripeInvoiceId?: string | null;
    paidAt?: Date | null;
    createdAt?: Date | null;
  }): Promise<Transaction>;
  updateTransactionPdf(id: number, pdfUrl: string): Promise<Transaction>;
  clearUserSubscriptions(userId: number): Promise<{ subscriptions: Subscription[], transactionPdfMap: Map<string, string | null> }>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  // Email operations
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmailStatus(id: number, status: string, messageId?: string, errorMessage?: string): Promise<Email>;
  getUserEmails(userId: number): Promise<Email[]>;
  // Newsletter operations
  getNewsletterSubscribers(websiteProgressId: number): Promise<any[]>;
  createNewsletterSubscriber(subscriber: any): Promise<any>;
  updateNewsletterSubscriber(id: number, websiteProgressId: number, updates: any): Promise<any>;
  deleteNewsletterSubscriber(id: number, websiteProgressId: number): Promise<void>;
  getNewsletterSubscriberByToken(token: string): Promise<any>;
  confirmNewsletterSubscriber(token: string): Promise<any>;
  // Campaign operations
  getNewsletterCampaigns(websiteProgressId: number): Promise<NewsletterCampaign[]>;
  getNewsletterCampaignById(id: number, websiteProgressId: number): Promise<NewsletterCampaign | undefined>;
  createNewsletterCampaign(campaign: InsertNewsletterCampaign): Promise<NewsletterCampaign>;
  updateNewsletterCampaign(id: number, websiteProgressId: number, updates: Partial<NewsletterCampaign>): Promise<NewsletterCampaign>;
  deleteNewsletterCampaign(id: number, websiteProgressId: number): Promise<void>;
  updateCampaignStats(id: number, stats: { openCount?: number; clickCount?: number }): Promise<NewsletterCampaign>;
  // Analytics operations
  getAnalyticsKeyByWebsiteId(websiteProgressId: number): Promise<WebsiteAnalyticsKey | undefined>;
  getAnalyticsKeyByApiKey(apiKey: string): Promise<WebsiteAnalyticsKey | undefined>;
  createAnalyticsKey(websiteProgressId: number, domain: string): Promise<WebsiteAnalyticsKey>;
  updateAnalyticsKeyStatus(id: number, isActive: boolean): Promise<WebsiteAnalyticsKey>;
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(websiteProgressId: number, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getAnalyticsSummary(websiteProgressId: number, startDate?: Date, endDate?: Date): Promise<{
    pageviews: number;
    uniqueVisitors: number;
    bounceRate: number;
    avgSessionDuration: number;
    topPages: { page: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
    deviceBreakdown: { device: string; count: number }[];
    trafficSources: { source: string; count: number }[];
    dailyStats: { date: string; pageviews: number; visitors: number; sessions: number }[];
  }>;
  // Template operations
  getAllTemplates(): Promise<any[]>;
  getTemplateById(id: number): Promise<any>;
  createTemplate(template: any): Promise<any>;
  updateTemplate(id: number, updates: any): Promise<any>;
  deleteTemplate(id: number): Promise<void>;
  // Stripe pricing operations
  getAllStripePrices(): Promise<StripePrice[]>;
  saveStripePrices(prices: InsertStripePrice[]): Promise<void>;
  // Contact operations (NEW TAGS SYSTEM)
  getContacts(websiteProgressId: number): Promise<Contact[]>;
  getContactById(id: number): Promise<Contact | undefined>;
  getContactByEmail(email: string, websiteProgressId: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, websiteProgressId: number, updates: Partial<Contact>): Promise<Contact>;
  deleteContact(id: number, websiteProgressId: number): Promise<void>;
  confirmContact(token: string): Promise<Contact | undefined>;
  unsubscribeContact(id: number): Promise<Contact>;
  // Tag operations (NEW TAGS SYSTEM)
  getTags(websiteProgressId: number): Promise<Tag[]>;
  getTagById(id: number): Promise<Tag | undefined>;
  getTagByName(name: string, websiteProgressId: number): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, websiteProgressId: number, updates: Partial<Tag>): Promise<Tag>;
  deleteTag(id: number, websiteProgressId: number): Promise<void>;
  // Contact-Tag relationship operations (NEW TAGS SYSTEM)
  assignTagToContact(contactId: number, tagId: number): Promise<ContactTag>;
  removeTagFromContact(contactId: number, tagId: number): Promise<void>;
  getContactsByTag(tagId: number): Promise<Contact[]>;
  getContactsByTags(websiteProgressId: number, tagIds: number[]): Promise<Contact[]>;
  getContactTags(contactId: number): Promise<Tag[]>;
  // System tags initialization (NEW TAGS SYSTEM)
  createSystemTagsForWebsite(websiteProgressId: number): Promise<void>;
  // Website Invoice operations
  createWebsiteInvoice(invoice: InsertWebsiteInvoice): Promise<WebsiteInvoice>;
  getWebsiteInvoices(websiteProgressId: number): Promise<WebsiteInvoice[]>;
  getWebsiteInvoiceById(id: number): Promise<WebsiteInvoice | undefined>;
  getAllWebsiteInvoices(): Promise<WebsiteInvoice[]>;
  deleteWebsiteInvoice(id: number): Promise<void>;
  updateWebsiteInvoice(id: number, updates: Partial<WebsiteInvoice>): Promise<WebsiteInvoice>;
  // Custom Payment operations
  getAllCustomPayments(): Promise<CustomPayment[]>;
  getCustomPaymentById(id: number): Promise<CustomPayment | undefined>;
  getActiveCustomPayments(): Promise<CustomPayment[]>;
  createCustomPayment(payment: InsertCustomPayment): Promise<CustomPayment>;
  updateCustomPayment(id: number, updates: Partial<CustomPayment>): Promise<CustomPayment>;
  stopCustomPayment(id: number): Promise<CustomPayment>;
  excludeDateFromCustomPayment(id: number, dateString: string): Promise<CustomPayment>;
  deleteCustomPayment(id: number): Promise<void>;
  // Payment Obligation operations
  getAllPaymentObligations(): Promise<PaymentObligation[]>;
  getPaymentObligationById(id: number): Promise<PaymentObligation | undefined>;
  getPaymentObligationsByStatus(status: string): Promise<PaymentObligation[]>;
  getOutstandingObligations(): Promise<PaymentObligation[]>;
  getObligationsByCustomPaymentId(customPaymentId: number): Promise<PaymentObligation[]>;
  getObligationsByStripeInvoiceId(stripeInvoiceId: string): Promise<PaymentObligation | undefined>;
  createPaymentObligation(obligation: InsertPaymentObligation): Promise<PaymentObligation>;
  updatePaymentObligation(id: number, updates: Partial<PaymentObligation>): Promise<PaymentObligation>;
  markObligationSettled(id: number): Promise<PaymentObligation>;
  revertObligationToUnpaid(id: number): Promise<PaymentObligation>;
  markObligationStopped(id: number): Promise<PaymentObligation>;
  markObligationWrittenOff(id: number, notes?: string): Promise<PaymentObligation>;
  // Payment Settlement operations
  getSettlementsByObligationId(obligationId: number): Promise<PaymentSettlement[]>;
  createPaymentSettlement(settlement: InsertPaymentSettlement): Promise<PaymentSettlement>;
  getTotalSettledForObligation(obligationId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        role: insertUser.role || UserRole.SUBSCRIBER
      })
      .returning();

    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserSubscriptions(userId: number): Promise<Subscription[]> {
    const userSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    return userSubscriptions;
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    const allSubscriptions = await db.select().from(subscriptions);
    return allSubscriptions;
  }

  async createSubscription(data: { 
    userId: number; 
    productType: string;
    productId: string;
    stripeSubscriptionId?: string | null;
    stripeSubscriptionItemId?: string | null;
    tier?: string | null;
    status: string; 
    price?: number | null;
    vatNumber?: string | null;
    city?: string | null;
    street?: string | null;
    number?: string | null;
    postalCode?: string | null;
    invoiceType?: string | null;
    pdfUrl?: string | null;
    billingPeriod?: string;
    createdAt?: Date;
    cancellationReason?: string | null;
    websiteProgressId?: number | null;
  }): Promise<Subscription> {
    try {
      const [subscription] = await db
        .insert(subscriptions)
        .values({
          userId: data.userId,
          websiteProgressId: data.websiteProgressId || null,
          productType: data.productType,
          productId: data.productId,
          stripeSubscriptionId: data.stripeSubscriptionId || null,
          stripeSubscriptionItemId: data.stripeSubscriptionItemId || null,
          tier: data.tier || null,
          status: data.status,
          price: data.price || null,
          vatNumber: data.vatNumber || null,
          city: data.city || null,
          street: data.street || null,
          number: data.number || null,
          postalCode: data.postalCode || null,
          invoiceType: data.invoiceType || null,
          pdfUrl: data.pdfUrl || null,
          billingPeriod: data.billingPeriod || 'monthly',
          createdAt: data.createdAt || new Date(),
          cancellationReason: data.cancellationReason || null,
        })
        .returning();

      return subscription;
    } catch (error: any) {
      console.error('Database error creating subscription:', {
        error: error?.message,
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
        data: {
          userId: data.userId,
          productType: data.productType,
          productId: data.productId,
          status: data.status,
        }
      });
      throw error;
    }
  }

  async updateSubscriptionPdf(id: number, pdfUrl: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ pdfUrl })
      .where(eq(subscriptions.id, id))
      .returning();

    return subscription;
  }

  async updateSubscriptionVatNumber(id: number, vatNumber: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ vatNumber })
      .where(eq(subscriptions.id, id))
      .returning();

    return subscription;
  }

  async getSubscriptionTransactions(subscriptionId: number): Promise<Transaction[]> {
    const subscriptionTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.subscriptionId, subscriptionId));

    return subscriptionTransactions;
  }

  async createTransaction(transactionData: InsertTransaction & { createdAt?: Date; paidAt?: Date | null; stripeInvoiceId?: string | null }): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values({
      ...transactionData,
      createdAt: transactionData.createdAt || new Date(),
      paidAt: transactionData.paidAt || null,
      stripeInvoiceId: transactionData.stripeInvoiceId || null,
    }).returning();
    return transaction;
  }

  async updateTransactionPdf(id: number, pdfUrl: string): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set({ pdfUrl })
      .where(eq(transactions.id, id))
      .returning();

    return transaction;
  }

  async clearUserSubscriptions(userId: number): Promise<{ subscriptions: Subscription[], transactionPdfMap: Map<string, string | null> }> {

    const userSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const transactionPdfMap = new Map<string, string | null>();

    for (const subscription of userSubscriptions) {
      const transactionsList = await db
        .select()
        .from(transactions)
        .where(eq(transactions.subscriptionId, subscription.id));

      for (const transaction of transactionsList) {
        const key = `${subscription.tier}_${transaction.amount}`;
        transactionPdfMap.set(key, transaction.pdfUrl);
      }

      await db
        .delete(transactions)
        .where(eq(transactions.subscriptionId, subscription.id));
    }

    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, userId));

    return { subscriptions: userSubscriptions, transactionPdfMap };
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  // Email operations
  async createEmail(emailData: InsertEmail): Promise<Email> {
    const [email] = await db.insert(emails).values({
      ...emailData,
      createdAt: new Date(),
    }).returning();
    return email;
  }

  async updateEmailStatus(id: number, status: string, messageId?: string, errorMessage?: string): Promise<Email> {
    const [email] = await db
      .update(emails)
      .set({ 
        status, 
        messageId: messageId || null, 
        errorMessage: errorMessage || null 
      })
      .where(eq(emails.id, id))
      .returning();
    return email;
  }

  async getUserEmails(userId: number): Promise<Email[]> {
    const userEmails = await db
      .select()
      .from(emails)
      .where(eq(emails.userId, userId))
      .orderBy(emails.createdAt);
    return userEmails;
  }

    async getSubscriptionById(subscriptionId: number): Promise<Subscription | null> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    return result[0] || null;
  }

  // Newsletter operations
  async getNewsletterSubscribers(websiteProgressId: number): Promise<any[]> {
    const subscribers = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.websiteProgressId, websiteProgressId));
    return subscribers;
  }

  async createNewsletterSubscriber(subscriberData: any): Promise<any> {
    const [subscriber] = await db
      .insert(newsletterSubscribers)
      .values({
        ...subscriberData,
        subscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return subscriber;
  }

  async updateNewsletterSubscriber(id: number, websiteProgressId: number, updates: any): Promise<any> {
    const [subscriber] = await db
      .update(newsletterSubscribers)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(newsletterSubscribers.id, id),
          eq(newsletterSubscribers.websiteProgressId, websiteProgressId)
        )
      )
      .returning();
    return subscriber;
  }

  async deleteNewsletterSubscriber(id: number, websiteProgressId: number): Promise<void> {
    await db.delete(newsletterSubscribers).where(
      and(
        eq(newsletterSubscribers.id, id),
        eq(newsletterSubscribers.websiteProgressId, websiteProgressId)
      )
    );
  }

  async getNewsletterSubscriberByToken(token: string): Promise<any> {
    const [subscriber] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.confirmationToken, token));
    return subscriber;
  }

  async confirmNewsletterSubscriber(token: string): Promise<any> {
    const [subscriber] = await db
      .update(newsletterSubscribers)
      .set({ 
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmationToken: null,
        updatedAt: new Date()
      })
      .where(eq(newsletterSubscribers.confirmationToken, token))
      .returning();
    return subscriber;
  }

  async getNewsletterCampaigns(websiteProgressId: number): Promise<NewsletterCampaign[]> {
    const campaigns = await db
      .select({
        id: newsletterCampaigns.id,
        websiteProgressId: newsletterCampaigns.websiteProgressId,
        title: newsletterCampaigns.title,
        description: newsletterCampaigns.description,
        purpose: newsletterCampaigns.purpose,
        tagIds: newsletterCampaigns.tagIds,
        excludedTagIds: newsletterCampaigns.excludedTagIds,
        subject: newsletterCampaigns.subject,
        message: newsletterCampaigns.message,
        status: newsletterCampaigns.status,
        scheduledFor: newsletterCampaigns.scheduledFor,
        sentAt: newsletterCampaigns.sentAt,
        templateId: newsletterCampaigns.templateId,
        templateName: emailTemplates.name,
        recipientCount: newsletterCampaigns.recipientCount,
        sentCount: newsletterCampaigns.sentCount,
        deliveredCount: newsletterCampaigns.deliveredCount,
        bounceCount: newsletterCampaigns.bounceCount,
        complaintCount: newsletterCampaigns.complaintCount,
        openCount: newsletterCampaigns.openCount,
        clickCount: newsletterCampaigns.clickCount,
        senderEmail: newsletterCampaigns.senderEmail,
        senderName: newsletterCampaigns.senderName,
        excludedSubscriberIds: newsletterCampaigns.excludedSubscriberIds,
        emailHtml: newsletterCampaigns.emailHtml,
        emailDesign: newsletterCampaigns.emailDesign,
        createdAt: newsletterCampaigns.createdAt,
        updatedAt: newsletterCampaigns.updatedAt,
      })
      .from(newsletterCampaigns)
      .leftJoin(emailTemplates, eq(newsletterCampaigns.templateId, emailTemplates.id))
      .where(eq(newsletterCampaigns.websiteProgressId, websiteProgressId));
    return campaigns as NewsletterCampaign[];
  }

  async getNewsletterCampaignById(id: number, websiteProgressId: number): Promise<NewsletterCampaign | undefined> {
    const [campaign] = await db
      .select({
        id: newsletterCampaigns.id,
        websiteProgressId: newsletterCampaigns.websiteProgressId,
        title: newsletterCampaigns.title,
        description: newsletterCampaigns.description,
        purpose: newsletterCampaigns.purpose,
        tagIds: newsletterCampaigns.tagIds,
        excludedTagIds: newsletterCampaigns.excludedTagIds,
        subject: newsletterCampaigns.subject,
        message: newsletterCampaigns.message,
        status: newsletterCampaigns.status,
        scheduledFor: newsletterCampaigns.scheduledFor,
        sentAt: newsletterCampaigns.sentAt,
        templateId: newsletterCampaigns.templateId,
        recipientCount: newsletterCampaigns.recipientCount,
        sentCount: newsletterCampaigns.sentCount,
        deliveredCount: newsletterCampaigns.deliveredCount,
        bounceCount: newsletterCampaigns.bounceCount,
        complaintCount: newsletterCampaigns.complaintCount,
        openCount: newsletterCampaigns.openCount,
        clickCount: newsletterCampaigns.clickCount,
        senderEmail: newsletterCampaigns.senderEmail,
        senderName: newsletterCampaigns.senderName,
        excludedSubscriberIds: newsletterCampaigns.excludedSubscriberIds,
        emailHtml: newsletterCampaigns.emailHtml,
        emailDesign: newsletterCampaigns.emailDesign,
        createdAt: newsletterCampaigns.createdAt,
        updatedAt: newsletterCampaigns.updatedAt,
      })
      .from(newsletterCampaigns)
      .where(
        and(
          eq(newsletterCampaigns.id, id),
          eq(newsletterCampaigns.websiteProgressId, websiteProgressId)
        )
      );
    return campaign as NewsletterCampaign | undefined;
  }

  async createNewsletterCampaign(campaignData: InsertNewsletterCampaign): Promise<NewsletterCampaign> {
    const [campaign] = await db
      .insert(newsletterCampaigns)
      .values({
        ...campaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return campaign;
  }

  async updateNewsletterCampaign(id: number, websiteProgressId: number, updates: Partial<NewsletterCampaign>): Promise<NewsletterCampaign> {
    const [campaign] = await db
      .update(newsletterCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(newsletterCampaigns.id, id),
          eq(newsletterCampaigns.websiteProgressId, websiteProgressId)
        )
      )
      .returning();
    return campaign;
  }

  async deleteNewsletterCampaign(id: number, websiteProgressId: number): Promise<void> {
    await db.delete(newsletterCampaigns).where(
      and(
        eq(newsletterCampaigns.id, id),
        eq(newsletterCampaigns.websiteProgressId, websiteProgressId)
      )
    );
  }

  async updateCampaignStats(id: number, stats: { openCount?: number; clickCount?: number }): Promise<NewsletterCampaign> {
    const [campaign] = await db
      .update(newsletterCampaigns)
      .set({ ...stats, updatedAt: new Date() })
      .where(eq(newsletterCampaigns.id, id))
      .returning();
    return campaign;
  }

  async getAnalyticsKeyByWebsiteId(websiteProgressId: number): Promise<WebsiteAnalyticsKey | undefined> {
    const [key] = await db
      .select()
      .from(websiteAnalyticsKeys)
      .where(eq(websiteAnalyticsKeys.websiteProgressId, websiteProgressId));
    return key;
  }

  async getAnalyticsKeyByApiKey(apiKey: string): Promise<WebsiteAnalyticsKey | undefined> {
    const [key] = await db
      .select()
      .from(websiteAnalyticsKeys)
      .where(eq(websiteAnalyticsKeys.apiKey, apiKey));
    return key;
  }

  async createAnalyticsKey(websiteProgressId: number, domain: string): Promise<WebsiteAnalyticsKey> {
    const apiKey = crypto.randomUUID();
    const [key] = await db
      .insert(websiteAnalyticsKeys)
      .values({
        websiteProgressId,
        domain,
        apiKey,
        isActive: true,
      })
      .returning();
    return key;
  }

  async updateAnalyticsKeyStatus(id: number, isActive: boolean): Promise<WebsiteAnalyticsKey> {
    const [key] = await db
      .update(websiteAnalyticsKeys)
      .set({ isActive })
      .where(eq(websiteAnalyticsKeys.id, id))
      .returning();
    return key;
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [newEvent] = await db
      .insert(analyticsEvents)
      .values(event)
      .returning();
    return newEvent;
  }

  async getAnalyticsEvents(websiteProgressId: number, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    if (startDate && endDate) {
      const events = await db
        .select()
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.websiteProgressId, websiteProgressId),
            gte(analyticsEvents.timestamp, startDate),
            lte(analyticsEvents.timestamp, endDate)
          )
        );
      return events;
    }

    const events = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.websiteProgressId, websiteProgressId));
    return events;
  }

  async getAnalyticsSummary(websiteProgressId: number, startDate?: Date, endDate?: Date): Promise<{
    pageviews: number;
    uniqueVisitors: number;
    bounceRate: number;
    avgSessionDuration: number;
    topPages: { page: string; count: number }[];
    topReferrers: { referrer: string; count: number }[];
    deviceBreakdown: { device: string; count: number }[];
    trafficSources: { source: string; count: number }[];
    dailyStats: { date: string; pageviews: number; visitors: number; sessions: number }[];
  }> {
    const events = await this.getAnalyticsEvents(websiteProgressId, startDate, endDate);
    
    const pageviews = events.length;
    const uniqueVisitors = new Set(events.map(e => e.ipHash).filter(Boolean)).size;
    
    // Calculate bounce rate (sessions with only 1 pageview)
    const sessionPageviews = new Map<string, number>();
    events.forEach(event => {
      const sessionKey = event.sessionId || event.ipHash || 'unknown';
      sessionPageviews.set(sessionKey, (sessionPageviews.get(sessionKey) || 0) + 1);
    });
    const totalSessions = sessionPageviews.size;
    const bouncedSessions = Array.from(sessionPageviews.values()).filter(count => count === 1).length;
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
    
    // Calculate average session duration (simplified: use 30 seconds per pageview as estimate)
    const avgSessionDuration = totalSessions > 0 ? (pageviews / totalSessions) * 30 : 0;
    
    // Top pages
    const pageCounts = new Map<string, number>();
    events.forEach(event => {
      pageCounts.set(event.page, (pageCounts.get(event.page) || 0) + 1);
    });
    const topPages = Array.from(pageCounts.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Top referrers
    const referrerCounts = new Map<string, number>();
    events.forEach(event => {
      if (event.referrer) {
        referrerCounts.set(event.referrer, (referrerCounts.get(event.referrer) || 0) + 1);
      }
    });
    const topReferrers = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Device breakdown
    const deviceCounts = new Map<string, number>();
    events.forEach(event => {
      const device = event.deviceType || this.detectDevice(event.userAgent || '');
      deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
    });
    const deviceBreakdown = Array.from(deviceCounts.entries())
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);
    
    // Traffic sources
    const sourceCounts = new Map<string, number>();
    events.forEach(event => {
      const source = this.categorizeTrafficSource(event.referrer);
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });
    const trafficSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
    
    // Daily stats
    const dailyData = new Map<string, { pageviews: number; visitors: Set<string>; sessions: Set<string> }>();
    events.forEach(event => {
      const date = event.timestamp.toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { pageviews: 0, visitors: new Set(), sessions: new Set() });
      }
      const data = dailyData.get(date)!;
      data.pageviews++;
      if (event.ipHash) data.visitors.add(event.ipHash);
      if (event.sessionId || event.ipHash) data.sessions.add(event.sessionId || event.ipHash!);
    });
    
    const dailyStats = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        pageviews: data.pageviews,
        visitors: data.visitors.size,
        sessions: data.sessions.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      pageviews,
      uniqueVisitors,
      bounceRate,
      avgSessionDuration,
      topPages,
      topReferrers,
      deviceBreakdown,
      trafficSources,
      dailyStats,
    };
  }
  
  private detectDevice(userAgent: string): string {
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'Mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'Tablet';
    }
    return 'Desktop';
  }
  
  private categorizeTrafficSource(referrer: string | null): string {
    if (!referrer) return 'Direct';
    
    const ref = referrer.toLowerCase();
    
    if (ref.includes('google.com') || ref.includes('google.')) return 'Google';
    if (ref.includes('facebook.com') || ref.includes('fb.com')) return 'Facebook';
    if (ref.includes('instagram.com')) return 'Instagram';
    if (ref.includes('twitter.com') || ref.includes('t.co')) return 'Twitter/X';
    if (ref.includes('linkedin.com')) return 'LinkedIn';
    if (ref.includes('youtube.com')) return 'YouTube';
    if (ref.includes('pinterest.com')) return 'Pinterest';
    if (ref.includes('reddit.com')) return 'Reddit';
    if (ref.includes('tiktok.com')) return 'TikTok';
    
    return 'Other';
  }

  // Template operations
  async getAllTemplates(): Promise<any[]> {
    const result = await db.query.templates.findMany({
      orderBy: (templates, { asc }) => [asc(templates.id)],
    });
    return result;
  }

  async getTemplateById(id: number): Promise<any> {
    const [template] = await db.query.templates.findMany({
      where: (templates, { eq }) => eq(templates.id, id),
    });
    return template;
  }

  async createTemplate(template: any): Promise<any> {
    const [newTemplate] = await db
      .insert(templates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateTemplate(id: number, updates: any): Promise<any> {
    const [updated] = await db
      .update(templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return updated;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  // Stripe pricing operations
  async getAllStripePrices(): Promise<StripePrice[]> {
    const result = await db.select().from(stripePrices);
    return result;
  }

  async saveStripePrices(prices: InsertStripePrice[]): Promise<void> {
    if (prices.length === 0) return;

    // Use upsert logic: insert or update based on tier + billing period
    for (const price of prices) {
      await db
        .insert(stripePrices)
        .values({
          ...price,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [stripePrices.tier, stripePrices.billingPeriod],
          set: {
            priceId: price.priceId,
            unitAmount: price.unitAmount,
            currency: price.currency,
            updatedAt: new Date(),
          },
        });
    }
  }

  // Contact operations (NEW TAGS SYSTEM)
  async getContacts(websiteProgressId: number): Promise<Contact[]> {
    const result = await db
      .select()
      .from(contacts)
      .where(eq(contacts.websiteProgressId, websiteProgressId))
      .orderBy(contacts.createdAt);
    
    // Fetch tags for each contact
    const contactsWithTags = await Promise.all(
      result.map(async (contact) => {
        const tagsList = await this.getContactTags(contact.id);
        return {
          ...contact,
          tags: tagsList,
        };
      })
    );
    
    return contactsWithTags as any;
  }

  async getContactById(id: number): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
    
    if (!contact) {
      return undefined;
    }
    
    // Fetch tags for the contact
    const tagsList = await this.getContactTags(contact.id);
    return {
      ...contact,
      tags: tagsList,
    } as any;
  }

  async getContactByEmail(email: string, websiteProgressId: number): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.email, email),
          eq(contacts.websiteProgressId, websiteProgressId)
        )
      )
      .limit(1);
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    // Generate confirmation token if not provided
    const confirmationToken = contact.confirmationToken || crypto.randomBytes(32).toString('hex');
    
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contact,
        confirmationToken,
        updatedAt: new Date(),
      })
      .returning();
    return newContact;
  }

  async updateContact(id: number, websiteProgressId: number, updates: Partial<Contact>): Promise<Contact> {
    const [updated] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.websiteProgressId, websiteProgressId)
        )
      )
      .returning();
    return updated;
  }

  async deleteContact(id: number, websiteProgressId: number): Promise<void> {
    await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.websiteProgressId, websiteProgressId)
        )
      );
  }

  async confirmContact(token: string): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(contacts.confirmationToken, token))
      .returning();
    return contact;
  }

  async unsubscribeContact(id: number): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  // Tag operations (NEW TAGS SYSTEM)
  async getTags(websiteProgressId: number): Promise<Tag[]> {
    const result = await db
      .select()
      .from(tags)
      .where(eq(tags.websiteProgressId, websiteProgressId))
      .orderBy(tags.name);
    return result;
  }

  async getTagById(id: number): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1);
    return tag;
  }

  async getTagByName(name: string, websiteProgressId: number): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.name, name),
          eq(tags.websiteProgressId, websiteProgressId)
        )
      )
      .limit(1);
    return tag;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db
      .insert(tags)
      .values(tag)
      .returning();
    return newTag;
  }

  async updateTag(id: number, websiteProgressId: number, updates: Partial<Tag>): Promise<Tag> {
    const [updated] = await db
      .update(tags)
      .set(updates)
      .where(
        and(
          eq(tags.id, id),
          eq(tags.websiteProgressId, websiteProgressId)
        )
      )
      .returning();
    return updated;
  }

  async deleteTag(id: number, websiteProgressId: number): Promise<void> {
    await db
      .delete(tags)
      .where(
        and(
          eq(tags.id, id),
          eq(tags.websiteProgressId, websiteProgressId)
        )
      );
  }

  // Contact-Tag relationship operations (NEW TAGS SYSTEM)
  async assignTagToContact(contactId: number, tagId: number): Promise<ContactTag> {
    const [contactTag] = await db
      .insert(contactTags)
      .values({ contactId, tagId })
      .onConflictDoNothing()
      .returning();
    return contactTag;
  }

  async removeTagFromContact(contactId: number, tagId: number): Promise<void> {
    await db
      .delete(contactTags)
      .where(
        and(
          eq(contactTags.contactId, contactId),
          eq(contactTags.tagId, tagId)
        )
      );
  }

  async getContactsByTag(tagId: number): Promise<Contact[]> {
    const result = await db
      .select({
        id: contacts.id,
        websiteProgressId: contacts.websiteProgressId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        status: contacts.status,
        confirmationToken: contacts.confirmationToken,
        subscribedAt: contacts.subscribedAt,
        confirmedAt: contacts.confirmedAt,
        unsubscribedAt: contacts.unsubscribedAt,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .innerJoin(contactTags, eq(contactTags.contactId, contacts.id))
      .where(eq(contactTags.tagId, tagId));
    return result;
  }

  async getContactsByTags(websiteProgressId: number, tagIds: number[]): Promise<Contact[]> {
    if (tagIds.length === 0) {
      return this.getContacts(websiteProgressId);
    }

    // Get contacts that have ANY of the specified tags (OR logic for campaign sending)
    const result = await db
      .select({
        id: contacts.id,
        websiteProgressId: contacts.websiteProgressId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        status: contacts.status,
        confirmationToken: contacts.confirmationToken,
        subscribedAt: contacts.subscribedAt,
        confirmedAt: contacts.confirmedAt,
        unsubscribedAt: contacts.unsubscribedAt,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .innerJoin(contactTags, eq(contactTags.contactId, contacts.id))
      .where(
        and(
          eq(contacts.websiteProgressId, websiteProgressId),
          inArray(contactTags.tagId, tagIds)
        )
      )
      .groupBy(contacts.id);
    
    // Fetch tags for each contact
    const contactsWithTags = await Promise.all(
      result.map(async (contact) => {
        const tagsList = await this.getContactTags(contact.id);
        return {
          ...contact,
          tags: tagsList,
        };
      })
    );
    
    return contactsWithTags as any;
  }

  async getContactTags(contactId: number): Promise<Tag[]> {
    const result = await db
      .select({
        id: tags.id,
        websiteProgressId: tags.websiteProgressId,
        name: tags.name,
        description: tags.description,
        color: tags.color,
        isSystem: tags.isSystem,
        createdAt: tags.createdAt,
      })
      .from(tags)
      .innerJoin(contactTags, eq(contactTags.tagId, tags.id))
      .where(eq(contactTags.contactId, contactId));
    return result;
  }

  async createSystemTagsForWebsite(websiteProgressId: number): Promise<void> {
    // No system tags needed - subscription status is managed via the contact status field, not tags
    // Tags are intended for user-defined organization/categorization of contacts
  }

  async createWebsiteInvoice(invoice: InsertWebsiteInvoice): Promise<WebsiteInvoice> {
    const [createdInvoice] = await db
      .insert(websiteInvoices)
      .values(invoice)
      .returning();
    return createdInvoice;
  }

  async getWebsiteInvoices(websiteProgressId: number): Promise<WebsiteInvoice[]> {
    const invoices = await db
      .select()
      .from(websiteInvoices)
      .where(eq(websiteInvoices.websiteProgressId, websiteProgressId))
      .orderBy(sql`${websiteInvoices.issueDate} DESC NULLS LAST, ${websiteInvoices.createdAt} DESC`);
    return invoices;
  }

  async getWebsiteInvoiceById(id: number): Promise<WebsiteInvoice | undefined> {
    const [invoice] = await db
      .select()
      .from(websiteInvoices)
      .where(eq(websiteInvoices.id, id));
    return invoice;
  }

  async getAllWebsiteInvoices(): Promise<WebsiteInvoice[]> {
    const invoices = await db
      .select()
      .from(websiteInvoices)
      .orderBy(sql`${websiteInvoices.createdAt} DESC`);
    return invoices;
  }

  async deleteWebsiteInvoice(id: number): Promise<void> {
    await db.delete(websiteInvoices).where(eq(websiteInvoices.id, id));
  }

  async updateWebsiteInvoice(id: number, updates: Partial<WebsiteInvoice>): Promise<WebsiteInvoice> {
    const [updatedInvoice] = await db
      .update(websiteInvoices)
      .set(updates)
      .where(eq(websiteInvoices.id, id))
      .returning();
    return updatedInvoice;
  }

  // Custom Payment operations
  async getAllCustomPayments(): Promise<CustomPayment[]> {
    const payments = await db
      .select()
      .from(customPayments)
      .orderBy(sql`${customPayments.createdAt} DESC`);
    return payments;
  }

  async getCustomPaymentById(id: number): Promise<CustomPayment | undefined> {
    const [payment] = await db
      .select()
      .from(customPayments)
      .where(eq(customPayments.id, id));
    return payment;
  }

  async getActiveCustomPayments(): Promise<CustomPayment[]> {
    const payments = await db
      .select()
      .from(customPayments)
      .where(eq(customPayments.isActive, true))
      .orderBy(sql`${customPayments.createdAt} DESC`);
    return payments;
  }

  async createCustomPayment(payment: InsertCustomPayment): Promise<CustomPayment> {
    const [createdPayment] = await db
      .insert(customPayments)
      .values({
        ...payment,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return createdPayment;
  }

  async updateCustomPayment(id: number, updates: Partial<CustomPayment>): Promise<CustomPayment> {
    const [updatedPayment] = await db
      .update(customPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customPayments.id, id))
      .returning();
    return updatedPayment;
  }

  async stopCustomPayment(id: number): Promise<CustomPayment> {
    const [stoppedPayment] = await db
      .update(customPayments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(customPayments.id, id))
      .returning();
    return stoppedPayment;
  }

  async excludeDateFromCustomPayment(id: number, dateString: string): Promise<CustomPayment> {
    // First get the current payment to get existing excluded dates
    const [payment] = await db
      .select()
      .from(customPayments)
      .where(eq(customPayments.id, id));
    
    if (!payment) {
      throw new Error("Custom payment not found");
    }
    
    // Add the new date to the excluded dates array
    const existingExcludedDates = payment.excludedDates || [];
    if (!existingExcludedDates.includes(dateString)) {
      existingExcludedDates.push(dateString);
    }
    
    const [updatedPayment] = await db
      .update(customPayments)
      .set({ 
        excludedDates: existingExcludedDates,
        updatedAt: new Date() 
      })
      .where(eq(customPayments.id, id))
      .returning();
    
    return updatedPayment;
  }

  async deleteCustomPayment(id: number): Promise<void> {
    // First get all payment obligations for this custom payment
    const obligations = await db
      .select({ id: paymentObligations.id })
      .from(paymentObligations)
      .where(eq(paymentObligations.customPaymentId, id));
    
    // Delete all payment settlements for those obligations
    if (obligations.length > 0) {
      const obligationIds = obligations.map(o => o.id);
      await db.delete(paymentSettlements).where(inArray(paymentSettlements.obligationId, obligationIds));
    }
    
    // Then delete any payment obligations that reference this custom payment
    await db.delete(paymentObligations).where(eq(paymentObligations.customPaymentId, id));
    
    // Finally delete the custom payment itself
    await db.delete(customPayments).where(eq(customPayments.id, id));
  }

  // Payment Obligation operations
  async getAllPaymentObligations(): Promise<PaymentObligation[]> {
    const obligations = await db
      .select()
      .from(paymentObligations)
      .orderBy(sql`${paymentObligations.dueDate} DESC`);
    return obligations;
  }

  async getPaymentObligationById(id: number): Promise<PaymentObligation | undefined> {
    const [obligation] = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.id, id));
    return obligation;
  }

  async getPaymentObligationsByStatus(status: string): Promise<PaymentObligation[]> {
    const obligations = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.status, status))
      .orderBy(sql`${paymentObligations.dueDate} DESC`);
    return obligations;
  }

  async getOutstandingObligations(): Promise<PaymentObligation[]> {
    const obligations = await db
      .select()
      .from(paymentObligations)
      .where(
        inArray(paymentObligations.status, ['pending', 'grace', 'retrying', 'delinquent', 'failed', 'stopped'])
      )
      .orderBy(sql`${paymentObligations.dueDate} ASC`);
    return obligations;
  }

  async getObligationsByCustomPaymentId(customPaymentId: number): Promise<PaymentObligation[]> {
    const obligations = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.customPaymentId, customPaymentId))
      .orderBy(sql`${paymentObligations.dueDate} DESC`);
    return obligations;
  }

  async getObligationsByStripeInvoiceId(stripeInvoiceId: string): Promise<PaymentObligation | undefined> {
    const [obligation] = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.stripeInvoiceId, stripeInvoiceId));
    return obligation;
  }

  async createPaymentObligation(obligation: InsertPaymentObligation): Promise<PaymentObligation> {
    const [createdObligation] = await db
      .insert(paymentObligations)
      .values({
        ...obligation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return createdObligation;
  }

  async updatePaymentObligation(id: number, updates: Partial<PaymentObligation>): Promise<PaymentObligation> {
    const [updatedObligation] = await db
      .update(paymentObligations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentObligations.id, id))
      .returning();
    return updatedObligation;
  }

  async markObligationSettled(id: number): Promise<PaymentObligation> {
    const [settledObligation] = await db
      .update(paymentObligations)
      .set({ status: 'settled', updatedAt: new Date() })
      .where(eq(paymentObligations.id, id))
      .returning();
    return settledObligation;
  }

  async revertObligationToUnpaid(id: number): Promise<PaymentObligation> {
    // Delete settlement records (reverting the "paid" status)
    await db.delete(paymentSettlements).where(eq(paymentSettlements.obligationId, id));
    // Set obligation back to pending
    const [revertedObligation] = await db
      .update(paymentObligations)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(paymentObligations.id, id))
      .returning();
    return revertedObligation;
  }

  async markObligationStopped(id: number): Promise<PaymentObligation> {
    const [stoppedObligation] = await db
      .update(paymentObligations)
      .set({ status: 'stopped', updatedAt: new Date() })
      .where(eq(paymentObligations.id, id))
      .returning();
    return stoppedObligation;
  }

  async markObligationWrittenOff(id: number, notes?: string): Promise<PaymentObligation> {
    const [writtenOffObligation] = await db
      .update(paymentObligations)
      .set({ 
        status: 'written_off', 
        notes: notes || null,
        updatedAt: new Date() 
      })
      .where(eq(paymentObligations.id, id))
      .returning();
    return writtenOffObligation;
  }

  // Payment Settlement operations
  async getSettlementsByObligationId(obligationId: number): Promise<PaymentSettlement[]> {
    const settlements = await db
      .select()
      .from(paymentSettlements)
      .where(eq(paymentSettlements.obligationId, obligationId))
      .orderBy(sql`${paymentSettlements.paidAt} DESC`);
    return settlements;
  }

  async createPaymentSettlement(settlement: InsertPaymentSettlement): Promise<PaymentSettlement> {
    const [createdSettlement] = await db
      .insert(paymentSettlements)
      .values({
        ...settlement,
        createdAt: new Date(),
      })
      .returning();
    return createdSettlement;
  }

  async getTotalSettledForObligation(obligationId: number): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${paymentSettlements.amountPaid}), 0)` })
      .from(paymentSettlements)
      .where(eq(paymentSettlements.obligationId, obligationId));
    return result[0]?.total || 0;
  }
}

export const storage = new DatabaseStorage();