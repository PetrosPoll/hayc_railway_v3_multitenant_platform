import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  unique,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const UserRole = {
  SUBSCRIBER: "subscriber",
  MODERATOR: "moderator", // New role with limited admin access
  ADMINISTRATOR: "administrator",
} as const;

// Define base permissions structure
export interface RolePermissionsType {
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewSubscriptions: boolean;
  canManageSubscriptions: boolean;
  canViewWebsites: boolean;
  canManageWebsites: boolean;
  canViewTemplates: boolean;
  canManageTemplates: boolean;
  canViewTips: boolean;
  canManageTips: boolean;
  canViewSettings: boolean;
  canManageSettings: boolean;
}

// Define permissions for each role
export const RolePermissions: Record<string, RolePermissionsType> = {
  subscriber: {
    canViewUsers: false,
    canManageUsers: false,
    canViewSubscriptions: false,
    canManageSubscriptions: false,
    canViewWebsites: false,
    canManageWebsites: false,
    canViewTemplates: false,
    canManageTemplates: false,
    canViewTips: false,
    canManageTips: false,
    canViewSettings: false,
    canManageSettings: false,
  },
  moderator: {
    canViewUsers: true,
    canManageUsers: false,
    canViewSubscriptions: true,
    canManageSubscriptions: false,
    canViewWebsites: true,
    canManageWebsites: true,
    canViewTemplates: true,
    canManageTemplates: false,
    canViewTips: true,
    canManageTips: true,
    canViewSettings: false,
    canManageSettings: false,
  },
  administrator: {
    canViewUsers: true,
    canManageUsers: true,
    canViewSubscriptions: true,
    canManageSubscriptions: true,
    canViewWebsites: true,
    canManageWebsites: true,
    canViewTemplates: true,
    canManageTemplates: true,
    canViewTips: true,
    canManageTips: true,
    canViewSettings: true,
    canManageSettings: true,
  },
};

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Email limits for different tiers, this is for how many newsletter emails a user can send per month
export const EMAIL_LIMITS = {
  BASIC: 0,
  ESSENTIAL: 3000,
  PRO: 10000,
} as const;

export function getEmailLimit(tier: string | null): number {
  if (!tier) return 0;
  const upperTier = tier.toUpperCase();
  if (upperTier === 'BASIC') return EMAIL_LIMITS.BASIC;
  if (upperTier === 'ESSENTIAL') return EMAIL_LIMITS.ESSENTIAL;
  if (upperTier === 'PRO') return EMAIL_LIMITS.PRO;
  return 0;
}

export const AccountKind = {
  CUSTOMER: "customer",
  STAFF: "staff",
} as const;

export type AccountKindType = typeof AccountKind[keyof typeof AccountKind];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  phone: text("phone"),
  stripeCustomerId: text("stripe_customer_id"),
  role: text("role").notNull().default(UserRole.SUBSCRIBER),
  accountKind: text("account_kind").notNull().default(AccountKind.CUSTOMER),
  language: text("language").default("en"),
  analyticsEmail: text("analytics_email"),
  vatNumber: text("vat_number"),
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true),
  tipEmailNotifications: boolean("tip_email_notifications").default(true),
  tipsEmailNotifications: boolean("tips_email_notifications").default(true),
  passwordResetToken: text("password_reset_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const websiteProgress = pgTable("website_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  domain: text("domain").notNull(),
  projectName: text("project_name"),
  websiteLanguage: text("website_language").default("en"),
  currentStage: integer("current_stage").notNull().default(1),
  media: jsonb("media").$type<Array<{url: string, publicId: string, name: string}>>().default([]),
  bonusEmails: integer("bonus_emails").default(0).notNull(),
  bonusEmailsExpiry: timestamp("bonus_emails_expiry"),
  bookingEnabled: boolean("booking_enabled").default(false).notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const websiteDomains = pgTable("website_domains", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const websitePages = pgTable("website_pages", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  status: text("status").notNull().default("draft"),
  contentJson: jsonb("content_json").$type<{
    sections: Array<{
      type: string;
      config?: Record<string, unknown>;
      items?: Array<Record<string, unknown>>;
    }>;
  }>().default({ sections: [] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniquePageSlug: unique().on(t.websiteProgressId, t.slug),
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  websiteProgressId: integer("website_progress_id")
    .references(() => websiteProgress.id),
  productType: text("product_type").default("plan"),
  productId: text("product_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionItemId: text("stripe_subscription_item_id"),
  tier: text("tier"),
  status: text("status").notNull(),
  price: integer("price"),
  vatNumber: text("vat_number"),
  city: text("city"),
  street: text("street"),
  number: text("number"),
  postalCode: text("postal_code"),
  pdfUrl: text("pdf_url"),
  invoiceType: text("invoice_type").default("invoice"),
  classificationType: text("classification_type"),
  invoiceTypeCode: text("invoice_type_code"),
  productName: text("product_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  billingPeriod: text("billing_period").default("monthly"),
  cancellationReason: text("cancellation_reason"),
  accessUntil: timestamp("access_until"),
  emailsSentThisMonth: integer("emails_sent_this_month").default(0).notNull(),
  emailLimitResetDate: timestamp("email_limit_reset_date").defaultNow().notNull(),
  isLegacy: boolean("is_legacy").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  pdfUrl: text("pdf_url"),
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const websiteInvoices = pgTable("website_invoices", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  invoiceNumber: text("invoice_number"),
  title: text("title").notNull(),
  description: text("description"),
  pdfUrl: text("pdf_url").notNull(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  amount: integer("amount"),
  currency: text("currency").default("eur"),
  issueDate: timestamp("issue_date"),
  createdAt: timestamp("created_at").defaultNow(),
  uploadedBy: integer("uploaded_by")
    .references(() => users.id),
  status: text("status").default("COMPLETED"),
  wrappInvoiceId: text("wrapp_invoice_id"),
  subscriptionId: integer("subscription_id"),
  paymentIntentId: text("payment_intent_id"),
  errorMessage: text("error_message"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  phone: true,
  stripeCustomerId: true,
  role: true,
  language: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  userId: true,
  websiteProgressId: true,
  productType: true,
  productId: true,
  stripeSubscriptionId: true,
  stripeSubscriptionItemId: true,
  tier: true,
  status: true,
  vatNumber: true,
  pdfUrl: true,
  billingPeriod: true,
}).partial({ websiteProgressId: true, tier: true, stripeSubscriptionId: true, stripeSubscriptionItemId: true });

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  subscriptionId: true,
  amount: true,
  currency: true,
  status: true,
  pdfUrl: true,
});

export const insertWebsiteInvoiceSchema = createInsertSchema(websiteInvoices).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertWebsiteInvoice = z.infer<typeof insertWebsiteInvoiceSchema>;
export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type WebsiteInvoice = typeof websiteInvoices.$inferSelect;

export const websiteStages = pgTable("website_stages", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  stageNumber: integer("stage_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  waiting_info: text("waiting_info"),
  reminder_interval: integer("reminder_interval").default(1),
  completedAt: timestamp("completed_at"),
});

export const tips = pgTable("tips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const stripePrices = pgTable("stripe_prices", {
  id: serial("id").primaryKey(),
  tier: text("tier").notNull(),
  billingPeriod: text("billing_period").notNull(),
  priceId: text("price_id").notNull(),
  unitAmount: integer("unit_amount").notNull(),
  currency: text("currency").notNull().default("eur"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTierBilling: unique().on(table.tier, table.billingPeriod),
}));

export const websiteChanges = pgTable("website_changes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  domain: text("domain").notNull(),
  changesUsed: integer("changes_used").notNull().default(0),
  changesAllowed: integer("changes_allowed").notNull().default(0),
  monthYear: text("month_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserDomainMonth: unique().on(table.userId, table.domain, table.monthYear),
}));

export const websiteChangeLogs = pgTable("website_change_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  domain: text("domain").notNull(),
  changeDescription: text("change_description").notNull(),
  status: text("status").notNull().default("pending"),
  adminId: integer("admin_id")
    .references(() => users.id),
  completedBy: integer("completed_by")
    .references(() => users.id),
  completedAt: timestamp("completed_at"),
  userFeedback: text("user_feedback"),
  files: jsonb("files"),
  monthYear: text("month_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logoDesignPurchases = pgTable("logo_design_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  websiteProgressId: integer("website_progress_id")
    .references(() => websiteProgress.id),
  onboardingId: integer("onboarding_id")
    .references(() => onboardingFormResponses.id),
  logoType: text("logo_type").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("eur"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const onboardingFormResponses = pgTable("onboarding_form_responses", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),

  // Step 1: Business Information
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  accountEmail: text("account_email").notNull(),
  contactEmail: text("contact_email").notNull(),
  businessDescription: text("business_description").notNull(),
  websiteLanguage: text("website_language").default("en"),

  // Step 2: Domain
  hasDomain: text("has_domain").notNull(),
  existingDomain: text("existing_domain"),
  domainAccess: text("domain_access"),
  domainConnectionPreference: text("domain_connection_preference"),
  domainPurchasePreference: text("domain_purchase_preference"),
  preferredDomains: text("preferred_domains"),

  // Step 3: Professional Emails
  hasEmails: text("has_emails").notNull(),
  emailProvider: text("email_provider"),
  emailAccess: text("email_access"),
  existingEmails: text("existing_emails"),
  emailCount: text("email_count"),
  emailNames: text("email_names"),
  emailRedirect: text("email_redirect"),
  redirectInboxAddress: text("redirect_inbox_address"),

  // Step 4: Website Foundation
  hasWebsite: text("has_website").notNull(),
  websiteLink: text("website_link"),
  websiteChanges: text("website_changes"),
  wantedPages: text("wanted_pages").array(),
  notSurePages: boolean("not_sure_pages").default(false),
  hasTextContent: text("has_text_content").notNull(),
  hasMediaContent: text("has_media_content").notNull(),

  // Step 5: Design Preferences
  businessLogoUrl: text("business_logo_url"),
  businessLogoName: text("business_logo_name"),
  businessLogoPublicId: text("business_logo_public_id"),
  createTextLogo: boolean("create_text_logo").default(false),
  colorPalette: text("color_palette"),
  inspirationWebsites: text("inspiration_websites").array(),
  preferredFonts: text("preferred_fonts"),
  siteStyle: text("site_style"),

  // Step 6: Template Selection
  selectedTemplateId: integer("selected_template_id"),
  customTemplateRequest: text("custom_template_request"),

  // Step 7: Social Media
  hasSocialMedia: text("has_social_media").notNull(),
  facebookLink: text("facebook_link"),
  instagramLink: text("instagram_link"),
  linkedinLink: text("linkedin_link"),
  tiktokLink: text("tiktok_link"),
  youtubeLink: text("youtube_link"),
  otherSocialLinks: text("other_social_links"),
  logoDesignService: text("logo_design_service"),

  // Step 8: Practical Information
  projectDeadline: text("project_deadline"),
  additionalNotes: text("additional_notes"),

  submissionId: text("submission_id").notNull(),
  status: text("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type WebsiteProgress = typeof websiteProgress.$inferSelect;
export type WebsiteStage = typeof websiteStages.$inferSelect;
export type Tip = typeof tips.$inferSelect;
export type StripePrice = typeof stripePrices.$inferSelect;
export type WebsiteChanges = typeof websiteChanges.$inferSelect;
export type WebsiteChangeLog = typeof websiteChangeLogs.$inferSelect;
export type LogoDesignPurchase = typeof logoDesignPurchases.$inferSelect;
export type OnboardingFormResponse =
  typeof onboardingFormResponses.$inferSelect;

export const insertStripePriceSchema = createInsertSchema(stripePrices).omit({ id: true });
export type InsertStripePrice = z.infer<typeof insertStripePriceSchema>;

export const insertLogoDesignPurchaseSchema = createInsertSchema(logoDesignPurchases).omit({ id: true, createdAt: true });
export type InsertLogoDesignPurchase = z.infer<typeof insertLogoDesignPurchaseSchema>;

// File attachment schema for change logs
export const changeFileSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  publicId: z.string(),
});

export type ChangeFile = z.infer<typeof changeFileSchema>;

// Website change log insert schema
export const insertWebsiteChangeLogSchema = createInsertSchema(websiteChangeLogs).extend({
  files: z.array(changeFileSchema).optional().nullable(),
}).omit({ id: true, createdAt: true });

export type InsertWebsiteChangeLog = z.infer<typeof insertWebsiteChangeLogSchema>;

export const insertOnboardingFormResponseSchema = createInsertSchema(
  onboardingFormResponses,
);

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Client-safe subscription plans (without process.env)
// This is where the code falls back if he can't find prices in our database (which we have saved from Stripe) or it can't call the stripe's API to get the prices.
export const subscriptionPlans = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 34,
    yearlyPrice: 326,
    yearlyPriceInMonth: 27,
    setupFee: 99,
    changesPerMonth: 1,
    features: [
      "3 pages",
      "1 email (1GB)",
      "1 change/month (10 days)",
      "Basic SEO",
      "Email support in Greek & English (72hr)",
    ],
    image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12",
  },
  essential: {
    id: "essential",
    name: "Essential",
    price: 39,
    yearlyPrice: 372,
    yearlyPriceInMonth: 31,
    setupFee: 99,
    changesPerMonth: 3,
    features: [
      "10 pages",
      "5 emails (1GB)",
      "2 changes/month (5 days)",
      "Analytics",
      "Advance SEO",
      "Newsletter (3,000 emails/month)",
      "Email support in Greek & English (48hr)",
    ],
    image: "https://images.unsplash.com/photo-1513492365349-8ba97c199501",
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 200,
    yearlyPrice: 2400,
    yearlyPriceInMonth: 160,
    setupFee: 99,
    changesPerMonth: 5,
    features: [
      "All add-ons included for free",
      "Monthly strategy call",
      "Phone Support",
      "50 pages",
      "20 emails (50GB)",
      "5 changes/month (48hr)",
      "Advanced Analytics",
      "Advanced SEO",
      "Newsletter (10,000 emails/month)",
    ],
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692",
  },
} as const;

// Client-safe add-ons configuration (without process.env)
// Logo design one-time payment options for onboarding
export const logoDesignOptions = {
  none: {
    id: "none",
    name: "No Logo Service",
    price: 0,
  },
  basic: {
    id: "basic",
    name: "Basic Logo Design",
    description: "2 formats (horizontal and vertical), and your own editable file",
    price: 250,
  },
  premium: {
    id: "premium",
    name: "Brand Identity",
    description: "Logos - Color palette - Fonts - Design for cards, design for letters, branded social media assets",
    price: 500,
  },
} as const;

export const availableAddOns = [
  {
    id: "booking",
    name: "Booking System",
    description: "Complete appointment and reservation booking system",
    price: 10,
    yearlyPrice: 120,
    image: "/images/booking-add-on-icon.svg",
  },
  {
    id: "lms",
    name: "Learning Management System",
    description: "Full-featured LMS for courses and educational content",
    price: 10,
    yearlyPrice: 120,
    image: "/images/lms-add-on-icon.svg",
  },
  {
    id: "multistep",
    name: "Multistep Forms",
    description: "Advanced multi-step form builder with conditional logic",
    price: 10,
    yearlyPrice: 120,
    image: "/images/multistep-form-add-on-icon.svg",
  },
  {
    id: "qrcode",
    name: "QR Code Generator",
    description: "Dynamic QR code generation and management system",
    price: 10,
    // yearlyPrice: 120,
    image: "/images/qr-code-add-on-icon.svg",
  },
  {
    id: "donation",
    name: "Donation System",
    description: "Complete donation platform with payment processing",
    price: 10,
    // yearlyPrice: 120,
    image: "/images/donation-system-add-on-icon.svg",
  },
  {
    id: "payments",
    name: "Online Payments",
    description: "Secure online payment processing and e-commerce features",
    price: 10,
    // yearlyPrice: 120,
    image: "/images/online-payment-add-on-icon.svg",
  },
  {
    id: "realestate",
    name: "Real Estate Platform",
    description: "Property listing and management system for real estate",
    price: 10,
    yearlyPrice: 120,
    image: "/images/real-estate-add-on-icon.svg",
  },
  {
    id: "transport",
    name: "Transport Booking",
    description: "Transportation booking and management system",
    price: 10,
    yearlyPrice: 120,
    image: "/images/transport-booking-add-on-icon.svg",
  },
  {
    id: "newsletter",
    name: "Increase Newsletter Limits (15000 emails / month)",
    description: "Expand your newsletter subscriber capacity",
    price: 10, // or whatever price
    yearlyPrice: 120,
    image: "/images/Newsletter-icon.png",
  },
  {
    id: "newsletter_100",
    name: "Increase Newsletter Limits (100000 emails / month)",
    description: "Expand your newsletter subscriber capacity",
    price: 35, // or whatever price
    yearlyPrice: 120,
    image: "/images/Newsletter-icon.png",
  },
  {
    id: "trafficbuilder",
    name: "Traffic Builder (2 Posts/Month)",
    description: "our team creates two professionally written, SEO-optimized posts tailored to your business and audience",
    price: 10, // or whatever price
    //yearlyPrice: 120,
    image: "/images/traffic-builder-blog.png",
  },
];

// Server-only function to get subscription plans with price IDs
export function getSubscriptionPlansWithPriceIds() {
  return {
    basic: {
      ...subscriptionPlans.basic,
      priceId: {
        monthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || "",
        yearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID || "",
      },
      setupFeeId: process.env.STRIPE_SETUP_FEE_PRICE_ID || "",
    },
    essential: {
      ...subscriptionPlans.essential,
      priceId: {
        monthly: process.env.STRIPE_ESSENTIAL_MONTHLY_PRICE_ID || "",
        yearly: process.env.STRIPE_ESSENTIAL_YEARLY_PRICE_ID || "",
      },
      setupFeeId: process.env.STRIPE_SETUP_FEE_PRICE_ID || "",
    },
    pro: {
      ...subscriptionPlans.pro,
      priceId: {
        monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
        yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
      },
      setupFeeId: process.env.STRIPE_SETUP_FEE_PRICE_ID || "",
    },
  } as const;
}

export type SubscriptionTier = keyof typeof subscriptionPlans;

// Dynamic pricing from Stripe
export const stripePriceSchema = z.object({
  tier: z.enum(["basic", "essential", "pro"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
  priceId: z.string(),
  unitAmount: z.number(),
  currency: z.string(),
});

export type StripePriceData = z.infer<typeof stripePriceSchema>;

// Email schema for AWS SES
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  messageId: text("message_id"), // AWS SES message ID
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emails).pick({
  userId: true,
  toEmail: true,
  subject: true,
  message: true,
});

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

// Internal email (cross-app) - log every attempt; business settings for sender/reply-to
export const internalEmailLog = pgTable("internal_email_log", {
  id: serial("id").primaryKey(),
  app: text("app").notNull(),
  event: text("event").notNull(),
  businessId: text("business_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull(), // accepted | sent | failed
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const internalBusinessEmailSettings = pgTable("internal_business_email_settings", {
  id: serial("id").primaryKey(),
  app: text("app").notNull(),
  businessId: text("business_id").notNull(),
  senderName: text("sender_name").notNull(),
  replyToEmail: text("reply_to_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email form validation schema
export const emailFormSchema = z
  .object({
    to: z.string().optional(),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    sendType: z.enum(["single", "multiple"]).default("single"),
    multipleEmails: z.string().optional(),
    emails: z.array(z.string().email()).optional(),
  })
  .superRefine((data, ctx) => {
    console.log("Validation data:", data);

    if (data.sendType === "single") {
      // Check if emails array is populated (frontend sends resolved emails)
      if (data.emails && data.emails.length > 0) {
        // If emails array is provided, validation passes
        return true;
      }

      // Only check 'to' field if emails aren't provided
      if (!data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email address is required for single recipient",
          path: ["to"]
        });
      } else if (data.to && !z.string().email().safeParse(data.to).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid email address",
          path: ["to"]
        });
      }
    }

    if (data.sendType === "multiple") {
      // Check if emails array is populated (frontend sends resolved emails)
      if (!data.emails || data.emails.length === 0) {
        // Only check multipleEmails if emails aren't provided
        if (!data.multipleEmails || data.multipleEmails.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter at least one email address",
            path: ["multipleEmails"],
          });
        }
      }
    }

  });

// Newsletter tables - NEW TAGS-BASED SYSTEM
// Contacts table - One record per unique email per website
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  confirmationToken: text("confirmation_token"),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailWebsiteUnique: unique().on(table.email, table.websiteProgressId),
}));

// Tags table - For categorizing contacts (replaces groups)
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("bg-blue-100 text-blue-800"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  nameWebsiteProgressIdUnique: unique().on(table.name, table.websiteProgressId),
}));

// Contact Tags junction table - Many-to-many relationship
export const contactTags = pgTable("contact_tags", {
  contactId: integer("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tagId] }),
}));

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  confirmationToken: text("confirmation_token"),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailWebsiteUnique: unique().on(table.email, table.websiteProgressId),
}));

// Types
export type Contact = typeof contacts.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ContactTag = typeof contactTags.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  subscribedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  assignedAt: true,
});

export const insertNewsletterSubscriberSchema = createInsertSchema(
  newsletterSubscribers,
).omit({
  id: true,
  subscribedAt: true,
  updatedAt: true,
});

// Insert types
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type InsertNewsletterSubscriber = z.infer<
  typeof insertNewsletterSubscriberSchema
>;

// Newsletter campaigns table
export const newsletterCampaigns = pgTable("newsletter_campaigns", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  title: text("title").notNull(),
  description: text("description"),
  purpose: text("purpose"),
  tagIds: integer("tag_ids").array().default(sql`ARRAY[]::integer[]`),
  excludedTagIds: integer("excluded_tag_ids").array().default(sql`ARRAY[]::integer[]`),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  excludedSubscriberIds: text("excluded_subscriber_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  excludedContactIds: integer("excluded_contact_ids").array().notNull().default(sql`ARRAY[]::integer[]`),
  subject: text("subject"),
  message: text("message"),
  templateId: integer("template_id").references(() => emailTemplates.id),
  emailHtml: text("email_html"), // Campaign's custom HTML
  emailDesign: text("email_design"), // Campaign's custom design JSON
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  bounceCount: integer("bounce_count").notNull().default(0),
  complaintCount: integer("complaint_count").notNull().default(0),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NewsletterCampaign = typeof newsletterCampaigns.$inferSelect & {
  templateName?: string | null; // Joined from emailTemplates table
};

export const insertNewsletterCampaignSchema = createInsertSchema(newsletterCampaigns).omit({
  id: true,
  sentCount: true,
  deliveredCount: true,
  openCount: true,
  clickCount: true,
  bounceCount: true,
  complaintCount: true,
  recipientCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
});

export type InsertNewsletterCampaign = z.infer<typeof insertNewsletterCampaignSchema>;

// Campaign message tracking table (for SES analytics)
export const campaignMessages = pgTable("campaign_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => newsletterCampaigns.id),
  messageId: text("message_id").notNull().unique(),
  recipientEmail: text("recipient_email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CampaignMessage = typeof campaignMessages.$inferSelect;

// App settings table
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  newsletterEnabled: boolean("newsletter_enabled").notNull().default(true),
  tipsVisibleInUserDashboard: boolean("tips_visible_in_user_dashboard").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;

// Newsletter settings table (key-value store for settings)
export const newsletterSettings = pgTable("newsletter_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NewsletterSettings = typeof newsletterSettings.$inferSelect;

// Session table (managed by connect-pg-simple for Express sessions)
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export type Session = typeof session.$inferSelect;

// Email templates table (for Unlayer email builder)
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  name: text("name").notNull(),
  html: text("html").notNull(),
  design: text("design").notNull(), // JSON string of Unlayer design
  thumbnail: text("thumbnail"), // Preview image (data URL or URL)
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).pick({
  websiteProgressId: true,
  name: true,
  html: true,
  design: true,
  thumbnail: true,
  category: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// Website Analytics tables
export const websiteAnalyticsKeys = pgTable("website_analytics_keys", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  apiKey: text("api_key").notNull().unique(),
  domain: text("domain").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  eventType: text("event_type").notNull(),
  page: text("page").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  sessionId: text("session_id"),
  ipHash: text("ip_hash"),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsDailySummaries = pgTable("analytics_daily_summaries", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  date: text("date").notNull(),
  pageviews: integer("pageviews").notNull().default(0),
  uniqueVisitors: integer("unique_visitors").notNull().default(0),
  topPages: text("top_pages"),
  topReferrers: text("top_referrers"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type WebsiteAnalyticsKey = typeof websiteAnalyticsKeys.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type AnalyticsDailySummary = typeof analyticsDailySummaries.$inferSelect;

export const insertWebsiteAnalyticsKeySchema = createInsertSchema(websiteAnalyticsKeys).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertWebsiteAnalyticsKey = z.infer<typeof insertWebsiteAnalyticsKeySchema>;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Website templates table
export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  translationKey: text("translation_key").notNull().unique(),
  description: text("description").notNull(),
  preview: text("preview").notNull(),
  images: text("images").array().notNull(),
  category: text("category").notNull(),
  features: text("features").array().notNull(),
  tech: text("tech").array(),
  fullDescription: text("full_description"),
  externalUrl: text("external_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

// Custom roles table
export const customRoles = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<RolePermissionsType>().notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomRoleSchema = createInsertSchema(customRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;

// Admin Newsletter Tables (website-independent)
// Admin Templates table
export const adminTemplates = pgTable("admin_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  html: text("html").notNull(),
  design: text("design").notNull(), // JSON string of Unlayer design
  thumbnail: text("thumbnail"), // Preview image (data URL or URL)
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminTemplateSchema = createInsertSchema(adminTemplates).pick({
  name: true,
  html: true,
  design: true,
  thumbnail: true,
  category: true,
});

export type AdminTemplate = typeof adminTemplates.$inferSelect;
export type InsertAdminTemplate = z.infer<typeof insertAdminTemplateSchema>;

// Admin Tags table
export const adminTags = pgTable("admin_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").default("#888888"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminTagSchema = createInsertSchema(adminTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminTag = typeof adminTags.$inferSelect;
export type InsertAdminTag = z.infer<typeof insertAdminTagSchema>;

// Admin Contacts table
export const adminContacts = pgTable("admin_contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminContactSchema = createInsertSchema(adminContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminContact = typeof adminContacts.$inferSelect;
export type InsertAdminContact = z.infer<typeof insertAdminContactSchema>;

// Admin Contact Tags junction table
export const adminContactTags = pgTable("admin_contact_tags", {
  contactId: integer("contact_id")
    .notNull()
    .references(() => adminContacts.id, { onDelete: 'cascade' }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => adminTags.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tagId] }),
}));

export const insertAdminContactTagSchema = createInsertSchema(adminContactTags).omit({
  createdAt: true,
});

export type AdminContactTag = typeof adminContactTags.$inferSelect;
export type InsertAdminContactTag = z.infer<typeof insertAdminContactTagSchema>;

// Admin Campaigns table
export const adminCampaigns = pgTable("admin_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  purpose: text("purpose"),
  tagIds: integer("tag_ids").array().default(sql`ARRAY[]::integer[]`),
  excludedTagIds: integer("excluded_tag_ids").array().default(sql`ARRAY[]::integer[]`),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  excludedContactIds: integer("excluded_contact_ids").array().notNull().default(sql`ARRAY[]::integer[]`),
  subject: text("subject"),
  message: text("message"),
  templateId: integer("template_id").references(() => adminTemplates.id),
  emailHtml: text("email_html"), // Campaign's custom HTML
  emailDesign: text("email_design"), // Campaign's custom design JSON
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  bounceCount: integer("bounce_count").notNull().default(0),
  complaintCount: integer("complaint_count").notNull().default(0),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminCampaignSchema = createInsertSchema(adminCampaigns).omit({
  id: true,
  sentCount: true,
  deliveredCount: true,
  openCount: true,
  clickCount: true,
  bounceCount: true,
  complaintCount: true,
  recipientCount: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminCampaign = typeof adminCampaigns.$inferSelect;
export type InsertAdminCampaign = z.infer<typeof insertAdminCampaignSchema>;

// Admin Campaign Messages table (for tracking sent emails)
export const adminCampaignMessages = pgTable("admin_campaign_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => adminCampaigns.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id")
    .references(() => adminContacts.id),
  email: text("email").notNull(),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminCampaignMessageSchema = createInsertSchema(adminCampaignMessages).omit({
  id: true,
  createdAt: true,
});

export type AdminCampaignMessage = typeof adminCampaignMessages.$inferSelect;
export type InsertAdminCampaignMessage = z.infer<typeof insertAdminCampaignMessageSchema>;

// Payment Obligation Status enum
export const PaymentObligationStatus = {
  PENDING: "pending",
  GRACE: "grace",
  RETRYING: "retrying",
  DELINQUENT: "delinquent",
  FAILED: "failed",
  SETTLED: "settled",
  STOPPED: "stopped",
  WRITTEN_OFF: "written_off",
} as const;

export type PaymentObligationStatusType = typeof PaymentObligationStatus[keyof typeof PaymentObligationStatus];

// Payment Origin enum
export const PaymentOrigin = {
  CUSTOM: "custom",
  STRIPE: "stripe",
} as const;

export type PaymentOriginType = typeof PaymentOrigin[keyof typeof PaymentOrigin];

// Custom Payments table - stores recurring custom payment configurations
export const customPayments = pgTable("custom_payments", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  email: text("email"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("eur"),
  frequency: text("frequency").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  paymentType: text("payment_type").notNull().default("cash"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  userId: integer("user_id").references(() => users.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  notes: text("notes"),
  excludedDates: text("excluded_dates").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomPaymentSchema = createInsertSchema(customPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomPayment = typeof customPayments.$inferSelect;
export type InsertCustomPayment = z.infer<typeof insertCustomPaymentSchema>;

// Payment Obligations table - tracks each individual payment due
export const paymentObligations = pgTable("payment_obligations", {
  id: serial("id").primaryKey(),
  customPaymentId: integer("custom_payment_id").references(() => customPayments.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  userId: integer("user_id").references(() => users.id),
  clientName: text("client_name").notNull(),
  amountDue: integer("amount_due").notNull(),
  currency: text("currency").notNull().default("eur"),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default(PaymentObligationStatus.PENDING),
  origin: text("origin").notNull().default(PaymentOrigin.CUSTOM),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  graceDays: integer("grace_days").default(7),
  nextRetryDate: timestamp("next_retry_date"),
  attemptCount: integer("attempt_count").default(0),
  lastFailureReason: text("last_failure_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentObligationSchema = createInsertSchema(paymentObligations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PaymentObligation = typeof paymentObligations.$inferSelect;
export type InsertPaymentObligation = z.infer<typeof insertPaymentObligationSchema>;

// Payment Settlements table - records payments made against obligations
export const paymentSettlements = pgTable("payment_settlements", {
  id: serial("id").primaryKey(),
  obligationId: integer("obligation_id")
    .notNull()
    .references(() => paymentObligations.id),
  amountPaid: integer("amount_paid").notNull(),
  currency: text("currency").notNull().default("eur"),
  paidAt: timestamp("paid_at").notNull(),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentSettlementSchema = createInsertSchema(paymentSettlements).omit({
  id: true,
  createdAt: true,
});

export type PaymentSettlement = typeof paymentSettlements.$inferSelect;
export type InsertPaymentSettlement = z.infer<typeof insertPaymentSettlementSchema>;