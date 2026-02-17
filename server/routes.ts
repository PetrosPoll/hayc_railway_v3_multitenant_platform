import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { EmailService } from "./email-service";
import { startCampaignScheduler } from "./scheduler";
import { emailFormSchema } from "@shared/schema";
import Stripe from "stripe";
import {
  insertUserSchema,
  subscriptionPlans,
  getSubscriptionPlansWithPriceIds,
  availableAddOns,
  type SubscriptionTier,
  UserRole,
  AccountKind,
  transactions as transactionsTable,
  RolePermissions,
} from "@shared/schema";
import { getEmailLimitWithAddOns } from "./email-limits";
import { z } from "zod";
import * as express from "express";
import { db, pool } from "./db";
import { desc, eq, sql, and, or, isNull, inArray, like, gte } from "drizzle-orm";
import { setupAuth, hashPassword } from "./auth";
import passport from "passport";
import {
  users,
  subscriptions as subscriptionsTable,
  websiteProgress,
  websiteStages,
  tips,
  websiteChanges,
  websiteChangeLogs,
  onboardingFormResponses,
  newsletterSubscribers as newsletterSubscribersTable,
  appSettings,
  emailTemplates,
  insertEmailTemplateSchema,
  campaignMessages,
  newsletterCampaigns as newsletterCampaignsTable,
  templates as templatesTable,
  insertTemplateSchema,
  customRoles,
  contacts,
  contactTags,
  adminContacts,
  adminContactTags,
  adminTags,
  websiteInvoices,
  paymentObligations,
  internalEmailLog,
  internalBusinessEmailSettings,
} from "@shared/schema";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import multer from "multer";
import { createHash, randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { getPrices, initializePricingCache } from "./stripe/pricing";
import { verifyUnsubscribeToken, generateUnsubscribeToken, generateUnsubscribeUrl, generateUnsubscribeFooter } from "./unsubscribe-utils";
import { wrappApiService } from "./services/wrapp-api";
import jwt from "jsonwebtoken";
import { handleWrappPdfGenerationWebhook } from "./services/wrapp-webhook";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper function to create a DRAFT invoice in the database
 * @param params - Invoice creation parameters
 * @returns The created invoice or null if creation failed
 */
async function createDraftInvoice(params: {
  websiteProgressId: number;
  subscriptionId: number | null; // Can be null for payment intents without subscriptions
  paymentIntentId: string | null;
  title: string;
  description: string;
  amount: number; // in cents
  currency: string;
  context?: string; // For logging context (e.g., "add-on purchase via API")
}): Promise<{ id: number } | null> {
  try {
    if (!params.websiteProgressId) {
      console.error('❌ Cannot create draft invoice: websiteProgressId is required');
      return null;
    }

    if (!params.amount || params.amount <= 0) {
      console.error('❌ Cannot create draft invoice: amount must be greater than 0');
      return null;
    }

    const now = new Date();
    const context = params.context ? ` (${params.context})` : '';

    const invoiceResult = await db
      .insert(websiteInvoices)
      .values({
        websiteProgressId: params.websiteProgressId,
        subscriptionId: params.subscriptionId,
        paymentIntentId: params.paymentIntentId,
        title: params.title,
        description: params.description,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        status: 'DRAFT',
        issueDate: now,
        createdAt: now,
        pdfUrl: '', // Placeholder for draft
        cloudinaryPublicId: '', // Placeholder for draft
      })
      .returning();

    console.log(`✅ DRAFT invoice created with ID: ${invoiceResult[0].id}${context}`);
    return invoiceResult[0];
  } catch (error) {
    console.error(`❌ Error creating DRAFT invoice${params.context ? ` (${params.context})` : ''}:`, error);
    return null;
  }
}

/**
 * Helper function to get payment intent ID from a Stripe subscription's latest invoice
 * @param stripeSubscription - The Stripe subscription object
 * @returns Payment intent ID or null if not found
 */
async function getPaymentIntentFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  try {
    if (!stripeSubscription.latest_invoice) {
      return null;
    }

    const invoiceId = typeof stripeSubscription.latest_invoice === 'string' 
      ? stripeSubscription.latest_invoice 
      : stripeSubscription.latest_invoice.id;
    
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['payment_intent']
    });
    
    if (invoice.payment_intent) {
      return typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent.id;
    }
    
    return null;
  } catch (error) {
    console.error('⚠️ Could not retrieve payment intent from subscription invoice:', error);
    return null;
  }
}

// Helper function to check user permissions
function hasPermission(userRole: string, permission: keyof typeof RolePermissions[string]): boolean {
  // Administrator always has full access to everything
  if (userRole === 'administrator') return true;
  
  const permissions = RolePermissions[userRole];
  if (!permissions) return false;
  
  // Check the requested permission
  if (permissions[permission] === true) return true;
  
  // Hierarchical permissions: "manage" automatically grants "view"
  const hierarchicalPermissions: Record<string, string> = {
    'canViewUsers': 'canManageUsers',
    'canViewSubscriptions': 'canManageSubscriptions',
    'canViewWebsites': 'canManageWebsites',
    'canViewTemplates': 'canManageTemplates',
    'canViewTips': 'canManageTips',
    'canViewSettings': 'canManageSettings',
  };
  
  // If checking a "view" permission, also check if they have the corresponding "manage" permission
  if (permission in hierarchicalPermissions) {
    const managePermission = hierarchicalPermissions[permission] as keyof typeof RolePermissions[string];
    if (permissions[managePermission] === true) return true;
  }
  
  return false;
}

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST?.replace(/^https?:\/\//, "").replace(/\/$/, "").trim(),
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS?.replace(/^["']|["']$/g, "").trim(),
  },
  tls: {
    rejectUnauthorized: false,
  },
});


// Use server-only functions to get subscription plans with price IDs
const subscriptionPlansWithPriceIds = getSubscriptionPlansWithPriceIds();

const SUBSCRIPTION_PRICES = {
  basic: subscriptionPlansWithPriceIds.basic.priceId,
  essential: subscriptionPlansWithPriceIds.essential.priceId,
  pro: subscriptionPlansWithPriceIds.pro.priceId,
} as const;

const SETUP_FEE_PRICES = {
  basic: subscriptionPlansWithPriceIds.basic.setupFeeId,
  essential: subscriptionPlansWithPriceIds.essential.setupFeeId,
  pro: subscriptionPlansWithPriceIds.pro.setupFeeId,
} as const;

// Server-only function to get add-ons with price IDs
function getAvailableAddOnsWithPriceIds() {
  return [
    {
      ...availableAddOns[0], // booking
      priceId: process.env.STRIPE_BOOKING_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[1], // lms
      priceId: process.env.STRIPE_LMS_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[2], // multistep
      priceId: process.env.STRIPE_SMART_FORMS_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[3], // qrcode
      priceId: process.env.STRIPE_QRCODE_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[4], // donation
      priceId: process.env.STRIPE_DONATION_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[5], // payments
      priceId: process.env.STRIPE_PAYMENTS_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[6], // realestate
      priceId: process.env.STRIPE_REALESTATE_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[7], // transport
      priceId: process.env.STRIPE_TRANSPORT_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[8], // newsletter 15k
      priceId: process.env.STRIPE_NEWSLETTER_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[9], // traffic builder
      priceId: process.env.STRIPE_TRAFFIC_BUILDER_ADDON_PRICE_ID || "",
    },
    {
      ...availableAddOns[10], // newsletter 100k
      priceId: process.env.STRIPE_NEWSLETTER_EMAILS_100K_ADDON_MONTHLY_PRICE_ID || "",
    },
  ];
}

// Create add-on price mapping (monthly prices from env)
const availableAddOnsWithPriceIds = getAvailableAddOnsWithPriceIds();
const ADDON_PRICE_MAP = availableAddOnsWithPriceIds.reduce((map, addon) => {
  map[addon.id] = addon.priceId;
  return map;
}, {} as Record<string, string>);

// Mapping of add-on IDs to their yearly price environment variable names
const ADDON_YEARLY_ENV_KEYS: Record<string, string> = {
  'lms': 'STRIPE_LMS_ADDON_YEARLY_PRICE_ID',
  'booking': 'STRIPE_BOOKING_ADDON_YEARLY_PRICE_ID',
  'realestate': 'STRIPE_REALESTATE_ADDON_YEARLY_PRICE_ID',
  'marketplace': 'STRIPE_MARKETPLACE_ADDON_YEARLY_PRICE_ID',
  'restaurant': 'STRIPE_RESTAURANT_ADDON_YEARLY_PRICE_ID',
  'jobboard': 'STRIPE_JOBBOARD_ADDON_YEARLY_PRICE_ID',
  'webinar': 'STRIPE_WEBINAR_ADDON_YEARLY_PRICE_ID',
  'transport': 'STRIPE_TRANSPORT_ADDON_YEARLY_PRICE_ID',
  'newsletter': 'STRIPE_NEWSLETTER_ADDON_YEARLY_PRICE_ID',
  'newsletter_100': 'STRIPE_NEWSLETTER_100K_ADDON_YEARLY_PRICE_ID',
  'traffic-builder': 'STRIPE_TRAFFIC_BUILDER_ADDON_YEARLY_PRICE_ID',
};

// Helper to get yearly price config for an add-on (reads from env dynamically)
function getAddonYearlyConfig(addonId: string): { priceId: string; yearlyPrice: number } | null {
  const envKey = ADDON_YEARLY_ENV_KEYS[addonId];
  if (!envKey) return null;
  
  const priceId = process.env[envKey];
  if (!priceId) return null;
  
  const addon = availableAddOns.find(a => a.id === addonId);
  const yearlyPrice = (addon && 'yearlyPrice' in addon ? addon.yearlyPrice : 120) as number;
  
  return { priceId, yearlyPrice };
}

// Build ADDON_YEARLY_PRICE_MAP dynamically from env (needed for reverse lookup)
const ADDON_YEARLY_PRICE_MAP: Record<string, { priceId: string; yearlyPrice: number }> = {};
for (const addonId of Object.keys(ADDON_YEARLY_ENV_KEYS)) {
  const config = getAddonYearlyConfig(addonId);
  if (config) {
    ADDON_YEARLY_PRICE_MAP[addonId] = config;
  }
}

console.log('[ADDON_YEARLY_PRICE] Configured add-ons:', Object.keys(ADDON_YEARLY_PRICE_MAP));

// Create reverse mapping (price ID -> add-on ID) - includes both monthly and yearly prices
const PRICE_TO_ADDON_MAP: Record<string, string> = {};
// Add monthly prices
for (const addon of availableAddOnsWithPriceIds) {
  if (addon.priceId) {
    PRICE_TO_ADDON_MAP[addon.priceId] = addon.id;
  }
}
// Add yearly prices (from ADDON_YEARLY_PRICE_MAP which was built from env)
for (const [addonId, config] of Object.entries(ADDON_YEARLY_PRICE_MAP)) {
  PRICE_TO_ADDON_MAP[config.priceId] = addonId;
}

// Helper to get all price IDs for an add-on (monthly + yearly if exists)
function getAddonPriceIds(addonId: string): string[] {
  const priceIds: string[] = [];
  // Add monthly price from env
  const monthlyPriceId = ADDON_PRICE_MAP[addonId];
  if (monthlyPriceId) priceIds.push(monthlyPriceId);
  // Add yearly price from schema
  const yearlyConfig = ADDON_YEARLY_PRICE_MAP[addonId];
  if (yearlyConfig?.priceId) priceIds.push(yearlyConfig.priceId);
  return priceIds;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

async function verifyPriceCurrencies(
  planId: SubscriptionTier,
  billingPeriod: "monthly" | "yearly",
): Promise<{
  price: Stripe.Price;
  setupFee: Stripe.Price;
  currency: string;
}> {
  const priceId = SUBSCRIPTION_PRICES[planId][billingPeriod];
  const setupFeeId = SETUP_FEE_PRICES[planId];

  if (!priceId || !setupFeeId) {
    throw new Error(`Missing price IDs for plan: ${planId} (${billingPeriod})`);
  }

  const [price, setupFee] = await Promise.all([
    stripe.prices.retrieve(priceId),
    stripe.prices.retrieve(setupFeeId),
  ]);

  if (price.currency !== "eur" || setupFee.currency !== "eur") {
    const updates = [];
    if (price.currency !== "eur") {
      updates.push(
        `- Update subscription price (${price.id}) from ${price.currency.toUpperCase()} to EUR`,
      );
    }
    if (setupFee.currency !== "eur") {
      updates.push(
        `- Update setup fee (${setupFee.id}) from ${setupFee.currency.toUpperCase()} to EUR`,
      );
    }
    throw new Error(
      `Please update the following prices in your Stripe dashboard:\n${updates.join("\n")}`,
    );
  }

  return { price, setupFee, currency: price.currency };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Initialize pricing cache on server startup
  // initializePricingCache().catch((error) => {
  //   console.error("Failed to initialize pricing cache:", error);
  // });

  // Load custom roles into RolePermissions at server startup (non-blocking so health check can respond immediately)
  db.select()
    .from(customRoles)
    .then((customRolesData) => {
      for (const role of customRolesData) {
        RolePermissions[role.name] = role.permissions;
      }
      if (customRolesData.length > 0) {
        console.log(`✅ Loaded ${customRolesData.length} custom roles into permissions system`);
      }
    })
    .catch((error) => {
      console.error("Error loading custom roles:", error);
    });

  // Start campaign scheduler for automated scheduled campaign sending
  startCampaignScheduler(storage);

  // Diagnostic: check if app can reach the database (GET /api/db-check)
  // Always returns 200 with JSON so you see the result (DO won't replace the page with a generic error)
  app.get("/api/db-check", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, message: "Database reachable" });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { code?: string };
      console.error("DB check failed:", e?.message ?? err);
      res.status(200).json({
        ok: false,
        error: e?.message ?? String(err),
        code: e?.code ?? null,
        hint:
          "Check DATABASE_URL, Trusted Sources on the DB, and that the app uses the correct connection string (TCP, not WebSocket).",
      });
    }
  });

  // API endpoint to get dynamic pricing from Stripe
  app.get("/api/pricing", async (req, res) => {
    try {
      const prices = await getPrices();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ error: "Failed to fetch pricing" });
    }
  });

  // Admin-only endpoint to refresh pricing from Stripe
  app.post("/api/pricing/refresh", async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      console.log("🔄 Admin triggered pricing refresh");
      const prices = await getPrices(true); // Force refresh from Stripe
      res.json({ 
        success: true, 
        message: `Successfully refreshed ${prices.length} prices from Stripe`,
        prices 
      });
    } catch (error) {
      console.error("Error refreshing pricing:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to refresh pricing from Stripe" 
      });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { email, username, password, phone } = req.body;

      // Get language from header or body, default to 'en'
      const preferredLanguage = req.body.language || getPreferredLanguage(req);

      // Validate input
      const parsed = insertUserSchema.parse({
        email,
        username,
        password: await hashPassword(password), // Hash the password before storing
        phone: phone || null, // Optional phone field
        stripeCustomerId: null,
        role: UserRole.SUBSCRIBER, // Set default role for new registrations
        language: preferredLanguage, // Save user language preference
      });

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Create new user
      const user = await storage.createUser(parsed);

      // Log in the new user
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res
            .status(500)
            .json({ error: "Failed to login after registration" });
        }
        res.status(201).json({ user });
      });
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid request data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Check if email already exists (for pre-checkout validation)
  app.post("/api/check-email", async (req, res) => {
    try {
      const { email } = req.body;

      // Validate input
      const emailSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
      });

      const validationResult = emailSchema.safeParse({ email });
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false,
          error: "Invalid input", 
          details: validationResult.error.errors 
        });
      }

      // Check if user exists with this email
      const existingUser = await storage.getUserByEmail(validationResult.data.email);
      
      res.json({ 
        success: true,
        exists: !!existingUser 
      });
    } catch (err) {
      console.error("Email check error:", err);
      res.status(500).json({ 
        success: false,
        error: "Failed to check email" 
      });
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      // Wrap passport.authenticate in a Promise
      const user = await new Promise<Express.User | false>(
        (resolve, reject) => {
          passport.authenticate("local", (err, user, info) => {
            if (err) return reject(err);
            if (!user)
              return reject(new Error(info?.message || "Invalid credentials"));
            resolve(user);
          })(req, res, next);
        },
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Log in the user and wrap req.login in a Promise
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // Fetch user subscriptions and transactions asynchronously
      let subscriptions = [];
      if (user.stripeCustomerId) {
        // Get subscriptions
        const userSubscriptions = await storage.getUserSubscriptions(user.id);

        // For each subscription, fetch its transactions
        subscriptions = await Promise.all(
          userSubscriptions.map(async (subscription) => {
            const transactions = await storage.getSubscriptionTransactions(
              subscription.id,
            );
            return { ...subscription, transactions };
          }),
        );
      }

      // Get user permissions from RolePermissions (includes custom roles)
      const permissions = RolePermissions[user.role] || null;

      return res.json({ user, subscriptions, permissions });
    } catch (err: any) {
      console.error("Login error:", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
      return res
        .status(500)
        .json({ error: "Internal server error", details: err.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let subscriptions = [];
      if (user.stripeCustomerId) {
        // Get subscriptions from database only - no need to query Stripe
        const userSubscriptions = await storage.getUserSubscriptions(user.id);

        // Get prices from database (already stored in cents from Stripe)
        subscriptions = await Promise.all(
          userSubscriptions.map(async (subscription) => {
            const transactions = await storage.getSubscriptionTransactions(
              subscription.id,
            );

            // Use price from database (already in cents from Stripe) - this is the ORIGINAL price
            let price = subscription.price || 0;
            const currency = "EUR";
            const billingPeriod = subscription.billingPeriod || 'monthly';

            // Calculate totals based on billing period and subscription status
            let monthlyTotal = null;
            let yearlyTotal = null;

            if (subscription.status === 'active') {
              if (billingPeriod === 'monthly') {
                monthlyTotal = price;
                yearlyTotal = price * 12;
              } else {
                monthlyTotal = Math.round(price / 12);
                yearlyTotal = price;
              }
            }

            // Get next billing date and amount from Stripe if available
            let nextBillingDate = null;
            let nextBillingAmount = null;
            let discountedPrice = null;
            let originalPrice = price; // Store the original price for reference
            
            if (subscription.status === 'active' && subscription.stripeSubscriptionId) {
              try {
                // Check if this is a scheduled subscription (ID starts with 'sub_sched_')
                const isScheduledSubscription = subscription.stripeSubscriptionId.startsWith('sub_sched_');

                
                if (isScheduledSubscription) {
                  try {
                    // Use invoice preview API to get accurate pricing with discounts
                    const invoicePreview = await stripe.invoices.createPreview({
                      schedule: subscription.stripeSubscriptionId,
                    });
                    
                    // Get the base price (subtotal before discounts) - NOTE: subtotal is already discounted!
                    // Don't overwrite price - keep the original database price
                    const basePrice = invoicePreview.subtotal;
                    
                    // Sum ALL discount amounts (handle multiple stacked discounts)
                    let discountAmount = 0;
                    if (invoicePreview.total_discount_amounts && invoicePreview.total_discount_amounts.length > 0) {
                      discountAmount = invoicePreview.total_discount_amounts.reduce(
                        (sum, discount) => sum + discount.amount,
                        0
                      );
                    } else {
                      console.log(`[SCHEDULED ADDON DEBUG] ℹ️ No discount applied to this invoice`);
                    }
                    
                    // Calculate discounted price and set nextBillingAmount
                    if (discountAmount > 0) {
                      discountedPrice = price - discountAmount;
                      nextBillingAmount = discountedPrice; // This is the actual amount to be charged
                    } else {
                      nextBillingAmount = basePrice;
                    }
                    
                    // Get next billing date from period_end
                    if (invoicePreview.period_end) {
                      nextBillingDate = new Date(invoicePreview.period_end * 1000).toISOString();
                    }

                  } catch (invoiceError) {
                    console.error(`[SCHEDULED ADDON DEBUG] ❌ Error creating invoice preview:`, invoiceError);
                    // Fallback to database price if invoice preview fails
                    nextBillingAmount = price;
                  }
                } else {
                  // Regular active subscription
                  const stripeSubscription = await stripe.subscriptions.retrieve(
                    subscription.stripeSubscriptionId
                  );

                  if (stripeSubscription && stripeSubscription.current_period_end) {
                    nextBillingDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
                    
                    // Fetch upcoming invoice to get the actual next billing amount (including discounts/coupons)
                    try {
                      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                        customer: stripeSubscription.customer as string,
                        subscription: subscription.stripeSubscriptionId,
                      });
                      
                      if (upcomingInvoice) {
                        // amount_due is in cents, so it's ready to use
                        nextBillingAmount = upcomingInvoice.amount_due;
                      }
                    } catch (invoiceError) {
                      console.error("[/api/user] Error fetching upcoming invoice:", invoiceError);
                      // If we can't get the upcoming invoice, use the subscription price as fallback
                      nextBillingAmount = price;
                    }
                  }
                }
              } catch (error) {
                console.error("[/api/user] Error fetching Stripe subscription:", error);
              }
            } else {
              console.log(`[/api/user] Skipping Stripe fetch - status: ${subscription.status}, stripeSubscriptionId: ${subscription.stripeSubscriptionId || 'null'}`);
            }

            const returnData = { 
              ...subscription, 
              transactions,
              monthlyTotal,
              yearlyTotal,
              price,
              currency,
              nextBillingDate,
              nextBillingAmount,
              discountedPrice,
            };
            
            return returnData;
          }),
        );
      }

      if (subscriptions.length > 0) {
        console.log(`[/api/user] First subscription nextBillingAmount: ${subscriptions[0].nextBillingAmount}`);
      }

      // Get user permissions from RolePermissions (includes custom roles loaded at startup)
      const permissions = RolePermissions[user.role] || null;

      // Prevent caching of this response to ensure fresh billing data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json({ user, subscriptions, permissions });
    } catch (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  // Generate Cloudinary signature for secure uploads
  app.post("/api/cloudinary/signature", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { paramsToSign } = req.body;

      // If no params provided, create default params with timestamp
      const params = paramsToSign || {};
      
      // Ensure timestamp is present
      if (!params.timestamp) {
        params.timestamp = Math.round(new Date().getTime() / 1000);
      }

      // Create signature string (sorted alphabetically, excluding signature and api_key)
      const signatureString = Object.keys(params)
        .filter(key => key !== 'signature' && key !== 'api_key')
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

      console.log('[Cloudinary Signature] Params received:', params);
      console.log('[Cloudinary Signature] String to sign:', signatureString);

      // Generate signature using SHA-1 (Cloudinary requirement)
      const signature = createHash('sha1')
        .update(signatureString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

      console.log('[Cloudinary Signature] Generated signature:', signature);

      res.json({
        signature,
        timestamp: params.timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch (error) {
      console.error("Error generating Cloudinary signature:", error);
      res.status(500).json({ error: "Failed to generate signature" });
    }
  });

  // Booking SSO: generate short-lived JWT for redirect to booking.hayc.gr
  // See booking-system-new-react-version/MAIN_APP_SSO_PROMPT.md for full spec
  app.get("/api/booking/sso-token", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const websiteIdParam = req.query.websiteId;
    if (!websiteIdParam || typeof websiteIdParam !== "string") {
      return res.status(400).json({ error: "websiteId is required" });
    }

    const websiteId = parseInt(websiteIdParam, 10);
    if (isNaN(websiteId)) {
      return res.status(400).json({ error: "Invalid websiteId" });
    }

    const secret = process.env.SSO_JWT_SECRET;
    if (!secret) {
      console.error("[Booking SSO] SSO_JWT_SECRET is not configured");
      return res.status(503).json({ error: "Booking SSO is not configured" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch website and verify permission
      const website = await db
        .select({
          id: websiteProgress.id,
          userId: websiteProgress.userId,
        })
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = user.role === "administrator" || user.role === "admin";
      const ownsWebsite = website.userId === user.id;
      const hasViewPermission = user.accountKind === AccountKind.STAFF && hasPermission(user.role, "canViewWebsites");

      if (!ownsWebsite && !isAdmin && !hasViewPermission) {
        return res.status(403).json({ error: "Not authorized to access this website" });
      }

      // Try to get firstName/lastName from subscription for this website
      let firstName = "";
      let lastName = "";
      const subscription = await db
        .select({
          firstName: subscriptionsTable.firstName,
          lastName: subscriptionsTable.lastName,
        })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.websiteProgressId, websiteId),
            eq(subscriptionsTable.productType, "plan")
          )
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null);

      if (subscription?.firstName) firstName = subscription.firstName;
      if (subscription?.lastName) lastName = subscription.lastName;

      const now = Math.floor(Date.now() / 1000);
      const exp = now + 5 * 60; // 5 minutes

      const payload = {
        websiteId: String(websiteId),
        userId: String(user.id),
        email: user.email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role: "business_owner",
        iat: now,
        exp,
      };

      const token = jwt.sign(payload, secret, { algorithm: "HS256" });
      // VITE_BOOKING_APP_URL per environment; always produce an absolute redirect URL (no leading slash)
      let bookingBaseUrl = (process.env.VITE_BOOKING_APP_URL || "https://booking.hayc.gr").trim().replace(/^\/+/, "");
      if (!bookingBaseUrl.startsWith("http://") && !bookingBaseUrl.startsWith("https://")) {
        bookingBaseUrl = `https://${bookingBaseUrl}`;
      }
      bookingBaseUrl = bookingBaseUrl.replace(/\/+$/, "");
      const redirectUrl = `${bookingBaseUrl}/sso?token=${encodeURIComponent(token)}`;

      res.json({ token, redirectUrl });
    } catch (err) {
      console.error("Error generating booking SSO token:", err);
      res.status(500).json({ error: "Failed to generate SSO token" });
    }
  });

  // Get subscriptions - supports two modes:
  // 1. With websiteProgressId: returns subscriptions for that specific website
  // 2. Without websiteProgressId: returns all subscriptions for the authenticated user
  app.get("/api/subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const websiteProgressId = req.query.websiteProgressId;

      // Mode 1: Filter by websiteProgressId (website-specific view)
      if (websiteProgressId) {
        // Get the website to determine its owner
        const website = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, parseInt(websiteProgressId as string)))
          .then((rows) => rows[0]);

        if (!website) {
          return res.status(404).json({ error: "Website not found" });
        }

        // Check authorization: allow if user owns the website OR if user is an admin
        const isAdmin = user.role === "admin" || user.role === "administrator";
        if (!isAdmin && website.userId !== user.id) {
          return res.status(403).json({ error: "Not authorized" });
        }

        // Fetch subscriptions filtered by websiteProgressId
        const subscriptions = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.websiteProgressId, parseInt(websiteProgressId as string)));

        // Fetch transactions and calculate totals for each subscription
        const subscriptionsWithDetails = await Promise.all(
          subscriptions.map(async (subscription) => {
            const transactions = await db
              .select()
              .from(transactionsTable)
              .where(eq(transactionsTable.subscriptionId, subscription.id))
              .orderBy(desc(transactionsTable.createdAt));

            // Use price from database (already in cents from Stripe) - this is the ORIGINAL price
            let price = subscription.price || 0;
            const currency = "EUR";
            const billingPeriod = subscription.billingPeriod || 'monthly';

            // Calculate totals based on billing period
            let monthlyTotal = null;
            let yearlyTotal = null;
            
            if (billingPeriod === 'monthly') {
              monthlyTotal = price;
              yearlyTotal = price * 12;
            } else {
              monthlyTotal = Math.round(price / 12);
              yearlyTotal = price;
            }

            // Get product details (for display purposes)
            const productDetails = subscription.productType === 'addon' && subscription.productId
              ? (() => {
                  const addon = availableAddOns.find(a => a.id === subscription.productId);
                  return addon ? {
                    id: addon.id,
                    name: addon.name,
                    description: addon.description,
                    price: price, // Use database price (already in cents)
                  } : null;
                })()
              : null;

            // Get next billing date and amount from Stripe if available
            let nextBillingDate = null;
            let nextBillingAmount = null;
            let discountedPrice = null;
            
            if (subscription.status === 'active' && subscription.stripeSubscriptionId) {
              try {
                // Check if this is a scheduled subscription (ID starts with 'sub_sched_')
                const isScheduledSubscription = subscription.stripeSubscriptionId.startsWith('sub_sched_');
                
                console.log(`[/api/subscriptions Mode 1] ========================================`);
                console.log(`[/api/subscriptions Mode 1] Subscription ID: ${subscription.stripeSubscriptionId}`);
                console.log(`[/api/subscriptions Mode 1] Is scheduled: ${isScheduledSubscription}`);
                
                if (isScheduledSubscription) {
                  console.log(`[/api/subscriptions Mode 1] 🔍 Creating invoice preview for scheduled subscription...`);
                  
                  try {
                    // Use invoice preview API to get accurate pricing with discounts
                    const invoicePreview = await stripe.invoices.createPreview({
                        schedule: subscription.stripeSubscriptionId,
                    });
                    
                    console.log("[/api/subscriptions Mode 1] 🧾 Invoice preview created");
                    console.log(`[/api/subscriptions Mode 1] Subtotal: ${invoicePreview.subtotal} cents`);
                    console.log(`[/api/subscriptions Mode 1] Total: ${invoicePreview.total} cents`);
                    
                    // Get the base price (subtotal before discounts) - NOTE: subtotal is already discounted!
                    // Don't overwrite price - keep the original database price
                    const basePrice = invoicePreview.subtotal;
                    
                    // Sum ALL discount amounts (handle multiple stacked discounts)
                    let discountAmount = 0;
                    if (invoicePreview.total_discount_amounts && invoicePreview.total_discount_amounts.length > 0) {
                      discountAmount = invoicePreview.total_discount_amounts.reduce(
                        (sum, discount) => sum + discount.amount,
                        0
                      );
                      console.log(`[/api/subscriptions Mode 1] 💰 Total Discount: ${discountAmount} cents (from ${invoicePreview.total_discount_amounts.length} discount(s))`);
                    }
                    
                    // Calculate discounted price and set nextBillingAmount
                    if (discountAmount > 0) {
                      discountedPrice = price - discountAmount;
                      nextBillingAmount = discountedPrice;
                      console.log(`[/api/subscriptions Mode 1] ✂️ Original: ${basePrice}, Discounted: ${discountedPrice}`);
                    } else {
                      nextBillingAmount = basePrice;
                    }
                    
                    // Get next billing date from period_end
                    if (invoicePreview.period_end) {
                      nextBillingDate = new Date(invoicePreview.period_end * 1000).toISOString();
                    }
                  } catch (invoiceError) {
                    console.error(`[/api/subscriptions Mode 1] ❌ Error creating invoice preview:`, invoiceError);
                    nextBillingAmount = price;
                  }
                } else {
                  // Regular subscription
                  const stripeSubscription = await stripe.subscriptions.retrieve(
                    subscription.stripeSubscriptionId
                  );

                  if (stripeSubscription && stripeSubscription.current_period_end) {
                    nextBillingDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
                    
                    // Fetch upcoming invoice to get the actual next billing amount (including discounts/coupons)
                    try {
                      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                        customer: stripeSubscription.customer as string,
                        subscription: subscription.stripeSubscriptionId,
                      });
                      
                      if (upcomingInvoice) {
                        nextBillingAmount = upcomingInvoice.amount_due;
                        console.log(`[/api/subscriptions Mode 1] Upcoming invoice: ${nextBillingAmount} cents`);
                      }
                    } catch (invoiceError) {
                      console.error("[/api/subscriptions Mode 1] Error fetching upcoming invoice:", invoiceError);
                      nextBillingAmount = price;
                    }
                  }
                }

              } catch (error) {
                console.error("[/api/subscriptions Mode 1] Error fetching Stripe subscription:", error);
              }
            }

            // Get plan details if this is a plan subscription
            const planDetails = subscription.productType === 'plan' && subscription.productId
              ? subscriptionPlans[subscription.productId as SubscriptionTier]
              : null;

            // Calculate email usage data
            const emailLimit = await getEmailLimitWithAddOns(subscription.tier, subscription.websiteProgressId);
            const emailsUsed = subscription.emailsSentThisMonth || 0;
            const emailsRemaining = Math.max(0, emailLimit - emailsUsed);

            return {
              ...subscription,
              transactions,
              monthlyTotal,
              yearlyTotal,
              price,
              currency,
              productDetails,
              nextBillingDate,
              nextBillingAmount,
              discountedPrice,
              plan: planDetails,
              emailUsage: {
                limit: emailLimit,
                used: emailsUsed,
                remaining: emailsRemaining,
                resetDate: subscription.emailLimitResetDate,
              },
            };
          }),
        );

        console.log(`[/api/subscriptions Mode 1] Returning ${subscriptionsWithDetails.length} subscriptions`);
        if (subscriptionsWithDetails.length > 0) {
          console.log(`[/api/subscriptions Mode 1] First subscription nextBillingAmount: ${subscriptionsWithDetails[0].nextBillingAmount}`);
        }

        // Prevent caching to ensure fresh billing data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.json(subscriptionsWithDetails);
      }

      // Mode 2: Return all subscriptions for authenticated user (backward compatibility)
      const subscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, user.id));

      // Fetch transactions and calculate totals for each subscription
      const subscriptionsWithDetails = await Promise.all(
        subscriptions.map(async (subscription) => {
          const transactions = await db
            .select()
            .from(transactionsTable)
            .where(eq(transactionsTable.subscriptionId, subscription.id))
            .orderBy(desc(transactionsTable.createdAt));

          // Use price from database (already in cents from Stripe)
          const price = subscription.price || 0;
          const currency = "EUR";
          const billingPeriod = subscription.billingPeriod || 'monthly';

          // Calculate totals based on billing period
          let monthlyTotal = null;
          let yearlyTotal = null;
          
          if (billingPeriod === 'monthly') {
            monthlyTotal = price;
            yearlyTotal = price * 12;
          } else {
            monthlyTotal = Math.round(price / 12);
            yearlyTotal = price;
          }

          // Get product details (for display purposes)
          const productDetails = subscription.productType === 'addon' && subscription.productId
            ? (() => {
                const addon = availableAddOns.find(a => a.id === subscription.productId);
                return addon ? {
                  id: addon.id,
                  name: addon.name,
                  description: addon.description,
                  price: price, // Use database price (already in cents)
                } : null;
              })()
            : null;

          // Get next billing date and amount from Stripe if available
          let nextBillingDate = null;
          let nextBillingAmount = null;
          if (subscription.status === 'active' && subscription.stripeSubscriptionId) {
            try {
              // Use the stored Stripe subscription ID for reliable lookup
              const stripeSubscription = await stripe.subscriptions.retrieve(
                subscription.stripeSubscriptionId
              );

              if (stripeSubscription && stripeSubscription.current_period_end) {
                nextBillingDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
                
                // Fetch upcoming invoice to get the actual next billing amount (including discounts/coupons)
                try {
                  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                    customer: stripeSubscription.customer as string,
                    subscription: subscription.stripeSubscriptionId,
                  });
                  
                  if (upcomingInvoice) {
                    // amount_due is in cents, so it's ready to use
                    nextBillingAmount = upcomingInvoice.amount_due;
                  }
                } catch (invoiceError) {
                  console.error("[/api/subscriptions Mode 2] Error fetching upcoming invoice:", invoiceError);
                  // If we can't get the upcoming invoice, use the subscription price as fallback
                  nextBillingAmount = price;
                }
              }
            } catch (error) {
              console.error("[/api/subscriptions Mode 2] Error fetching Stripe subscription:", error);
            }
          }

          // Get plan details if this is a plan subscription
          const planDetails = subscription.productType === 'plan' && subscription.productId
            ? subscriptionPlans[subscription.productId as SubscriptionTier]
            : null;

          // Calculate email usage data
          const emailLimit = await getEmailLimitWithAddOns(subscription.tier, subscription.websiteProgressId);
          const emailsUsed = subscription.emailsSentThisMonth || 0;
          const emailsRemaining = Math.max(0, emailLimit - emailsUsed);

          return {
            ...subscription,
            transactions,
            monthlyTotal,
            yearlyTotal,
            price,
            currency,
            productDetails,
            nextBillingDate,
            nextBillingAmount,
            plan: planDetails,
            emailUsage: {
              limit: emailLimit,
              used: emailsUsed,
              remaining: emailsRemaining,
              resetDate: subscription.emailLimitResetDate,
            },
          };
        }),
      );

      console.log(`[/api/subscriptions Mode 2] Returning ${subscriptionsWithDetails.length} subscriptions`);
      if (subscriptionsWithDetails.length > 0) {
        console.log(`[/api/subscriptions Mode 2] First subscription nextBillingAmount: ${subscriptionsWithDetails[0].nextBillingAmount}`);
      }

      // Prevent caching to ensure fresh billing data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json(subscriptionsWithDetails);
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Email routes
  app.post("/api/emails/send", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate email configuration first
      const configValidation = EmailService.validateConfiguration();
      if (!configValidation.isValid) {
        return res.status(500).json({ 
          error: "Email service not configured properly", 
          details: configValidation.error 
        });
      }

      // Validate request body
      const validationResult = emailFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid email data", 
          details: validationResult.error.issues 
        });
      }

      const { to, subject, message, sendType, emails, multipleEmails } = validationResult.data;

      // Get current user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user's active subscription
      const userSubscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, req.user.id),
            eq(subscriptionsTable.status, "active")
          )
        )
        .limit(1);

      const subscription = userSubscriptions[0];
      if (!subscription) {
        return res.status(403).json({ error: "No active subscription found" });
      }

      // Check if we need to reset the monthly email counter
      const now = new Date();
      const resetDate = subscription.emailLimitResetDate ? new Date(subscription.emailLimitResetDate) : now;
      const shouldReset = now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();

      let currentSubscription = subscription;
      
      if (shouldReset) {
        // Reset counter for new month
        await db
          .update(subscriptionsTable)
          .set({
            emailsSentThisMonth: 0,
            emailLimitResetDate: now,
          })
          .where(eq(subscriptionsTable.id, subscription.id));
        
        // Reload subscription to get fresh data
        const reloadedSubs = await db
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.id, subscription.id))
          .limit(1);
        
        currentSubscription = reloadedSubs[0] || subscription;
      }

      // Get email limit for user's tier
      const emailLimit = await getEmailLimitWithAddOns(currentSubscription.tier, currentSubscription.websiteProgressId);
      const currentUsage = currentSubscription.emailsSentThisMonth || 0;

      let recipients: string[] = [];
      let emailRecords: any[] = [];
      let results: any[] = [];

      // Determine recipients based on send type
      if (sendType === "single") {
        // Check if emails array is already provided (from frontend)
        if (emails && emails.length > 0) {
          recipients = emails;
        } else if (to) {
          recipients = [to];
        } else {
          return res.status(400).json({ error: "To email is required for single recipient" });
        }
      } else if (sendType === "multiple") {
        if (emails && emails.length > 0) {
          recipients = emails;
        } else if (multipleEmails) {
          // Parse multipleEmails string into array
          recipients = multipleEmails
            .split('\n')
            .map(email => email.trim())
            .filter(email => email.length > 0 && email.includes('@'));
          
          if (recipients.length === 0) {
            return res.status(400).json({ error: "No valid email addresses found in the list" });
          }
        } else {
          return res.status(400).json({ error: "Email list is required for multiple recipients" });
        }
      } else if (sendType === "group") {
        // Check if emails array is already provided (from frontend)
        if (emails && emails.length > 0) {
          recipients = emails;
        } else {
          return res.status(400).json({ error: "Email list is required for group sending" });
        }
      }

      // Check if user has enough email quota
      const emailsToSend = recipients.length;
      const remainingQuota = emailLimit - currentUsage;

      if (emailLimit === 0) {
        return res.status(403).json({ 
          error: "Your current plan includes 0 newsletter emails per month. Upgrade to Essential or Pro to start sending newsletters.",
          tier: currentSubscription.tier,
          limit: emailLimit,
          used: currentUsage,
          remaining: 0,
          upgradeRequired: true
        });
      }

      if (emailsToSend > remainingQuota) {
        return res.status(403).json({ 
          error: `Email limit exceeded. You have ${remainingQuota} emails remaining this month.`,
          limit: emailLimit,
          used: currentUsage,
          remaining: remainingQuota,
          requested: emailsToSend
        });
      }

      // Send emails to all recipients
      for (const recipientEmail of recipients) {
        try {
          // Create email record in database
          const email = await storage.createEmail({
            userId: req.user.id,
            toEmail: recipientEmail,
            subject,
            message,
          });
          emailRecords.push(email);

          console.log(`📧 Sending email from: ${currentUser.email} to: ${recipientEmail}`);

          // Send email via AWS SES
          const result = await EmailService.sendEmail({
            to: recipientEmail,
            subject,
            message,
            fromEmail: currentUser.email,
          });

          // Update email status in database
          if (result.success) {
            await storage.updateEmailStatus(email.id, "sent", result.messageId);
          } else {
            await storage.updateEmailStatus(email.id, "failed", undefined, result.error);
          }

          results.push({
            email: recipientEmail,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
          });
        } catch (emailError) {
          console.error(`Error sending to ${recipientEmail}:`, emailError);
          results.push({
            email: recipientEmail,
            success: false,
            error: "Failed to send email",
          });
        }
      }

      // Calculate success statistics
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      // Increment email counter for successfully sent emails using SQL increment to prevent race conditions
      if (successCount > 0) {
        await db
          .update(subscriptionsTable)
          .set({
            emailsSentThisMonth: sql`${subscriptionsTable.emailsSentThisMonth} + ${successCount}`,
          })
          .where(eq(subscriptionsTable.id, currentSubscription.id));
      }

      // Calculate remaining quota after this send
      const newUsage = (currentUsage + successCount);
      const newRemaining = emailLimit - newUsage;

      res.json({
        success: successCount > 0,
        totalSent: successCount,
        totalAttempted: totalCount,
        results: results,
        sendType: sendType,
        emailUsage: {
          limit: emailLimit,
          used: newUsage,
          remaining: newRemaining,
        },
      });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's sent emails
  app.get("/api/emails", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const emails = await storage.getUserEmails(req.user.id);
      res.json(emails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email Template routes (for Unlayer email builder)
  // Get all templates for a website
  app.get("/api/email-templates/:websiteId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const websiteId = parseInt(req.params.websiteId);
      const templates = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.websiteProgressId, websiteId))
        .orderBy(desc(emailTemplates.updatedAt));

      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Get single template by id
  app.get("/api/email-template/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const templateId = parseInt(req.params.id);
      const template = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, templateId))
        .limit(1);

      if (!template || template.length === 0) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(template[0]);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  // Create new template
  app.post("/api/email-templates", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = insertEmailTemplateSchema.parse(req.body);
      
      const [newTemplate] = await db
        .insert(emailTemplates)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(newTemplate);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  // Update template
  app.patch("/api/email-templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const templateId = parseInt(req.params.id);
      const validatedData = insertEmailTemplateSchema.partial().parse(req.body);

      const [updatedTemplate] = await db
        .update(emailTemplates)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, templateId))
        .returning();

      if (!updatedTemplate) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  // Delete template
  app.delete("/api/email-templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const templateId = parseInt(req.params.id);

      await db
        .delete(emailTemplates)
        .where(eq(emailTemplates.id, templateId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // Duplicate template
  app.post("/api/email-templates/:id/duplicate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const templateId = parseInt(req.params.id);
      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";

      // Get the original template
      const [originalTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, templateId))
        .limit(1);

      if (!originalTemplate) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Handle global/shared templates (no websiteProgressId) - only admins can duplicate these
      if (!originalTemplate.websiteProgressId) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Not authorized to duplicate this template" });
        }
        // Admin can duplicate global templates - the duplicate will also be global
        const [duplicatedTemplate] = await db
          .insert(emailTemplates)
          .values({
            websiteProgressId: null,
            name: `${originalTemplate.name} (Copy)`,
            html: originalTemplate.html,
            design: originalTemplate.design,
            thumbnail: originalTemplate.thumbnail,
            category: originalTemplate.category,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        return res.json(duplicatedTemplate);
      }

      // Verify ownership: check that the user owns the website this template belongs to
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, originalTemplate.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Check if user owns this website or is admin
      // Note: canManageTemplates permission is for admin-level operations only, 
      // not for cross-tenant access on user-facing endpoints
      if (website.userId !== req.user.id && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to duplicate this template" });
      }

      // Create a duplicate with a modified name
      const [duplicatedTemplate] = await db
        .insert(emailTemplates)
        .values({
          websiteProgressId: originalTemplate.websiteProgressId,
          name: `${originalTemplate.name} (Copy)`,
          html: originalTemplate.html,
          design: originalTemplate.design,
          thumbnail: originalTemplate.thumbnail,
          category: originalTemplate.category,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(duplicatedTemplate);
    } catch (error) {
      console.error("Error duplicating email template:", error);
      res.status(500).json({ error: "Failed to duplicate email template" });
    }
  });

  // Send test email
  app.post("/api/email-templates/send-test", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const schema = z.object({
        toEmail: z.string().email("Invalid email address"),
        fromEmail: z.string().email("Invalid from email address"),
        subject: z.string().min(1, "Subject is required"),
        html: z.string().min(1, "Email content is required"),
      });

      const validatedData = schema.parse(req.body);

      // Validate email configuration first
      const configValidation = EmailService.validateConfiguration();
      if (!configValidation.isValid) {
        return res.status(500).json({ 
          error: configValidation.error || "Email service not configured" 
        });
      }

      // Send test email
      const result = await EmailService.sendEmail({
        to: validatedData.toEmail,
        subject: validatedData.subject,
        message: "This is a test email from your email builder",
        fromEmail: validatedData.fromEmail,
        html: validatedData.html,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send test email" });
      }

      res.json({ 
        success: true, 
        messageId: result.messageId,
        message: "Test email sent successfully" 
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Custom Roles API routes
  // Get all roles
  app.get("/api/admin/roles", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageRoles')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const roles = await db.select().from(customRoles).orderBy(customRoles.name);
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // Create custom role
  app.post("/api/admin/roles", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageRoles')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { name, displayName, description, permissions } = req.body;
      
      if (!name || !displayName || !permissions) {
        return res.status(400).json({ error: "Name, display name, and permissions are required" });
      }

      const [newRole] = await db.insert(customRoles).values({
        name: name.toLowerCase().replace(/\s+/g, '_'),
        displayName,
        description,
        permissions,
        isSystem: false,
      }).returning();

      // Update RolePermissions object dynamically
      RolePermissions[newRole.name] = permissions;

      res.json(newRole);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  // Update custom role
  app.patch("/api/admin/roles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageRoles')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const roleId = parseInt(req.params.id);
      const { displayName, description, permissions } = req.body;

      const [role] = await db.select().from(customRoles).where(eq(customRoles.id, roleId));
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (role.isSystem) {
        return res.status(400).json({ error: "Cannot modify system roles" });
      }

      const [updatedRole] = await db.update(customRoles)
        .set({
          displayName,
          description,
          permissions,
          updatedAt: new Date(),
        })
        .where(eq(customRoles.id, roleId))
        .returning();

      // Update RolePermissions object dynamically
      RolePermissions[updatedRole.name] = permissions;

      res.json(updatedRole);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // Delete custom role
  app.delete("/api/admin/roles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageRoles')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const roleId = parseInt(req.params.id);

      const [role] = await db.select().from(customRoles).where(eq(customRoles.id, roleId));
      
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (role.isSystem) {
        return res.status(400).json({ error: "Cannot delete system roles" });
      }

      // Check if any users have this role
      const usersWithRole = await db.select().from(users).where(eq(users.role, role.name));
      
      if (usersWithRole.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete role with assigned users. Please reassign users first.",
          userCount: usersWithRole.length
        });
      }

      await db.delete(customRoles).where(eq(customRoles.id, roleId));
      
      // Remove from RolePermissions object
      delete RolePermissions[role.name];

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Create staff user (administrator only)
  app.post("/api/admin/staff-users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageRoles')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { username, email, password, role } = req.body;

      // Validate required fields
      if (!username || !email || !password || !role) {
        return res.status(400).json({ error: "Username, email, password, and role are required" });
      }

      // Validate role - subscriber is not a staff role, all other roles are allowed
      if (role === UserRole.SUBSCRIBER) {
        return res.status(400).json({ error: "Cannot create staff users with subscriber role" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create staff user
      const [newStaffUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
          role,
          accountKind: AccountKind.STAFF,
        })
        .returning();

      // Don't return password in response
      const { password: _, ...userWithoutPassword } = newStaffUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating staff user:", error);
      res.status(500).json({ error: "Failed to create staff user" });
    }
  });

  // Website Templates routes
  // Get all templates
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get single template by id
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getTemplateById(templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Create new template
  app.post("/api/templates", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageTemplates')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const newTemplate = await storage.createTemplate(req.body);
      res.json(newTemplate);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Update template
  app.patch("/api/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageTemplates')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const templateId = parseInt(req.params.id);
      const updatedTemplate = await storage.updateTemplate(templateId, req.body);
      
      if (!updatedTemplate) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageTemplates')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const templateId = parseInt(req.params.id);
      await storage.deleteTemplate(templateId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Create checkout session
  app.post("/api/create-checkout-session", async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      username: z.string().min(3),
      phone: z.string().optional(), // Add phone field
      planId: z.enum(["basic", "essential", "pro"] as const),
      billingPeriod: z.enum(["monthly", "yearly"] as const), // Add billing period validation
      vatNumber: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      street: z.string().nullable().optional(),
      number: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      invoiceType: z.enum(["invoice", "receipt"]).optional().default("invoice"), // Add invoice type selection
      password: z.string().min(6).optional(), // Make password optional for existing users
      addOns: z.array(z.string()).optional(), // Add support for add-ons
      language: z.string().optional(), // Add support for language preference
      isResume: z.boolean().optional(), // Add support for resume flow
      websiteProgressId: z.number().optional(), // Add support for website progress ID
    });

    try {
      const body = schema.parse(req.body);
      try {
        // Verify price currencies first, passing the billing period
        const { price, setupFee } = await verifyPriceCurrencies(
          body.planId,
          body.billingPeriod,
        );

        // Rest of the function remains the same as before, starting from checking existingUser
        const existingUser = await storage.getUserByEmail(body.email);
        let stripeCustomerId = existingUser?.stripeCustomerId;

        // Create line items array with base subscription and conditionally setup fee
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        // Only add setup fee if it's not a resume flow
        if (!body.isResume) {
          lineItems.push({
            price: setupFee.id,
            quantity: 1,
          });
        }

        // Always add the subscription price
        lineItems.push({
          price: price.id,
          quantity: 1,
        });

        // Add selected add-ons to line items
        if (body.addOns && body.addOns.length > 0) {
          console.log('📦 Processing add-ons:', body.addOns);
          body.addOns.forEach((addonId) => {
            const priceId = ADDON_PRICE_MAP[addonId];
            console.log(`  - Add-on "${addonId}" -> Price ID: ${priceId}`);
            if (priceId) {
              lineItems.push({
                price: priceId,
                quantity: 1,
              });
            } else {
              console.warn(`Unknown add-on ID: ${addonId}`);
            }
          });
        }

        console.log('🛒 Final line items being sent to Stripe:', JSON.stringify(lineItems, null, 2));

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "subscription",
          success_url: `${req.protocol}://${req.get("host")}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.protocol}://${req.get("host")}`,
          metadata: {
            username: body.username,
            phone: body.phone || "",
            planId: body.planId,
            billingPeriod: body.billingPeriod,
            password: body.password,
            vatNumber: body.vatNumber || "",
            city: body.city || "",
            street: body.street || "",
            number: body.number || "",
            postalCode: body.postalCode || "",
            invoiceType: body.invoiceType || "invoice", // Default to invoice if not specified
            addOns: body.addOns ? JSON.stringify(body.addOns) : "",
            language: body.language || "en", //default language is en
            isResume: body.isResume ? "true" : "false",
          },
        };

        if (stripeCustomerId) {
          sessionConfig.customer = stripeCustomerId;
        } else {
          sessionConfig.customer_email = body.email;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({ url: session.url });
      } catch (stripeError: any) {
        console.error("Stripe error:", stripeError);
        return res.status(400).json({
          error: stripeError.message || "Invalid request to Stripe",
        });
      }
    } catch (err) {
      console.error("Checkout session error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid request data", details: err.errors });
      }
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "Failed to create checkout session",
      });
    }
  });

  // Check if user has saved payment method
  app.get("/api/check-saved-payment-method", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user || !user.stripeCustomerId) {
        return res.json({ hasSavedPaymentMethod: false });
      }

      // Get payment methods for this customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });

      if (paymentMethods.data.length > 0) {
        const pm = paymentMethods.data[0];
        return res.json({
          hasSavedPaymentMethod: true,
          last4: pm.card?.last4,
          brand: pm.card?.brand,
        });
      }

      return res.json({ hasSavedPaymentMethod: false });
    } catch (err) {
      console.error("Check payment method error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to check payment method",
      });
    }
  });

  // Process logo payment with saved payment method
  app.post("/api/pay-logo-with-saved-card", async (req, res) => {
    const schema = z.object({
      logoType: z.enum(["basic", "premium"]),
    });

    try {
      const { logoType } = schema.parse(req.body);
      
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ error: "No saved payment method" });
      }

      const { logoDesignOptions } = await import('@shared/schema');
      const logoOption = logoDesignOptions[logoType];
      
      if (!logoOption || logoOption.price === 0) {
        return res.status(400).json({ error: "Invalid logo type" });
      }

      // Get the customer's default payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });

      if (paymentMethods.data.length === 0) {
        return res.status(400).json({ error: "No saved payment method found" });
      }

      const paymentMethodId = paymentMethods.data[0].id;

      // Create a PaymentIntent with the saved payment method
      const paymentIntent = await stripe.paymentIntents.create({
        amount: logoOption.price * 100, // Convert to cents
        currency: "eur",
        customer: user.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `${logoOption.name} - ${logoOption.description}`,
        metadata: {
          userId: user.id.toString(),
          logoType,
          purchaseType: "logo_design",
        },
      });

      if (paymentIntent.status === "succeeded") {
        // Payment succeeded - return success
        res.json({ 
          success: true,
          paymentIntentId: paymentIntent.id,
        });
      } else {
        // Payment requires additional action (e.g., 3D Secure)
        res.json({
          success: false,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
        });
      }
    } catch (err) {
      console.error("Logo payment error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: err.errors });
      }
      
      // Handle Stripe errors
      if (err && typeof err === 'object' && 'type' in err) {
        const stripeError = err as any;
        if (stripeError.type === 'StripeCardError') {
          return res.status(400).json({ 
            error: "Payment failed",
            message: stripeError.message 
          });
        }
      }
      
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to process payment",
      });
    }
  });

  // Create checkout session for logo design one-time payment
  app.post("/api/create-logo-design-checkout", async (req, res) => {
    const schema = z.object({
      logoType: z.enum(["basic", "premium"]),
    });

    try {
      const { logoType } = schema.parse(req.body);
      
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { logoDesignOptions } = await import('@shared/schema');
      const logoOption = logoDesignOptions[logoType];
      
      if (!logoOption || logoOption.price === 0) {
        return res.status(400).json({ error: "Invalid logo type" });
      }

      // Create Stripe checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: logoOption.name,
                description: logoOption.description,
              },
              unit_amount: logoOption.price * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/onboarding-logo-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/onboarding?step=8`,
        metadata: {
          userId: req.user.id.toString(),
          logoType,
          purchaseType: "logo_design",
        },
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Logo checkout error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: err.errors });
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to create checkout session",
      });
    }
  });

  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    console.log('📥 Webhook endpoint hit');
    let event: Stripe.Event;

    try {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.log('⚠️ No webhook secret configured, using raw body');
        event = req.body;
      } else {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(
          req.body,
          sig!,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      }

      console.log('🔔 Webhook received:', event.type, 'ID:', event.id);

      switch (event.type) {
        case "checkout.session.completed": {
          console.log('✅ Processing checkout.session.completed');
          const session = event.data.object as Stripe.Checkout.Session;

          try {
            // Differentiate between plan purchase, add-on purchase, and logo design purchase
            const isPlanPurchase = session.metadata?.planId;
            const isAddOnPurchase = session.metadata?.addOnId && session.metadata?.userId;
            const isLogoPurchase = session.metadata?.purchaseType === "logo_design";


            if (!isPlanPurchase && !isAddOnPurchase && !isLogoPurchase) {
              console.error("❌ Unknown purchase type - missing planId, addOnId, or logo purchase:", {
                metadata: session.metadata,
              });
              return res
                .status(400)
                .json({ error: "Missing required session data" });
            }

            // Logo purchases are handled differently (one-time payment, no customer required upfront)
            if (isLogoPurchase) {
              console.log('🎨 Handling logo design purchase');
              const userId = parseInt(session.metadata!.userId!);
              const logoType = session.metadata!.logoType!;
              
              // The onboarding form data is stored in sessionStorage on the frontend
              // and will be submitted after successful payment redirect
              console.log(`✅ Logo design ${logoType} purchased by user ${userId}`);
              
              // Payment will be recorded when onboarding form is submitted via success page
              return res.json({ received: true });
            }

            if (!session.customer) {
              console.error("❌ Missing customer in webhook:", {
                customer: session.customer,
                metadata: session.metadata,
              });
              return res
                .status(400)
                .json({ error: "Missing customer" });
            }
            
            console.log('✅ Customer exists, proceeding...');

            // Handle add-on purchases separately
            if (isAddOnPurchase) {
              console.log('📦 Handling add-on purchase');
              
              const userId = parseInt(session.metadata!.userId!);
              const websiteProgressId = parseInt(session.metadata!.websiteProgressId!);
              const addOnId = session.metadata!.addOnId!;

              // Get the Stripe subscription
              const stripeSubscriptionId = session.subscription as string;
              const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
                expand: ['items.data.price', 'latest_invoice']
              });

              // Set the payment method as customer's default if available
              if (stripeSubscription.default_payment_method) {
                console.log('💳 Setting payment method as customer default for add-on purchase');
                try {
                  await stripe.customers.update(session.customer as string, {
                    invoice_settings: {
                      default_payment_method: stripeSubscription.default_payment_method as string,
                    },
                  });
                  console.log('✅ Payment method set as customer default');
                } catch (pmError) {
                  console.error('⚠️ Failed to set default payment method:', pmError);
                  // Continue anyway - this is not critical
                }
              }

              // Create subscription record for the add-on (keep price in cents)
              const addOnPrice = stripeSubscription.items.data[0].price.unit_amount || null;
              
              const createdSubscription = await storage.createSubscription({
                userId,
                websiteProgressId,
                productType: 'addon',
                productId: addOnId,
                stripeSubscriptionId: stripeSubscription.id,
                stripeSubscriptionItemId: stripeSubscription.items.data[0].id,
                tier: null,
                status: stripeSubscription.status,
                price: addOnPrice,
                vatNumber: null,
                invoiceType: "invoice",
                billingPeriod: stripeSubscription.items.data[0].plan.interval === 'year' ? 'yearly' : 'monthly',
                createdAt: new Date(session.created * 1000),
              });

              console.log('✅ Add-on subscription created:', {
                subscriptionId: createdSubscription.id,
                addOnId,
                stripeSubscriptionId: stripeSubscription.id
              });

              // Create DRAFT invoice for add-on purchase
              if (addOnPrice) {
                const addOn = availableAddOns.find(a => a.id === addOnId);
                const addOnName = addOn?.name || "Add-on";
                const paymentIntentId = await getPaymentIntentFromSubscription(stripeSubscription);
                
                await createDraftInvoice({
                  websiteProgressId,
                  subscriptionId: createdSubscription.id,
                  paymentIntentId,
                  title: `Invoice for ${addOnName}`,
                  description: `Add-on purchase - ${addOnName}`,
                  amount: addOnPrice,
                  currency: session.currency?.toUpperCase() || 'EUR',
                  context: `add-on purchase via checkout (${addOnId})`,
                });
              } else {
                console.error('❌ Cannot create draft invoice: add-on price is null');
              }

              return res.json({ received: true });
            }

            // Handle plan purchases (existing logic)
            console.log('💳 Handling plan purchase');
            
            if (!session.metadata?.username) {
              console.error("❌ Missing username for plan purchase:", {
                metadata: session.metadata,
              });
              return res
                .status(400)
                .json({ error: "Missing username" });
            }

            console.log('✅ Username exists, continuing plan purchase...');
            const planId = session.metadata.planId as SubscriptionTier;

            // Get customer details from Stripe
            const customer = await stripe.customers.retrieve(
              session.customer as string,
            );
            
            if (!customer || customer.deleted) {
              throw new Error("Customer not found or deleted");
            }

            const customerEmail = customer.email;
            if (!customerEmail) {
              throw new Error("Customer email not found");
            }

            // Check if user exists
            let user = await storage.getUserByEmail(customerEmail);

            if (user) {
              if (!user.stripeCustomerId) {
                user = await storage.updateUser(user.id, {
                  stripeCustomerId: session.customer as string,
                  role: UserRole.SUBSCRIBER, // Ensure role is set to subscriber
                });
              }
            } else {
              try {
                user = await storage.createUser({
                  username: session.metadata.username,
                  email: customerEmail,
                  phone: session.metadata.phone || null,
                  stripeCustomerId: session.customer as string,
                  role: UserRole.SUBSCRIBER, // Set role for new users
                  password: await hashPassword(session.metadata.password || ""),
                  language: session.metadata.language || "en", // Use language from session metadata
                });
              } catch (userCreateError) {
                console.error('❌ Failed to create user:', userCreateError);
                throw userCreateError;
              }

              // Send registration welcome email for new users (fire-and-forget)
              sendEmailsSafely([{
                type: 'subscription',
                emailType: 'registered',
                data: {
                  username: session.metadata.username,
                  email: customerEmail,
                  plan: planId,
                  registrationDate: new Date().toLocaleDateString(),
                  language: session.metadata.language || "en",
                }
              }]);
            }
            // Get the Stripe subscription to access subscription items
            const stripeSubscriptionId = session.subscription as string;
            
            let stripeSubscription;
            try {
              stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
                expand: ['items.data.price']
              });
            } catch (stripeError) {
              console.error('❌ Failed to retrieve Stripe subscription:', stripeError);
              throw stripeError;
            }

            // Set the payment method as customer's default if available
            if (stripeSubscription.default_payment_method) {
              console.log('💳 Setting payment method as customer default for plan purchase');
              try {
                await stripe.customers.update(session.customer as string, {
                  invoice_settings: {
                    default_payment_method: stripeSubscription.default_payment_method as string,
                  },
                });
                console.log('✅ Payment method set as customer default');
              } catch (pmError) {
                console.error('⚠️ Failed to set default payment method:', pmError);
                // Continue anyway - this is not critical
              }
            }
            
            // Create a separate subscription record for each subscription item
            for (const item of stripeSubscription.items.data) {
              const priceId = item.price.id;
              
              // Determine if this is a tier or an add-on
              let productType: 'plan' | 'addon' | null = null;
              let productId: string | null = null;
              
              // Check if this price ID matches the setup fee - skip it
              if (priceId === SETUP_FEE_PRICES[planId]) {
                console.log('⏭️  Skipping setup fee item:', priceId);
                continue;
              }
              
              // Check if this price ID matches any add-on
              if (PRICE_TO_ADDON_MAP[priceId]) {
                productType = 'addon';
                productId = PRICE_TO_ADDON_MAP[priceId];
              } else if (priceId === SUBSCRIPTION_PRICES[planId].monthly || priceId === SUBSCRIPTION_PRICES[planId].yearly) {
                productType = 'plan';
                productId = planId;
              } else {
                // Unknown price ID - skip it to avoid creating duplicate subscriptions
                console.warn('Unknown price ID in subscription items, skipping:', priceId);
                continue;
              }
              
              // Check if this subscription came from a schedule
              // If so, find the existing record with the schedule ID and update it
              if (stripeSubscription.schedule) {
                console.log('🗓️  This subscription came from a schedule:', stripeSubscription.schedule);
                
                const scheduleId = typeof stripeSubscription.schedule === 'string' 
                  ? stripeSubscription.schedule 
                  : stripeSubscription.schedule.id;
                
                const scheduledSubscription = await db
                  .select()
                  .from(subscriptionsTable)
                  .where(eq(subscriptionsTable.stripeSubscriptionId, scheduleId))
                  .limit(1);
                
                if (scheduledSubscription.length > 0) {
                  console.log('✅ Found existing scheduled subscription, updating with new subscription ID');
                  
                  await db
                    .update(subscriptionsTable)
                    .set({
                      stripeSubscriptionId: stripeSubscription.id,
                      stripeSubscriptionItemId: item.id,
                      status: stripeSubscription.status,
                      price: item.price.unit_amount || null,
                    })
                    .where(eq(subscriptionsTable.id, scheduledSubscription[0].id));
                  
                  console.log('✅ Updated scheduled subscription to active subscription');
                  continue; // Don't create a new record
                }
              }
              
              // Check if subscription already exists with this Stripe subscription item ID
              const existingSubscription = await db
                .select()
                .from(subscriptionsTable)
                .where(eq(subscriptionsTable.stripeSubscriptionItemId, item.id))
                .limit(1);
              
              // Get the price from Stripe (keep in cents as integer)
              const subscriptionPrice = item.price.unit_amount || null;

              // Website creation is now handled in /api/onboarding/initialize endpoint
              // Webhook only creates/updates subscription without websiteProgressId
              let websiteProgressId = null;
              let createdSubscription;
              
              if (existingSubscription.length > 0) {
                console.log('Subscription already exists for item:', item.id, '- updating with billing info from checkout');
                createdSubscription = existingSubscription[0];
                // Keep existing websiteProgressId if it exists, but don't create new one here
                websiteProgressId = createdSubscription.websiteProgressId;
                
                // Update existing subscription with billing info from checkout session
                // This ensures VAT number and other billing details are saved even for existing subscriptions
                const updateResult = await db
                  .update(subscriptionsTable)
                  .set({
                    vatNumber: session.metadata.vatNumber || createdSubscription.vatNumber || null,
                    city: session.metadata.city || createdSubscription.city || null,
                    street: session.metadata.street || createdSubscription.street || null,
                    number: session.metadata.number || createdSubscription.number || null,
                    postalCode: session.metadata.postalCode || createdSubscription.postalCode || null,
                    invoiceType: session.metadata.invoiceType || createdSubscription.invoiceType || "invoice",
                  })
                  .where(eq(subscriptionsTable.id, createdSubscription.id))
                  .returning();
                
                if (updateResult.length > 0) {
                  createdSubscription = updateResult[0];
                  console.log('✅ Existing subscription updated with billing info:', {
                    subscriptionId: createdSubscription.id,
                    vatNumber: createdSubscription.vatNumber,
                    invoiceType: createdSubscription.invoiceType,
                  });
                }
              } else {
                // Create subscription record without websiteProgressId
                // Website will be created when user visits /onboarding page
                try {
                  createdSubscription = await storage.createSubscription({
                    userId: user.id,
                    websiteProgressId: null, // Will be set when user initializes onboarding
                    productType,
                    productId,
                    stripeSubscriptionId: stripeSubscription.id,
                    stripeSubscriptionItemId: item.id,
                    tier: productType === 'plan' ? productId : null,
                    status: stripeSubscription.status,
                    price: subscriptionPrice,
                    vatNumber: session.metadata.vatNumber || null,
                    city: session.metadata.city || null,
                    street: session.metadata.street || null,
                    number: session.metadata.number || null,
                    postalCode: session.metadata.postalCode || null,
                    invoiceType: session.metadata.invoiceType || "invoice",
                    billingPeriod: stripeSubscription.items.data[0].plan.interval === 'year' ? 'yearly' : 'monthly',
                    createdAt: new Date(session.created * 1000),
                  });
                  
                  console.log('✅ Subscription created (website will be created on onboarding):', {
                    userId: user.id,
                    productType,
                    productId,
                    subscriptionId: createdSubscription.id,
                    stripeSubscriptionItemId: item.id
                  });
                } catch (subscriptionError: any) {
                  console.error('❌ Failed to create subscription:', {
                    error: subscriptionError?.message,
                    stack: subscriptionError?.stack,
                    userId: user.id,
                    productType,
                    productId,
                    stripeSubscriptionId: stripeSubscription.id,
                    metadata: session.metadata
                  });
                  throw subscriptionError;
                }
              }

            }

            const userSubscriptions = await storage.getUserSubscriptions(
              user.id,
            );

            // After subscription creation, send appropriate email
            // Get user's language preference from the database
            const userLanguage = user.language || "en";
            const isResumeFlow = session.metadata?.isResume === "true";

            // Get add-on subscriptions for THIS subscription only (not all user's addons)
            const addonSubscriptions = userSubscriptions.filter(sub => 
              sub.productType === 'addon' && sub.stripeSubscriptionId === stripeSubscription.id
            );
            
            const addOnsInfo = addonSubscriptions.map(sub => {
              const addon = availableAddOns.find(a => a.id === sub.productId);
              return addon ? { name: addon.name, price: addon.price } : null;
            }).filter(Boolean) as { name: string; price: number }[];

            // Fire-and-forget email sending - failures will never block subscription creation
            const emailTasks = [];
            
            if (isResumeFlow) {
              // User confirmation email for resume
              emailTasks.push({
                type: 'subscription' as const,
                emailType: 'resumed',
                data: {
                  username: session.metadata?.username,
                  email: customerEmail,
                  plan: planId,
                  amount: session.amount_total
                    ? (session.amount_total / 100).toFixed(2)
                    : "0.00",
                  currency: session.currency?.toUpperCase(),
                  resumeDate: new Date(),
                  language: userLanguage,
                }
              });

              // Admin notification for resume
              const adminEmailHtml = loadTemplate(
                "admin-subscription-resumed-notification.html",
                {
                  username: session.metadata?.username,
                  email: customerEmail,
                  plan: planId,
                  resumeDate: new Date().toLocaleDateString(),
                  amount: session.amount_total
                    ? (session.amount_total / 100).toFixed(2)
                    : "0.00",
                  currency: session.currency?.toUpperCase(),
                },
                "en",
              );

              emailTasks.push({
                type: 'admin' as const,
                to: "development@hayc.gr",
                subject: `🔄 Subscription Resumed - Reactivate Website for ${session.metadata?.username}`,
                html: adminEmailHtml,
              });
            } else {
              // Calculate the base subscription price from the Stripe subscription items (excluding setup fee and add-ons)
              const planPriceItem = stripeSubscription.items.data.find(item => 
                item.price.id === SUBSCRIPTION_PRICES[planId].monthly || 
                item.price.id === SUBSCRIPTION_PRICES[planId].yearly
              );
              
              const basePriceInCents = planPriceItem?.price.unit_amount || 0;
              const basePriceFormatted = (basePriceInCents / 100).toFixed(2);

              // Get the setup fee from the session's line items (setup fee is a one-time charge, not in subscription items)
              let setupFeeInCents = 0;
              try {
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                  expand: ['data.price']
                });
                const setupFeeLineItem = lineItems.data.find(item =>
                  item.price?.id === SETUP_FEE_PRICES[planId]
                );
                setupFeeInCents = setupFeeLineItem?.amount_total || 0;
              } catch (error) {
                console.error('Error fetching setup fee from session line items:', error);
              }
              const setupFeeFormatted = (setupFeeInCents / 100).toFixed(2);

              // User confirmation email for new subscription
              emailTasks.push({
                type: 'subscription' as const,
                emailType: 'purchased',
                data: {
                  username: session.metadata?.username,
                  email: customerEmail,
                  plan: planId,
                  amount: session.amount_total
                    ? (session.amount_total / 100).toFixed(2)
                    : "0.00",
                  baseAmount: basePriceFormatted,
                  setupFee: setupFeeFormatted,
                  hasSetupFee: setupFeeInCents > 0,
                  currency: session.currency?.toUpperCase(),
                  startDate: new Date(),
                  language: userLanguage,
                  hasAddOns: addOnsInfo.length > 0,
                  addOns: addOnsInfo,
                  addOnsHtml: addOnsInfo
                    .map(
                      (addon) => `
                    <div class="addon-item">
                      <div class="price-row">
                        <span>${addon.name}</span>
                        <span>${session.currency?.toUpperCase()} ${addon.price.toFixed(2)}</span>
                      </div>
                    </div>
                  `,
                    )
                    .join(""),
                }
              });

              // Admin notification for new subscription
              const adminEmailHtml = loadTemplate(
                "admin-new-subscription-notification.html",
                {
                  username: session.metadata?.username,
                  email: customerEmail,
                  plan: planId,
                  subscriptionDate: new Date().toLocaleDateString(),
                  amount: session.amount_total
                    ? (session.amount_total / 100).toFixed(2)
                    : "0.00",
                  currency: session.currency?.toUpperCase(),
                  hasAddOns: addOnsInfo.length > 0,
                  addOnsDetails:
                    addOnsInfo
                      .map(
                        (addon) =>
                          `${addon.name} (+${session.currency?.toUpperCase()} ${addon.price.toFixed(2)})`,
                      )
                      .join(", ") || "None",
                },
                "en",
              );

              emailTasks.push({
                type: 'admin' as const,
                to: "development@hayc.gr",
                subject: `🎉 New Subscription - Setup Website for ${session.metadata?.username}`,
                html: adminEmailHtml,
              });
            }

            // Send emails asynchronously - will not block webhook response
            sendEmailsSafely(emailTasks);

            console.log('✅ Webhook processing completed successfully');
            return res.json({ received: true });
          } catch (err: any) {
            console.error("❌ Webhook processing error:", {
              message: err?.message,
              stack: err?.stack,
              type: event.type,
              sessionId: (event.data.object as any)?.id
            });
            return res.status(500).json({ error: "Failed to process webhook" });
          }
        }

        case "customer.subscription.deleted": {
          // This webhook is handled by the manual cancellation endpoints
          // to avoid duplicate emails. The cancellation email is sent
          // when the user cancels through the UI or admin panel.
          
          // Mark any pending/grace obligations for this subscription as stopped
          try {
            const deletedSubscription = event.data.object as Stripe.Subscription;
            
            // Find our local subscription
            const localSubscription = await db
              .select()
              .from(subscriptionsTable)
              .where(eq(subscriptionsTable.stripeSubscriptionId, deletedSubscription.id))
              .limit(1);
            
            if (localSubscription.length > 0) {
              // Get all pending/grace obligations for this subscription and mark them as stopped
              const obligations = await db
                .select()
                .from(paymentObligations)
                .where(
                  and(
                    eq(paymentObligations.subscriptionId, localSubscription[0].id),
                    inArray(paymentObligations.status, ['pending', 'grace'])
                  )
                );
              
              for (const obligation of obligations) {
                await storage.markObligationStopped(obligation.id);
              }
              
              console.log(`🛑 Marked ${obligations.length} obligations as stopped for cancelled subscription ${deletedSubscription.id}`);
            }
          } catch (error) {
            console.error('Error handling subscription deleted for obligations:', error);
          }
          break;
        }

        case "charge.failed": {
          const charge = event.data.object as Stripe.Charge;
          const customer = await stripe.customers.retrieve(
            charge.customer as string,
          );

          if (!customer || customer.deleted) break;

          // Get the user based on their email
          const user = await storage.getUserByEmail(customer.email);
          const userLanguage = user?.language || "en";

          // Try to find the subscription and website domain
          let websiteDomain = null;
          let websiteProjectName = null;
          let planName = "Your Subscription";
          if (user && charge.metadata?.subscription_id) {
            const subscription = await db
              .select()
              .from(subscriptionsTable)
              .where(eq(subscriptionsTable.stripeSubscriptionId, charge.metadata.subscription_id))
              .limit(1);
            
            if (subscription.length > 0) {
              planName = subscription[0].tier || "Your Subscription";
              
              if (subscription[0].websiteProgressId) {
                const websiteProgressResult = await db
                  .select()
                  .from(websiteProgress)
                  .where(eq(websiteProgress.id, subscription[0].websiteProgressId))
                  .limit(1);
                
                if (websiteProgressResult.length > 0) {
                  websiteDomain = websiteProgressResult[0].domain;
                  websiteProjectName = websiteProgressResult[0].projectName;
                }
              }
            }
          }

          await sendSubscriptionEmail("failed", {
            username: customer.name,
            email: customer.email,
            plan: planName,
            amount: (charge.amount / 100).toFixed(2),
            currency: charge.currency.toUpperCase(),
            failureDate: new Date(),
            failureReason:
              charge.failure_message || "Payment verification failed",
            language: userLanguage,
            domain: websiteDomain,
            projectName: websiteProjectName || websiteDomain,
          });
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const customer = await stripe.customers.retrieve(
            charge.customer as string,
          );

          if (!customer || customer.deleted) break;

          // Get the user based on their email
          const user = await storage.getUserByEmail(customer.email);
          const userLanguage = user?.language || "en";

          // Try to find the subscription and website domain
          let websiteDomain = null;
          let websiteProjectName = null;
          let planName = "Your Subscription";
          if (user && charge.metadata?.subscription_id) {
            const subscription = await db
              .select()
              .from(subscriptionsTable)
              .where(eq(subscriptionsTable.stripeSubscriptionId, charge.metadata.subscription_id))
              .limit(1);
            
            if (subscription.length > 0) {
              planName = subscription[0].tier || "Your Subscription";
              
              if (subscription[0].websiteProgressId) {
                const websiteProgressResult = await db
                  .select()
                  .from(websiteProgress)
                  .where(eq(websiteProgress.id, subscription[0].websiteProgressId))
                  .limit(1);
                
                if (websiteProgressResult.length > 0) {
                  websiteDomain = websiteProgressResult[0].domain;
                  websiteProjectName = websiteProgressResult[0].projectName;
                }
              }
            }
          }

          await sendSubscriptionEmail("refunded", {
            username: customer.name,
            email: customer.email,
            plan: planName,
            amount: (charge.amount_refunded / 100).toFixed(2),
            currency: charge.currency.toUpperCase(),
            refundDate: new Date(),
            transactionId: charge.id,
            language: userLanguage,
            domain: websiteDomain,
            projectName: websiteProjectName || websiteDomain,
          });
          break;
        }

        case "invoice.payment_succeeded": {
          console.log('💰 Processing invoice.payment_succeeded');
          const invoice = event.data.object as Stripe.Invoice;

          try {
            // Only process invoices that are paid and associated with a subscription
            if (invoice.paid && invoice.amount_paid > 0 && invoice.subscription) {
              console.log('📋 Invoice details:', {
                invoiceId: invoice.id,
                subscriptionId: invoice.subscription,
                amount: invoice.amount_paid,
                currency: invoice.currency
              });

              // Check if transaction already exists by Stripe invoice ID
              const existingTransaction = await db
                .select()
                .from(transactionsTable)
                .where(eq(transactionsTable.stripeInvoiceId, invoice.id))
                .limit(1);

              if (existingTransaction.length > 0) {
                console.log('⏭️  Transaction already exists for invoice:', invoice.id);
                break;
              }

              // Find the subscription in our database
              let dbSubscription = await db
                .select()
                .from(subscriptionsTable)
                .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
                .limit(1);

              // If not found, check if this subscription came from a schedule
              if (dbSubscription.length === 0) {
                try {
                  // Fetch the subscription from Stripe to check if it has a schedule
                  const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
                  
                  if (stripeSubscription.schedule) {
                    console.log(`🔄 Subscription ${invoice.subscription} came from schedule ${stripeSubscription.schedule}`);
                    
                    // Look for a subscription with the schedule ID
                    const scheduleSubscription = await db
                      .select()
                      .from(subscriptionsTable)
                      .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscription.schedule as string))
                      .limit(1);
                    
                    if (scheduleSubscription.length > 0) {
                      console.log(`✅ Found subscription with schedule ID, updating to real subscription ID`);
                      
                      // Extract tier and price from the Stripe subscription
                      let updatedTier = scheduleSubscription[0].tier;
                      let updatedPrice = scheduleSubscription[0].price;
                      
                      if (stripeSubscription.items.data.length > 0) {
                        const subscriptionItem = stripeSubscription.items.data[0];
                        const priceId = typeof subscriptionItem.price.id === 'string' ? subscriptionItem.price.id : subscriptionItem.price.id;
                        
                        // Check if this is an add-on
                        if (PRICE_TO_ADDON_MAP[priceId]) {
                          const addonId = PRICE_TO_ADDON_MAP[priceId];
                          updatedTier = addonId; // For add-ons, tier is the add-on ID
                          console.log(`Detected add-on from activated schedule: ${addonId}`);
                        } else {
                          // Check if it's a plan subscription
                          for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
                            if (priceId === prices.monthly || priceId === prices.yearly) {
                              updatedTier = tierKey as SubscriptionTier;
                              console.log(`Detected plan tier from activated schedule: ${tierKey}`);
                              break;
                            }
                          }
                        }
                        
                        // Extract price amount
                        if (subscriptionItem.price.unit_amount) {
                          updatedPrice = subscriptionItem.price.unit_amount;
                          console.log(`Extracted price from activated schedule: ${updatedPrice}`);
                        }
                      }
                      
                      // Update the schedule ID to the real subscription ID, plus tier and price
                      await db
                        .update(subscriptionsTable)
                        .set({ 
                          stripeSubscriptionId: invoice.subscription as string,
                          tier: updatedTier,
                          price: updatedPrice
                        })
                        .where(eq(subscriptionsTable.id, scheduleSubscription[0].id));
                      
                      // Reload the subscription
                      dbSubscription = await db
                        .select()
                        .from(subscriptionsTable)
                        .where(eq(subscriptionsTable.id, scheduleSubscription[0].id))
                        .limit(1);
                      
                      console.log(`🔄 Updated subscription ${scheduleSubscription[0].id} from schedule ${stripeSubscription.schedule} to subscription ${invoice.subscription} with tier: ${updatedTier}, price: ${updatedPrice}`);
                    }
                  }
                } catch (scheduleError) {
                  console.error('Error checking for schedule:', scheduleError);
                }
              }

              if (dbSubscription.length > 0) {
                const subscription = dbSubscription[0];
                
                // Fetch website domain for logging
                let websiteDomain = 'unknown';
                if (subscription.websiteProgressId) {
                  try {
                    const website = await db
                      .select({ domain: websiteProgress.domain })
                      .from(websiteProgress)
                      .where(eq(websiteProgress.id, subscription.websiteProgressId))
                      .limit(1)
                      .then((rows) => rows[0]);
                    if (website) {
                      websiteDomain = website.domain;
                    }
                  } catch (err) {
                    // Ignore error, use default
                  }
                }
                
                console.log('📋 [WEBHOOK] Processing invoice for subscription:', {
                  dbSubscriptionId: subscription.id,
                  stripeSubscriptionId: invoice.subscription,
                  websiteProgressId: subscription.websiteProgressId,
                  websiteDomain: websiteDomain,
                  productType: subscription.productType,
                  amount: invoice.amount_paid,
                  currency: invoice.currency
                });
                
                // Get the actual payment timestamp
                const paidAt = invoice.status_transitions?.paid_at 
                  ? new Date(invoice.status_transitions.paid_at * 1000)
                  : new Date(invoice.created * 1000);

                // Create new transaction with Stripe invoice ID and paid_at timestamp
                // Note: pdfUrl is set to null - admin will upload custom invoice from Cloudinary
                await storage.createTransaction({
                  subscriptionId: subscription.id,
                  amount: invoice.amount_paid,
                  currency: invoice.currency,
                  status: 'paid',
                  pdfUrl: null,
                  stripeInvoiceId: invoice.id,
                  paidAt: paidAt,
                  createdAt: paidAt, // Use the actual payment date as createdAt
                });

                console.log('✅ [WEBHOOK] Transaction created for invoice:', invoice.id);

                // Create invoice draft for recurring payments (both plans and addons)
                // This handles monthly/yearly renewals, not the initial purchase
                // Initial purchase invoice is created in /initialize endpoint
                if (subscription.websiteProgressId && subscription.id) {
                  try {
                    // Check if invoice draft already exists for this subscription + this billing period
                    // Use invoice date to determine the billing period (month/year)
                    const invoiceDate = new Date(invoice.created * 1000);
                    const invoiceMonth = invoiceDate.getMonth() + 1; // 1-12
                    const invoiceYear = invoiceDate.getFullYear();

                    const existingInvoice = await db
                      .select()
                      .from(websiteInvoices)
                      .where(
                        and(
                          eq(websiteInvoices.subscriptionId, subscription.id),
                          eq(websiteInvoices.websiteProgressId, subscription.websiteProgressId),
                          // Check if invoice exists for this month/year
                          sql`EXTRACT(MONTH FROM ${websiteInvoices.issueDate}) = ${invoiceMonth}`,
                          sql`EXTRACT(YEAR FROM ${websiteInvoices.issueDate}) = ${invoiceYear}`
                        )
                      )
                      .limit(1)
                      .then((rows) => rows[0]);

                    if (!existingInvoice && invoice.amount_paid > 0) {
                      // Fetch website domain for logging
                      let websiteDomain = 'unknown';
                      try {
                        const website = await db
                          .select({ domain: websiteProgress.domain })
                          .from(websiteProgress)
                          .where(eq(websiteProgress.id, subscription.websiteProgressId))
                          .limit(1)
                          .then((rows) => rows[0]);
                        if (website) {
                          websiteDomain = website.domain;
                        }
                      } catch (err) {
                        // Ignore error, use default
                      }
                      
                      console.log('🔵 [WEBHOOK] Creating invoice draft for recurring payment:', {
                        subscriptionId: subscription.id,
                        websiteProgressId: subscription.websiteProgressId,
                        websiteDomain: websiteDomain,
                        productType: subscription.productType,
                        amount: invoice.amount_paid,
                        currency: invoice.currency
                      });

                      // Get payment intent from invoice
                      let paymentIntentId: string | null = null;
                      if (invoice.payment_intent) {
                        paymentIntentId = typeof invoice.payment_intent === 'string'
                          ? invoice.payment_intent
                          : invoice.payment_intent.id;
                      }

                      // Determine invoice title and description based on product type
                      let invoiceTitle: string;
                      let invoiceDescription: string;

                      if (subscription.productType === 'plan') {
                        const tierName = subscription.tier 
                          ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)
                          : 'Plan';
                        const billingPeriod = subscription.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly';
                        const planName = subscriptionPlans[subscription.tier as keyof typeof subscriptionPlans]?.name || tierName;
                        invoiceTitle = `Invoice for ${planName} Plan (${billingPeriod})`;
                        invoiceDescription = `Subscription plan - ${planName} (${billingPeriod})`;
                      } else if (subscription.productType === 'addon') {
                        const addOn = availableAddOns.find(a => a.id === subscription.productId);
                        const addOnName = addOn?.name || "Add-on";
                        invoiceTitle = `Invoice for ${addOnName}`;
                        invoiceDescription = `Add-on purchase - ${addOnName}`;
                      } else {
                        invoiceTitle = `Invoice for Subscription`;
                        invoiceDescription = `Recurring payment`;
                      }

                      await createDraftInvoice({
                        websiteProgressId: subscription.websiteProgressId,
                        subscriptionId: subscription.id,
                        paymentIntentId,
                        title: invoiceTitle,
                        description: invoiceDescription,
                        amount: invoice.amount_paid,
                        currency: (invoice.currency || 'eur').toUpperCase(),
                        context: `recurring payment via webhook (${subscription.productType})`,
                      });

                      console.log('✅ [WEBHOOK] Invoice draft created for recurring payment:', {
                        websiteDomain: websiteDomain,
                        invoiceTitle: invoiceTitle,
                        amount: invoice.amount_paid
                      });
                    } else if (existingInvoice) {
                      console.log('🔵 [WEBHOOK] Invoice draft already exists for this billing period, skipping creation');
                    } else {
                      console.log('🔵 [WEBHOOK] Invoice amount is 0, skipping invoice draft creation');
                    }
                  } catch (invoiceError) {
                    console.error('❌ [WEBHOOK] Error creating invoice draft:', invoiceError);
                    // Don't fail the entire webhook if invoice creation fails
                  }
                } else {
                  console.log('🔵 [WEBHOOK] Subscription has no websiteProgressId, skipping invoice draft creation');
                }
                console.log('✅ Transaction created for invoice:', invoice.id);
                
                // Also settle any existing obligation for this invoice
                const existingObligation = await storage.getObligationsByStripeInvoiceId(invoice.id);
                if (existingObligation) {
                  // Create a settlement record
                  await storage.createPaymentSettlement({
                    obligationId: existingObligation.id,
                    amountPaid: invoice.amount_paid,
                    currency: invoice.currency,
                    paidAt: paidAt,
                    paymentMethod: 'stripe',
                    reference: invoice.id,
                    notes: 'Automatically settled via Stripe webhook',
                  });
                  await storage.markObligationSettled(existingObligation.id);
                  console.log('✅ Obligation settled for invoice:', invoice.id);
                }
              } else {
                console.log('⚠️  No local subscription found for Stripe subscription:', invoice.subscription);
              }
            } else {
              console.log('⏭️  Skipping invoice (not paid or no subscription):', {
                paid: invoice.paid,
                amount: invoice.amount_paid,
                subscription: invoice.subscription
              });
            }
          } catch (error) {
            console.error('❌ Error processing invoice.payment_succeeded:', error);
          }
          break;
        }

        case "invoice.payment_failed": {
          console.log('⚠️ Processing invoice.payment_failed');
          const invoice = event.data.object as Stripe.Invoice;

          try {
            if (invoice.subscription) {
              // Find the local subscription
              const dbSubscription = await db
                .select()
                .from(subscriptionsTable)
                .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
                .limit(1);

              if (dbSubscription.length > 0) {
                const subscription = dbSubscription[0];
                
                // Get user info for client name
                const user = await storage.getUserById(subscription.userId);
                const clientName = user?.username || user?.email || 'Unknown Client';

                // Determine if Stripe will retry - check next_payment_attempt
                const hasNextRetry = invoice.next_payment_attempt !== null;
                const nextRetryDate = hasNextRetry && invoice.next_payment_attempt 
                  ? new Date(invoice.next_payment_attempt * 1000) 
                  : null;
                
                // Get failure reason from the charge if available
                let failureReason = invoice.billing_reason || 'unknown reason';
                if (invoice.charge) {
                  try {
                    const charge = await stripe.charges.retrieve(invoice.charge as string);
                    failureReason = charge.failure_message || charge.outcome?.seller_message || failureReason;
                  } catch (e) {
                    // Ignore charge retrieval errors
                  }
                }

                // Status: "retrying" if Stripe will retry, "delinquent" if no more retries
                const status = hasNextRetry ? 'retrying' : 'delinquent';

                // Check if obligation already exists for this invoice
                const existingObligation = await storage.getObligationsByStripeInvoiceId(invoice.id);
                
                if (existingObligation) {
                  // Update existing obligation with retry info
                  await storage.updatePaymentObligation(existingObligation.id, {
                    status,
                    nextRetryDate,
                    attemptCount: (existingObligation.attemptCount || 0) + 1,
                    lastFailureReason: failureReason,
                    notes: hasNextRetry 
                      ? `Payment failed, Stripe will retry on ${nextRetryDate?.toLocaleDateString()}`
                      : `Payment failed - all retries exhausted. Reason: ${failureReason}`,
                  });
                  console.log(`⚠️ Updated obligation to ${status} for invoice:`, invoice.id);
                } else {
                  // Create a new obligation with retry tracking
                  await storage.createPaymentObligation({
                    customPaymentId: null,
                    subscriptionId: subscription.id,
                    userId: subscription.userId,
                    clientName,
                    amountDue: invoice.amount_due,
                    currency: invoice.currency,
                    dueDate: new Date(invoice.created * 1000),
                    status,
                    origin: 'stripe',
                    stripeInvoiceId: invoice.id,
                    stripePaymentIntentId: invoice.payment_intent as string || null,
                    graceDays: 7,
                    nextRetryDate,
                    attemptCount: 1,
                    lastFailureReason: failureReason,
                    notes: hasNextRetry 
                      ? `Payment failed, Stripe will retry on ${nextRetryDate?.toLocaleDateString()}`
                      : `Payment failed - all retries exhausted. Reason: ${failureReason}`,
                  });
                  console.log(`⚠️ Created ${status} obligation for failed payment:`, invoice.id);
                }
              }
            }
          } catch (error) {
            console.error('❌ Error processing invoice.payment_failed:', error);
          }
          break;
        }

        case "invoice.marked_uncollectible": {
          // All payment retries exhausted - Stripe has given up on this invoice
          console.log('❌ Processing invoice.marked_uncollectible - all retries exhausted');
          const invoice = event.data.object as Stripe.Invoice;

          try {
            if (invoice.subscription) {
              // Find the local subscription
              const dbSubscription = await db
                .select()
                .from(subscriptionsTable)
                .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
                .limit(1);

              if (dbSubscription.length > 0) {
                const subscription = dbSubscription[0];
                
                // Update or create obligation as "failed"
                const existingObligation = await storage.getObligationsByStripeInvoiceId(invoice.id);
                
                if (existingObligation) {
                  await storage.updatePaymentObligation(existingObligation.id, {
                    status: 'failed',
                    nextRetryDate: null,
                    notes: `Payment permanently failed - all retries exhausted. Subscription will be cancelled.`,
                  });
                  console.log('❌ Marked obligation as failed for uncollectible invoice:', invoice.id);
                }

                // Cancel the subscription in Stripe (this will trigger customer.subscription.deleted)
                try {
                  await stripe.subscriptions.cancel(invoice.subscription as string, {
                    prorate: false,
                  });
                  console.log('🛑 Cancelled subscription due to unpaid invoice:', invoice.subscription);
                } catch (cancelError) {
                  console.error('Error cancelling subscription:', cancelError);
                }

                // Update local subscription status
                await db
                  .update(subscriptionsTable)
                  .set({ 
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelReason: 'payment_failed'
                  })
                  .where(eq(subscriptionsTable.id, subscription.id));
              }
            }
          } catch (error) {
            console.error('❌ Error processing invoice.marked_uncollectible:', error);
          }
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Check if this is an add-on purchase
          if (paymentIntent.metadata?.action === 'add_subscription_items') {
            try {
              const subscriptionId = paymentIntent.metadata.subscription_id;
              const localSubscriptionId = parseInt(paymentIntent.metadata.local_subscription_id);
              const addOnIds = JSON.parse(paymentIntent.metadata.add_on_ids);
              const addOnPriceIds = JSON.parse(paymentIntent.metadata.add_on_price_ids);

              // Update the Stripe subscription with the add-ons NOW that payment succeeded
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);

              const addOnItems = addOnPriceIds.map((priceId: string) => ({
                price: priceId,
                quantity: 1,
              }));

              await stripe.subscriptions.update(subscriptionId, {
                items: [
                  ...subscription.items.data.map((item) => ({
                    id: item.id,
                  })),
                  ...addOnItems,
                ],
              });

              // Update local database with the add-ons
              const localSubscription = await db.query.subscriptionsTable.findFirst({
                where: eq(subscriptionsTable.id, localSubscriptionId),
              });

              if (localSubscription) {
                const existingAddOns = localSubscription.addOns || [];
                const updatedAddOns = [...existingAddOns, ...addOnIds];

                await db
                  .update(subscriptionsTable)
                  .set({ addOns: updatedAddOns })
                  .where(eq(subscriptionsTable.id, localSubscriptionId));
              }

              console.log(`✅ Add-ons successfully added to subscription ${subscriptionId} after payment`);
            } catch (error) {
              console.error("Error adding add-ons after payment:", error);
            }
          }


          break;
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(400).json({ error: "Webhook error" });
    }
  });

  app.get("/api/session/:sessionId", async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        req.params.sessionId,
        {
          expand: ['subscription']
        }
      );
      
      console.log('📥 [SESSION] Session retrieved:', {
        sessionId: req.params.sessionId,
        stripeSubscriptionId: session.subscription,
        subscriptionType: typeof session.subscription,
        paymentStatus: session.payment_status,
        metadata: session.metadata
      });
      
      // Find the local subscription ID from our database using Stripe subscription ID
      // For plan purchases, we need to find the PLAN subscription, not addons
      // Retry logic in case webhook hasn't finished processing yet
      let localSubscriptionId: number | null = null;
      
      // Get Stripe subscription ID (could be string or expanded object)
      let stripeSubscriptionId: string | null = null;
      if (typeof session.subscription === 'string') {
        stripeSubscriptionId = session.subscription;
      } else if (session.subscription && typeof session.subscription === 'object' && 'id' in session.subscription) {
        stripeSubscriptionId = (session.subscription as any).id;
      }
      
      console.log('📥 [SESSION] Stripe subscription ID:', stripeSubscriptionId);
      
      if (stripeSubscriptionId) {
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries && !localSubscriptionId) {
          // First, try to find a PLAN subscription (not addon)
          const planSubscription = await db
            .select()
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId),
                eq(subscriptionsTable.productType, 'plan')
              )
            )
            .limit(1);
          
          if (planSubscription.length > 0) {
            localSubscriptionId = planSubscription[0].id;
            console.log('✅ [SESSION] Found PLAN subscription:', {
              stripeSubscriptionId: stripeSubscriptionId,
              localSubscriptionId: localSubscriptionId,
              subscriptionId: planSubscription[0].id,
              retryCount
            });
            break;
          }
          
          // If not found and not last retry, wait a bit and retry
          if (retryCount < maxRetries - 1) {
            console.log(`⏳ [SESSION] PLAN subscription not found, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
          
          retryCount++;
        }
        
        // If still not found, fallback: find any subscription with this Stripe subscription ID
        if (!localSubscriptionId) {
          const anySubscription = await db
            .select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
            .limit(1);
          
          console.log('⚠️ [SESSION] No PLAN subscription found after retries, checking for any subscription:', {
            stripeSubscriptionId: stripeSubscriptionId,
            foundSubscriptions: anySubscription.length,
            localSubscriptionId: anySubscription.length > 0 ? anySubscription[0].id : null,
            productType: anySubscription.length > 0 ? anySubscription[0].productType : null
          });
          
          if (anySubscription.length > 0) {
            localSubscriptionId = anySubscription[0].id;
            console.log('✅ [SESSION] Using any subscription found:', {
              subscriptionId: localSubscriptionId,
              productType: anySubscription[0].productType
            });
          } else {
            // Debug: Check what subscriptions exist with this Stripe subscription ID
            const matchingSubscriptions = await db
              .select({
                id: subscriptionsTable.id,
                stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
                productType: subscriptionsTable.productType,
                userId: subscriptionsTable.userId
              })
              .from(subscriptionsTable)
              .where(eq(subscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
              .limit(10);
            
            console.log('🔍 [SESSION] Debug: Subscriptions with this Stripe ID:', {
              stripeSubscriptionId: stripeSubscriptionId,
              matchingSubscriptions: matchingSubscriptions.map(s => ({
                id: s.id,
                stripeSubscriptionId: s.stripeSubscriptionId,
                productType: s.productType,
                userId: s.userId
              }))
            });
          }
        }
      } else {
        console.log('⚠️ [SESSION] No Stripe subscription ID in session:', {
          sessionId: req.params.sessionId,
          hasSubscription: !!session.subscription,
          subscription: session.subscription
        });
      }
      
      const responseData = {
        email: session.customer_details?.email,
        status: session.payment_status === "paid" ? "complete" : "pending",
        subscriptionId: localSubscriptionId,
      };
      
      console.log('📤 [SESSION] Returning session data:', {
        sessionId: req.params.sessionId,
        hasSubscriptionId: !!localSubscriptionId,
        subscriptionId: localSubscriptionId,
        status: responseData.status
      });
      
      res.json(responseData);
    } catch (err) {
      console.error("Session retrieval error:", err);
      res.status(400).json({ error: "Invalid session ID" });
    }
  });

  // Add automatic login endpoint for post-payment
  app.post("/api/auto-login/:sessionId", async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        req.params.sessionId,
      );

      if (session.payment_status !== "paid") {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const customerEmail = session.customer_details?.email;
      if (!customerEmail) {
        return res.status(400).json({ error: "No customer email found" });
      }

      // Find the user by email
      const user = await storage.getUserByEmail(customerEmail);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Log in the user
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // Get user subscriptions
      let subscriptions = [];
      if (user.stripeCustomerId) {
        const userSubscriptions = await storage.getUserSubscriptions(user.id);
        subscriptions = await Promise.all(
          userSubscriptions.map(async (subscription) => {
            const transactions = await storage.getSubscriptionTransactions(
              subscription.id,
            );
            return { ...subscription, transactions };
          }),
        );
      }

      res.json({ user, subscriptions });
    } catch (err) {
      console.error("Auto-login error:", err);
      res.status(500).json({ error: "Failed to auto-login" });
    }
  });

  app.post("/api/subscriptions/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriptionId = parseInt(req.params.id);
      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);

      if (!currentUser?.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: "User or Stripe customer not found" });
      }

      // Get Stripe subscriptions with expanded data
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: currentUser.stripeCustomerId,
        status: "active",
        expand: ["data.items", "data.items.data.price"],
      });

      // Get our local subscription to find matching Stripe subscription
      const userSubscriptions = await storage.getUserSubscriptions(
        currentUser.id,
      );
      const localSubscription = userSubscriptions.find(
        (sub) => sub.id === subscriptionId,
      );

      if (!localSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Find matching Stripe subscription by checking all tier price IDs
      let stripeSubscription = null;
      let foundTier = null;

      for (const stripeSub of stripeSubscriptions.data) {
        const priceId = stripeSub.items.data[0]?.price.id;
        if (!priceId) continue;

        // Check against all subscription tiers and billing periods
        for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
          if (priceId === prices.monthly || priceId === prices.yearly) {
            stripeSubscription = stripeSub;
            foundTier = tierKey;
            break;
          }
        }
        if (stripeSubscription) break;
      }

      if (!stripeSubscription) {
        return res.status(404).json({ error: "Stripe subscription not found" });
      }

      // Cancel only this specific subscription
      await stripe.subscriptions.cancel(stripeSubscription.id);

      // Update local subscription status to cancelled instead of deleting
      await db
        .update(subscriptionsTable)
        .set({
          status: "cancelled",
          cancellationReason: "User requested cancellation",
          accessUntil: new Date(stripeSubscription.current_period_end * 1000),
        })
        .where(eq(subscriptionsTable.id, subscriptionId));

      // Get fresh subscriptions
      const subscriptions = await storage.getUserSubscriptions(currentUser.id);

      // Send cancellation notification email to user
      const user = await storage.getUserById(currentUser.id);
      if (user) {
        // Fetch website domain if subscription is linked to a website
        let websiteDomain = null;
        let websiteProjectName = null;
        if (localSubscription.websiteProgressId) {
          const websiteProgressResult = await db
            .select()
            .from(websiteProgress)
            .where(eq(websiteProgress.id, localSubscription.websiteProgressId))
            .limit(1);
          
          if (websiteProgressResult.length > 0) {
            websiteDomain = websiteProgressResult[0].domain;
            websiteProjectName = websiteProgressResult[0].projectName;
          }
        }

        await sendSubscriptionEmail("cancelled", {
          username: user.username,
          email: user.email,
          plan: localSubscription.tier,
          cancellationDate: new Date(),
          accessUntil: new Date(stripeSubscription.current_period_end * 1000),
          language: user.language || "en",
          domain: websiteDomain,
          projectName: websiteProjectName || websiteDomain,
        });

        // Send admin notification email with action items
        const adminEmailHtml = loadTemplate(
          "admin-cancellation-notice.html",
          {
            username: user.username,
            email: user.email,
            plan: localSubscription.tier,
            cancellationDate: new Date().toLocaleDateString(),
            accessUntil: new Date(
              stripeSubscription.current_period_end * 1000,
            ).toLocaleDateString(),
          },
          "en",
        );

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: "development@hayc.gr",
          subject: `🚨 Subscription Cancelled - Action Required for ${user.username}`,
          html: adminEmailHtml,
        });
      }

      res.json({ success: true, subscriptions });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.post("/api/update-subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { subscriptionId, invoiceType, vatNumber, city, street, number, postalCode } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }

      // Get the subscription to verify ownership
      const subscription = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription.length) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Verify the subscription belongs to the authenticated user
      if (subscription[0].userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Build update object with all fields
      const updateData: any = {
        invoiceType: invoiceType || null,
        vatNumber: vatNumber || null,
        city: city || null,
        street: street || null,
        number: number || null,
        postalCode: postalCode || null,
      };

      // Update the subscription fields
      await db
        .update(subscriptionsTable)
        .set(updateData)
        .where(eq(subscriptionsTable.id, subscriptionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  app.post("/api/admin/update-subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { subscriptionId, invoiceType, vatNumber, city, street, number, postalCode, classificationType, invoiceTypeCode, productName } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }

      // Get the subscription to verify it exists
      const subscription = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription.length) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Build update object with all fields
      const updateData: any = {
        invoiceType: invoiceType || null,
        vatNumber: vatNumber || null,
        city: city || null,
        street: street || null,
        number: number || null,
        postalCode: postalCode || null,
        classificationType: classificationType || null,
        invoiceTypeCode: invoiceTypeCode || null,
        productName: productName || null,
      };

      // Update the subscription fields
      await db
        .update(subscriptionsTable)
        .set(updateData)
        .where(eq(subscriptionsTable.id, subscriptionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  app.get("/api/debug/user/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email);

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      email: user.email,
      username: user.username,
    });
  });

  // Add debug endpoint to check Stripe customer info
  app.get("/api/debug/stripe-customers", async (_req, res) => {
    // Force JSON headers
    res.setHeader("Content-Type", "application/json");

    try {
      const customers = await stripe.customers.list({
        limit: 10,
      });

      return res.json({
        customers: customers.data.map((c) => ({
          email: c.email,
          created: new Date(c.created * 1000).toISOString(),
        })),
      });
    } catch (error) {
      console.error("Error fetching Stripe customers:", error);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Add new admin routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      // Check if the user has permission to view users
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewUsers')) {
        return res.status(403).json({ error: "Not authorized" });
      }
      // Fetch all users from the database
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));
      // Remove sensitive information before sending
      const sanitizedUsers = allUsers.map(({ password, ...user }) => user);
      res.json({ users: sanitizedUsers });
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  // Add endpoint to update user role
  app.patch("/api/admin/users/:id/role", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      // Check if the user has permission to manage users
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || !hasPermission(adminUser.role, 'canManageUsers')) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const schema = z.object({
        role: z.string(),
      });
      const { role } = schema.parse(req.body);
      const userId = parseInt(req.params.id);
      
      // Verify the role exists (either in default roles or custom roles)
      const roleExists = RolePermissions[role] || 
        await db.select().from(customRoles).where(eq(customRoles.name, role)).limit(1);
      
      if (!roleExists || (Array.isArray(roleExists) && roleExists.length === 0)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Update user role
      const updatedUser = await storage.updateUser(userId, { role });
      // Remove sensitive information before sending
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (err) {
      console.error("Error updating user role:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid role", details: err.errors });
      }
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Extract language from Accept-Language header as a fallback when user preference isn't available
  const getPreferredLanguage = (req: express.Request): string => {
    const acceptLanguage = req.headers["accept-language"] || "";

    // Parse the Accept-Language header to get the preferred language
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, quality] = lang.trim().split(";q=");
        return {
          code: code.substring(0, 2).toLowerCase(), // Get first two characters (e.g., 'en' from 'en-US')
          quality: quality ? parseFloat(quality) : 1.0,
        };
      })
      .sort((a, b) => b.quality - a.quality); // Sort by quality descending

    // Check if the preferred language has a template folder
    const availableLanguages = ["en", "gr"]; // Add more supported languages here
    const preferredLanguage =
      languages.find((lang) => availableLanguages.includes(lang.code))?.code ||
      "en";

    return preferredLanguage;
  };

  // Get user's websites from their subscriptions (returns projectName for display)
  const getUserWebsites = async (userId: number): Promise<string[]> => {
    try {
      const userSubscriptions = await db
        .select({
          websiteProgressId: subscriptionsTable.websiteProgressId,
        })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId));

      const websiteIds = userSubscriptions
        .map((s) => s.websiteProgressId)
        .filter((id): id is number => id !== null);

      if (websiteIds.length === 0) return [];

      const websites = await db
        .select({
          projectName: websiteProgress.projectName,
          domain: websiteProgress.domain,
        })
        .from(websiteProgress)
        .where(inArray(websiteProgress.id, websiteIds));

      // Return projectName for display (fallback to domain if projectName is empty)
      return websites.map((w) => w.projectName || w.domain);
    } catch (error) {
      console.error("Error fetching user websites:", error);
      return [];
    }
  };

  // Format websites as HTML for email templates (displays projectName)
  const formatWebsitesHtml = (websites: string[], language: string = "en"): string => {
    if (websites.length === 0) return "";
    
    const title = language === "gr" ? "Επηρεαζόμενη Ιστοσελίδα" : "Affected Website";
    const websiteItems = websites.map(projectName => `<li style="margin-bottom: 5px;">${projectName}</li>`).join("");
    
    return `
      <div style="background-color: #f5f7fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #222; border-bottom: 1px solid #e1e4e8; padding-bottom: 10px;">${title}</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${websiteItems}
        </ul>
      </div>
    `;
  };

  // Get base URL for the application (use VITE_APP_URL for production)
  const getBaseUrl = (): string => {
    return process.env.VITE_APP_URL || 'https://hayc.gr';
  };

  // Loading email template
  const loadTemplate = (
    fileName: string,
    replacements: any,
    language: string,
  ): string => {
    try {
      const filePath = path.join(
        __dirname,
        "email-templates",
        language,
        fileName,
      );
      let template = fs.readFileSync(filePath, "utf8");

      // Automatically add baseUrl to replacements if not present
      const enrichedReplacements = {
        baseUrl: getBaseUrl(),
        ...replacements,
      };

      // Process Handlebars-style conditionals {{#if var}}...{{/if}}
      template = template.replace(
        /{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g,
        (match, condition, content) => {
          const conditionValue = enrichedReplacements[condition];
          return conditionValue ? content : "";
        },
      );

      // Replace variables
      for (const key in enrichedReplacements) {
        const regex = new RegExp(`{{${key}}}`, "g");
        template = template.replace(regex, enrichedReplacements[key]);
      }

      return template;
    } catch (err) {
      console.error(`Error loading template ${fileName}:`, err);
      // Fallback to English if template in specified language doesn't exist
      if (language !== "en") {
        console.warn(
          `Template ${fileName} not found in ${language}, falling back to English`,
        );
        return loadTemplate(fileName, replacements, "en");
      }
      throw err;
    }
  };

  // Internal email: load template from email-templates/{lang}/internal/{app}/{event}.html
  // Internal app sends events with underscores (e.g. booking_reminder); templates use hyphens (booking-reminder.html).
  const loadInternalTemplate = (
    app: string,
    event: string,
    context: Record<string, unknown>,
    language: string,
  ): string => {
    const normalizedEvent = event.replace(/_/g, "-");
    const fileName = path.join("internal", app, `${normalizedEvent}.html`);
    return loadTemplate(fileName, context, language);
  };

  // ----- Internal email endpoint (token-auth, used by booking and other apps) -----
  const INTERNAL_EMAIL_TOKEN = process.env.INTERNAL_EMAIL_TOKEN;
  app.post("/internal/email", async (req, res) => {
    if (!INTERNAL_EMAIL_TOKEN) {
      return res.status(503).json({ error: "Internal email not configured" });
    }
    const token =
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null) ?? (req.headers["x-internal-token"] as string | undefined) ?? null;
    if (token !== INTERNAL_EMAIL_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bodySchema = z.object({
      app: z.string().min(1, "app is required"),
      event: z.string().min(1, "event is required"),
      business_id: z.string().min(1, "business_id is required"),
      recipient: z.object({
        to: z.string().email("recipient.to must be a valid email"),
        name: z.string().optional(),
      }),
      subject: z.string().optional(),
      body: z.string().optional(),
      logo_url: z.string().optional(),
      logoUrl: z.string().optional(),
      reply_to_email: z.string().optional(),
      email_color: z.string().optional(),
      emailColor: z.string().optional(),
      notes: z.string().optional(),
      context: z.record(z.unknown()).default({}),
      language: z.string().optional(),
    });
    type Body = z.infer<typeof bodySchema>;
    const parseResult = bodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.flatten() });
    }
    const payload = parseResult.data as Body & { html?: string; from?: string; fromEmail?: string };


    if (payload.html !== undefined || payload.from !== undefined || (payload as any).fromEmail !== undefined) {
      return res.status(400).json({
        error: "Request must not include raw html, from, or fromEmail; hayc owns template and sender",
      });
    }
    const subject =
      (payload.subject as string) ?? (payload.context?.subject as string) ?? "";
    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ error: "subject or context.subject is required" });
    }

    const { app: appName, event: eventName, business_id: businessId, recipient, context, language = "en", body: payloadBody, reply_to_email: replyToEmail, notes: payloadNotes } = payload;
    const logoUrl = (payload as any).logo_url ?? (payload as any).logoUrl ?? "";
    const emailColor = (payload as any).email_color ?? (payload as any).emailColor ?? "";
    const toEmail = recipient.to;

    console.log("[internal/email] logo_url journey - 8. extracted logoUrl:", logoUrl, "(length:", logoUrl?.length ?? 0, ")");

    res.status(202).json({ accepted: true, message: "Email queued" });

    setImmediate(async () => {
      const logRow = {
        app: appName,
        event: eventName,
        businessId,
        recipientEmail: toEmail,
        status: "accepted",
        messageId: null as string | null,
        errorMessage: null as string | null,
      };
      try {
        const fromAddress =
          process.env[`INTERNAL_EMAIL_FROM_${appName.toUpperCase().replace(/-/g, "_")}`] ??
          process.env.INTERNAL_EMAIL_FROM ??
          "no-reply@booking.hayc.gr";
        const [businessRow] = await db
          .select()
          .from(internalBusinessEmailSettings)
          .where(
            and(
              eq(internalBusinessEmailSettings.app, appName),
              eq(internalBusinessEmailSettings.businessId, businessId)
            )
          )
          .limit(1);
        const fromName = businessRow?.senderName ?? "Hayc";
        const replyTo =
          (replyToEmail && replyToEmail.trim()) ? [replyToEmail] :
          (businessRow?.replyToEmail ? [businessRow.replyToEmail] : undefined);

        // Normalize context: body/subject/logo/color/notes can be top-level or in context.
        console.log("[internal/email] logo_url journey - 9. (setImmediate) logoUrl from closure:", logoUrl);
        console.log("[internal/email] logo_url journey - 10. context keys:", Object.keys(context || {}));
        console.log("[internal/email] logo_url journey - 11. context.logo_url:", context.logo_url);
        console.log("[internal/email] logo_url journey - 12. context.logoUrl:", context.logoUrl);

        const resolvedLogoUrl = (logoUrl || context.logo_url || context.logoUrl || "") as string;
        console.log("[internal/email] logo_url journey - 13. resolvedLogoUrl (final):", resolvedLogoUrl, "(length:", resolvedLogoUrl.length, ")");

        const resolvedBody = (payloadBody ?? context.body ?? context.message ?? context.content ?? context.text ?? "") as string;
        const normalizedContext = {
          ...context,
          recipientName: recipient.name ?? "",
          body: resolvedBody,
          bookingLink: (context.bookingLink ?? context.booking_link ?? context.link ?? "") as string,
          subject,
          logoUrl: resolvedLogoUrl,
          emailColor: (emailColor || context.email_color || context.emailColor || "#182B53") as string,
          notes: (payloadNotes ?? context.notes ?? "") as string,
        };

        console.log("[internal/email] logo_url journey - 14. normalizedContext.logoUrl:", normalizedContext.logoUrl);

        const html = loadInternalTemplate(appName, eventName, normalizedContext, language);
        console.log("[internal/email] logo_url journey - 15. template has {{#if logoUrl}} block removed?", !html.includes("{{#if logoUrl}}"));
        console.log("[internal/email] logo_url journey - 16. template contains logo img?", html.includes("<img") && html.includes("Logo"));
        const result = await EmailService.sendEmail({
          to: toEmail,
          subject,
          message: subject,
          fromEmail: fromAddress,
          fromName,
          html,
          replyToAddresses: replyTo,
        });

        if (result.success) {
          logRow.status = "sent";
          logRow.messageId = result.messageId ?? null;
        } else {
          logRow.status = "failed";
          logRow.errorMessage = result.error ?? null;
        }
      } catch (err: any) {
        logRow.status = "failed";
        logRow.errorMessage = err?.message ?? String(err);
      } finally {
        await db.insert(internalEmailLog).values(logRow);
      }
    });
  });

  // Function to submit lead to HubSpot using Contacts API
  async function submitToHubSpot(data: any) {
    const apiKey = process.env.HUBSPOT_API_KEY;

    if (!apiKey) {
      console.error("❌ HubSpot API key is missing");
      return;
    }

    const apiUrl = "https://api.hubapi.com/crm/v3/objects/contacts";

    // Prepare contact properties using only the most basic required fields
    const properties = {
      email: data.email,
      phone: data.phone,
      lifecyclestage: "lead",
      acquired_lead__drop_down_: "Digital Ads / Campaign",
    };

    const postData = JSON.stringify({
      properties,
    });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: postData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ HubSpot API error response:", errorText);
        throw new Error(
          `HubSpot contact creation failed with status ${response.status}: ${errorText}`,
        );
      }

      const responseData = await response.json();
      return responseData;
    } catch (error: any) {
      console.error("❌ HubSpot contact creation error:", error.message);
      console.error("❌ Full error details:", error);
      throw error;
    }
  }

  // Function to submit contact form to HubSpot with UTM parameters
  async function submitContactToHubSpot(data: {
    email: string;
    firstname: string;
    lastname: string;
    subject: string;
    message: string;
    utm?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
      fbclid?: string;
      gclid?: string;
    };
  }) {
    const apiKey = process.env.HUBSPOT_API_KEY;

    if (!apiKey) {
      console.error("❌ HubSpot API key is missing");
      throw new Error("HubSpot API key is missing");
    }

    const apiUrl = "https://api.hubapi.com/crm/v3/objects/contacts";

    // Build properties object with standard fields
    const properties: Record<string, string> = {
      email: data.email,
      firstname: data.firstname,
      lifecyclestage: "lead",
      acquired_lead__drop_down_: "Contact Form",
      hs_lead_status: "NEW",
    };

    // Add lastname if provided
    if (data.lastname) {
      properties.lastname = data.lastname;
    }

    // Add UTM parameters to HubSpot's default UTM properties
    // These are HubSpot's built-in analytics properties
    if (data.utm) {
      // Set hs_analytics_source to PAID_SOCIAL for META ad traffic
      properties.hs_analytics_source = "PAID_SOCIAL";
      
      if (data.utm.utm_source) {
        properties.utm_source = data.utm.utm_source;
        properties.hayc_utm_source = data.utm.utm_source;
      }
      if (data.utm.utm_medium) {
        properties.utm_medium = data.utm.utm_medium;
        properties.hayc_utm_medium = data.utm.utm_medium;
      }
      if (data.utm.utm_campaign) {
        properties.utm_campaign = data.utm.utm_campaign;
        properties.hayc_utm_campaign = data.utm.utm_campaign;
      }
      if (data.utm.utm_content) {
        properties.utm_content = data.utm.utm_content;
        properties.hayc_utm_content = data.utm.utm_content;
      }
      if (data.utm.utm_term) {
        properties.utm_term = data.utm.utm_term;
        properties.hayc_utm_term = data.utm.utm_term;
      }
      if (data.utm.fbclid) {
        properties.hayc_fbclid = data.utm.fbclid;
      }
      if (data.utm.gclid) {
        properties.hayc_gclid = data.utm.gclid;
      }
    }

    console.log("📤 Submitting contact to HubSpot with properties:", JSON.stringify(properties, null, 2));

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ properties }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ HubSpot API error response:", errorText);
        
        // If contact already exists, try to update instead
        if (response.status === 409) {
          console.log("⚠️ Contact already exists, attempting to update...");
          return await updateHubSpotContact(data.email, properties);
        }
        
        throw new Error(`HubSpot contact creation failed with status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      console.log("✅ HubSpot contact created:", responseData.id);
      return responseData;
    } catch (error: any) {
      console.error("❌ HubSpot contact creation error:", error.message);
      throw error;
    }
  }

  // Function to submit lead to HubSpot with UTM parameters (for landing page)
  async function submitLeadToHubSpot(data: {
    email: string;
    phone: string;
    source?: string;
    leadId?: string;
    utm?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
      fbclid?: string;
      gclid?: string;
    };
  }) {
    const apiKey = process.env.HUBSPOT_API_KEY;

    if (!apiKey) {
      console.error("❌ HubSpot API key is missing");
      throw new Error("HubSpot API key is missing");
    }

    const apiUrl = "https://api.hubapi.com/crm/v3/objects/contacts";

    // Build properties object with standard fields
    const properties: Record<string, string> = {
      email: data.email,
      phone: data.phone,
      lifecyclestage: "lead",
      acquired_lead__drop_down_: "Digital Ads / Campaign",
      hs_lead_status: "NEW",
    };

    // Add UTM parameters to HubSpot properties
    if (data.utm) {
      // Set hs_analytics_source to PAID_SOCIAL for META ad traffic
      properties.hs_analytics_source = "PAID_SOCIAL";
      
      if (data.utm.utm_source) {
        properties.utm_source = data.utm.utm_source;
        properties.hayc_utm_source = data.utm.utm_source;
      }
      if (data.utm.utm_medium) {
        properties.utm_medium = data.utm.utm_medium;
        properties.hayc_utm_medium = data.utm.utm_medium;
      }
      if (data.utm.utm_campaign) {
        properties.utm_campaign = data.utm.utm_campaign;
        properties.hayc_utm_campaign = data.utm.utm_campaign;
      }
      if (data.utm.utm_content) {
        properties.utm_content = data.utm.utm_content;
        properties.hayc_utm_content = data.utm.utm_content;
      }
      if (data.utm.utm_term) {
        properties.utm_term = data.utm.utm_term;
        properties.hayc_utm_term = data.utm.utm_term;
      }
      if (data.utm.fbclid) {
        properties.hayc_fbclid = data.utm.fbclid;
      }
      if (data.utm.gclid) {
        properties.hayc_gclid = data.utm.gclid;
      }
    }

    console.log("📤 Submitting lead to HubSpot with properties:", JSON.stringify(properties, null, 2));

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ properties }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ HubSpot API error response:", errorText);
        
        // If contact already exists, try to update instead
        if (response.status === 409) {
          console.log("⚠️ Lead already exists in HubSpot, attempting to update...");
          return await updateHubSpotContact(data.email, properties);
        }
        
        throw new Error(`HubSpot lead creation failed with status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      console.log("✅ HubSpot lead created:", responseData.id);
      return responseData;
    } catch (error: any) {
      console.error("❌ HubSpot lead creation error:", error.message);
      throw error;
    }
  }

  // Function to update existing HubSpot contact by email
  async function updateHubSpotContact(email: string, properties: Record<string, string>) {
    const apiKey = process.env.HUBSPOT_API_KEY;

    if (!apiKey) {
      throw new Error("HubSpot API key is missing");
    }

    // First, search for the contact by email
    const searchUrl = "https://api.hubapi.com/crm/v3/objects/contacts/search";
    
    try {
      const searchResponse = await fetch(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: "email",
              operator: "EQ",
              value: email,
            }],
          }],
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`HubSpot search failed: ${errorText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.results && searchData.results.length > 0) {
        const contactId = searchData.results[0].id;
        
        // Update the contact
        const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
        const updateResponse = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ properties }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`HubSpot update failed: ${errorText}`);
        }

        const updateData = await updateResponse.json();
        console.log("✅ HubSpot contact updated:", contactId);
        return updateData;
      }

      throw new Error("Contact not found for update");
    } catch (error: any) {
      console.error("❌ HubSpot contact update error:", error.message);
      throw error;
    }
  }

  // Add lead submission endpoint
  app.post("/api/submit-lead", async (req, res) => {
    const utmSchema = z.object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
      fbclid: z.string().optional(),
      gclid: z.string().optional(),
    }).optional();

    const leadSchema = z.object({
      email: z.string().email(),
      phone: z.string().min(10),
      source: z.string().optional().default("website"),
      utm: utmSchema,
    });

    try {
      const data = leadSchema.parse(req.body);
      const leadId = `LEAD_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const submittedAt = new Date().toLocaleString();

      // Send admin notification email (non-blocking)
      const adminEmailHtml = loadTemplate(
        "admin-new-lead-notification.html",
        {
          email: data.email,
          phone: data.phone,
          submittedAt: submittedAt,
          leadId: leadId,
        },
        "en",
      );

      // Send email asynchronously without blocking the response
      transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🎯 NEW LEAD ALERT - ${data.email} from Website Creation Page`,
        html: adminEmailHtml,
      }).then(() => {
        console.log("📧 Admin notification email sent successfully");
      }).catch((emailError) => {
        console.error("📧 Admin email failed (non-blocking):", emailError.message);
      });

      // Submit to HubSpot with UTM parameters
      let hubspotSuccess = false;
      try {
        await submitLeadToHubSpot({
          email: data.email,
          phone: data.phone,
          source: data.source,
          leadId: leadId,
          utm: data.utm,
        });
        hubspotSuccess = true;
        console.log("✅ Lead submitted to HubSpot successfully with UTM data");
      } catch (hubspotError) {
        console.error("❌ HubSpot submission failed:", hubspotError);
        // Don't fail the entire request if HubSpot fails
      }

      res.json({
        success: true,
        leadId: leadId,
        hubspotSuccess: hubspotSuccess,
        message: "Lead submitted successfully",
      });
    } catch (err) {
      console.error("Lead submission error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid lead data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to submit lead" });
    }
  });

  // Debug endpoint to capture HubSpot meeting event data in production
  app.post("/api/debug-meeting-event", async (req, res) => {
    console.log('🔍 DEBUG: Raw HubSpot meeting event received');
    console.log('🔍 Email:', req.body.email);
    console.log('🔍 Event Origin:', req.body.eventOrigin);
    console.log('🔍 Timestamp:', req.body.timestamp);
    console.log('🔍 Full Event Data:', JSON.stringify(req.body.eventData, null, 2));
    res.json({ received: true });
  });

  // Update HubSpot contact when meeting is booked
  app.post("/api/update-meeting-booked", async (req, res) => {
    const meetingSchema = z.object({
      email: z.string().email(),
      meetingDate: z.string(),
    });

    try {
      const data = meetingSchema.parse(req.body);
      
      // Validate that meetingDate is a proper date string
      const parsedDate = new Date(data.meetingDate);
      const now = new Date();
      const timeDiff = Math.abs(parsedDate.getTime() - now.getTime());
      
      // If the meeting date is within 5 seconds of current time, it's likely a fallback issue
      if (timeDiff < 5000) {
        console.warn(`⚠️ PRODUCTION DEBUG: Meeting date appears to be current time (possible fallback)`);
        console.warn(`⚠️ meetingDate received: ${data.meetingDate}`);
        console.warn(`⚠️ current time: ${now.toISOString()}`);
        console.warn(`⚠️ diff: ${timeDiff}ms`);
      }
      
      // Update HubSpot contact with meeting info
      const properties: Record<string, string> = {
        client_stage: "Booked Call",
        meeting_date: data.meetingDate,
      };

      console.log(`📅 Updating HubSpot contact for meeting booking: ${data.email}`);
      console.log(`📅 Meeting date received: ${data.meetingDate}`);
      console.log(`📅 Parsed as: ${parsedDate.toISOString()} (${parsedDate.toLocaleString()})`);

      await updateHubSpotContact(data.email, properties);
      
      console.log(`✅ HubSpot contact updated with meeting info for ${data.email}`);

      res.json({
        success: true,
        message: "Meeting booking info updated in HubSpot",
      });
    } catch (err) {
      console.error("Meeting booking update error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid meeting data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to update meeting booking" });
    }
  });

  // Add check reviews endpoint
  app.post("/api/check-reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Send admin notification email about review check request
      const adminEmailHtml = loadTemplate(
        "admin-review-check-notification.html",
        {
          username: user.username,
          email: user.email,
          userId: user.id,
          requestDate: new Date().toLocaleDateString(),
          facebookUrl: "https://www.facebook.com/haycWebsites/reviews",
          trustpilotUrl: "https://www.trustpilot.com/review/hayc.gr",
          g2Url: "https://www.g2.com/products/hayc/reviews",
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🔍 Review Check Request - ${user.username}`,
        html: adminEmailHtml,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Review check error:", err);
      console.error("Error details:", {
        message: err.message,
        code: err.code,
        command: err.command,
        responseCode: err.responseCode,
        response: err.response,
      });
      res.status(500).json({ error: "Failed to submit review check request" });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    dest: "uploads/",
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  // Initialize onboarding - creates website progress entry with unique domain
  app.post("/api/onboarding/initialize", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { generateUniqueIdentifier } = await import('../shared/utils.js');
      const subscriptionId = req.body.subscriptionId || req.query.subscriptionId;
      const isPostPurchase = !!subscriptionId;
      
      console.log('🔵 [ONBOARDING INITIALIZE] Request received:', {
        subscriptionId,
        isPostPurchase,
        userId: req.user.id,
        body: req.body,
        query: req.query
      });
      
      // Generate unique domain identifier
      let domain: string = '';
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        domain = generateUniqueIdentifier();
        
        // Check if this identifier is already in use (with or without .pending-onboarding suffix)
        const existing = await db
          .select()
          .from(websiteProgress)
          .where(
            or(
              eq(websiteProgress.domain, domain),
              eq(websiteProgress.domain, `${domain}.pending-onboarding`)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique || !domain) {
        throw new Error('Failed to generate unique identifier after multiple attempts');
      }

      // If post-purchase, check if subscription already has a website progress entry
      // Otherwise, check for existing draft first
      let websiteProgressEntry;
      let shouldCreateDraft = false;

      if (isPostPurchase) {
        console.log('🔵 [ONBOARDING INITIALIZE] Post-purchase flow detected');
        // Post-purchase: First check if subscription already has a website progress entry
        const subscriptionIdNum = parseInt(subscriptionId as string);
        
        if (isNaN(subscriptionIdNum)) {
          console.error('❌ [ONBOARDING INITIALIZE] Invalid subscriptionId:', subscriptionId);
          return res.status(400).json({ error: "Invalid subscription ID" });
        }
        
        const subscription = await db
          .select()
          .from(subscriptionsTable)
          .where(
            and(
              eq(subscriptionsTable.id, subscriptionIdNum),
              eq(subscriptionsTable.userId, req.user.id)
            )
          )
          .then((rows) => rows[0]);

        if (!subscription) {
          console.error('❌ [ONBOARDING INITIALIZE] Subscription not found:', subscriptionIdNum);
          return res.status(404).json({ error: "Subscription not found" });
        }

        console.log('🔵 [ONBOARDING INITIALIZE] Subscription found:', {
          subscriptionId: subscription.id,
          websiteProgressId: subscription.websiteProgressId,
          productType: subscription.productType
        });

        // For post-purchase: Check if subscription already has a website
        // If yes, reuse it (unless onboarding is completed, then create new for new purchase)
        // If no, create new website and link it
        if (subscription.websiteProgressId) {
          websiteProgressEntry = await db
            .select()
            .from(websiteProgress)
            .where(eq(websiteProgress.id, subscription.websiteProgressId))
            .then((rows) => rows[0]);

          if (!websiteProgressEntry) {
            console.error('❌ [ONBOARDING INITIALIZE] Website progress entry not found:', subscription.websiteProgressId);
            return res.status(404).json({ error: "Website progress entry not found" });
          }

          console.log('🔵 [ONBOARDING INITIALIZE] Existing website found:', {
            websiteProgressId: websiteProgressEntry.id,
            domain: websiteProgressEntry.domain,
            currentStage: websiteProgressEntry.currentStage
          });

          // Check if onboarding has already been completed for this website
          const completedOnboarding = await db
            .select()
            .from(onboardingFormResponses)
            .where(
              and(
                eq(onboardingFormResponses.websiteProgressId, websiteProgressEntry.id),
                eq(onboardingFormResponses.status, 'completed')
              )
            )
            .limit(1)
            .then((rows) => rows[0]);

          if (completedOnboarding) {
            // Onboarding completed - create new website for this new purchase
            console.log('🔵 [ONBOARDING INITIALIZE] Onboarding completed for existing website, creating new website for this purchase');
            const websiteProgressResult = await db.insert(websiteProgress).values({
              userId: req.user.id,
              domain: `${domain}.pending-onboarding`,
              currentStage: 0,
            }).returning();

            websiteProgressEntry = websiteProgressResult[0];
            shouldCreateDraft = true;

            // Link new website to subscription
            await db
              .update(subscriptionsTable)
              .set({ websiteProgressId: websiteProgressEntry.id })
              .where(eq(subscriptionsTable.id, subscriptionIdNum));

            // Create system tags for new website
            await storage.createSystemTagsForWebsite(websiteProgressEntry.id);
            
            console.log('✅ [ONBOARDING INITIALIZE] New website created for new purchase:', {
              websiteProgressId: websiteProgressEntry.id,
              domain: websiteProgressEntry.domain,
              subscriptionId: subscriptionIdNum
            });
          } else {
            // Reuse existing website - check for existing draft
            console.log('🔵 [ONBOARDING INITIALIZE] Reusing existing website, checking for draft');
            const existingDraft = await db
              .select()
              .from(onboardingFormResponses)
              .where(
                and(
                  eq(onboardingFormResponses.websiteProgressId, websiteProgressEntry.id),
                  eq(onboardingFormResponses.status, 'draft')
                )
              )
              .limit(1)
              .then((rows) => rows[0]);
            
            if (!existingDraft) {
              shouldCreateDraft = true;
            }
            
            console.log('✅ [ONBOARDING INITIALIZE] Reusing existing website:', {
              websiteProgressId: websiteProgressEntry.id,
              domain: websiteProgressEntry.domain,
              subscriptionId: subscriptionIdNum,
              hasExistingDraft: !!existingDraft
            });
          }
        } else {
          // No website exists - create new one (this is the normal flow now)
          console.log('🔵 [ONBOARDING INITIALIZE] Subscription has no websiteProgressId, creating new website');
          const websiteProgressResult = await db.insert(websiteProgress).values({
            userId: req.user.id,
            domain: `${domain}.pending-onboarding`,
            currentStage: 0,
          }).returning();

          websiteProgressEntry = websiteProgressResult[0];
          shouldCreateDraft = true;

          // Link website to subscription
          await db
            .update(subscriptionsTable)
            .set({ websiteProgressId: websiteProgressEntry.id })
            .where(eq(subscriptionsTable.id, subscriptionIdNum));

          // Create system tags for new website
          await storage.createSystemTagsForWebsite(websiteProgressEntry.id);
          
          console.log('✅ [ONBOARDING INITIALIZE] New website created and linked:', {
            websiteProgressId: websiteProgressEntry.id,
            domain: websiteProgressEntry.domain,
            subscriptionId: subscriptionIdNum
          });
        }

        // Create invoice draft for plan subscriptions
        if (websiteProgressEntry && subscription) {
          // Only create invoice for plan subscriptions, not addons
          if (subscription.productType === 'plan' && subscription.id) {
            try {
              // Check if invoice already exists for this subscription + current month
              // This prevents duplicates if webhook already created invoice for first payment
              const now = new Date();
              const currentMonth = now.getMonth() + 1;
              const currentYear = now.getFullYear();
              
              const existingInvoice = await db
                .select()
                .from(websiteInvoices)
                .where(
                  and(
                    eq(websiteInvoices.subscriptionId, subscription.id),
                    eq(websiteInvoices.websiteProgressId, websiteProgressEntry.id),
                    // Check if invoice exists for current month/year to avoid duplicates
                    sql`EXTRACT(MONTH FROM ${websiteInvoices.issueDate}) = ${currentMonth}`,
                    sql`EXTRACT(YEAR FROM ${websiteInvoices.issueDate}) = ${currentYear}`
                  )
                )
                .limit(1)
                .then((rows) => rows[0]);

              if (!existingInvoice && subscription.price && subscription.price > 0) {
                console.log('🔵 [ONBOARDING INITIALIZE] Creating invoice draft for plan subscription');
                
                // Get payment intent from Stripe subscription
                let paymentIntentId: string | null = null;
                if (subscription.stripeSubscriptionId) {
                  try {
                    const stripeSubscription = await stripe.subscriptions.retrieve(
                      subscription.stripeSubscriptionId,
                      { expand: ['latest_invoice'] }
                    );
                    paymentIntentId = await getPaymentIntentFromSubscription(stripeSubscription);
                  } catch (stripeError) {
                    console.warn('⚠️ [ONBOARDING INITIALIZE] Could not fetch Stripe subscription for payment intent:', stripeError);
                  }
                }

                // Get tier name for invoice title
                const tierName = subscription.tier 
                  ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)
                  : 'Plan';
                
                const billingPeriod = subscription.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly';
                const planName = subscriptionPlans[subscription.tier as keyof typeof subscriptionPlans]?.name || tierName;

                await createDraftInvoice({
                  websiteProgressId: websiteProgressEntry.id,
                  subscriptionId: subscription.id,
                  paymentIntentId,
                  title: `Invoice for ${planName} Plan (${billingPeriod})`,
                  description: `Subscription plan - ${planName} (${billingPeriod})`,
                  amount: subscription.price,
                  currency: 'EUR', // Default to EUR, can be enhanced later
                  context: `plan subscription via onboarding initialize (${subscription.tier || 'unknown'})`,
                });
                
                console.log('✅ [ONBOARDING INITIALIZE] Invoice draft created for plan subscription');
              } else if (existingInvoice) {
                console.log('🔵 [ONBOARDING INITIALIZE] Invoice already exists for this subscription, skipping creation');
              } else {
                console.log('🔵 [ONBOARDING INITIALIZE] Subscription price is 0 or null, skipping invoice creation');
              }
            } catch (invoiceError) {
              console.error('❌ [ONBOARDING INITIALIZE] Error creating invoice draft:', invoiceError);
              // Don't fail the entire request if invoice creation fails
            }
          }
        }
      } else {
        console.log('🔵 [ONBOARDING INITIALIZE] Non-post-purchase flow (no subscriptionId provided)');
        // Not post-purchase: Check for existing draft first
        // First, check if user has a pending onboarding website progress
        const existingPending = await db
          .select()
          .from(websiteProgress)
          .where(
            and(
              eq(websiteProgress.userId, req.user.id),
              like(websiteProgress.domain, '%.pending-onboarding')
            )
          )
          .orderBy(desc(websiteProgress.createdAt))
          .limit(1)
          .then((rows) => rows[0]);
        
        console.log('🔵 [ONBOARDING INITIALIZE] Existing pending website check:', {
          found: !!existingPending,
          websiteProgressId: existingPending?.id,
          domain: existingPending?.domain
        });

        if (existingPending) {
          // Check if this website has a draft
          const existingDraft = await db
            .select()
            .from(onboardingFormResponses)
            .where(
              and(
                eq(onboardingFormResponses.websiteProgressId, existingPending.id),
                eq(onboardingFormResponses.status, 'draft')
              )
            )
            .limit(1)
            .then((rows) => rows[0]);

          if (existingDraft) {
            // Existing draft found - return it
            websiteProgressEntry = existingPending;
            const cleanDomain = websiteProgressEntry.domain.replace('.pending-onboarding', '');
            return res.json({
              success: true,
              websiteProgressId: websiteProgressEntry.id,
              domain: cleanDomain,
              hasExistingDraft: true,
            });
          } else {
            // Has pending website but no draft - use existing website
            websiteProgressEntry = existingPending;
          }
        } else {
          // No existing pending website - create new
          const websiteProgressResult = await db.insert(websiteProgress).values({
            userId: req.user.id,
            domain: `${domain}.pending-onboarding`,
            currentStage: 0, // 0 = pending onboarding
          }).returning();

          websiteProgressEntry = websiteProgressResult[0];
        }
      }

      // Create initial draft if this is post-purchase
      if (shouldCreateDraft && websiteProgressEntry) {
        // Double-check that no draft exists before creating one (safety check)
        const existingDraftCheck = await db
          .select()
          .from(onboardingFormResponses)
          .where(
            and(
              eq(onboardingFormResponses.websiteProgressId, websiteProgressEntry.id),
              eq(onboardingFormResponses.status, 'draft')
            )
          )
          .limit(1)
          .then((rows) => rows[0]);
        
        if (!existingDraftCheck) {
          console.log('🔵 [ONBOARDING INITIALIZE] Creating initial draft for website:', websiteProgressEntry.id);
          const accountEmail = req.user.email;
          const initialDraftData = {
            websiteProgressId: websiteProgressEntry.id,
            status: 'draft' as const,
            businessName: '',
            contactName: '',
            contactPhone: '',
            accountEmail: accountEmail,
            contactEmail: '',
            businessDescription: '',
            hasDomain: '',
            hasEmails: '',
            hasWebsite: '',
            hasTextContent: '',
            hasMediaContent: '',
            hasSocialMedia: '',
            submissionId: `DRAFT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          };

          await db.insert(onboardingFormResponses).values(initialDraftData);
          console.log('✅ [ONBOARDING INITIALIZE] Initial draft created');
        } else {
          console.log('🔵 [ONBOARDING INITIALIZE] Draft already exists, skipping creation');
        }
      }

      const cleanDomain = websiteProgressEntry.domain.replace('.pending-onboarding', '');
      
      // Check if there's an existing draft for the final website entry
      const finalDraftCheck = await db
        .select()
        .from(onboardingFormResponses)
        .where(
          and(
            eq(onboardingFormResponses.websiteProgressId, websiteProgressEntry.id),
            eq(onboardingFormResponses.status, 'draft')
          )
        )
        .limit(1)
        .then((rows) => rows[0]);
      
      const hasExistingDraft = !!finalDraftCheck;
      
      console.log('✅ [ONBOARDING INITIALIZE] Returning response:', {
        success: true,
        websiteProgressId: websiteProgressEntry.id,
        domain: cleanDomain,
        hasExistingDraft,
        isPostPurchase
      });

      res.json({
        success: true,
        websiteProgressId: websiteProgressEntry.id,
        domain: cleanDomain, // Return the domain without .pending-onboarding suffix for file uploads
        hasExistingDraft, // Return true if draft exists, false otherwise
      });
    } catch (error) {
      console.error("Error initializing onboarding:", error);
      res.status(500).json({ error: "Failed to initialize onboarding" });
    }
  });

  // Add draft save endpoint for onboarding form
  app.post(
    "/api/onboarding-form/draft",
    upload.none(), // Parse FormData without expecting files
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const draftSchema = z.object({
        websiteProgressId: z.string().min(1),
        // All fields optional for partial saves
        businessName: z.string().optional(),
        websiteLanguage: z.enum(["en", "gr"]).optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional(),
        businessDescription: z.string().optional(),
        hasDomain: z.enum(["yes", "no"]).optional(),
        existingDomain: z.string().optional(),
        domainAccess: z.string().optional(),
        domainConnectionPreference: z.enum(["i_will_connect", "you_connect"]).optional().or(z.literal("")),
        domainPurchasePreference: z.enum(["i_will_buy", "you_buy"]).optional().or(z.literal("")),
        preferredDomains: z.string().optional(),
        hasEmails: z.enum(["yes", "no"]).optional(),
        emailProvider: z.string().optional(),
        emailAccess: z.string().optional(),
        existingEmails: z.string().optional(),
        emailCount: z.string().optional(),
        emailNames: z.string().optional(),
        emailRedirect: z.enum(["main-inbox", "separate"]).optional().or(z.literal("")),
        redirectInboxAddress: z.string().email().optional(),
        hasWebsite: z.enum(["yes", "no"]).optional(),
        websiteLink: z.string().optional(),
        websiteChanges: z.string().optional(),
        wantedPages: z.string().optional(),
        notSurePages: z.string().optional(),
        hasTextContent: z.enum(["yes", "no"]).optional(),
        hasMediaContent: z.enum(["yes", "no"]).optional(),
        businessLogoUrl: z.string().optional(),
        businessLogoName: z.string().optional(),
        businessLogoPublicId: z.string().optional(),
        createTextLogo: z.string().optional(),
        colorPalette: z.string().optional(),
        inspirationWebsites: z.string().optional(),
        preferredFonts: z.string().optional(),
        siteStyle: z.string().optional(),
        selectedTemplateId: z.string().optional(),
        customTemplateRequest: z.string().optional(),
        hasSocialMedia: z.enum(["yes", "no"]).optional(),
        facebookLink: z.string().optional(),
        instagramLink: z.string().optional(),
        linkedinLink: z.string().optional(),
        tiktokLink: z.string().optional(),
        youtubeLink: z.string().optional(),
        otherSocialLinks: z.string().optional(),
        logoDesignService: z.enum(["none", "basic", "premium"]).optional().or(z.literal("")),
        projectDeadline: z.string().optional(),
        additionalNotes: z.string().optional(),
      });

      try {
        const data = draftSchema.parse(req.body);
        const websiteProgressId = parseInt(data.websiteProgressId);

        // Verify website progress entry exists and belongs to user
        const websiteProgressEntry = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, websiteProgressId))
          .then((rows) => rows[0]);

        if (!websiteProgressEntry) {
          return res.status(404).json({ error: "Website progress entry not found" });
        }

        if (websiteProgressEntry.userId !== req.user.id) {
          return res.status(403).json({ error: "Not authorized" });
        }

        // Get accountEmail from authenticated user session
        const accountEmail = req.user.email;

        // Parse JSON fields and boolean fields
        let wantedPages: string[] | undefined;
        if (data.wantedPages) {
          try {
            wantedPages = JSON.parse(data.wantedPages);
          } catch (e) {
            wantedPages = [];
          }
        }

        let inspirationWebsites: string[] | undefined;
        if (data.inspirationWebsites) {
          try {
            inspirationWebsites = JSON.parse(data.inspirationWebsites);
          } catch (e) {
            inspirationWebsites = [];
          }
        }

        const notSurePages = data.notSurePages === 'true' ? true : data.notSurePages === 'false' ? false : undefined;
        const createTextLogo = data.createTextLogo === 'true' ? true : data.createTextLogo === 'false' ? false : undefined;

        // Check if any record exists (draft or completed)
        const existingRecord = await db
          .select()
          .from(onboardingFormResponses)
          .where(eq(onboardingFormResponses.websiteProgressId, websiteProgressId))
          .orderBy(desc(onboardingFormResponses.id))
          .limit(1)
          .then((rows) => rows[0]);

        // If record exists and is already completed, don't allow draft saves to overwrite it
        if (existingRecord && existingRecord.status === 'completed') {
          return res.json({ success: true, message: "Form already completed, draft save skipped" });
        }

        // Only update if it's a draft, otherwise we'll create a new draft
        const existingDraft = existingRecord && existingRecord.status === 'draft' ? existingRecord : null;

        const draftData: any = {
          websiteProgressId: websiteProgressId,
          status: 'draft',
        };

        // Only include fields that are provided
        if (data.businessName) draftData.businessName = data.businessName;
        if (data.contactName) draftData.contactName = data.contactName;
        if (data.contactPhone) draftData.contactPhone = data.contactPhone;
        if (accountEmail) draftData.accountEmail = accountEmail;
        if (data.contactEmail) draftData.contactEmail = data.contactEmail;
        if (data.businessDescription) draftData.businessDescription = data.businessDescription;
        if (data.hasDomain) draftData.hasDomain = data.hasDomain;
        if (data.existingDomain !== undefined) draftData.existingDomain = data.existingDomain;
        if (data.domainAccess !== undefined) draftData.domainAccess = data.domainAccess;
        if (data.domainConnectionPreference !== undefined) draftData.domainConnectionPreference = data.domainConnectionPreference;
        if (data.domainPurchasePreference !== undefined) draftData.domainPurchasePreference = data.domainPurchasePreference;
        if (data.preferredDomains !== undefined) draftData.preferredDomains = data.preferredDomains;
        if (data.hasEmails) draftData.hasEmails = data.hasEmails;
        if (data.emailProvider !== undefined) draftData.emailProvider = data.emailProvider;
        if (data.emailAccess !== undefined) draftData.emailAccess = data.emailAccess;
        if (data.existingEmails !== undefined) draftData.existingEmails = data.existingEmails;
        if (data.emailCount !== undefined) draftData.emailCount = data.emailCount;
        if (data.emailNames !== undefined) draftData.emailNames = data.emailNames;
        if (data.emailRedirect !== undefined) draftData.emailRedirect = data.emailRedirect;
        if (data.redirectInboxAddress !== undefined) draftData.redirectInboxAddress = data.redirectInboxAddress;
        if (data.hasWebsite) draftData.hasWebsite = data.hasWebsite;
        if (data.websiteLink !== undefined) draftData.websiteLink = data.websiteLink;
        if (data.websiteChanges !== undefined) draftData.websiteChanges = data.websiteChanges;
        if (wantedPages !== undefined) draftData.wantedPages = wantedPages;
        if (notSurePages !== undefined) draftData.notSurePages = notSurePages;
        if (data.hasTextContent) draftData.hasTextContent = data.hasTextContent;
        if (data.hasMediaContent) draftData.hasMediaContent = data.hasMediaContent;
        if (data.businessLogoUrl !== undefined) draftData.businessLogoUrl = data.businessLogoUrl;
        if (data.businessLogoName !== undefined) draftData.businessLogoName = data.businessLogoName;
        if (data.businessLogoPublicId !== undefined) draftData.businessLogoPublicId = data.businessLogoPublicId;
        if (createTextLogo !== undefined) draftData.createTextLogo = createTextLogo;
        if (data.colorPalette !== undefined) draftData.colorPalette = data.colorPalette;
        if (inspirationWebsites !== undefined) draftData.inspirationWebsites = inspirationWebsites;
        if (data.preferredFonts !== undefined) draftData.preferredFonts = data.preferredFonts;
        if (data.siteStyle !== undefined) draftData.siteStyle = data.siteStyle;
        if (data.selectedTemplateId) draftData.selectedTemplateId = parseInt(data.selectedTemplateId);
        if (data.customTemplateRequest !== undefined) draftData.customTemplateRequest = data.customTemplateRequest;
        if (data.hasSocialMedia) draftData.hasSocialMedia = data.hasSocialMedia;
        if (data.facebookLink !== undefined) draftData.facebookLink = data.facebookLink;
        if (data.instagramLink !== undefined) draftData.instagramLink = data.instagramLink;
        if (data.linkedinLink !== undefined) draftData.linkedinLink = data.linkedinLink;
        if (data.tiktokLink !== undefined) draftData.tiktokLink = data.tiktokLink;
        if (data.youtubeLink !== undefined) draftData.youtubeLink = data.youtubeLink;
        if (data.otherSocialLinks !== undefined) draftData.otherSocialLinks = data.otherSocialLinks;
        if (data.logoDesignService !== undefined) draftData.logoDesignService = data.logoDesignService;
        if (data.projectDeadline !== undefined) draftData.projectDeadline = data.projectDeadline;
        if (data.additionalNotes !== undefined) draftData.additionalNotes = data.additionalNotes;

        // Generate submissionId if creating new draft
        if (!existingDraft) {
          draftData.submissionId = `DRAFT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        }

        if (existingDraft) {
          // Update existing draft
          await db
            .update(onboardingFormResponses)
            .set(draftData)
            .where(eq(onboardingFormResponses.id, existingDraft.id));
        } else {
          // Create new draft - ensure required fields have defaults
          if (!draftData.businessName) draftData.businessName = '';
          if (!draftData.contactName) draftData.contactName = '';
          if (!draftData.contactPhone) draftData.contactPhone = '';
          if (!draftData.accountEmail) draftData.accountEmail = accountEmail;
          if (!draftData.contactEmail) draftData.contactEmail = '';
          if (!draftData.businessDescription) draftData.businessDescription = '';
          if (!draftData.hasDomain) draftData.hasDomain = '';
          if (!draftData.hasEmails) draftData.hasEmails = '';
          if (!draftData.hasWebsite) draftData.hasWebsite = '';
          if (!draftData.hasTextContent) draftData.hasTextContent = '';
          if (!draftData.hasMediaContent) draftData.hasMediaContent = '';
          if (!draftData.hasSocialMedia) draftData.hasSocialMedia = '';
          if (!draftData.submissionId) draftData.submissionId = `DRAFT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

          await db.insert(onboardingFormResponses).values(draftData);
        }

        res.json({ success: true, message: "Draft saved successfully" });
      } catch (err) {
        console.error("Draft save error:", err);
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Invalid form data", details: err.errors });
        }
        res.status(500).json({ error: "Failed to save draft" });
      }
    },
  );

  // Get draft endpoint for onboarding form
  app.get(
    "/api/onboarding-form/draft/:websiteProgressId",
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      try {
        const websiteProgressId = parseInt(req.params.websiteProgressId);

        // Verify website progress entry exists and belongs to user
        const websiteProgressEntry = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, websiteProgressId))
          .then((rows) => rows[0]);

        if (!websiteProgressEntry) {
          return res.status(404).json({ error: "Website progress entry not found" });
        }

        if (websiteProgressEntry.userId !== req.user.id) {
          return res.status(403).json({ error: "Not authorized" });
        }

        // Get draft if exists
        const draft = await db
          .select()
          .from(onboardingFormResponses)
          .where(
            and(
              eq(onboardingFormResponses.websiteProgressId, websiteProgressId),
              eq(onboardingFormResponses.status, 'draft')
            )
          )
          .then((rows) => rows[0]);

        if (!draft) {
          return res.status(404).json({ error: "Draft not found" });
        }

        res.json(draft);
      } catch (err) {
        console.error("Draft load error:", err);
        res.status(500).json({ error: "Failed to load draft" });
      }
    },
  );

  // Add onboarding form submission endpoint
  app.post(
    "/api/onboarding-form",
    upload.single("businessLogo"),
    async (req, res) => {
      const onboardingSchema = z.object({
        // Website progress linking (from initialization)
        websiteProgressId: z.string().optional(),
        // Subscription linking
        subscriptionId: z.string().optional(),

        // Step 1: Business Information
        businessName: z.string().min(2),
        websiteLanguage: z.enum(["en", "gr"]).optional(),
        contactName: z.string().min(2),
        contactPhone: z.string().min(5),
        contactEmail: z.string().email(),
        businessDescription: z.string().min(10),

        // Step 2: Domain
        hasDomain: z.enum(["yes", "no"]),
        existingDomain: z.string().optional(),
        domainAccess: z.string().optional(),
        domainConnectionPreference: z.enum(["i_will_connect", "you_connect"]).optional().or(z.literal("")),
        domainPurchasePreference: z.enum(["i_will_buy", "you_buy"]).optional().or(z.literal("")),
        preferredDomains: z.string().optional(),

        // Step 3: Professional Emails
        hasEmails: z.enum(["yes", "no"]),
        emailProvider: z.string().optional(),
        emailAccess: z.string().optional(),
        existingEmails: z.string().optional(),
        emailCount: z.string().optional(),
        emailNames: z.string().optional(),
        emailRedirect: z.enum(["main-inbox", "separate"]).optional().or(z.literal("")),
        redirectInboxAddress: z.string().optional(),

        // Step 4: Website Foundation
        hasWebsite: z.enum(["yes", "no"]),
        websiteLink: z.string().optional(),
        websiteChanges: z.string().optional(),
        wantedPages: z.string().optional(), // Will be parsed from JSON
        notSurePages: z.string().optional(), // Will be parsed as boolean
        hasTextContent: z.enum(["yes", "no"]),
        hasMediaContent: z.enum(["yes", "no"]),

        // Step 5: Design Preferences
        businessLogoUrl: z.string().optional(),
        businessLogoName: z.string().optional(),
        businessLogoPublicId: z.string().optional(),
        createTextLogo: z.string().optional(), // Will be parsed as boolean
        colorPalette: z.string().optional(),
        inspirationWebsites: z.string().optional(), // Will be parsed from JSON
        preferredFonts: z.string().optional(),
        siteStyle: z.string().optional(),

        // Step 6: Template Selection
        selectedTemplateId: z.string().optional(),
        customTemplateRequest: z.string().optional(),

        // Step 7: Social Media
        hasSocialMedia: z.enum(["yes", "no"]),
        facebookLink: z.string().optional(),
        instagramLink: z.string().optional(),
        linkedinLink: z.string().optional(),
        tiktokLink: z.string().optional(),
        youtubeLink: z.string().optional(),
        otherSocialLinks: z.string().optional(),
        logoDesignService: z.enum(["none", "basic", "premium"]).optional().or(z.literal("")),

        // Step 8: Practical Information
        projectDeadline: z.string().optional(),
        additionalNotes: z.string().optional(),
      });

      try {
        const data = onboardingSchema.parse(req.body);
        const submissionId = `ONBOARD_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const submittedAt = new Date().toLocaleString();

        // Get accountEmail from authenticated user session instead of trusting client data
        const accountEmail = req.user.email;

        // Parse JSON fields and boolean fields
        let wantedPages: string[] = [];
        try {
          wantedPages = data.wantedPages ? JSON.parse(data.wantedPages) : [];
        } catch (e) {
          wantedPages = [];
        }

        let inspirationWebsites: string[] = [];
        try {
          inspirationWebsites = data.inspirationWebsites ? JSON.parse(data.inspirationWebsites) : [];
        } catch (e) {
          inspirationWebsites = [];
        }

        const notSurePages = data.notSurePages === 'true';
        const createTextLogo = data.createTextLogo === 'true';
        
        const projectName = data.businessName;

        // If websiteProgressId is provided, use the existing entry
        let websiteProgressEntry;
        let domain: string;

        if (data.websiteProgressId) {
          const websiteProgressId = parseInt(data.websiteProgressId);
          const existingEntry = await db
            .select()
            .from(websiteProgress)
            .where(eq(websiteProgress.id, websiteProgressId))
            .then((rows) => rows[0]);

          if (!existingEntry) {
            throw new Error('Website progress entry not found');
          }

          // Verify the entry belongs to the authenticated user
          if (req.isAuthenticated() && existingEntry.userId !== req.user.id) {
            throw new Error('Website progress entry does not belong to user');
          }

          websiteProgressEntry = existingEntry;
          // Extract domain from the entry (remove .pending-onboarding if present)
          domain = existingEntry.domain.replace('.pending-onboarding', '');
        } else {
          // Generate unique domain identifier for internal tracking
          // Keep trying until we find a unique identifier
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!isUnique && attempts < maxAttempts) {
            const { generateUniqueIdentifier } = await import('../shared/utils.js');
            domain = generateUniqueIdentifier();
            
            // Check if this identifier is already in use
            const existing = await db
              .select()
              .from(websiteProgress)
              .where(eq(websiteProgress.domain, domain))
              .limit(1);
            
            if (existing.length === 0) {
              isUnique = true;
            }
            attempts++;
          }
          
          if (!isUnique) {
            throw new Error('Failed to generate unique identifier after multiple attempts');
          }
        }

        // Determine which user to associate the website with
        let websiteUserId;
        let isNewUser = false;

        if (req.isAuthenticated()) {
          // If user is already logged in, use their account for the website
          websiteUserId = req.user.id;
          console.log('Using logged-in user for website:', { userId: websiteUserId });
        } else {
          // If not logged in, find or create user account
          let user;
          try {
            user = await storage.getUserByEmail(data.contactEmail);
            if (!user) {
              // User doesn't exist, create a new one
              isNewUser = true;
              const hashedPassword = await hashPassword('temporary123'); // Temporary password, user will need to reset
              user = await storage.createUser({
                username: data.contactName.toLowerCase().replace(/\s+/g, ''),
                email: data.contactEmail,
                password: hashedPassword,
                phone: data.contactPhone,
                language: 'en',
              });

              // Auto-login newly created users
              await new Promise<void>((resolve, reject) => {
                req.login(user, (err) => {
                  if (err) {
                    console.error('Login error after onboarding form submission:', err);
                    reject(err);
                  } else {
                    console.log('User logged in successfully after onboarding submission');
                    resolve();
                  }
                });
              });
            }
          } catch (error) {
            console.error('Error finding user, creating new one:', error);
            // User doesn't exist, create a new one
            isNewUser = true;
            const hashedPassword = await hashPassword('temporary123'); // Temporary password, user will need to reset
            user = await storage.createUser({
              username: data.contactName.toLowerCase().replace(/\s+/g, ''),
              email: data.contactEmail,
              password: hashedPassword,
              phone: data.contactPhone,
              language: 'en',
            });

            // Auto-login newly created users
            await new Promise<void>((resolve, reject) => {
              req.login(user, (err) => {
                if (err) {
                  console.error('Login error after onboarding form submission:', err);
                  reject(err);
                } else {
                  console.log('User logged in successfully after onboarding submission');
                  resolve();
                }
              });
            });
          }

          // Ensure user was created/found successfully
          if (!user || !user.id) {
            console.error('User creation/retrieval failed:', { user });
            throw new Error('Failed to create or find user account');
          }

          websiteUserId = user.id;
          console.log('User found/created successfully:', { userId: user.id, email: user.email });
        }

        // If websiteProgressEntry was already set from websiteProgressId, update it
        // Otherwise, find or create the website progress entry
        if (!websiteProgressEntry) {
          // Find the pending website progress entry that was created with the subscription
          // Look for entries with ".pending-onboarding" in the domain
          const pendingWebsiteProgress = await db
            .select()
            .from(websiteProgress)
            .where(
              and(
                eq(websiteProgress.userId, websiteUserId),
                like(websiteProgress.domain, '%.pending-onboarding')
              )
            )
            .orderBy(desc(websiteProgress.createdAt))
            .limit(1);

          if (pendingWebsiteProgress.length > 0) {
            // Update the existing pending website progress with real domain and project name
            const updatedProgressResult = await db
              .update(websiteProgress)
              .set({ 
                domain: domain,
                projectName: projectName,
                websiteLanguage: data.websiteLanguage || 'en',
                currentStage: 1, // Move from stage 0 (pending) to stage 1
                updatedAt: new Date()
              })
              .where(eq(websiteProgress.id, pendingWebsiteProgress[0].id))
              .returning();

            websiteProgressEntry = updatedProgressResult[0];
            console.log('✅ Updated pending website progress with real data:', { 
              websiteProgressId: websiteProgressEntry.id,
              oldDomain: pendingWebsiteProgress[0].domain,
              newDomain: domain,
              projectName: projectName
            });
          } else {
            // Fallback: Create new website progress entry (for edge cases or old users)
            const websiteProgressResult = await db.insert(websiteProgress).values({
              userId: websiteUserId,
              domain: domain,
              projectName: projectName,
              websiteLanguage: data.websiteLanguage || 'en',
              currentStage: 1,
            }).returning();

            websiteProgressEntry = websiteProgressResult[0];
            console.log('⚠️  No pending website found, created new website progress:', { 
              websiteProgressId: websiteProgressEntry.id, 
              projectName: projectName 
            });
            
            // Create system tags for the new website
            await storage.createSystemTagsForWebsite(websiteProgressEntry.id);
            console.log('✅ Created system tags for website:', websiteProgressEntry.id);
            
            // If we created a new entry, we need to link any unlinked subscriptions
            try {
              const userId = Number(websiteUserId);
              if (!isNaN(userId)) {
                const linkedSubscriptions = await db
                  .update(subscriptionsTable)
                  .set({ websiteProgressId: websiteProgressEntry.id })
                  .where(
                    and(
                      eq(subscriptionsTable.userId, userId),
                      eq(subscriptionsTable.productType, 'plan'),
                      eq(subscriptionsTable.status, 'active'),
                      isNull(subscriptionsTable.websiteProgressId)
                    )
                  )
                  .returning();

                if (linkedSubscriptions.length > 0) {
                  console.log(`✅ Linked ${linkedSubscriptions.length} active subscription(s) to new website ${websiteProgressEntry.id}`);
                }
              }
            } catch (linkError) {
              console.error('Error linking subscriptions to new website:', linkError);
            }
          }
        } else {
          // Update the existing website progress entry with form data
          const updatedProgressResult = await db
            .update(websiteProgress)
            .set({ 
              domain: domain, // Remove .pending-onboarding suffix if present
              projectName: projectName,
              websiteLanguage: data.websiteLanguage || 'en',
              currentStage: 1, // Move from stage 0 (pending) to stage 1
              updatedAt: new Date()
            })
            .where(eq(websiteProgress.id, websiteProgressEntry.id))
            .returning();

          websiteProgressEntry = updatedProgressResult[0];
          console.log('✅ Updated existing website progress with form data:', { 
            websiteProgressId: websiteProgressEntry.id,
            domain: domain,
            projectName: projectName
          });
        }

        // Ensure website progress was created/updated successfully
        if (!websiteProgressEntry || !websiteProgressEntry.id) {
          console.error('Website progress creation/update failed:', { websiteProgressEntry });
          throw new Error('Failed to create or update website progress entry');
        }

        // Define predefined stages for onboarding form projects
        const defaultStages = [
          {
            title: "Welcome & Project Setup",
            description: "Welcome to hayc! We're setting up your website project and preparing everything based on your onboarding form."
          },
          {
            title: "Content Review & Organization",
            description: "We're reviewing the information, text, and materials you provided to structure your website effectively."
          },
          {
            title: "Design & Website Creation",
            description: "Our team is building your website’s layout and design according to your preferences and chosen template."
          },
          {
            title: "Content & Media Integration",
            description: "We're adding your business content, photos, and other media to bring your website to life."
          },
          {
            title: "Connections & Integrations",
            description: "We’re connecting your website with essential tools — domain, email, analytics, social media, newsletter, and other integrations."
          },
          {
            title: "Responsive Optimization & Final Checks",
            description: "We ensure your website looks and works perfectly on all devices (mobile, tablet, and desktop) and perform the final quality review."
          },
          {
            title: "Website Launch",
            description: "Your website is now live! We activate ongoing support and monthly updates to keep everything running smoothly."
          }
        ];

        // Create stages for the website progress
        for (let i = 0; i < defaultStages.length; i++) {
          await db.insert(websiteStages).values({
            websiteProgressId: websiteProgressEntry.id,
            stageNumber: i + 1,
            title: defaultStages[i].title,
            description: defaultStages[i].description,
            status: i === 0 ? 'in-progress' : 'pending',
          });
        }

        // Check if any existing record exists for this websiteProgressId (draft or completed)
        // We'll update it to completed status on final submission
        const existingRecord = await db
          .select()
          .from(onboardingFormResponses)
          .where(eq(onboardingFormResponses.websiteProgressId, websiteProgressEntry.id))
          .orderBy(desc(onboardingFormResponses.id))
          .limit(1)
          .then((rows) => rows[0]);

        const formResponseData = {
          websiteProgressId: websiteProgressEntry.id,

          // Step 1: Business Information
          businessName: data.businessName,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          accountEmail: accountEmail, // Use server-derived accountEmail from authenticated session
          contactEmail: data.contactEmail,
          businessDescription: data.businessDescription,
          websiteLanguage: data.websiteLanguage || 'en',

          // Step 2: Domain
          hasDomain: data.hasDomain,
          existingDomain: data.existingDomain,
          domainAccess: data.domainAccess,
          domainConnectionPreference: data.domainConnectionPreference,
          domainPurchasePreference: data.domainPurchasePreference,
          preferredDomains: data.preferredDomains,

          // Step 3: Professional Emails
          hasEmails: data.hasEmails,
          emailProvider: data.emailProvider,
          emailAccess: data.emailAccess,
          existingEmails: data.existingEmails,
          emailCount: data.emailCount,
          emailNames: data.emailNames,
          emailRedirect: data.emailRedirect,
          redirectInboxAddress: data.redirectInboxAddress,

          // Step 4: Website Foundation
          hasWebsite: data.hasWebsite,
          websiteLink: data.websiteLink,
          websiteChanges: data.websiteChanges,
          wantedPages: wantedPages,
          notSurePages: notSurePages,
          hasTextContent: data.hasTextContent,
          hasMediaContent: data.hasMediaContent,

          // Step 5: Design Preferences
          businessLogoUrl: data.businessLogoUrl,
          businessLogoName: data.businessLogoName,
          businessLogoPublicId: data.businessLogoPublicId,
          createTextLogo: createTextLogo,
          colorPalette: data.colorPalette,
          inspirationWebsites: inspirationWebsites,
          preferredFonts: data.preferredFonts,
          siteStyle: data.siteStyle,

          // Step 6: Template Selection
          selectedTemplateId: data.selectedTemplateId ? parseInt(data.selectedTemplateId) : null,
          customTemplateRequest: data.customTemplateRequest,

          // Step 7: Social Media
          hasSocialMedia: data.hasSocialMedia,
          facebookLink: data.facebookLink,
          instagramLink: data.instagramLink,
          linkedinLink: data.linkedinLink,
          tiktokLink: data.tiktokLink,
          youtubeLink: data.youtubeLink,
          otherSocialLinks: data.otherSocialLinks,
          logoDesignService: data.logoDesignService,

          // Step 8: Practical Information
          projectDeadline: data.projectDeadline,
          additionalNotes: data.additionalNotes,

          submissionId: submissionId,
          status: 'completed', // Set status to completed on final submission
        };

        if (existingRecord) {
          // Update existing record (draft or completed) to completed status
          const updateResult = await db
            .update(onboardingFormResponses)
            .set({
              ...formResponseData,
              status: 'completed', // Explicitly set status to completed on final submission
            })
            .where(eq(onboardingFormResponses.id, existingRecord.id))
            .returning();
        } else {
          // Create new completed record
          const insertResult = await db.insert(onboardingFormResponses).values({
            ...formResponseData,
            status: 'completed', // Explicitly set status to completed on final submission
          }).returning();
        }

        // Link subscription to website progress if subscriptionId is provided
        if (data.subscriptionId) {
          const subscriptionIdNum = parseInt(data.subscriptionId);
          try {
            // Verify subscription exists and belongs to user
            const subscription = await db
              .select()
              .from(subscriptionsTable)
              .where(
                and(
                  eq(subscriptionsTable.id, subscriptionIdNum),
                  eq(subscriptionsTable.userId, websiteProgressEntry.userId)
                )
              )
              .then((rows) => rows[0]);

            if (subscription) {
              // Link the subscription to the website progress entry
              await db
                .update(subscriptionsTable)
                .set({ websiteProgressId: websiteProgressEntry.id })
                .where(eq(subscriptionsTable.id, subscriptionIdNum));
              console.log('[ONBOARDING SUBMISSION] Linked subscription to website:', {
                subscriptionId: subscriptionIdNum,
                websiteProgressId: websiteProgressEntry.id
              });
            } else {
              console.warn('[ONBOARDING SUBMISSION] Subscription not found or does not belong to user:', subscriptionIdNum);
            }
          } catch (linkError) {
            console.error('[ONBOARDING SUBMISSION] Error linking subscription:', linkError);
            // Don't fail the request if subscription linking fails
          }
        } else {
          // If no subscriptionId provided, try to link any unlinked active subscriptions for this user
          try {
            const linkedSubscriptions = await db
              .update(subscriptionsTable)
              .set({ websiteProgressId: websiteProgressEntry.id })
              .where(
                and(
                  eq(subscriptionsTable.userId, websiteProgressEntry.userId),
                  eq(subscriptionsTable.productType, 'plan'),
                  eq(subscriptionsTable.status, 'active'),
                  isNull(subscriptionsTable.websiteProgressId)
                )
              )
              .returning();

            if (linkedSubscriptions.length > 0) {
              console.log(`[ONBOARDING SUBMISSION] Auto-linked ${linkedSubscriptions.length} active subscription(s) to website ${websiteProgressEntry.id}`);
            }
          } catch (autoLinkError) {
            console.error('[ONBOARDING SUBMISSION] Error auto-linking subscriptions:', autoLinkError);
            // Don't fail the request if auto-linking fails
          }
        }

        // Send response immediately to prevent frontend hanging
        res.json({
          success: true,
          submissionId: submissionId,
          websiteProgressId: websiteProgressEntry.id,
          domain: domain,
          message: "Website project created successfully",
        });

        // Send emails asynchronously after response (fire-and-forget)
        setImmediate(async () => {
          // Get user's preferred language
          const preferredLanguage = getPreferredLanguage(req);

          // Load and send user confirmation email
          try {
            const userEmailHtml = loadTemplate(
              "onboarding-form-confirmation.html",
              {
                contactName: data.contactName,
                businessName: data.businessName,
                email: data.contactEmail,
                domain: domain,
                submissionId: submissionId,
                submittedAt: submittedAt,
              },
              preferredLanguage,
            );

            await Promise.race([
              transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: data.contactEmail,
                replyTo: "support@hayc.gr",
                subject: "🎉 Your website project has been created - hayc",
                html: userEmailHtml,
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);
            console.log('User confirmation email sent successfully');
          } catch (emailError) {
            console.error('Failed to send user confirmation email:', emailError);
          }

          // Load admin notification email template
          let adminEmailHtml;
          try {
            const dashboardUrl = `${process.env.VITE_APP_URL || 'https://hayc.gr'}/admin`;
            adminEmailHtml = loadTemplate(
              "admin-onboarding-form-notification.html",
              {
                fullName: data.contactName,
                businessName: data.businessName,
                email: data.contactEmail,
                submittedAt: submittedAt,
                dashboardUrl: dashboardUrl,
              },
              "en",
            );
          } catch (templateError) {
            console.error('Failed to load admin email template:', templateError);
            return; // Skip admin email if template fails
          }

          // Send notification email to admin
          try {
            await Promise.race([
              transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: "development@hayc.gr",
                subject: `🚀 New Website Project Created - ${data.businessName}`,
                html: adminEmailHtml,
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
            ]);
            console.log('Admin notification email sent successfully');
          } catch (emailError) {
            console.error('Failed to send admin notification email:', emailError);
          }
        });
      } catch (err) {
        console.error("Onboarding form error:", err);
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Invalid form data", details: err.errors });
        }
        res.status(500).json({ error: "Failed to create website project" });
      }
    },
  );

  // Add contact form endpoint
  app.post("/api/contact", async (req, res) => {
    const utmSchema = z.object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
      fbclid: z.string().optional(),
      gclid: z.string().optional(),
    }).optional();

    const contactSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      subject: z.string().min(5),
      message: z.string().min(10),
      language: z.string().optional(),
      "cf-turnstile-response": z.string().min(1),
      utm: utmSchema,
    });

    try {
      const data = contactSchema.parse(req.body);

      // Verify Turnstile token with Cloudflare
      const turnstileToken = data["cf-turnstile-response"];
      const secretKey = process.env.TURNSTILE_SECRET_KEY;
      
      if (!secretKey) {
        console.error("TURNSTILE_SECRET_KEY not configured");
        return res.status(500).json({ error: "Server configuration error" });
      }

      // Get client IP
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      // Verify with Cloudflare
      const verificationResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: secretKey,
            response: turnstileToken,
            remoteip: clientIp,
          }),
        }
      );

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success) {
        console.error('Turnstile verification failed:', verificationResult['error-codes']);
        return res.status(403).json({ 
          error: 'Security verification failed. Please try again.',
          errorCodes: verificationResult['error-codes']
        });
      }

      // Remove the turnstile response and utm from data after successful verification
      const { "cf-turnstile-response": _, utm: utmData, ...contactData } = data;

      // Use provided language or detect from Accept-Language header
      const preferredLanguage = contactData.language || getPreferredLanguage(req);

      // If user is logged in, update their language preference
      if (req.isAuthenticated()) {
        await storage.updateUser(req.user.id, { language: preferredLanguage });
      }

      // Load the HTML email template and replace values
      const emailHtml = loadTemplate(
        "contact-form-email.html",
        {
          name: contactData.name,
          email: contactData.email,
          subject: contactData.subject,
          message: contactData.message.replace(/\n/g, "<br>"),
        },
        preferredLanguage,
      );

      // Send email to the user
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: contactData.email,
        replyTo: "support@hayc.gr",
        subject: `Contact Form: ${contactData.subject}`,
        html: emailHtml,
      });

      // Send the email to us
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "info@hayc.gr",
        subject: `New Contact Form Submission: ${contactData.subject}`,
        text: `
      A new contact form submission was received.

      Name: ${contactData.name}
      Email: ${contactData.email}
      Subject: ${contactData.subject}

      Message:
      ${contactData.message}
        `,
        html: `
          <div style="font-family: Arial, sans-serif; background:#f8f9fa; padding:20px;">
            <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:25px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

              <h2 style="margin-top:0; color:#333;">📩 New Contact Form Submission</h2>
              <p style="color:#555; margin-bottom:20px;">
                Someone just submitted a new message through your website.
              </p>

              <table style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="font-weight:bold; padding:8px 0; width:120px;">Name:</td>
                  <td style="padding:8px 0; color:#333;">${contactData.name}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; padding:8px 0;">Email:</td>
                  <td style="padding:8px 0;"><a href="mailto:${contactData.email}" style="color:#007bff;">${contactData.email}</a></td>
                </tr>
                <tr>
                  <td style="font-weight:bold; padding:8px 0;">Subject:</td>
                  <td style="padding:8px 0; color:#333;">${contactData.subject}</td>
                </tr>
              </table>

              <div style="margin-top:25px;">
                <h3 style="color:#333; margin-bottom:10px;">📝 Message</h3>
                <div style="white-space:pre-wrap; padding:15px; background:#f2f4f7; border-radius:8px; color:#333;">
                  ${contactData.message}
                </div>
              </div>

              <p style="margin-top:35px; color:#999; font-size:12px; text-align:center;">
                This email was automatically generated by hayc.gr
              </p>
            </div>
          </div>
        `
      });

      // Submit to HubSpot with UTM data (non-blocking)
      let hubspotSuccess = false;
      try {
        await submitContactToHubSpot({
          email: contactData.email,
          firstname: contactData.name.split(' ')[0] || contactData.name,
          lastname: contactData.name.split(' ').slice(1).join(' ') || '',
          subject: contactData.subject,
          message: contactData.message,
          utm: utmData,
        });
        hubspotSuccess = true;
        console.log("✅ Contact form submitted to HubSpot successfully");
      } catch (hubspotError) {
        console.error("❌ HubSpot contact form submission failed:", hubspotError);
      }

      res.json({ success: true, hubspotSuccess });
    } catch (err) {
      console.error("Contact form error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid form data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Cancellation feedback endpoint
  app.post("/api/cancellation-feedback", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const feedbackSchema = z.object({
      reason: z.string().min(1),
      details: z.string().optional(),
    });

    try {
      const data = feedbackSchema.parse(req.body);
      const user = await storage.getUserById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Map reason codes to readable text
      const reasonMap: Record<string, { en: string; gr: string }> = {
        reason1: { en: "Too expensive for my budget", gr: "Πολύ ακριβό για τον προϋπολογισμό μου" },
        reason2: { en: "Not using the service enough", gr: "Δεν χρησιμοποιώ την υπηρεσία αρκετά" },
        reason3: { en: "Found a better alternative", gr: "Βρήκα μια καλύτερη εναλλακτική" },
        reason4: { en: "Technical issues or bugs", gr: "Τεχνικά προβλήματα ή σφάλματα" },
        reason5: { en: "Service didn't meet my expectations", gr: "Η υπηρεσία δεν πληρούσε τις προσδοκίες μου" },
        reason6: { en: "Switching to a different solution", gr: "Μεταβαίνω σε διαφορετική λύση" },
        reason7: { en: "Other reason", gr: "Άλλος λόγος" },
      };

      const reasonText = reasonMap[data.reason]?.en || data.reason;
      const userLanguage = user.language || "en";

      // Send email to support with feedback
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "support@hayc.gr",
        subject: `🔔 Subscription Cancellation Feedback - ${user.username}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Subscription Cancellation Feedback</h2>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">User Information</h3>
              <p><strong>Name:</strong> ${user.username}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>User ID:</strong> ${user.id}</p>
              <p><strong>Language:</strong> ${userLanguage === 'gr' ? 'Greek' : 'English'}</p>
            </div>

            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="margin-top: 0; color: #856404;">Cancellation Reason</h3>
              <p style="font-size: 16px; color: #856404;"><strong>${reasonText}</strong></p>
              ${data.details ? `
                <div style="margin-top: 15px;">
                  <h4 style="color: #856404;">Additional Details:</h4>
                  <p style="color: #856404;">${data.details}</p>
                </div>
              ` : ''}
            </div>

            <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #0066cc;">
                <strong>Action Required:</strong> Review this feedback and consider follow-up actions to improve the service.
              </p>
            </div>

            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              This is an automated notification from the hayc cancellation feedback system.
            </p>
          </div>
        `,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Cancellation feedback error:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid feedback data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Add new endpoint for admin subscriptions
  app.get("/api/admin/subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      // Check if the user has permission to view subscriptions
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewSubscriptions')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Fetch subscriptions with user data (active and trialing subscriptions)
      const activeSubscriptions = await db
        .select({
          id: subscriptionsTable.id,
          userId: subscriptionsTable.userId,
          tier: subscriptionsTable.tier,
          status: subscriptionsTable.status,
          price: subscriptionsTable.price,
          vatNumber: subscriptionsTable.vatNumber,
          invoiceType: subscriptionsTable.invoiceType,
          pdfUrl: subscriptionsTable.pdfUrl,
          createdAt: subscriptionsTable.createdAt,
          cancellationReason: subscriptionsTable.cancellationReason,
          billingPeriod: subscriptionsTable.billingPeriod,
          username: users.username,
          email: users.email,
          stripeCustomerId: users.stripeCustomerId,
        })
        .from(subscriptionsTable)
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .where(
          or(
            eq(subscriptionsTable.status, "active"),
            eq(subscriptionsTable.status, "trialing")
          )
        )
        .orderBy(desc(subscriptionsTable.createdAt));

      // Fetch transactions and get upcoming invoice for each subscription
      const subscriptionsWithTransactions = await Promise.all(
        activeSubscriptions.map(async (subscription) => {
          const transactions = await storage.getSubscriptionTransactions(
            subscription.id,
          );

          // Get next billing date from Stripe's upcoming invoice if customer has Stripe ID
          let nextBillingDate = null;
          if (subscription.stripeCustomerId) {
            try {
              // Get all active Stripe subscriptions for this customer
              const stripeSubscriptions = await stripe.subscriptions.list({
                customer: subscription.stripeCustomerId,
                status: "active",
                expand: ["data.items", "data.items.data.price"],
              });

              // Find the best matching Stripe subscription by creation time
              let matchingStripeSubscription = null;
              let smallestTimeDiff = Infinity;
              const localCreatedAt = new Date(subscription.createdAt);

              for (const stripeSub of stripeSubscriptions.data) {
                const stripeCreatedAt = new Date(stripeSub.created * 1000);
                const timeDiff = Math.abs(localCreatedAt.getTime() - stripeCreatedAt.getTime());

                // Find the Stripe subscription with creation time closest to our local subscription
                if (timeDiff < smallestTimeDiff) {
                  smallestTimeDiff = timeDiff;
                  matchingStripeSubscription = stripeSub;
                }
              }

              // Get the upcoming invoice for the matching subscription
              if (matchingStripeSubscription) {
                try {
                  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                    customer: subscription.stripeCustomerId,
                    subscription: matchingStripeSubscription.id,
                  });

                  if (upcomingInvoice && upcomingInvoice.period_end) {
                    nextBillingDate = new Date(upcomingInvoice.period_end * 1000);
                  }
                } catch (invoiceError) {
                  console.error(`Error fetching upcoming invoice for subscription ${matchingStripeSubscription.id}:`, invoiceError);
                }
              }
            } catch (error) {
              console.error(`Error fetching subscriptions for customer ${subscription.stripeCustomerId}:`, error);
            }
          }

          return { 
            ...subscription, 
            transactions,
            nextBillingDate: nextBillingDate ? nextBillingDate.toISOString() : null
          };
        }),
      );

      res.json({ subscriptions: subscriptionsWithTransactions });
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Get payment history for calendar (includes both past and future payments)
  app.get("/api/admin/payment-history", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewSubscriptions')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) - 1 : new Date().getMonth();

      const payments = [];

      // Fetch historical paid invoices from database (fast!)
      const historicalTransactions = await db
        .select({
          transactionId: transactionsTable.id,
          amount: transactionsTable.amount,
          currency: transactionsTable.currency,
          status: transactionsTable.status,
          pdfUrl: transactionsTable.pdfUrl,
          createdAt: transactionsTable.createdAt,
          tier: subscriptionsTable.tier,
          username: users.username,
          email: users.email,
        })
        .from(transactionsTable)
        .leftJoin(subscriptionsTable, eq(transactionsTable.subscriptionId, subscriptionsTable.id))
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .where(eq(transactionsTable.status, 'paid'));

      // Add historical transactions to payments array
      for (const transaction of historicalTransactions) {
        payments.push({
          id: `transaction_${transaction.transactionId}`,
          type: 'stripe_invoice',
          clientName: transaction.username || transaction.email || 'Unknown',
          email: transaction.email || '',
          amount: transaction.amount / 100,
          date: transaction.createdAt || new Date(),
          status: 'paid',
          tier: transaction.tier,
          invoiceUrl: transaction.pdfUrl,
        });
      }

      // Get all active and trialing subscriptions for upcoming invoices
      const activeSubscriptions = await db
        .select({
          id: subscriptionsTable.id,
          userId: subscriptionsTable.userId,
          tier: subscriptionsTable.tier,
          status: subscriptionsTable.status,
          price: subscriptionsTable.price,
          billingPeriod: subscriptionsTable.billingPeriod,
          stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
          username: users.username,
          email: users.email,
          stripeCustomerId: users.stripeCustomerId,
          createdAt: subscriptionsTable.createdAt,
        })
        .from(subscriptionsTable)
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .where(
          or(
            eq(subscriptionsTable.status, "active"),
            eq(subscriptionsTable.status, "trialing")
          )
        );

      // Fetch upcoming invoices from Stripe (only for active subscriptions)
      const upcomingInvoicePromises = activeSubscriptions
        .filter(sub => sub.stripeSubscriptionId && sub.stripeCustomerId)
        .map(async (subscription) => {
          try {
            const subscriptionId = subscription.stripeSubscriptionId!;
            
            // Handle scheduled subscriptions differently
            if (subscriptionId.startsWith('sub_sched_')) {
              // Retrieve the schedule to get phase data
              const schedule = await stripe.subscriptionSchedules.retrieve(subscriptionId);
              
              // Get the first phase (scheduled subscription details)
              const targetPhase = schedule.phases[0];
              if (!targetPhase || !targetPhase.items?.length) {
                return null;
              }
              
              // Extract price and start date from phase
              const priceData = targetPhase.items[0].price;
              let amount = 0;
              
              if (typeof priceData === 'object' && priceData !== null && 'unit_amount' in priceData) {
                amount = priceData.unit_amount || 0;
              } else {
                // Fetch price if not expanded
                try {
                  const fetchedPrice = await stripe.prices.retrieve(priceData as string);
                  amount = fetchedPrice.unit_amount || 0;
                } catch (priceError) {
                  console.error(`Failed to fetch price for schedule ${subscriptionId}:`, priceError);
                  return null;
                }
              }
              
              return {
                id: `scheduled_${subscriptionId}`,
                type: 'stripe_scheduled',
                clientName: subscription.username || subscription.email,
                email: subscription.email,
                amount: amount / 100,
                date: new Date(targetPhase.start_date * 1000),
                status: 'scheduled',
                tier: subscription.tier,
              };
            }
            
            // Normal subscription - fetch upcoming invoice
            const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
              customer: subscription.stripeCustomerId!,
              subscription: subscriptionId,
            });

            if (upcomingInvoice && upcomingInvoice.amount_due > 0) {
              return {
                id: `upcoming_${subscriptionId}`,
                type: 'stripe_upcoming',
                clientName: subscription.username || subscription.email,
                email: subscription.email,
                amount: upcomingInvoice.amount_due / 100,
                date: new Date(upcomingInvoice.period_end * 1000),
                status: 'upcoming',
                tier: subscription.tier,
              };
            }
          } catch (upcomingError) {
            console.error(`Error fetching upcoming invoice for ${subscription.stripeSubscriptionId}:`, upcomingError);
          }
          return null;
        });

      const upcomingInvoices = (await Promise.all(upcomingInvoicePromises)).filter(Boolean);
      payments.push(...upcomingInvoices);

      // Sort payments by date
      payments.sort((a, b) => a.date.getTime() - b.date.getTime());

      res.json({ payments });
    } catch (err) {
      console.error("Error fetching payment history:", err);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // Sync invoices from Stripe to database
  app.post("/api/admin/sync-invoices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewSubscriptions')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { mode } = req.body; // 'all' or 'last_2_months'
      
      if (!mode || !['all', 'last_2_months'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'all' or 'last_2_months'" });
      }

      // Calculate date range based on mode
      let startDate: number | undefined;
      if (mode === 'last_2_months') {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        startDate = Math.floor(twoMonthsAgo.getTime() / 1000);
      }

      // Get all subscriptions with Stripe customer IDs
      const allSubscriptions = await db
        .select({
          id: subscriptionsTable.id,
          stripeCustomerId: users.stripeCustomerId,
        })
        .from(subscriptionsTable)
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .where(sql`${users.stripeCustomerId} IS NOT NULL`);

      let syncedCount = 0;
      let skippedCount = 0;
      const processedCustomers = new Set();

      // Process each unique customer
      for (const subscription of allSubscriptions) {
        if (!subscription.stripeCustomerId || processedCustomers.has(subscription.stripeCustomerId)) {
          continue;
        }
        processedCustomers.add(subscription.stripeCustomerId);

        try {
          // Fetch invoices from Stripe
          const invoices = await stripe.invoices.list({
            customer: subscription.stripeCustomerId,
            status: 'paid',
            limit: 100,
            created: startDate ? { gte: startDate } : undefined,
          });

          for (const invoice of invoices.data) {
            if (invoice.paid && invoice.amount_paid > 0 && invoice.subscription) {
              // Find the subscription in our database first
              const dbSubscription = await db
                .select()
                .from(subscriptionsTable)
                .where(eq(subscriptionsTable.stripeSubscriptionId, invoice.subscription as string))
                .limit(1);

              if (dbSubscription.length > 0) {
                // Check if transaction already exists using BOTH methods:
                // 1. By Stripe invoice ID (for new transactions)
                // 2. By subscriptionId + amount + status (for old transactions without stripeInvoiceId)
                const existingByInvoiceId = await db
                  .select()
                  .from(transactionsTable)
                  .where(eq(transactionsTable.stripeInvoiceId, invoice.id))
                  .limit(1);

                const existingByAmount = await db
                  .select()
                  .from(transactionsTable)
                  .where(
                    and(
                      eq(transactionsTable.subscriptionId, dbSubscription[0].id),
                      eq(transactionsTable.amount, invoice.amount_paid),
                      eq(transactionsTable.status, 'paid'),
                      // Only check by amount if stripeInvoiceId is null (old records)
                      sql`${transactionsTable.stripeInvoiceId} IS NULL`
                    )
                  )
                  .limit(1);

                if (existingByInvoiceId.length === 0 && existingByAmount.length === 0) {
                  // Create new transaction with Stripe invoice ID and paid_at timestamp
                  // Note: pdfUrl is set to null - admin will upload custom invoice from Cloudinary
                  const paidAt = invoice.status_transitions?.paid_at 
                    ? new Date(invoice.status_transitions.paid_at * 1000)
                    : new Date(invoice.created * 1000);
                  
                  await storage.createTransaction({
                    subscriptionId: dbSubscription[0].id,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    status: 'paid',
                    pdfUrl: null,
                    stripeInvoiceId: invoice.id,
                    paidAt: paidAt,
                    createdAt: paidAt, // Use the actual payment date as createdAt
                  });
                  syncedCount++;
                } else {
                  skippedCount++;
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error syncing invoices for customer ${subscription.stripeCustomerId}:`, error);
        }
      }

      res.json({ 
        success: true, 
        synced: syncedCount, 
        skipped: skippedCount,
        message: `Successfully synced ${syncedCount} invoices (${skippedCount} already existed)` 
      });
    } catch (err) {
      console.error("Error syncing invoices:", err);
      res.status(500).json({ error: "Failed to sync invoices" });
    }
  });

  // Cleanup duplicate transactions
  app.post("/api/admin/cleanup-duplicate-transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageSubscriptions')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      console.log('🧹 Starting duplicate transaction cleanup...');

      // Find all transactions grouped by subscriptionId, amount, and status
      // We'll identify duplicates as transactions with the same values but NULL stripeInvoiceId
      const allTransactions = await db
        .select()
        .from(transactionsTable)
        .orderBy(transactionsTable.id);

      // Group transactions by subscriptionId + amount + status
      const groups = new Map<string, typeof allTransactions>();
      
      for (const transaction of allTransactions) {
        const key = `${transaction.subscriptionId}_${transaction.amount}_${transaction.status}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(transaction);
      }

      let deletedCount = 0;
      let groupsProcessed = 0;

      // Process each group to find duplicates
      for (const [key, transactions] of groups.entries()) {
        // Only process groups with more than one transaction
        if (transactions.length > 1) {
          // Separate transactions with stripeInvoiceId from those without
          const withInvoiceId = transactions.filter(t => t.stripeInvoiceId !== null);
          const withoutInvoiceId = transactions.filter(t => t.stripeInvoiceId === null);

          // If we have duplicates without stripeInvoiceId, keep only the oldest one (by id)
          if (withoutInvoiceId.length > 1) {
            // Sort by id to keep the oldest
            withoutInvoiceId.sort((a, b) => a.id - b.id);
            const toKeep = withoutInvoiceId[0];
            const toDelete = withoutInvoiceId.slice(1);

            console.log(`📋 Group ${key}: Found ${withoutInvoiceId.length} duplicates without invoice ID, keeping transaction ${toKeep.id}, deleting ${toDelete.length}`);

            // Delete the duplicates
            for (const transaction of toDelete) {
              await db
                .delete(transactionsTable)
                .where(eq(transactionsTable.id, transaction.id));
              deletedCount++;
            }
            groupsProcessed++;
          }
        }
      }

      console.log(`✅ Cleanup complete: Deleted ${deletedCount} duplicate transactions from ${groupsProcessed} groups`);

      res.json({ 
        success: true, 
        deleted: deletedCount,
        groupsProcessed: groupsProcessed,
        message: `Successfully deleted ${deletedCount} duplicate transactions` 
      });
    } catch (err) {
      console.error("Error cleaning up duplicate transactions:", err);
      res.status(500).json({ error: "Failed to cleanup duplicate transactions" });
    }
  });

  // Add new endpoint for all subscriptions (including cancelled)
  app.get("/api/admin/all-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewSubscriptions')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Fetch all subscriptions with user data (including cancelled)
      const allSubscriptions = await db
        .select({
          id: subscriptionsTable.id,
          userId: subscriptionsTable.userId,
          tier: subscriptionsTable.tier,
          status: subscriptionsTable.status,
          price: subscriptionsTable.price,
          vatNumber: subscriptionsTable.vatNumber,
          invoiceType: subscriptionsTable.invoiceType,
          pdfUrl: subscriptionsTable.pdfUrl,
          createdAt: subscriptionsTable.createdAt,
          cancellationReason: subscriptionsTable.cancellationReason,
          username: users.username,
          email: users.email,
        })
        .from(subscriptionsTable)
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .orderBy(desc(subscriptionsTable.createdAt));

      // Fetch transactions foreach subscription
      const subscriptionsWithTransactions = await Promise.all(
        allSubscriptions.map(async (subscription) => {
          const transactions = await storage.getSubscriptionTransactions(
            subscription.id,
          );
          return { ...subscription, transactions };
        }),
      );

      res.json({ subscriptions: subscriptionsWithTransactions });
    } catch (err) {
      console.error("Error fetching all subscriptions:", err);
      res.status(500).json({ error: "Failed to fetch all subscriptions" });
    }
  });

  // Get user's subscriptions with email usage
  app.get("/api/admin/users/:userId/subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewUsers')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const userId = parseInt(req.params.userId);
      
      // Get user info
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Fetch user's subscriptions
      const userSubscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId))
        .orderBy(desc(subscriptionsTable.createdAt));

      // Add email usage data to each subscription
      const subscriptionsWithUsage = await Promise.all(
        userSubscriptions.map(async (sub) => {
          const emailLimit = await getEmailLimitWithAddOns(sub.tier, sub.websiteProgressId);
          const emailUsage = {
            limit: emailLimit,
            used: sub.emailsSentThisMonth || 0,
            remaining: Math.max(0, emailLimit - (sub.emailsSentThisMonth || 0)),
            resetDate: sub.emailLimitResetDate
          };
          
          return {
            ...sub,
            emailUsage
          };
        })
      );

      res.json({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          role: targetUser.role
        },
        subscriptions: subscriptionsWithUsage
      });
    } catch (err) {
      console.error("Error fetching user subscriptions:", err);
      res.status(500).json({ error: "Failed to fetch user subscriptions" });
    }
  });

  // Update the subscription PDF upload endpoint
  app.post("/api/admin/subscriptions/:id/pdf", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscriptionId = parseInt(req.params.id);
      const { pdfUrl } = req.body;

      if (!pdfUrl) {
        return res.status(400).json({ error: "No PDF URL provided" });
      }

      // Update subscription with PDF URL
      const subscription = await storage.updateSubscriptionPdf(
        subscriptionId,
        pdfUrl,
      );

      res.json({ subscription });
    } catch (err) {
      console.error("Error updating subscription PDF:", err);
      res.status(500).json({ error: "Failed to update subscription PDF" });
    }
  });

  // Fire-and-forget email helper - ensures email failures never block critical operations
  async function sendEmailsSafely(
    emailTasks: Array<{
      type: 'subscription' | 'admin';
      emailType?: string;
      data?: any;
      to?: string;
      subject?: string;
      html?: string;
    }>
  ): Promise<void> {
    // Don't await - fire and forget
    setImmediate(async () => {
      const results = await Promise.allSettled(
        emailTasks.map(async (task) => {
          // Wrap each email in a timeout to prevent hanging
          return Promise.race([
            (async () => {
              if (task.type === 'subscription' && task.emailType && task.data) {
                await sendSubscriptionEmail(task.emailType as any, task.data);
              } else if (task.type === 'admin' && task.to && task.subject && task.html) {
                await transporter.sendMail({
                  from: process.env.SMTP_FROM,
                  to: task.to,
                  subject: task.subject,
                  html: task.html,
                });
              }
            })(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Email timeout after 10s')), 10000)
            )
          ]);
        })
      );

      // Log results without throwing errors
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Email ${index + 1} sent successfully`);
        } else {
          console.warn(`⚠️  Email ${index + 1} failed (non-critical):`, result.reason?.message || result.reason);
        }
      });
    });
  }

  // Email sending functions
  async function sendSubscriptionEmail(
    type:
      | "purchased"
      | "cancelled"
      | "refunded"
      | "failed"
      | "card-expiring"
      | "waiting"
      | "stage-update"
      | "registered"
      | "resumed"
      | "upgraded",
    data: any,
  ) {
    let template: string;
    let subject: string;

    // Process add-ons if available
    let templateData = { ...data };
    
    // Format website HTML if domain is provided in the data
    if (templateData.domain) {
      templateData.hasWebsites = true;
      templateData.websitesHtml = formatWebsitesHtml([templateData.domain], templateData.language || "en");
    }
    
    if (
      type === "purchased" &&
      data.addOns &&
      Array.isArray(data.addOns) &&
      data.addOns.length > 0
    ) {
      // Format add-ons data for the template
      templateData.hasAddOns = true;
      templateData.addOnsHtml = "";

      let addOnsTotal = 0;

      data.addOns.forEach((addon: any) => {
        templateData.addOnsHtml += `
          <div class="addon-item">
            <div class="price-row">
              <span>${addon.name}</span>
              <span>${data.currency} ${addon.price.toFixed(2)}</span>
            </div>
          </div>
        `;
        addOnsTotal += addon.price;
      });

      // Calculate total with add-ons and setup fee
      const baseAmount = parseFloat(data.baseAmount);
      const setupFee = parseFloat(data.setupFee || "0");
      templateData.totalAmount = (baseAmount + addOnsTotal + setupFee).toFixed(2);
    }

    switch (type) {
      case "purchased":
        template = loadTemplate(
          "subscription-purchased.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            amount: templateData.totalAmount || templateData.amount,
            baseAmount: templateData.baseAmount || templateData.amount,
            setupFee: templateData.setupFee || "0.00",
            hasSetupFee: templateData.hasSetupFee || false,
            currency: templateData.currency,
            startDate: new Date(templateData.startDate).toLocaleDateString(),
            hasAddOns: templateData.hasAddOns || false,
            addOnsHtml: templateData.addOnsHtml || "",
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Welcome to Your New Subscription!";
        break;

      case "cancelled":
        template = loadTemplate(
          "subscription-cancelled.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            cancellationDate: new Date(
              templateData.cancellationDate,
            ).toLocaleDateString(),
            accessUntil: new Date(
              templateData.accessUntil,
            ).toLocaleDateString(),
            domain: templateData.domain || null,
            projectName: templateData.projectName,
            adminCancellation: templateData.adminCancellation,
            cancellationReason: templateData.cancellationReason,
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Subscription Cancellation Confirmation";
        break;

      case "refunded":
        template = loadTemplate(
          "subscription-refunded.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            amount: templateData.amount,
            currency: templateData.currency,
            refundDate: new Date(templateData.refundDate).toLocaleDateString(),
            transactionId: templateData.transactionId,
            domain: templateData.domain || null,
            projectName: templateData.projectName,
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Subscription Refund Confirmation";
        break;

      case "failed":
        template = loadTemplate(
          "transaction-failed.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            amount: templateData.amount,
            currency: templateData.currency,
            failureDate: new Date(
              templateData.failureDate,
            ).toLocaleDateString(),
            failureReason: templateData.failureReason,
            domain: templateData.domain || null,
            projectName: templateData.projectName,
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc -Transaction Failed Notice";
        break;

      case "card-expiring":
        template = loadTemplate(
          "card-expiring.html",
          {
            username: templateData.username,
            email: templateData.email,
            lastFourDigits: templateData.lastFourDigits,
            expirationDate: templateData.expirationDate,
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Credit Card Expiring Soon";
        break;
      case "waiting":
        template = loadTemplate(
          "stage-waiting-reminder.html",
          {
            username: templateData.username,
            email: templateData.email,
            waitingMessage: templateData.waitingMessage,
          },
          templateData.language,
        );
        subject = "💙 hayc - Your Subscription is Waiting";
        break;
      case "stage-update":
        template = loadTemplate(
          "stage-update.html",
          {
            username: templateData.username,
            email: templateData.email,
            domain: templateData.domain,
            projectName: templateData.projectName,
            stageName: templateData.stageName,
            oldStatus: templateData.oldStatus,
            newStatus: templateData.newStatus,
            waitingInfo: templateData.waitingInfo,
          },
          templateData.language,
        );
        subject = "💙 hayc - Website Progress Update";
        break;
      case "registered":
        template = loadTemplate(
          "user-registered.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            registrationDate: templateData.registrationDate,
          },
          templateData.language,
        );
        subject = "💙 hayc - Welcome to HAYC!";
        break;
      case "resumed":
        template = loadTemplate(
          "subscription-resumed.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            amount: templateData.amount,
            currency: templateData.currency,
            resumeDate: new Date(templateData.resumeDate).toLocaleDateString(),
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Subscription Resumed Successfully!";
        break;
      case "upgraded":
        template = loadTemplate(
          "subscription-upgraded.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            upgradeDate: new Date(
              templateData.upgradeDate,
            ).toLocaleDateString(),
            nextBillingDate: new Date(
              templateData.nextBillingDate,
            ).toLocaleDateString(),
            currency: templateData.currency,
            monthlySavings: templateData.monthlySavings,
            domain: templateData.domain || null,
            hasWebsites: templateData.hasWebsites || false,
            websitesHtml: templateData.websitesHtml || "",
          },
          templateData.language,
        );
        subject = "💙 hayc - Subscription Upgraded to Yearly!";
        break;
      case "user-registered":
        template = loadTemplate(
          "user-registered.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            registrationDate: templateData.registrationDate,
          },
          templateData.language,
        );
        subject = "💙 hayc - Welcome to HAYC!";
        break;
      case "new-tip-notification":
        template = loadTemplate(
          "new-tip-notification.html",
          {
            username: templateData.username,
            email: templateData.email,
            tipTitle: templateData.tipTitle,
            tipPreview: templateData.tipPreview,
            dashboardUrl: templateData.dashboardUrl,
          },
          templateData.language,
        );
        subject = "💡 New Tip Available - hayc";
        break;
      case "review-verified-free-month":
        template = loadTemplate(
          "review-verified-free-month.html",
          {
            username: templateData.username,
            email: templateData.email,
            plan: templateData.plan,
            verificationDate: templateData.verificationDate,
            nextBillingDate: templateData.nextBillingDate,
            isRefund: templateData.isRefund,
          },
          templateData.language,
        );
        subject = "🎉 hayc - Your Reviews Have Been Verified!";
        break;
      case "stage-waiting-reminder":
        template = loadTemplate(
          "stage-waiting-reminder.html",
          {
            username: templateData.username,
            email: templateData.email,
            stageName: templateData.stageName,
            waitingInfo: templateData.waitingInfo,
            domain: templateData.domain,
          },
          templateData.language,
        );
        subject = "🔔 hayc - Action Required: Website Progress Update";
        break;
      case "website-change-recorded":
        template = loadTemplate(
          "website-change-recorded.html",
          {
            username: templateData.username,
            email: templateData.email,
            domain: templateData.domain,
            projectName: templateData.projectName || templateData.domain,
            changeDescription: templateData.changeDescription,
            changesUsed: templateData.changesUsed,
            changesAllowed: templateData.changesAllowed,
            remainingChanges: templateData.remainingChanges,
            recordedDate: templateData.recordedDate,
          },
          templateData.language,
        );
        subject = "🔧 hayc - Website Change Recorded";
        break;
      case "change-request-completed":
        template = loadTemplate(
          "change-request-completed.html",
          {
            username: templateData.username,
            email: templateData.email,
            domain: templateData.domain,
            projectName: templateData.projectName || templateData.domain,
            changeDescription: templateData.changeDescription,
            completedDate: templateData.completedDate,
            changeLogId: templateData.changeLogId,
          },
          templateData.language,
        );
        subject = "✅ hayc - Your Website Change Request Has Been Completed";
        break;
      case "website-progress-created":
        template = loadTemplate(
          "website-progress-created.html",
          {
            username: templateData.username,
            email: templateData.email,
            domain: templateData.domain,
            currentStage: templateData.currentStage,
            createdDate: templateData.createdDate,
          },
          templateData.language,
        );
        subject = "🚀 hayc - Your Website Development Has Started!";
        break;
      case "contact-form-email":
        template = loadTemplate(
          "contact-form-email.html",
          {
            name: templateData.name,
            email: templateData.email,
            subject: templateData.subject,
            message: templateData.message.replace(/\n/g, "<br>"),
          },
          templateData.language,
        );
        subject = `Contact Form: ${templateData.subject}`;
        break;
      case "onboarding-form-confirmation":
        template = loadTemplate(
          "onboarding-form-confirmation.html",
          {
            contactName: templateData.contactName,
            fullName: templateData.fullName,
            businessName: templateData.businessName,
            email: templateData.email,
            submissionId: templateData.submissionId,
            submittedAt: templateData.submittedAt,
          },
          templateData.language,
        );
        subject = "🎉 Thank you for your submission - hayc";
        break;
      default:
        throw new Error("Invalid email type");
    }

    // Send email to the user
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: templateData.email,
      replyTo: "support@hayc.gr",
      subject: subject,
      html: template,
    });
  }

  // Add endpoint for getting subscription transactions
  app.get("/api/admin/subscriptions/:id/transactions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscriptionId = parseInt(req.params.id);
      const transactions =
        await storage.getSubscriptionTransactions(subscriptionId);
      res.json({ transactions });
    } catch (err) {
      console.error("Error fetching transactions:", err);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Add endpoint for updating transaction PDF
  app.post("/api/admin/transactions/:id/pdf", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const transactionId = parseInt(req.params.id);
      const { pdfUrl } = req.body;

      if (!pdfUrl) {
        return res.status(400).json({ error: "No PDF URL provided" });
      }

      // Update transaction with PDF URL
      const transaction = await storage.updateTransactionPdf(
        transactionId,
        pdfUrl,
      );

      res.json({ transaction });
    } catch (err) {
      console.error("Error updating transaction PDF:", err);
      res.status(500).json({ error: "Failed to update transaction PDF" });
    }
  });

  // Newsletter API routes
  app.get("/api/newsletter/subscribers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const subscribers = await storage.getNewsletterSubscribers(websiteProgressId);
      res.json(subscribers);
    } catch (err) {
      console.error("Error fetching newsletter subscribers:", err);
      res.status(500).json({ error: "Failed to fetch newsletter subscribers" });
    }
  });

  app.post("/api/newsletter/subscribers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { name, email, status, websiteProgressId } = req.body;

      if (!name || !email || !websiteProgressId) {
        return res.status(400).json({ error: "Name, email, and website ID are required" });
      }

      const subscriber = await storage.createNewsletterSubscriber({
        name,
        email,
        status: status || "active",
        websiteProgressId
      });

      res.json(subscriber);
    } catch (err) {
      console.error("Error creating newsletter subscriber:", err);
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: "Email already exists for this website" });
      }
      res.status(500).json({ error: "Failed to create newsletter subscriber" });
    }
  });

  app.put("/api/newsletter/subscribers/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriberId = parseInt(req.params.id);
      const { name, email, status, websiteProgressId } = req.body;

      if (!name || !email || !websiteProgressId) {
        return res.status(400).json({ error: "Name, email, and website ID are required" });
      }

      const subscriber = await storage.updateNewsletterSubscriber(subscriberId, websiteProgressId, {
        name,
        email,
        status: status || "active"
      });

      res.json(subscriber);
    } catch (err) {
      console.error("Error updating newsletter subscriber:", err);
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: "Email already exists for this website" });
      }
      res.status(500).json({ error: "Failed to update newsletter subscriber" });
    }
  });

  app.delete("/api/newsletter/subscribers/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriberId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      await storage.deleteNewsletterSubscriber(subscriberId, websiteProgressId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting newsletter subscriber:", err);
      res.status(500).json({ error: "Failed to delete newsletter subscriber" });
    }
  });

  // Newsletter Campaign API routes
  app.get("/api/newsletter/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaigns = await storage.getNewsletterCampaigns(websiteProgressId);
      
      // Log the campaigns data to see if tagIds are present
      console.log('[GET CAMPAIGNS] Returning campaigns:', campaigns.map(c => ({ id: c.id, title: c.title, tagIds: c.tagIds })));
      
      res.json(campaigns);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(campaign);
    } catch (err) {
      console.error("Error fetching campaign:", err);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/newsletter/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { 
        title, 
        description, 
        purpose, 
        senderName, 
        senderEmail, 
        excludedSubscriberIds,
        excludedTagIds,
        subject, 
        message, 
        templateId,
        tagIds,
        statusFilters,
        status, 
        scheduledFor, 
        websiteProgressId 
      } = req.body;

      console.log('[CREATE CAMPAIGN] Request:', { title, tagIds, statusFilters, senderName, senderEmail, subject, message, status, scheduledFor });

      // Basic validation - always require websiteProgressId
      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaignStatus = status || 'draft';

      // For non-draft campaigns, require all fields (tags are now optional)
      // Allow either message OR templateId (template provides email content)
      if (campaignStatus !== 'draft') {
        if (!title || !senderName || !senderEmail || !subject) {
          console.log('[CREATE CAMPAIGN] Validation failed:', { title: !!title, senderName: !!senderName, senderEmail: !!senderEmail, subject: !!subject });
          return res.status(400).json({ error: "Title, sender name, sender email, and subject are required for non-draft campaigns" });
        }
        // Require either message content OR a template
        if (!message && !templateId) {
          console.log('[CREATE CAMPAIGN] Validation failed: no message and no template');
          return res.status(400).json({ error: "Either message content or a template is required for non-draft campaigns" });
        }
      }

      // Get recipient count for the campaign
      let recipientCount = 0;
      const activeStatuses = statusFilters && statusFilters.length > 0 
        ? statusFilters 
        : ['confirmed', 'active', 'pending'];
      
      let allContacts: any[] = [];
      if (tagIds && tagIds.length > 0) {
        allContacts = await storage.getContactsByTags(websiteProgressId, tagIds);
      } else {
        // Get all contacts when no tags selected
        allContacts = await storage.getContacts(websiteProgressId);
      }
      
      // Filter by status
      let activeContacts = allContacts.filter(c => activeStatuses.includes(c.status));
      
      // Filter out contacts with excluded tags
      const excludedTagIdsNormalized = (excludedTagIds || []).map((id: any) => typeof id === 'number' ? id : parseInt(id)).filter((id: number) => !isNaN(id));
      if (excludedTagIdsNormalized.length > 0) {
        // Get contacts that have any of the excluded tags
        const contactsWithExcludedTags = await storage.getContactsByTags(websiteProgressId, excludedTagIdsNormalized);
        const excludedContactIdsByTag = new Set(contactsWithExcludedTags.map(c => c.id));
        activeContacts = activeContacts.filter(c => !excludedContactIdsByTag.has(c.id));
      }
      
      // Filter out individually excluded contacts
      const excludedIds = excludedSubscriberIds || [];
      const finalRecipients = activeContacts.filter(c => !excludedIds.includes(c.id.toString()));
      recipientCount = finalRecipients.length;

      console.log('[CREATE CAMPAIGN] Received templateId:', templateId);
      
      const campaign = await storage.createNewsletterCampaign({
        title: title || 'Untitled Campaign',
        description: description || null,
        purpose: purpose || null,
        tagIds: tagIds || [],
        excludedTagIds: excludedTagIdsNormalized,
        senderName: senderName || null,
        senderEmail: senderEmail || null,
        excludedSubscriberIds: excludedSubscriberIds || [],
        subject: subject || null,
        message: message || '',
        templateId: templateId || null,
        status: campaignStatus,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        sentAt: null,
        websiteProgressId,
      });
      
      console.log('[CREATE CAMPAIGN] Created campaign with templateId:', campaign.templateId);

      // Update recipient count after creation
      await storage.updateNewsletterCampaign(campaign.id, websiteProgressId, {
        recipientCount,
      });

      res.json(campaign);
    } catch (err) {
      console.error("Error creating campaign:", err);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.put("/api/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const { title, description, purpose, tagIds, excludedTagIds, statusFilters, senderName, senderEmail, subject, message, status, scheduledFor, templateId, websiteProgressId } = req.body;

      console.log('[UPDATE CAMPAIGN] Received request body:', { title, tagIds, excludedTagIds, statusFilters, senderName, senderEmail });

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const existingCampaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);
      if (!existingCampaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // For scheduled campaigns, validate required fields
      // Allow either message OR templateId (template provides email content)
      const finalStatus = status !== undefined ? status : existingCampaign.status;
      const finalTemplateId = templateId !== undefined ? templateId : existingCampaign.templateId;
      const finalMessage = message !== undefined ? message : existingCampaign.message;
      const finalTitle = title !== undefined ? title : existingCampaign.title;
      const finalSenderName = senderName !== undefined ? senderName : existingCampaign.senderName;
      const finalSenderEmail = senderEmail !== undefined ? senderEmail : existingCampaign.senderEmail;
      const finalSubject = subject !== undefined ? subject : existingCampaign.subject;

      if (finalStatus === 'scheduled') {
        if (!finalTitle || !finalSenderName || !finalSenderEmail || !finalSubject) {
          console.log('[UPDATE CAMPAIGN] Validation failed:', { title: !!finalTitle, senderName: !!finalSenderName, senderEmail: !!finalSenderEmail, subject: !!finalSubject });
          return res.status(400).json({ error: "Title, sender name, sender email, and subject are required for scheduled campaigns" });
        }
        // Require either message content OR a template
        if (!finalMessage && !finalTemplateId) {
          console.log('[UPDATE CAMPAIGN] Validation failed: no message and no template');
          return res.status(400).json({ error: "Either message content or a template is required for scheduled campaigns" });
        }
      }

      // Always recalculate recipient count based on current tags, excluded tags, and status filters
      const activeStatuses = statusFilters && statusFilters.length > 0 
        ? statusFilters 
        : ['confirmed', 'active', 'pending'];
      
      const currentTagIds = tagIds !== undefined ? tagIds : existingCampaign.tagIds;
      const currentExcludedTagIds = excludedTagIds !== undefined ? excludedTagIds : (existingCampaign.excludedTagIds || []);
      
      // Normalize excluded tag IDs
      const excludedTagIdsNormalized = (currentExcludedTagIds || []).map((id: any) => typeof id === 'number' ? id : parseInt(id)).filter((id: number) => !isNaN(id));
      
      let allContacts: any[] = [];
      if (currentTagIds && currentTagIds.length > 0) {
        allContacts = await storage.getContactsByTags(websiteProgressId, currentTagIds);
      } else {
        // Get all contacts when no tags selected
        allContacts = await storage.getContacts(websiteProgressId);
      }
      
      // Filter by status
      let activeContacts = allContacts.filter(c => activeStatuses.includes(c.status));
      
      // Filter out contacts with excluded tags
      if (excludedTagIdsNormalized.length > 0) {
        const contactsWithExcludedTags = await storage.getContactsByTags(websiteProgressId, excludedTagIdsNormalized);
        const excludedContactIdsByTag = new Set(contactsWithExcludedTags.map(c => c.id));
        activeContacts = activeContacts.filter(c => !excludedContactIdsByTag.has(c.id));
      }
      
      const recipientCount = activeContacts.length;

      const campaign = await storage.updateNewsletterCampaign(campaignId, websiteProgressId, {
        title,
        description,
        purpose,
        tagIds,
        excludedTagIds: excludedTagIdsNormalized,
        senderName,
        senderEmail,
        subject,
        message,
        status,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        templateId: templateId !== undefined ? templateId : existingCampaign.templateId,
        recipientCount,
      });

      console.log('[UPDATE CAMPAIGN] Updated campaign:', { id: campaign.id, tagIds: campaign.tagIds, senderName: campaign.senderName, senderEmail: campaign.senderEmail });

      res.json(campaign);
    } catch (err) {
      console.error("Error updating campaign:", err);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  // Save email to campaign by creating a template and attaching it
  app.post("/api/newsletter/campaigns/:id/save-html", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const { emailHtml, emailDesign, websiteProgressId } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      if (!emailHtml) {
        return res.status(400).json({ error: "Email HTML is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Prevent updating sent campaigns
      if (campaign.status === 'sent') {
        return res.status(400).json({ error: "Cannot update sent campaigns" });
      }

      // Smart template handling:
      // - If campaign already has a template that matches exactly "{campaign.title} - Campaign Email", update it
      // - Otherwise, always create a new campaign-specific template
      // This ensures user-created templates are NEVER modified
      let template;
      const expectedTemplateName = `${campaign.title} - Campaign Email`;
      
      if (campaign.templateId) {
        // Get the existing template to check if it was auto-created for THIS campaign
        const [existingTemplate] = await db
          .select()
          .from(emailTemplates)
          .where(
            and(
              eq(emailTemplates.id, campaign.templateId),
              eq(emailTemplates.websiteProgressId, websiteProgressId)
            )
          );
        
        if (existingTemplate && existingTemplate.name === expectedTemplateName) {
          // This template was auto-created for THIS specific campaign, safe to update
          const [updatedTemplate] = await db
            .update(emailTemplates)
            .set({
              html: emailHtml,
              design: emailDesign || null,
              updatedAt: new Date(),
            })
            .where(eq(emailTemplates.id, campaign.templateId))
            .returning();
          template = updatedTemplate;
        } else {
          // This is either a user-created template or belongs to another campaign
          // Create a new campaign-specific template instead
          const [newTemplate] = await db
            .insert(emailTemplates)
            .values({
              websiteProgressId,
              name: expectedTemplateName,
              html: emailHtml,
              design: emailDesign || null,
            })
            .returning();
          template = newTemplate;
        }
      } else {
        // No template exists, create a new campaign template
        const [newTemplate] = await db
          .insert(emailTemplates)
          .values({
            websiteProgressId,
            name: expectedTemplateName,
            html: emailHtml,
            design: emailDesign || null,
          })
          .returning();
        template = newTemplate;
      }

      // Update campaign to reference the template
      const updatedCampaign = await storage.updateNewsletterCampaign(campaignId, websiteProgressId, {
        templateId: template.id,
      });

      res.json(updatedCampaign);
    } catch (err) {
      console.error("Error saving campaign HTML:", err);
      res.status(500).json({ error: "Failed to save campaign HTML" });
    }
  });

  app.delete("/api/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      await storage.deleteNewsletterCampaign(campaignId, websiteProgressId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting campaign:", err);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Bulk delete user newsletter campaigns
  app.post("/api/newsletter/campaigns/bulk-delete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { campaignIds, websiteProgressId } = req.body;
      console.log("[BULK DELETE] Received request:", { campaignIds, websiteProgressId, userId: req.user.id });

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: "Campaign IDs array is required" });
      }

      // Verify ownership of the website
      const websiteProgressEntry = await db.query.websiteProgress.findFirst({
        where: eq(websiteProgress.id, websiteProgressId),
      });

      if (!websiteProgressEntry) {
        console.log("[BULK DELETE] Website not found:", websiteProgressId);
        return res.status(404).json({ error: "Website not found" });
      }

      if (websiteProgressEntry.userId !== req.user.id) {
        console.log("[BULK DELETE] Permission denied. Website owner:", websiteProgressEntry.userId, "User:", req.user.id);
        return res.status(403).json({ error: "You don't have permission to manage this website's campaigns" });
      }

      const ids = campaignIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
      console.log("[BULK DELETE] Parsed campaign IDs:", ids);

      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid campaign IDs provided" });
      }

      // First delete related campaign messages
      await db.delete(campaignMessages).where(
        inArray(campaignMessages.campaignId, ids)
      );
      console.log("[BULK DELETE] Deleted related campaign messages");

      // Then delete campaigns
      const result = await db.delete(newsletterCampaignsTable).where(
        and(
          inArray(newsletterCampaignsTable.id, ids),
          eq(newsletterCampaignsTable.websiteProgressId, websiteProgressId)
        )
      );

      console.log("[BULK DELETE] Delete result:", result);

      res.json({ 
        success: true, 
        deletedCount: ids.length 
      });
    } catch (err) {
      console.error("[BULK DELETE] Error bulk deleting campaigns:", err);
      res.status(500).json({ error: "Failed to bulk delete campaigns" });
    }
  });

  app.post("/api/newsletter/campaigns/:id/duplicate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const { websiteProgressId } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Calculate recipient count based on tagIds and excludedTagIds
      let recipientCount = 0;
      if (campaign.tagIds && campaign.tagIds.length > 0) {
        const activeStatuses = ['confirmed', 'active', 'pending'];
        let allContacts: any[] = [];
        
        if (campaign.tagIds.length > 0) {
          allContacts = await storage.getContactsByTags(websiteProgressId, campaign.tagIds);
        }
        
        let activeContacts = allContacts.filter(c => activeStatuses.includes(c.status));
        
        // Filter out contacts with excluded tags
        const excludedTagIds = campaign.excludedTagIds || [];
        const excludedTagIdsNormalized = excludedTagIds.map((id: any) => typeof id === 'number' ? id : parseInt(id)).filter((id: number) => !isNaN(id));
        if (excludedTagIdsNormalized.length > 0) {
          const contactsWithExcludedTags = await storage.getContactsByTags(websiteProgressId, excludedTagIdsNormalized);
          const excludedContactIdsByTag = new Set(contactsWithExcludedTags.map(c => c.id));
          activeContacts = activeContacts.filter(c => !excludedContactIdsByTag.has(c.id));
        }
        
        const excludedIds = campaign.excludedSubscriberIds || [];
        const finalRecipients = activeContacts.filter(c => !excludedIds.includes(c.id.toString()));
        recipientCount = finalRecipients.length;
      }

      const duplicatedCampaign = await storage.createNewsletterCampaign({
        websiteProgressId: campaign.websiteProgressId,
        title: `${campaign.title} (Copy)`,
        description: campaign.description,
        purpose: campaign.purpose,
        subject: campaign.subject,
        message: campaign.message,
        senderName: campaign.senderName,
        senderEmail: campaign.senderEmail,
        tagIds: campaign.tagIds,
        excludedTagIds: campaign.excludedTagIds || [],
        excludedSubscriberIds: campaign.excludedSubscriberIds,
        excludedContactIds: campaign.excludedContactIds,
        templateId: campaign.templateId,
        emailHtml: campaign.emailHtml,
        emailDesign: campaign.emailDesign,
        status: 'draft',
      });

      // Update the recipient count
      await storage.updateNewsletterCampaign(duplicatedCampaign.id, websiteProgressId, {
        recipientCount,
      });

      res.json({ ...duplicatedCampaign, recipientCount });
    } catch (err) {
      console.error("Error duplicating campaign:", err);
      res.status(500).json({ error: "Failed to duplicate campaign" });
    }
  });

  app.post("/api/newsletter/campaigns/:id/send", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const { websiteProgressId } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (campaign.status === 'sent') {
        return res.status(400).json({ error: "Campaign has already been sent" });
      }

      if (campaign.status === 'sending') {
        return res.status(400).json({ error: "Campaign is already being sent" });
      }

      // Store original status for potential rollback
      const originalStatus = campaign.status;

      // Check if campaign has either a template selected OR email content saved directly
      if (!campaign.templateId && !campaign.emailHtml) {
        return res.status(400).json({ error: "Cannot send campaign without email content. Please select a template or design an email first." });
      }

      // Get the website to determine its owner and check authorization
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Check authorization: allow if user owns the website OR if user is an admin
      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to send campaigns for this website" });
      }

      // Get subscription for the website owner (not current user) to check tier and limits
      const [currentSubscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.websiteProgressId, websiteProgressId),
            eq(subscriptionsTable.userId, website.userId), // Use website owner's ID
            eq(subscriptionsTable.status, "active"),
            eq(subscriptionsTable.productType, "plan")
          )
        )
        .limit(1);

      if (!currentSubscription) {
        return res.status(403).json({ error: "No active subscription found for this website" });
      }

      // Determine email limit based on tier
      const tier = currentSubscription.tier as "basic" | "essential" | "pro";
      const emailLimit = await getEmailLimitWithAddOns(tier, currentSubscription.websiteProgressId);
      
      if (tier === "basic") {
        return res.status(403).json({ 
          error: "Newsletter features require Essential or Pro tier", 
          tier: "basic",
          upsellMessage: "Upgrade to Essential to send up to 3,000 emails per month"
        });
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

      // Get contacts for the campaign (by tags if specified, or all contacts)
      let recipients: any[] = [];
      
      let allContacts: any[] = [];
      if (campaign.tagIds && campaign.tagIds.length > 0) {
        allContacts = await storage.getContactsByTags(websiteProgressId, campaign.tagIds);
      } else {
        // Get all contacts when no tags selected
        allContacts = await storage.getContacts(websiteProgressId);
      }
      
      // Accept contacts with status 'active', 'confirmed', or 'pending' (migrated from legacy subscribers)
      // Use campaign's status filters if available, otherwise default to all active statuses
      const statusFilters = campaign.statusFilters || ['confirmed', 'active', 'pending'];
      recipients = allContacts.filter(c => statusFilters.includes(c.status));
      
      // Filter out contacts with excluded tags
      const excludedTagIds = campaign.excludedTagIds || [];
      const excludedTagIdsNormalized = excludedTagIds.map((id: any) => typeof id === 'number' ? id : parseInt(id)).filter((id: number) => !isNaN(id));
      if (excludedTagIdsNormalized.length > 0) {
        const contactsWithExcludedTags = await storage.getContactsByTags(websiteProgressId, excludedTagIdsNormalized);
        const excludedContactIdsByTag = new Set(contactsWithExcludedTags.map(c => c.id));
        recipients = recipients.filter(c => !excludedContactIdsByTag.has(c.id));
      }
      
      // Filter out individually excluded subscribers/contacts
      const excludedIds = campaign.excludedSubscriberIds || [];
      const finalRecipients = recipients.filter(r => !excludedIds.includes(r.id.toString()));

      if (finalRecipients.length === 0) {
        return res.status(400).json({ error: "No active subscribers to send to after exclusions" });
      }

      // Check if sending this campaign would exceed the email limit
      const remainingQuota = emailLimit - currentUsage;
      if (finalRecipients.length > remainingQuota) {
        return res.status(403).json({ 
          error: "Email limit exceeded", 
          limit: emailLimit,
          used: currentUsage,
          remaining: remainingQuota,
          requested: finalRecipients.length,
          tier: tier,
          message: `This campaign would send ${finalRecipients.length} emails, but you only have ${remainingQuota} emails remaining this month (${currentUsage}/${emailLimit} used).${tier === 'essential' ? ' Upgrade to Pro for 10,000 emails per month.' : ''}`
        });
      }

      // ALL VALIDATION PASSED - Now atomically claim the campaign by setting status to 'sending'
      // Use conditional update to prevent race conditions
      const claimResult = await db
        .update(newsletterCampaignsTable)
        .set({ status: 'sending' })
        .where(
          and(
            eq(newsletterCampaignsTable.id, campaignId),
            eq(newsletterCampaignsTable.websiteProgressId, websiteProgressId),
            // Only update if status is still what we expect (not already 'sent' or 'sending')
            sql`${newsletterCampaignsTable.status} NOT IN ('sent', 'sending')`
          )
        )
        .returning({ id: newsletterCampaignsTable.id });

      if (!claimResult || claimResult.length === 0) {
        // Another process already claimed this campaign
        return res.status(400).json({ error: "Campaign is already being sent or has been sent" });
      }

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
              websiteProgressId,
              subscriber.email
            );
            
            // Inject unsubscribe footer into email HTML
            let emailHtml = templateHtml || campaign.emailHtml || '';
            if (emailHtml) {
              // Detect language from campaign or default to English
              const campaignLanguage = (campaign as any).language;
              const language = (campaignLanguage === 'gr' || campaignLanguage === 'el') ? 'gr' : 'en';
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
                    campaignId: campaignId,
                    messageId: result.messageId,
                    recipientEmail: subscriber.email,
                  });
                } catch (trackError) {
                  console.error('Failed to store message ID for tracking:', trackError);
                }
              }
            } else {
              failCount++;
              console.error(`Failed to send to ${subscriber.email}:`, result.error);
            }
          } catch (emailError) {
            failCount++;
            console.error(`Error sending to ${subscriber.email}:`, emailError);
          }
        }

        // Update campaign status and counts
        await storage.updateNewsletterCampaign(campaignId, websiteProgressId, {
          status: 'sent',
          sentAt: new Date(),
          recipientCount: successCount,
        });
        
        // Update sent count
        await db
          .update(newsletterCampaignsTable)
          .set({
            sentCount: successCount,
          })
          .where(eq(newsletterCampaignsTable.id, campaignId));

        // Increment email counter for successfully sent emails
        if (successCount > 0) {
          await db
            .update(subscriptionsTable)
            .set({
              emailsSentThisMonth: sql`${subscriptionsTable.emailsSentThisMonth} + ${successCount}`,
            })
            .where(eq(subscriptionsTable.id, currentSubscription.id));
        }

        // Calculate new usage for response
        const newUsage = currentUsage + successCount;
        const newRemaining = emailLimit - newUsage;

        res.json({
          success: true,
          message: `Campaign sent to ${successCount} subscribers. ${failCount} failed.`,
          successCount,
          failCount,
          emailUsage: {
            limit: emailLimit,
            used: newUsage,
            remaining: newRemaining,
            tier: tier,
          },
        });
      } catch (sendError) {
        // Revert campaign status to original if sending fails
        console.error("Error during campaign send, reverting status:", sendError);
        try {
          await storage.updateNewsletterCampaign(campaignId, websiteProgressId, {
            status: originalStatus,
          });
        } catch (revertError) {
          console.error("Failed to revert campaign status:", revertError);
        }
        throw sendError; // Re-throw to be caught by outer catch
      }
    } catch (err) {
      console.error("Error sending campaign:", err);
      res.status(500).json({ error: "Failed to send campaign" });
    }
  });

  // Campaign analytics endpoint
  app.get("/api/newsletter/campaigns/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);

      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      const campaign = await storage.getNewsletterCampaignById(campaignId, websiteProgressId);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Fetch template if campaign has one
      let template = null;
      if (campaign.templateId) {
        const [templateResult] = await db
          .select()
          .from(emailTemplates)
          .where(eq(emailTemplates.id, campaign.templateId));
        template = templateResult;
      }

      // Calculate analytics metrics
      const sentCount = campaign.sentCount || 0;
      const deliveredCount = campaign.deliveredCount || 0;
      const bounceCount = campaign.bounceCount || 0;
      const complaintCount = campaign.complaintCount || 0;
      const openCount = campaign.openCount || 0;
      const clickCount = campaign.clickCount || 0;
      
      const deliveryRate = sentCount > 0 
        ? ((deliveredCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const bounceRate = sentCount > 0
        ? ((bounceCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const complaintRate = sentCount > 0
        ? ((complaintCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const openRate = deliveredCount > 0 
        ? ((openCount / deliveredCount) * 100).toFixed(2)
        : '0';
      
      const clickRate = deliveredCount > 0
        ? ((clickCount / deliveredCount) * 100).toFixed(2)
        : '0';

      const clickThroughRate = openCount > 0
        ? ((clickCount / openCount) * 100).toFixed(2)
        : '0';

      res.json({
        campaign,
        template,
        metrics: {
          sentCount,
          deliveredCount,
          bounceCount,
          complaintCount,
          recipientCount: campaign.recipientCount,
          openCount,
          clickCount,
          deliveryRate: parseFloat(deliveryRate),
          bounceRate: parseFloat(bounceRate),
          complaintRate: parseFloat(complaintRate),
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
          clickThroughRate: parseFloat(clickThroughRate),
          status: campaign.status,
          sentAt: campaign.sentAt,
          scheduledFor: campaign.scheduledFor,
        }
      });
    } catch (err) {
      console.error("Error fetching campaign analytics:", err);
      res.status(500).json({ error: "Failed to fetch campaign analytics" });
    }
  });

  // Get email usage stats for a website
  app.get("/api/newsletter/email-usage/:websiteProgressId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.params.websiteProgressId);

      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Get the website to determine its owner and check authorization
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Check authorization: allow if user owns the website OR if user is an admin
      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to view usage for this website" });
      }

      // Get subscription for the website owner (not current user)
      const [currentSubscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.websiteProgressId, websiteProgressId),
            eq(subscriptionsTable.userId, website.userId), // Use website owner's ID
            eq(subscriptionsTable.status, "active")
          )
        )
        .limit(1);

      if (!currentSubscription) {
        return res.status(404).json({ error: "No active subscription found for this website" });
      }

      // Determine email limit based on tier
      const tier = currentSubscription.tier as "basic" | "essential" | "pro";
      const emailLimit = await getEmailLimitWithAddOns(tier, currentSubscription.websiteProgressId);

      const currentUsage = currentSubscription.emailsSentThisMonth || 0;
      const remaining = Math.max(0, emailLimit - currentUsage);

      res.json({
        tier,
        limit: emailLimit,
        used: currentUsage,
        remaining,
        hasAccess: tier !== "basic",
        percentage: emailLimit > 0 ? Math.round((currentUsage / emailLimit) * 100) : 0,
      });
    } catch (err) {
      console.error("Error fetching email usage:", err);
      res.status(500).json({ error: "Failed to fetch email usage" });
    }
  });

  // ============================================================================
  // CONTACTS API ROUTES (NEW TAGS-BASED SYSTEM)
  // ============================================================================
  
  // Get all contacts for a website (optionally filtered by tags)
  app.get("/api/contacts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this website's contacts" });
      }

      // Check if filtering by tags
      const tagIdsParam = req.query.tagIds;
      if (tagIdsParam) {
        // Parse tag IDs
        const tagIds = Array.isArray(tagIdsParam)
          ? tagIdsParam.map((id: string) => parseInt(id))
          : [parseInt(tagIdsParam as string)];

        const validTagIds = tagIds.filter(id => !isNaN(id));
        
        if (validTagIds.length > 0) {
          const contactsList = await storage.getContactsByTags(websiteProgressId, validTagIds);
          return res.json(contactsList);
        }
      }

      // No tag filtering, return all contacts
      const contactsList = await storage.getContacts(websiteProgressId);
      res.json(contactsList);
    } catch (err) {
      console.error("Error fetching contacts:", err);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // Export contacts as CSV for a website
  app.get("/api/contacts/export", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to export this website's contacts" });
      }

      // Parse optional contact IDs filter
      const contactIdsParam = req.query.contactIds as string | undefined;
      const contactIds = contactIdsParam
        ? contactIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : [];

      // Fetch contacts with tags
      let result;
      if (contactIds.length > 0) {
        result = await db.execute(sql`
          SELECT 
            c.*,
            COALESCE(
              string_agg(DISTINCT t.name, ', '),
              ''
            ) as tags
          FROM contacts c
          LEFT JOIN contact_tags ct ON c.id = ct.contact_id
          LEFT JOIN tags t ON ct.tag_id = t.id
          WHERE c.website_progress_id = ${websiteProgressId}
            AND c.id IN (${sql.join(contactIds.map(id => sql`${id}`), sql`, `)})
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT 
            c.*,
            COALESCE(
              string_agg(DISTINCT t.name, ', '),
              ''
            ) as tags
          FROM contacts c
          LEFT JOIN contact_tags ct ON c.id = ct.contact_id
          LEFT JOIN tags t ON ct.tag_id = t.id
          WHERE c.website_progress_id = ${websiteProgressId}
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
      }

      const contactsList = result.rows || [];

      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Build CSV content
      const headers = ['email', 'first_name', 'last_name', 'status', 'tags', 'subscribed_at', 'confirmed_at'];
      const csvRows = [headers.join(',')];

      for (const contact of contactsList) {
        const row = [
          escapeCsvValue(contact.email),
          escapeCsvValue(contact.first_name),
          escapeCsvValue(contact.last_name),
          escapeCsvValue(contact.status),
          escapeCsvValue(contact.tags),
          escapeCsvValue(contact.subscribed_at ? new Date(contact.subscribed_at).toISOString() : ''),
          escapeCsvValue(contact.confirmed_at ? new Date(contact.confirmed_at).toISOString() : ''),
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts_export.csv"');
      res.send(csvContent);
    } catch (err) {
      console.error("Error exporting contacts:", err);
      res.status(500).json({ error: "Failed to export contacts" });
    }
  });

  // Get contact by ID
  app.get("/api/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContactById(contactId);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, contact.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this contact" });
      }

      res.json(contact);
    } catch (err) {
      console.error("Error fetching contact:", err);
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  // Create new contact
  app.post("/api/contacts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { first_name, last_name, email, websiteProgressId, status, tags } = req.body;

      if (!email || !websiteProgressId) {
        return res.status(400).json({ error: "Email and website ID are required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to create contacts for this website" });
      }

      // Check if contact already exists
      const existing = await storage.getContactByEmail(email, websiteProgressId);
      if (existing) {
        return res.status(400).json({ error: "Contact with this email already exists" });
      }

      // Create contact
      const contact = await storage.createContact({
        firstName: first_name || null,
        lastName: last_name || null,
        email,
        websiteProgressId,
        status: status || 'pending',
        subscribedAt: new Date(),
      });

      // Assign tags if provided and validate they belong to the same website
      if (tags && Array.isArray(tags)) {
        for (const tagId of tags) {
          const tag = await storage.getTagById(tagId);
          if (!tag || tag.websiteProgressId !== websiteProgressId) {
            return res.status(400).json({ error: `Tag ${tagId} does not belong to this website` });
          }
          await storage.assignTagToContact(contact.id, tagId);
        }
      }

      res.json(contact);
    } catch (err) {
      console.error("Error creating contact:", err);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  // Update contact
  app.put("/api/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.id);
      const { first_name, last_name, email, status, websiteProgressId } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to update contacts for this website" });
      }

      const updates: any = {};
      if (first_name !== undefined) updates.firstName = first_name;
      if (last_name !== undefined) updates.lastName = last_name;
      if (email !== undefined) updates.email = email;
      if (status !== undefined) updates.status = status;

      const contact = await storage.updateContact(contactId, websiteProgressId, updates);
      res.json(contact);
    } catch (err) {
      console.error("Error updating contact:", err);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  // Bulk delete contacts (must be before single delete route)
  app.delete("/api/contacts/bulk-delete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contactIds, websiteProgressId } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "Contact IDs array is required" });
      }

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Validate all IDs are numbers
      const validIds = contactIds.filter(id => typeof id === 'number' && !isNaN(id));
      if (validIds.length === 0) {
        return res.status(400).json({ error: "No valid contact IDs provided" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete contacts for this website" });
      }

      // First, verify all contacts belong to this website and get their IDs
      const contactsToDelete = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            inArray(contacts.id, validIds),
            eq(contacts.websiteProgressId, websiteProgressId)
          )
        );

      const contactIdsToDelete = contactsToDelete.map(c => c.id);

      if (contactIdsToDelete.length === 0) {
        return res.json({ success: true, deletedCount: 0 });
      }

      // Delete contact tags first (bulk delete)
      await db
        .delete(contactTags)
        .where(inArray(contactTags.contactId, contactIdsToDelete));

      // Delete contacts (bulk delete)
      const deletedContacts = await db
        .delete(contacts)
        .where(inArray(contacts.id, contactIdsToDelete))
        .returning();

      res.json({ 
        success: true, 
        deletedCount: deletedContacts.length 
      });
    } catch (err) {
      console.error("Error bulk deleting contacts:", err);
      res.status(500).json({ error: "Failed to bulk delete contacts" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);

      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete contacts for this website" });
      }

      await storage.deleteContact(contactId, websiteProgressId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting contact:", err);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // Bulk import contacts
  app.post("/api/contacts/bulk-import", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { contacts: contactsData, websiteProgressId } = req.body;

      // Debug logging
      console.log("[BULK IMPORT DEBUG] Request body keys:", Object.keys(req.body || {}));
      console.log("[BULK IMPORT DEBUG] websiteProgressId:", websiteProgressId, "type:", typeof websiteProgressId);
      console.log("[BULK IMPORT DEBUG] contactsData is array:", Array.isArray(contactsData), "length:", contactsData?.length);

      // More specific error messages
      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required for bulk import" });
      }
      
      if (!contactsData) {
        return res.status(400).json({ error: "Contacts data is required - received: " + typeof contactsData });
      }
      
      if (!Array.isArray(contactsData)) {
        return res.status(400).json({ error: "Contacts must be an array - received: " + typeof contactsData });
      }
      
      if (contactsData.length === 0) {
        return res.status(400).json({ error: "Contacts array is empty - no contacts to import" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to create contacts for this website" });
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ email: string; error: string }>,
      };

      // Helper function to map status values from other platforms to our system
      // Allowed statuses in our system
      const ALLOWED_STATUSES = ['pending', 'active', 'confirmed', 'unsubscribed'] as const;
      type AllowedStatus = typeof ALLOWED_STATUSES[number];
      
      function mapImportStatus(status: string | undefined | null): AllowedStatus {
        if (!status) return "pending";
        
        const normalized = status.toLowerCase().trim();
        
        // Map to "active" - common values from other platforms meaning subscribed
        if (['subscribed', 'active', 'yes', 'true', '1', 'opted_in', 'opt_in', 'optin'].includes(normalized)) {
          return 'active';
        }
        
        // Map to "confirmed" - verified/double opt-in contacts
        if (['confirmed', 'verified', 'double_opt_in', 'double_optin'].includes(normalized)) {
          return 'confirmed';
        }
        
        // Map to "unsubscribed" - contacts who opted out
        if (['unsubscribed', 'cleaned', 'bounced', 'inactive', 'no', 'false', '0', 'opted_out', 'opt_out', 'optout', 'removed', 'spam', 'complained'].includes(normalized)) {
          return 'unsubscribed';
        }
        
        // Check if it's already one of our valid statuses (handles "pending" explicitly)
        if (ALLOWED_STATUSES.includes(normalized as AllowedStatus)) {
          return normalized as AllowedStatus;
        }
        
        // Unknown values default to pending
        return 'pending';
      }

      // Validate all contacts first
      const validContacts: Array<{ first_name: string | null; last_name: string | null; email: string; status: AllowedStatus; tags: number[] }> = [];
      const contactEmails: string[] = [];
      
      for (const contactData of contactsData) {
        const { first_name, last_name, email, status, tags } = contactData;
        
        if (!email) {
          results.errors.push({ email: email || "unknown", error: "Email is required" });
          continue;
        }

        validContacts.push({
          first_name: first_name || null,
          last_name: last_name || null,
          email: email.toLowerCase().trim(),
          status: mapImportStatus(status),
          tags: Array.isArray(tags) ? tags : [],
        });
        contactEmails.push(email.toLowerCase().trim());
      }

      if (validContacts.length === 0) {
        return res.json(results);
      }

      // Batch check for existing contacts (single query)
      const existingContacts = await db
        .select({ email: contacts.email })
        .from(contacts)
        .where(
          and(
            eq(contacts.websiteProgressId, websiteProgressId),
            inArray(contacts.email, contactEmails)
          )
        );

      const existingEmailsSet = new Set(existingContacts.map(c => c.email.toLowerCase()));

      // Filter out existing contacts
      const contactsToCreate = validContacts.filter(c => !existingEmailsSet.has(c.email.toLowerCase()));
      results.skipped = validContacts.length - contactsToCreate.length;

      if (contactsToCreate.length === 0) {
        return res.json(results);
      }

      // Pre-fetch all tags for this website (single query)
      const allTags = await storage.getTags(websiteProgressId);
      const tagMap = new Map(allTags.map(tag => [tag.id, tag]));

      // Prepare contacts for bulk insert
      const contactsToInsert = contactsToCreate.map(contact => ({
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        websiteProgressId,
        status: contact.status,
        confirmationToken: randomBytes(32).toString('hex'),
      }));

      // Bulk insert contacts (single query)
      const insertedContacts = await db
        .insert(contacts)
        .values(contactsToInsert)
        .returning();

      results.imported = insertedContacts.length;

      // Prepare tag assignments for bulk insert
      const tagAssignments: Array<{ contactId: number; tagId: number }> = [];
      const contactEmailToIdMap = new Map(insertedContacts.map(c => [c.email.toLowerCase(), c.id]));

      for (const contactData of contactsToCreate) {
        const contactId = contactEmailToIdMap.get(contactData.email.toLowerCase());
        if (!contactId) continue;

        for (const tagId of contactData.tags) {
          const tag = tagMap.get(tagId);
          if (tag && tag.websiteProgressId === websiteProgressId) {
            tagAssignments.push({ contactId, tagId });
          }
        }
      }

      // Bulk insert tag assignments (single query)
      if (tagAssignments.length > 0) {
        await db
          .insert(contactTags)
          .values(tagAssignments)
          .onConflictDoNothing();
      }

      res.json(results);
    } catch (err) {
      console.error("Error bulk importing contacts:", err);
      res.status(500).json({ error: "Failed to bulk import contacts" });
    }
  });

  // Confirm contact subscription
  app.post("/api/contacts/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const contact = await storage.confirmContact(token);
      
      if (!contact) {
        return res.status(404).json({ error: "Invalid or expired confirmation token" });
      }

      res.json({ success: true, contact });
    } catch (err) {
      console.error("Error confirming contact:", err);
      res.status(500).json({ error: "Failed to confirm contact" });
    }
  });

  // Unsubscribe contact
  app.post("/api/contacts/:id/unsubscribe", async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const contact = await storage.unsubscribeContact(contactId);
      res.json({ success: true, contact });
    } catch (err) {
      console.error("Error unsubscribing contact:", err);
      res.status(500).json({ error: "Failed to unsubscribe contact" });
    }
  });

  // ============================================================================
  // TAGS API ROUTES (NEW TAGS-BASED SYSTEM)
  // ============================================================================
  
  // Get all tags for a website
  app.get("/api/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);
      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this website's tags" });
      }

      const tagsList = await storage.getTags(websiteProgressId);
      
      // Get contact counts for all tags in a single query
      const tagIds = tagsList.map((tag: any) => tag.id);
      let countsMap: Map<number, number> = new Map();
      
      if (tagIds.length > 0) {
        const counts = await db
          .select({
            tagId: contactTags.tagId,
            count: sql<number>`count(*)::int`,
          })
          .from(contactTags)
          .where(inArray(contactTags.tagId, tagIds))
          .groupBy(contactTags.tagId);
        
        counts.forEach((row) => {
          countsMap.set(row.tagId, row.count);
        });
      }
      
      // Merge counts with tags
      const tagsWithCounts = tagsList.map((tag: any) => ({
        ...tag,
        contactCount: countsMap.get(tag.id) || 0,
      }));
      
      res.json(tagsWithCounts);
    } catch (err) {
      console.error("Error fetching tags:", err);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  // Create new tag
  app.post("/api/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { name, description, color, websiteProgressId } = req.body;

      if (!name || !websiteProgressId) {
        return res.status(400).json({ error: "Name and website ID are required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to create tags for this website" });
      }

      // Check if tag already exists
      const existing = await storage.getTagByName(name, websiteProgressId);
      if (existing) {
        return res.status(400).json({ error: "Tag with this name already exists" });
      }

      const tag = await storage.createTag({
        name,
        description: description || null,
        color: color || 'bg-gray-100 text-gray-800',
        websiteProgressId,
        isSystem: false,
      });

      res.json(tag);
    } catch (err) {
      console.error("Error creating tag:", err);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  // Update tag
  app.put("/api/tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const tagId = parseInt(req.params.id);
      const { name, description, color, websiteProgressId } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to update tags for this website" });
      }

      // Prevent editing system tags
      const existingTag = await storage.getTagById(tagId);
      if (existingTag && existingTag.isSystem) {
        return res.status(400).json({ error: "Cannot edit system tags" });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;

      const tag = await storage.updateTag(tagId, websiteProgressId, updates);
      res.json(tag);
    } catch (err) {
      console.error("Error updating tag:", err);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  // Delete tag
  app.delete("/api/tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const tagId = parseInt(req.params.id);
      const websiteProgressId = parseInt(req.query.websiteProgressId as string);

      if (!websiteProgressId || isNaN(websiteProgressId)) {
        return res.status(400).json({ error: "Website ID is required" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete tags for this website" });
      }

      // Prevent deleting system tags
      const existingTag = await storage.getTagById(tagId);
      if (existingTag && existingTag.isSystem) {
        return res.status(400).json({ error: "Cannot delete system tags" });
      }

      await storage.deleteTag(tagId, websiteProgressId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting tag:", err);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Assign tag to contact
  app.post("/api/contacts/:contactId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.contactId);
      const tagId = parseInt(req.params.tagId);

      // Verify contact exists and get its website
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify tag exists and belongs to same website
      const tag = await storage.getTagById(tagId);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }

      if (contact.websiteProgressId !== tag.websiteProgressId) {
        return res.status(400).json({ error: "Contact and tag must belong to the same website" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, contact.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to modify tags for this website" });
      }

      const contactTag = await storage.assignTagToContact(contactId, tagId);
      res.json({ success: true, contactTag });
    } catch (err) {
      console.error("Error assigning tag to contact:", err);
      res.status(500).json({ error: "Failed to assign tag to contact" });
    }
  });

  // ============================================================================
  // ADMIN TAGS API ROUTES
  // ============================================================================

  // Get all admin tags
  app.get("/api/admin/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const adminTags = await db.execute(sql`
        SELECT * FROM admin_tags 
        ORDER BY name
      `);
      res.json(adminTags.rows);
    } catch (err) {
      console.error("Error fetching admin tags:", err);
      res.status(500).json({ error: "Failed to fetch admin tags" });
    }
  });

  // Create admin tag
  app.post("/api/admin/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { name, description, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check if tag already exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_tags WHERE name = ${name} LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        return res.status(400).json({ error: "Tag with this name already exists" });
      }

      const result = await db.execute(sql`
        INSERT INTO admin_tags (name, description, color, is_system, created_at)
        VALUES (${name}, ${description || null}, ${color || '#888888'}, false, NOW())
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creating admin tag:", err);
      res.status(500).json({ error: "Failed to create admin tag" });
    }
  });

  // Update admin tag
  app.put("/api/admin/tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const tagId = parseInt(req.params.id);
      const { name, description, color } = req.body;

      // Prevent editing system tags
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_tags WHERE id = ${tagId} LIMIT 1
      `);

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Tag not found" });
      }

      const existingTag = existingResult.rows[0];
      if (existingTag.is_system) {
        return res.status(400).json({ error: "Cannot edit system tags" });
      }

      const finalName = name !== undefined ? name : existingTag.name;
      const finalDescription = description !== undefined ? description : existingTag.description;
      const finalColor = color !== undefined ? color : existingTag.color;

      const result = await db.execute(sql`
        UPDATE admin_tags 
        SET 
          name = ${finalName},
          description = ${finalDescription || null},
          color = ${finalColor},
          updated_at = NOW()
        WHERE id = ${tagId}
        RETURNING *
      `);
      res.json((result as any).rows?.[0] || result);
    } catch (err) {
      console.error("Error updating admin tag:", err);
      res.status(500).json({ error: "Failed to update admin tag" });
    }
  });

  // Delete admin tag
  app.delete("/api/admin/tags/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const tagId = parseInt(req.params.id);

      // Prevent deleting system tags
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_tags WHERE id = ${tagId} LIMIT 1
      `);

      if (existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Tag not found" });
      }

      const existingTag = existingResult.rows[0];
      if (existingTag.is_system) {
        return res.status(400).json({ error: "Cannot delete system tags" });
      }

      await db.execute(sql`
        DELETE FROM admin_tags WHERE id = ${tagId}
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting admin tag:", err);
      res.status(500).json({ error: "Failed to delete admin tag" });
    }
  });

  // ============================================
  // ADMIN TEMPLATES API ROUTES
  // ============================================

  // Get all admin templates
  app.get("/api/admin/templates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const result = await db.execute(sql`
        SELECT * FROM admin_templates
        ORDER BY updated_at DESC, created_at DESC
      `);

      res.json(result.rows || []);
    } catch (err) {
      console.error("Error fetching admin templates:", err);
      res.status(500).json({ error: "Failed to fetch admin templates" });
    }
  });

  // Get single admin template by id
  app.get("/api/admin/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const templateId = parseInt(req.params.id);

      const result = await db.execute(sql`
        SELECT * FROM admin_templates WHERE id = ${templateId} LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error fetching admin template:", err);
      res.status(500).json({ error: "Failed to fetch admin template" });
    }
  });

  // Create new admin template
  app.post("/api/admin/templates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { name, html, design, thumbnail, category } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!html) {
        return res.status(400).json({ error: "HTML is required" });
      }
      if (!design) {
        return res.status(400).json({ error: "Design is required" });
      }

      const result = await db.execute(sql`
        INSERT INTO admin_templates (name, html, design, thumbnail, category, created_at, updated_at)
        VALUES (${name}, ${html}, ${design}, ${thumbnail || null}, ${category || null}, NOW(), NOW())
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creating admin template:", err);
      res.status(500).json({ error: "Failed to create admin template" });
    }
  });

  // Update admin template
  app.patch("/api/admin/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const templateId = parseInt(req.params.id);
      const { name, html, design, thumbnail, category } = req.body;

      // Check if template exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_templates WHERE id = ${templateId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Template not found" });
      }

      const setParts: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        setParts.push(`name = $${values.length + 1}`);
        values.push(name);
      }
      if (html !== undefined) {
        setParts.push(`html = $${values.length + 1}`);
        values.push(html);
      }
      if (design !== undefined) {
        setParts.push(`design = $${values.length + 1}`);
        values.push(design);
      }
      if (thumbnail !== undefined) {
        setParts.push(`thumbnail = $${values.length + 1}`);
        values.push(thumbnail);
      }
      if (category !== undefined) {
        setParts.push(`category = $${values.length + 1}`);
        values.push(category);
      }

      if (setParts.length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }

      setParts.push('updated_at = NOW()');
      values.push(templateId);

      const queryText = `UPDATE admin_templates SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`;
      
      const result = await pool.query(queryText, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error updating admin template:", err);
      res.status(500).json({ error: "Failed to update admin template" });
    }
  });

  // Delete admin template
  app.delete("/api/admin/templates/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const templateId = parseInt(req.params.id);

      // Check if template exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_templates WHERE id = ${templateId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Template not found" });
      }

      await db.execute(sql`
        DELETE FROM admin_templates WHERE id = ${templateId}
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting admin template:", err);
      res.status(500).json({ error: "Failed to delete admin template" });
    }
  });

  // ============================================
  // ADMIN CONTACTS API ROUTES
  // ============================================

  // Get all admin contacts
  app.get("/api/admin/contacts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const tagIdsParam = req.query.tagIds;
      
      let query = sql`
        SELECT 
          c.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'description', t.description,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as tags
        FROM admin_contacts c
        LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN admin_tags t ON ct.tag_id = t.id
      `;

      if (tagIdsParam) {
        const tagIds = Array.isArray(tagIdsParam)
          ? tagIdsParam.map((id: string) => parseInt(id))
          : [parseInt(tagIdsParam as string)];
        
        const validTagIds = tagIds.filter(id => !isNaN(id));
        
        if (validTagIds.length > 0) {
          // Use IN clause instead of ANY for better compatibility
          query = sql`
            SELECT 
              c.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', t.id,
                    'name', t.name,
                    'description', t.description,
                    'color', t.color
                  )
                ) FILTER (WHERE t.id IS NOT NULL),
                '[]'::json
              ) as tags
            FROM admin_contacts c
            LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
            LEFT JOIN admin_tags t ON ct.tag_id = t.id
            WHERE c.id IN (
              SELECT DISTINCT contact_id 
              FROM admin_contact_tags 
              WHERE tag_id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`, `)})
            )
            GROUP BY c.id
            ORDER BY c.created_at DESC
          `;
        }
      } else {
        query = sql`
          SELECT 
            c.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', t.id,
                  'name', t.name,
                  'description', t.description,
                  'color', t.color
                )
              ) FILTER (WHERE t.id IS NOT NULL),
              '[]'::json
            ) as tags
          FROM admin_contacts c
          LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
          LEFT JOIN admin_tags t ON ct.tag_id = t.id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `;
      }

      const result = await db.execute(query);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Error fetching admin contacts:", err);
      res.status(500).json({ error: "Failed to fetch admin contacts" });
    }
  });

  // Export admin contacts as CSV
  app.get("/api/admin/contacts/export", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const result = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(
            string_agg(DISTINCT t.name, ', '),
            ''
          ) as tags
        FROM admin_contacts c
        LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN admin_tags t ON ct.tag_id = t.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);

      const contacts = result.rows || [];

      // Helper function to escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Build CSV content
      const headers = ['email', 'first_name', 'last_name', 'status', 'tags', 'created_at'];
      const csvRows = [headers.join(',')];

      for (const contact of contacts) {
        const row = [
          escapeCsvValue(contact.email),
          escapeCsvValue(contact.first_name),
          escapeCsvValue(contact.last_name),
          escapeCsvValue(contact.status),
          escapeCsvValue(contact.tags),
          escapeCsvValue(contact.created_at ? new Date(contact.created_at).toISOString() : ''),
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts_export.csv"');
      res.send(csvContent);
    } catch (err) {
      console.error("Error exporting admin contacts:", err);
      res.status(500).json({ error: "Failed to export admin contacts" });
    }
  });

  // Get single admin contact by id
  app.get("/api/admin/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const contactId = parseInt(req.params.id);

      const result = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'description', t.description,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as tags
        FROM admin_contacts c
        LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN admin_tags t ON ct.tag_id = t.id
        WHERE c.id = ${contactId}
        GROUP BY c.id
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error fetching admin contact:", err);
      res.status(500).json({ error: "Failed to fetch admin contact" });
    }
  });

  // Create new admin contact
  app.post("/api/admin/contacts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { first_name, last_name, email, status, tags } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if contact already exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_contacts WHERE email = ${email} LIMIT 1
      `);

      if (existingResult.rows && existingResult.rows.length > 0) {
        return res.status(400).json({ error: "Contact with this email already exists" });
      }

      // Create contact
      const result = await db.execute(sql`
        INSERT INTO admin_contacts (first_name, last_name, email, status, created_at, updated_at)
        VALUES (${first_name || null}, ${last_name || null}, ${email}, ${status || 'pending'}, NOW(), NOW())
        RETURNING *
      `);

      const contact = result.rows[0];

      // Assign tags if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        for (const tagId of tags) {
          // Verify tag exists
          const tagResult = await db.execute(sql`
            SELECT * FROM admin_tags WHERE id = ${tagId} LIMIT 1
          `);

          if (tagResult.rows && tagResult.rows.length > 0) {
            // Check if already assigned
            const existingTagResult = await db.execute(sql`
              SELECT * FROM admin_contact_tags 
              WHERE contact_id = ${contact.id} AND tag_id = ${tagId} LIMIT 1
            `);

            if (!existingTagResult.rows || existingTagResult.rows.length === 0) {
              await db.execute(sql`
                INSERT INTO admin_contact_tags (contact_id, tag_id, created_at)
                VALUES (${contact.id}, ${tagId}, NOW())
              `);
            }
          }
        }
      }

      // Fetch contact with tags
      const contactWithTags = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'description', t.description,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as tags
        FROM admin_contacts c
        LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN admin_tags t ON ct.tag_id = t.id
        WHERE c.id = ${contact.id}
        GROUP BY c.id
      `);

      res.json(contactWithTags.rows[0]);
    } catch (err) {
      console.error("Error creating admin contact:", err);
      res.status(500).json({ error: "Failed to create admin contact" });
    }
  });

  // Update admin contact
  app.put("/api/admin/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const contactId = parseInt(req.params.id);
      const { first_name, last_name, email, status } = req.body;

      // Check if contact exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_contacts WHERE id = ${contactId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check if email is being changed and if new email already exists
      if (email && email !== existingResult.rows[0].email) {
        const emailCheckResult = await db.execute(sql`
          SELECT * FROM admin_contacts WHERE email = ${email} AND id != ${contactId} LIMIT 1
        `);

        if (emailCheckResult.rows && emailCheckResult.rows.length > 0) {
          return res.status(400).json({ error: "Contact with this email already exists" });
        }
      }

      const setParts: string[] = [];
      const values: any[] = [];

      if (first_name !== undefined) {
        setParts.push(`first_name = $${values.length + 1}`);
        values.push(first_name);
      }
      if (last_name !== undefined) {
        setParts.push(`last_name = $${values.length + 1}`);
        values.push(last_name);
      }
      if (email !== undefined) {
        setParts.push(`email = $${values.length + 1}`);
        values.push(email);
      }
      if (status !== undefined) {
        setParts.push(`status = $${values.length + 1}`);
        values.push(status);
      }
      setParts.push('updated_at = NOW()');

      if (setParts.length === 1) {
        return res.status(400).json({ error: "No update data provided" });
      }

      values.push(contactId);

      const queryText = `UPDATE admin_contacts SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`;

      const result = await pool.query(queryText, values);
      
      // Fetch contact with tags
      const contactWithTags = await db.execute(sql`
        SELECT 
          c.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'description', t.description,
                'color', t.color
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) as tags
        FROM admin_contacts c
        LEFT JOIN admin_contact_tags ct ON c.id = ct.contact_id
        LEFT JOIN admin_tags t ON ct.tag_id = t.id
        WHERE c.id = ${contactId}
        GROUP BY c.id
      `);

      res.json(contactWithTags.rows[0]);
    } catch (err) {
      console.error("Error updating admin contact:", err);
      res.status(500).json({ error: "Failed to update admin contact" });
    }
  });

  // Bulk delete admin contacts (must be before single delete route)
  app.delete("/api/admin/contacts/bulk-delete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "Contact IDs array is required" });
      }

      // Validate all IDs are numbers
      const validIds = contactIds.filter(id => typeof id === 'number' && !isNaN(id));
      if (validIds.length === 0) {
        return res.status(400).json({ error: "No valid contact IDs provided" });
      }

      // Delete contact tags first (bulk delete)
      await db
        .delete(adminContactTags)
        .where(inArray(adminContactTags.contactId, validIds));

      // Delete contacts (bulk delete)
      const deletedContacts = await db
        .delete(adminContacts)
        .where(inArray(adminContacts.id, validIds))
        .returning();

      res.json({ 
        success: true, 
        deletedCount: deletedContacts.length 
      });
    } catch (err) {
      console.error("Error bulk deleting admin contacts:", err);
      res.status(500).json({ error: "Failed to bulk delete admin contacts" });
    }
  });

  // Delete admin contact
  app.delete("/api/admin/contacts/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const contactId = parseInt(req.params.id);

      // Check if contact exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_contacts WHERE id = ${contactId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Delete contact tags first
      await db.execute(sql`
        DELETE FROM admin_contact_tags WHERE contact_id = ${contactId}
      `);

      // Delete contact
      await db.execute(sql`
        DELETE FROM admin_contacts WHERE id = ${contactId}
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting admin contact:", err);
      res.status(500).json({ error: "Failed to delete admin contact" });
    }
  });

  // Bulk import admin contacts
  app.post("/api/admin/contacts/bulk-import", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { contacts: contactsData } = req.body;

      if (!Array.isArray(contactsData)) {
        return res.status(400).json({ error: "Contacts array is required" });
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ email: string; error: string }>,
      };

      // Helper function to map status values from other platforms to our system
      // Allowed statuses in our system
      const ALLOWED_STATUSES = ['pending', 'active', 'confirmed', 'unsubscribed'] as const;
      type AllowedStatus = typeof ALLOWED_STATUSES[number];
      
      function mapImportStatus(status: string | undefined | null): AllowedStatus {
        if (!status) return "pending";
        
        const normalized = status.toLowerCase().trim();
        
        // Map to "active" - common values from other platforms meaning subscribed
        if (['subscribed', 'active', 'yes', 'true', '1', 'opted_in', 'opt_in', 'optin'].includes(normalized)) {
          return 'active';
        }
        
        // Map to "confirmed" - verified/double opt-in contacts
        if (['confirmed', 'verified', 'double_opt_in', 'double_optin'].includes(normalized)) {
          return 'confirmed';
        }
        
        // Map to "unsubscribed" - contacts who opted out
        if (['unsubscribed', 'cleaned', 'bounced', 'inactive', 'no', 'false', '0', 'opted_out', 'opt_out', 'optout', 'removed', 'spam', 'complained'].includes(normalized)) {
          return 'unsubscribed';
        }
        
        // Check if it's already one of our valid statuses (handles "pending" explicitly)
        if (ALLOWED_STATUSES.includes(normalized as AllowedStatus)) {
          return normalized as AllowedStatus;
        }
        
        // Unknown values default to pending
        return 'pending';
      }

      // Validate all contacts first
      const validContacts: Array<{ first_name: string | null; last_name: string | null; email: string; status: AllowedStatus; tags: number[] }> = [];
      const contactEmails: string[] = [];
      
      for (const contactData of contactsData) {
        const { first_name, last_name, email, status, tags } = contactData;
        
        if (!email) {
          results.errors.push({ email: email || "unknown", error: "Email is required" });
          continue;
        }

        validContacts.push({
          first_name: first_name || null,
          last_name: last_name || null,
          email: email.toLowerCase().trim(),
          status: mapImportStatus(status),
          tags: Array.isArray(tags) ? tags : [],
        });
        contactEmails.push(email.toLowerCase().trim());
      }

      if (validContacts.length === 0) {
        return res.json(results);
      }

      // Batch check for existing contacts (single query)
      const existingContacts = await db
        .select({ email: adminContacts.email })
        .from(adminContacts)
        .where(inArray(adminContacts.email, contactEmails));

      const existingEmailsSet = new Set(existingContacts.map(c => c.email.toLowerCase()));

      // Filter out existing contacts
      const contactsToCreate = validContacts.filter(c => !existingEmailsSet.has(c.email.toLowerCase()));
      results.skipped = validContacts.length - contactsToCreate.length;

      if (contactsToCreate.length === 0) {
        return res.json(results);
      }

      // Pre-fetch all tags (single query)
      const allTags = await db
        .select()
        .from(adminTags);
      const tagMap = new Map(allTags.map(tag => [tag.id, tag]));

      // Prepare contacts for bulk insert
      const contactsToInsert = contactsToCreate.map(contact => ({
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        status: contact.status,
      }));

      // Bulk insert contacts (single query)
      const insertedContacts = await db
        .insert(adminContacts)
        .values(contactsToInsert)
        .returning();

      results.imported = insertedContacts.length;

      // Prepare tag assignments for bulk insert
      const tagAssignments: Array<{ contactId: number; tagId: number }> = [];
      const contactEmailToIdMap = new Map(insertedContacts.map(c => [c.email.toLowerCase(), c.id]));

      for (const contactData of contactsToCreate) {
        const contactId = contactEmailToIdMap.get(contactData.email.toLowerCase());
        if (!contactId) continue;

        for (const tagId of contactData.tags) {
          if (tagMap.has(tagId)) {
            tagAssignments.push({ contactId, tagId });
          }
        }
      }

      // Bulk insert tag assignments (single query)
      if (tagAssignments.length > 0) {
        await db
          .insert(adminContactTags)
          .values(tagAssignments.map(ta => ({ contactId: ta.contactId, tagId: ta.tagId })))
          .onConflictDoNothing();
      }

      res.json(results);
    } catch (err) {
      console.error("Error bulk importing admin contacts:", err);
      res.status(500).json({ error: "Failed to bulk import admin contacts" });
    }
  });

  // Assign tag to admin contact
  app.post("/api/admin/contacts/:contactId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const contactId = parseInt(req.params.contactId);
      const tagId = parseInt(req.params.tagId);

      // Verify contact exists
      const contactResult = await db.execute(sql`
        SELECT * FROM admin_contacts WHERE id = ${contactId} LIMIT 1
      `);

      if (!contactResult.rows || contactResult.rows.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify tag exists
      const tagResult = await db.execute(sql`
        SELECT * FROM admin_tags WHERE id = ${tagId} LIMIT 1
      `);

      if (!tagResult.rows || tagResult.rows.length === 0) {
        return res.status(404).json({ error: "Tag not found" });
      }

      // Check if already assigned
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_contact_tags 
        WHERE contact_id = ${contactId} AND tag_id = ${tagId} LIMIT 1
      `);

      if (existingResult.rows && existingResult.rows.length > 0) {
        return res.json({ success: true, message: "Tag already assigned" });
      }

      // Assign tag
      await db.execute(sql`
        INSERT INTO admin_contact_tags (contact_id, tag_id, created_at)
        VALUES (${contactId}, ${tagId}, NOW())
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error assigning tag to admin contact:", err);
      res.status(500).json({ error: "Failed to assign tag to contact" });
    }
  });

  // Remove tag from admin contact
  app.delete("/api/admin/contacts/:contactId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const contactId = parseInt(req.params.contactId);
      const tagId = parseInt(req.params.tagId);

      // Verify contact exists
      const contactResult = await db.execute(sql`
        SELECT * FROM admin_contacts WHERE id = ${contactId} LIMIT 1
      `);

      if (!contactResult.rows || contactResult.rows.length === 0) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Verify tag exists
      const tagResult = await db.execute(sql`
        SELECT * FROM admin_tags WHERE id = ${tagId} LIMIT 1
      `);

      if (!tagResult.rows || tagResult.rows.length === 0) {
        return res.status(404).json({ error: "Tag not found" });
      }

      // Remove tag
      await db.execute(sql`
        DELETE FROM admin_contact_tags 
        WHERE contact_id = ${contactId} AND tag_id = ${tagId}
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error removing tag from admin contact:", err);
      res.status(500).json({ error: "Failed to remove tag from contact" });
    }
  });

  // ============================================
  // ADMIN CAMPAIGNS API ROUTES
  // ============================================

  // Get all admin campaigns
  app.get("/api/admin/newsletter/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const result = await db.execute(sql`
        SELECT * FROM admin_campaigns
        ORDER BY created_at DESC
      `);

      res.json(result.rows || []);
    } catch (err) {
      console.error("Error fetching admin campaigns:", err);
      res.status(500).json({ error: "Failed to fetch admin campaigns" });
    }
  });

  // Get single admin campaign by id
  app.get("/api/admin/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const campaignId = parseInt(req.params.id);

      const result = await db.execute(sql`
        SELECT * FROM admin_campaigns WHERE id = ${campaignId} LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error fetching admin campaign:", err);
      res.status(500).json({ error: "Failed to fetch admin campaign" });
    }
  });

  // Admin campaign analytics endpoint
  app.get("/api/admin/newsletter/campaigns/:id/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const campaignId = parseInt(req.params.id);

      const campaignResult = await db.execute(sql`
        SELECT * FROM admin_campaigns WHERE id = ${campaignId} LIMIT 1
      `);

      if (!campaignResult.rows || campaignResult.rows.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaign = campaignResult.rows[0];

      // Fetch template if campaign has one
      let template = null;
      if (campaign.template_id) {
        const templateResult = await db.execute(sql`
          SELECT * FROM admin_templates WHERE id = ${campaign.template_id} LIMIT 1
        `);
        if (templateResult.rows && templateResult.rows.length > 0) {
          template = templateResult.rows[0];
        }
      }

      // Calculate analytics metrics
      const sentCount = campaign.sent_count || 0;
      const deliveredCount = campaign.delivered_count || 0;
      const bounceCount = campaign.bounce_count || 0;
      const complaintCount = campaign.complaint_count || 0;
      const openCount = campaign.open_count || 0;
      const clickCount = campaign.click_count || 0;
      
      const deliveryRate = sentCount > 0 
        ? ((deliveredCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const bounceRate = sentCount > 0
        ? ((bounceCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const complaintRate = sentCount > 0
        ? ((complaintCount / sentCount) * 100).toFixed(2)
        : '0';
      
      const openRate = deliveredCount > 0 
        ? ((openCount / deliveredCount) * 100).toFixed(2)
        : '0';
      
      const clickRate = deliveredCount > 0
        ? ((clickCount / deliveredCount) * 100).toFixed(2)
        : '0';

      const clickThroughRate = openCount > 0
        ? ((clickCount / openCount) * 100).toFixed(2)
        : '0';

      // Convert snake_case to camelCase for frontend
      const campaignData = {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        purpose: campaign.purpose,
        tagIds: campaign.tag_ids || [],
        senderName: campaign.sender_name,
        senderEmail: campaign.sender_email,
        excludedContactIds: campaign.excluded_contact_ids || [],
        subject: campaign.subject,
        message: campaign.message,
        templateId: campaign.template_id,
        status: campaign.status,
        scheduledFor: campaign.scheduled_for,
        sentAt: campaign.sent_at,
        recipientCount: campaign.recipient_count,
      };

      res.json({
        campaign: campaignData,
        template,
        metrics: {
          sentCount,
          deliveredCount,
          bounceCount,
          complaintCount,
          recipientCount: campaign.recipient_count,
          openCount,
          clickCount,
          deliveryRate: parseFloat(deliveryRate),
          bounceRate: parseFloat(bounceRate),
          complaintRate: parseFloat(complaintRate),
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
          clickThroughRate: parseFloat(clickThroughRate),
          status: campaign.status,
          sentAt: campaign.sent_at,
          scheduledFor: campaign.scheduled_for,
        }
      });
    } catch (err) {
      console.error("Error fetching admin campaign analytics:", err);
      res.status(500).json({ error: "Failed to fetch admin campaign analytics" });
    }
  });

  // Create new admin campaign
  app.post("/api/admin/newsletter/campaigns", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const {
        title,
        description,
        purpose,
        senderName,
        senderEmail,
        excludedContactIds,
        excludedTagIds,
        subject,
        message,
        templateId,
        tagIds,
        status,
        scheduledFor,
        emailHtml,
        emailDesign,
      } = req.body;

      const campaignStatus = status || 'draft';

      // For non-draft campaigns, require all fields
      if (campaignStatus !== 'draft') {
        const hasRecipients = tagIds && tagIds.length > 0;
        if (!title || !hasRecipients || !senderName || !senderEmail || !subject || (!message && !templateId && !emailHtml)) {
          return res.status(400).json({ error: "Title, recipients (tags), sender name, sender email, subject, and message/template are required for non-draft campaigns" });
        }
      }

      // Get recipient count for the campaign (including tag-based exclusions)
      let recipientCount = 0;
      if (tagIds && tagIds.length > 0) {
        const tagIdsArray = Array.isArray(tagIds) ? tagIds : [tagIds];
        // Ensure tag IDs are integers (handle both string and number types)
        const validTagIds = tagIdsArray
          .map(id => typeof id === 'number' ? id : parseInt(id))
          .filter(id => !isNaN(id));

        if (validTagIds.length > 0) {
          // Get contacts with these tags
          const contactsResult = await db.execute(sql`
            SELECT DISTINCT c.*
            FROM admin_contacts c
            INNER JOIN admin_contact_tags ct ON c.id = ct.contact_id
            WHERE ct.tag_id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`, `)})
            AND c.status IN ('active', 'confirmed', 'pending')
          `);

          let allContacts = contactsResult.rows || [];
          
          // Filter out contacts that have any of the excluded tags
          const excludedTagIdsArray = excludedTagIds && Array.isArray(excludedTagIds) ? excludedTagIds : (excludedTagIds ? [excludedTagIds] : []);
          // Ensure excluded tag IDs are integers (handle both string and number types)
          const validExcludedTagIds = excludedTagIdsArray
            .map(id => typeof id === 'number' ? id : parseInt(id))
            .filter(id => !isNaN(id));
          
          if (validExcludedTagIds.length > 0) {
            // Get contact IDs that have any of the excluded tags
            const excludedContactsResult = await db.execute(sql`
              SELECT DISTINCT contact_id
              FROM admin_contact_tags
              WHERE tag_id IN (${sql.join(validExcludedTagIds.map(id => sql`${id}`), sql`, `)})
            `);
            const excludedContactIdsByTag = (excludedContactsResult.rows || []).map((r: any) => r.contact_id);
            allContacts = allContacts.filter((c: any) => !excludedContactIdsByTag.includes(c.id));
          }
          
          // Also filter out individually excluded contacts
          const excludedIds = excludedContactIds 
            ? (Array.isArray(excludedContactIds) ? excludedContactIds : [excludedContactIds])
              .map(id => typeof id === 'number' ? id : parseInt(id))
            : [];
          const finalRecipients = allContacts.filter((c: any) => !excludedIds.includes(c.id));
          recipientCount = finalRecipients.length;
        }
      }

      const tagIdsArray = tagIds && Array.isArray(tagIds) ? tagIds : (tagIds ? [tagIds] : []);
      const excludedIdsArray = excludedContactIds && Array.isArray(excludedContactIds) ? excludedContactIds : (excludedContactIds ? [excludedContactIds] : []);
      const excludedTagIdsArrayFinal = excludedTagIds && Array.isArray(excludedTagIds) ? excludedTagIds : (excludedTagIds ? [excludedTagIds] : []);

      const result = await db.execute(sql`
        INSERT INTO admin_campaigns (
          title, description, purpose, tag_ids, excluded_tag_ids, sender_name, sender_email,
          excluded_contact_ids, subject, message, template_id, status,
          scheduled_for, email_html, email_design, recipient_count,
          created_at, updated_at
        )
        VALUES (
          ${title || 'Untitled Campaign'},
          ${description || null},
          ${purpose || null},
          ${tagIdsArray.length > 0 ? sql`ARRAY[${sql.join(tagIdsArray.map(id => sql`${id}`), sql`, `)}]::integer[]` : sql`ARRAY[]::integer[]`},
          ${excludedTagIdsArrayFinal.length > 0 ? sql`ARRAY[${sql.join(excludedTagIdsArrayFinal.map(id => sql`${id}`), sql`, `)}]::integer[]` : sql`ARRAY[]::integer[]`},
          ${senderName || null},
          ${senderEmail || null},
          ${excludedIdsArray.length > 0 ? sql`ARRAY[${sql.join(excludedIdsArray.map(id => sql`${id}`), sql`, `)}]::integer[]` : sql`ARRAY[]::integer[]`},
          ${subject || null},
          ${message || ''},
          ${templateId || null},
          ${campaignStatus},
          ${scheduledFor ? new Date(scheduledFor).toISOString() : null},
          ${emailHtml || null},
          ${emailDesign || null},
          ${recipientCount},
          NOW(),
          NOW()
        )
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error creating admin campaign:", err);
      res.status(500).json({ error: "Failed to create admin campaign" });
    }
  });

  // Update admin campaign
  app.put("/api/admin/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const campaignId = parseInt(req.params.id);
      const {
        title,
        description,
        purpose,
        tagIds,
        excludedTagIds,
        senderName,
        senderEmail,
        excludedContactIds,
        subject,
        message,
        status,
        scheduledFor,
        templateId,
        emailHtml,
        emailDesign,
      } = req.body;

      // Check if campaign exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_campaigns WHERE id = ${campaignId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const existingCampaign = existingResult.rows[0];

      // Normalize tag arrays from DB (may be strings like "{1,2}" or already arrays)
      const normalizeTagArray = (arr: any): number[] => {
        if (!arr) return [];
        if (typeof arr === 'string') {
          // Handle Postgres array format like "{1,2,3}"
          const cleaned = arr.replace(/[{}]/g, '');
          if (!cleaned) return [];
          return cleaned.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        }
        if (Array.isArray(arr)) {
          return arr.map(id => typeof id === 'number' ? id : parseInt(id)).filter(n => !isNaN(n));
        }
        return [];
      };

      // Normalize existing campaign arrays
      existingCampaign.tag_ids = normalizeTagArray(existingCampaign.tag_ids);
      existingCampaign.excluded_tag_ids = normalizeTagArray(existingCampaign.excluded_tag_ids);
      existingCampaign.excluded_contact_ids = normalizeTagArray(existingCampaign.excluded_contact_ids);

      // Prevent updating sent campaigns
      if (existingCampaign.status === 'sent') {
        return res.status(400).json({ error: "Cannot update sent campaigns" });
      }

      // Normalize incoming arrays from request body
      const normalizedTagIds = normalizeTagArray(tagIds);
      const normalizedExcludedTagIds = normalizeTagArray(excludedTagIds);
      const normalizedExcludedContactIds = normalizeTagArray(excludedContactIds);

      // Get updated recipient count if tags or excluded tags changed
      let recipientCount = existingCampaign.recipient_count;
      const arraysEqual = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => b.includes(v));
      const tagsChanged = tagIds !== undefined && !arraysEqual(normalizedTagIds, existingCampaign.tag_ids);
      const excludedTagsChanged = excludedTagIds !== undefined;
      const shouldRecalculateRecipients = tagsChanged || excludedTagsChanged;

      if (shouldRecalculateRecipients) {
        const currentTagIds = tagIds !== undefined ? normalizedTagIds : existingCampaign.tag_ids;
        const currentExcludedTagIds = excludedTagIds !== undefined ? normalizedExcludedTagIds : existingCampaign.excluded_tag_ids;
        const currentExcludedContactIds = excludedContactIds !== undefined ? normalizedExcludedContactIds : existingCampaign.excluded_contact_ids;
        
        if (currentTagIds.length > 0) {
          const contactsResult = await db.execute(sql`
            SELECT DISTINCT c.*
            FROM admin_contacts c
            INNER JOIN admin_contact_tags ct ON c.id = ct.contact_id
            WHERE ct.tag_id IN (${sql.join(currentTagIds.map((id: number) => sql`${id}`), sql`, `)})
            AND c.status IN ('active', 'confirmed', 'pending')
          `);

          let allContacts = contactsResult.rows || [];
          
          // Filter out contacts that have any of the excluded tags
          if (currentExcludedTagIds.length > 0) {
            const excludedContactsResult = await db.execute(sql`
              SELECT DISTINCT contact_id
              FROM admin_contact_tags
              WHERE tag_id IN (${sql.join(currentExcludedTagIds.map((id: number) => sql`${id}`), sql`, `)})
            `);
            const excludedContactIdsByTag = (excludedContactsResult.rows || []).map((r: any) => r.contact_id);
            allContacts = allContacts.filter((c: any) => !excludedContactIdsByTag.includes(c.id));
          }
          
          // Also filter out individually excluded contacts
          const finalRecipients = allContacts.filter((c: any) => !currentExcludedContactIds.includes(c.id));
          recipientCount = finalRecipients.length;
        } else {
          recipientCount = 0;
        }
      }

      const setParts: string[] = [];
      const values: any[] = [];

      if (title !== undefined) {
        setParts.push(`title = $${values.length + 1}`);
        values.push(title);
      }
      if (description !== undefined) {
        setParts.push(`description = $${values.length + 1}`);
        values.push(description);
      }
      if (purpose !== undefined) {
        setParts.push(`purpose = $${values.length + 1}`);
        values.push(purpose);
      }
      if (tagIds !== undefined) {
        const tagIdsArray = tagIds && Array.isArray(tagIds) ? tagIds : (tagIds ? [tagIds] : []);
        setParts.push(`tag_ids = $${values.length + 1}::integer[]`);
        values.push(tagIdsArray);
      }
      if (excludedTagIds !== undefined) {
        const excludedTagIdsArray = excludedTagIds && Array.isArray(excludedTagIds) ? excludedTagIds : (excludedTagIds ? [excludedTagIds] : []);
        setParts.push(`excluded_tag_ids = $${values.length + 1}::integer[]`);
        values.push(excludedTagIdsArray);
      }
      if (senderName !== undefined) {
        setParts.push(`sender_name = $${values.length + 1}`);
        values.push(senderName);
      }
      if (senderEmail !== undefined) {
        setParts.push(`sender_email = $${values.length + 1}`);
        values.push(senderEmail);
      }
      if (excludedContactIds !== undefined) {
        const excludedIdsArray = excludedContactIds && Array.isArray(excludedContactIds) ? excludedContactIds : (excludedContactIds ? [excludedContactIds] : []);
        setParts.push(`excluded_contact_ids = $${values.length + 1}::integer[]`);
        values.push(excludedIdsArray);
      }
      if (subject !== undefined) {
        setParts.push(`subject = $${values.length + 1}`);
        values.push(subject);
      }
      if (message !== undefined) {
        setParts.push(`message = $${values.length + 1}`);
        values.push(message);
      }
      if (status !== undefined) {
        setParts.push(`status = $${values.length + 1}`);
        values.push(status);
      }
      if (scheduledFor !== undefined) {
        setParts.push(`scheduled_for = $${values.length + 1}`);
        values.push(scheduledFor ? new Date(scheduledFor).toISOString() : null);
      }
      if (templateId !== undefined) {
        setParts.push(`template_id = $${values.length + 1}`);
        values.push(templateId);
      }
      if (emailHtml !== undefined) {
        setParts.push(`email_html = $${values.length + 1}`);
        values.push(emailHtml);
      }
      if (emailDesign !== undefined) {
        setParts.push(`email_design = $${values.length + 1}`);
        values.push(emailDesign);
      }
      if (shouldRecalculateRecipients) {
        setParts.push(`recipient_count = $${values.length + 1}`);
        values.push(recipientCount);
      }
      setParts.push('updated_at = NOW()');

      if (setParts.length === 1) {
        return res.status(400).json({ error: "No update data provided" });
      }

      values.push(campaignId);

      const queryText = `UPDATE admin_campaigns SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`;

      const result = await pool.query(queryText, values);
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error updating admin campaign:", err);
      res.status(500).json({ error: "Failed to update admin campaign" });
    }
  });

  // Delete admin campaign
  app.delete("/api/admin/newsletter/campaigns/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const campaignId = parseInt(req.params.id);

      // Check if campaign exists
      const existingResult = await db.execute(sql`
        SELECT * FROM admin_campaigns WHERE id = ${campaignId} LIMIT 1
      `);

      if (!existingResult.rows || existingResult.rows.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaign = existingResult.rows[0];

      // Prevent deletion of sent campaigns
      if (campaign.status === 'sent') {
        return res.status(400).json({ error: "Cannot delete sent campaigns" });
      }

      // Delete campaign messages first
      await db.execute(sql`
        DELETE FROM admin_campaign_messages WHERE campaign_id = ${campaignId}
      `);

      // Delete campaign
      await db.execute(sql`
        DELETE FROM admin_campaigns WHERE id = ${campaignId}
      `);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting admin campaign:", err);
      res.status(500).json({ error: "Failed to delete admin campaign" });
    }
  });

  // Bulk delete admin campaigns
  app.post("/api/admin/newsletter/campaigns/bulk-delete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { campaignIds } = req.body;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: "Campaign IDs array is required" });
      }

      const ids = campaignIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));

      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid campaign IDs provided" });
      }

      // Delete campaign messages first
      await db.execute(sql`
        DELETE FROM admin_campaign_messages WHERE campaign_id = ANY(${ids})
      `);

      // Delete campaigns
      const result = await db.execute(sql`
        DELETE FROM admin_campaigns WHERE id = ANY(${ids})
      `);

      res.json({ 
        success: true, 
        deletedCount: result.rowCount || ids.length 
      });
    } catch (err) {
      console.error("Error bulk deleting admin campaigns:", err);
      res.status(500).json({ error: "Failed to bulk delete admin campaigns" });
    }
  });

  // Send admin campaign
  app.post("/api/admin/newsletter/campaigns/:id/send", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const campaignId = parseInt(req.params.id);

      // Get campaign
      const campaignResult = await db.execute(sql`
        SELECT * FROM admin_campaigns WHERE id = ${campaignId} LIMIT 1
      `);

      if (!campaignResult.rows || campaignResult.rows.length === 0) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaign = campaignResult.rows[0];
      
      // Normalize tag arrays from DB (may be strings like "{1,2}" or already arrays)
      const normalizeTagArray = (arr: any): number[] => {
        if (!arr) return [];
        if (typeof arr === 'string') {
          // Handle Postgres array format like "{1,2,3}"
          const cleaned = arr.replace(/[{}]/g, '');
          if (!cleaned) return [];
          return cleaned.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        }
        if (Array.isArray(arr)) {
          return arr.map(id => typeof id === 'number' ? id : parseInt(id)).filter(n => !isNaN(n));
        }
        return [];
      };
      
      // Pre-normalize campaign arrays for consistent handling
      campaign.tag_ids = normalizeTagArray(campaign.tag_ids);
      campaign.excluded_tag_ids = normalizeTagArray(campaign.excluded_tag_ids);
      campaign.excluded_contact_ids = normalizeTagArray(campaign.excluded_contact_ids);

      if (campaign.status === 'sent') {
        return res.status(400).json({ error: "Campaign has already been sent" });
      }

      // Check if campaign has email content
      if (!campaign.template_id && !campaign.email_html) {
        return res.status(400).json({ error: "Cannot send campaign without email content. Please select a template or design an email first." });
      }

      // Get email HTML
      let emailHtml = campaign.email_html;
      if (campaign.template_id && !emailHtml) {
        const templateResult = await db.execute(sql`
          SELECT html FROM admin_templates WHERE id = ${campaign.template_id} LIMIT 1
        `);
        if (templateResult.rows && templateResult.rows.length > 0) {
          emailHtml = templateResult.rows[0].html;
        }
      }

      if (!emailHtml) {
        return res.status(400).json({ error: "No email content available" });
      }

      // Get recipients based on tags (with tag-based exclusions)
      // Note: campaign.tag_ids, excluded_tag_ids, and excluded_contact_ids are already normalized above
      let recipients: any[] = [];
      if (campaign.tag_ids.length > 0) {
        const contactsResult = await db.execute(sql`
          SELECT DISTINCT c.*
          FROM admin_contacts c
          INNER JOIN admin_contact_tags ct ON c.id = ct.contact_id
          WHERE ct.tag_id IN (${sql.join(campaign.tag_ids.map((id: number) => sql`${id}`), sql`, `)})
          AND c.status IN ('active', 'confirmed', 'pending')
        `);

        let allContacts = contactsResult.rows || [];
        
        // Filter out contacts that have any of the excluded tags
        if (campaign.excluded_tag_ids.length > 0) {
          const excludedContactsResult = await db.execute(sql`
            SELECT DISTINCT contact_id
            FROM admin_contact_tags
            WHERE tag_id IN (${sql.join(campaign.excluded_tag_ids.map((id: number) => sql`${id}`), sql`, `)})
          `);
          const excludedContactIdsByTag = (excludedContactsResult.rows || []).map((r: any) => r.contact_id);
          allContacts = allContacts.filter((c: any) => !excludedContactIdsByTag.includes(c.id));
        }
        
        // Also filter out individually excluded contacts
        recipients = allContacts.filter((c: any) => !campaign.excluded_contact_ids.includes(c.id));
      }

      if (recipients.length === 0) {
        return res.status(400).json({ error: "No recipients found for this campaign" });
      }

      // Validate email configuration
      const configValidation = EmailService.validateConfiguration();
      if (!configValidation.isValid) {
        return res.status(500).json({
          error: configValidation.error || "Email service not configured"
        });
      }

      // Send emails
      let sentCount = 0;
      let deliveredCount = 0;
      let bounceCount = 0;
      let complaintCount = 0;
      const errors: string[] = [];

      // Determine base URL for unsubscribe links (use VITE_APP_URL for production)
      const baseUrl = process.env.VITE_APP_URL || 'https://hayc.gr';

      for (const recipient of recipients) {
        try {
          // Generate personalized unsubscribe link for this recipient (admin campaigns use contact ID 0 and websiteProgressId 0)
          const unsubscribeUrl = generateUnsubscribeUrl(
            baseUrl,
            (recipient as any).id,
            0, // Admin campaigns are not website-specific
            (recipient as any).email
          );
          
          // Inject unsubscribe footer into email HTML
          let finalEmailHtml = emailHtml as string;
          if (finalEmailHtml) {
            // Detect language from campaign or default to English
            const language = ((campaign as any).language === 'gr' || (campaign as any).language === 'el') ? 'gr' : 'en';
            const unsubscribeFooter = generateUnsubscribeFooter(unsubscribeUrl, language as 'en' | 'gr');
            
            // Insert footer before closing body tag, or append if no body tag
            if (finalEmailHtml.includes('</body>')) {
              finalEmailHtml = finalEmailHtml.replace('</body>', `${unsubscribeFooter}</body>`);
            } else {
              finalEmailHtml = finalEmailHtml + unsubscribeFooter;
            }
          }

          const result = await EmailService.sendEmail({
            to: (recipient as any).email,
            subject: (campaign as any).subject || 'No Subject',
            message: (campaign as any).message || 'No Message',
            html: finalEmailHtml as string,
            fromEmail: (campaign as any).sender_email || undefined,
            fromName: (campaign as any).sender_name || undefined,
          });

          if (result.success) {
            sentCount++;
            deliveredCount++;

            // Record message
            await db.execute(sql`
              INSERT INTO admin_campaign_messages (
                campaign_id, contact_id, email, status, sent_at, created_at
              )
              VALUES (
                ${campaignId}, ${recipient.id}, ${recipient.email}, 'sent', NOW(), NOW()
              )
            `);
          } else {
            errors.push(`${recipient.email}: ${result.error || 'Failed to send'}`);
          }
        } catch (err: any) {
          errors.push(`${recipient.email}: ${err.message || 'Failed to send'}`);
        }
      }

      // Update campaign status
      await db.execute(sql`
        UPDATE admin_campaigns
        SET 
          status = 'sent',
          sent_at = NOW(),
          sent_count = ${sentCount},
          delivered_count = ${deliveredCount},
          bounce_count = ${bounceCount},
          complaint_count = ${complaintCount},
          updated_at = NOW()
        WHERE id = ${campaignId}
      `);

      res.json({
        success: true,
        sentCount,
        deliveredCount,
        bounceCount,
        complaintCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("Error sending admin campaign:", err);
      res.status(500).json({ error: "Failed to send admin campaign" });
    }
  });

  // Remove tag from contact
  app.delete("/api/contacts/:contactId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.contactId);
      const tagId = parseInt(req.params.tagId);

      // Verify contact exists and get its website
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, contact.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to modify tags for this website" });
      }

      await storage.removeTagFromContact(contactId, tagId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing tag from contact:", err);
      res.status(500).json({ error: "Failed to remove tag from contact" });
    }
  });

  // Get contacts by tag
  app.get("/api/tags/:tagId/contacts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const tagId = parseInt(req.params.tagId);
      
      // Verify tag exists and get its website
      const tag = await storage.getTagById(tagId);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, tag.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this website's contacts" });
      }

      const contactsList = await storage.getContactsByTag(tagId);
      res.json(contactsList);
    } catch (err) {
      console.error("Error fetching contacts by tag:", err);
      res.status(500).json({ error: "Failed to fetch contacts by tag" });
    }
  });

  // Get tags for a contact
  app.get("/api/contacts/:contactId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const contactId = parseInt(req.params.contactId);
      
      // Verify contact exists and get its website
      const contact = await storage.getContactById(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check website ownership
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, contact.websiteProgressId))
        .limit(1);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
      if (!isAdmin && website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this website's data" });
      }

      const tagsList = await storage.getContactTags(contactId);
      res.json(tagsList);
    } catch (err) {
      console.error("Error fetching tags for contact:", err);
      res.status(500).json({ error: "Failed to fetch tags for contact" });
    }
  });

  // App Settings API routes
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const settings = await db.query.appSettings.findFirst();
      
      // If no settings exist, create default settings
      if (!settings) {
        const [newSettings] = await db
          .insert(appSettings)
          .values({ newsletterEnabled: true, tipsVisibleInUserDashboard: true })
          .returning();
        return res.json(newSettings);
      }

      res.json(settings);
    } catch (err) {
      console.error("Error fetching app settings:", err);
      res.status(500).json({ error: "Failed to fetch app settings" });
    }
  });

  app.patch("/api/settings/newsletter", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canEditSettings')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      // Get current settings
      let settings = await db.query.appSettings.findFirst();
      
      if (!settings) {
        // Create settings if they don't exist
        const [newSettings] = await db
          .insert(appSettings)
          .values({ newsletterEnabled: enabled, tipsVisibleInUserDashboard: true })
          .returning();
        return res.json(newSettings);
      }

      // Update existing settings
      const [updatedSettings] = await db
        .update(appSettings)
        .set({ newsletterEnabled: enabled, updatedAt: new Date() })
        .where(eq(appSettings.id, settings.id))
        .returning();

      res.json(updatedSettings);
    } catch (err) {
      console.error("Error updating newsletter settings:", err);
      res.status(500).json({ error: "Failed to update newsletter settings" });
    }
  });

  app.patch("/api/settings/tips-visible", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      const canUpdate = user && (hasPermission(user.role, 'canManageSettings') || hasPermission(user.role, 'canManageTips'));
      if (!canUpdate) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { visible } = req.body;
      if (typeof visible !== 'boolean') {
        return res.status(400).json({ error: "visible must be a boolean" });
      }

      let settings = await db.query.appSettings.findFirst();
      if (!settings) {
        const [newSettings] = await db
          .insert(appSettings)
          .values({ newsletterEnabled: true, tipsVisibleInUserDashboard: visible })
          .returning();
        return res.json(newSettings);
      }

      const [updatedSettings] = await db
        .update(appSettings)
        .set({ tipsVisibleInUserDashboard: visible, updatedAt: new Date() })
        .where(eq(appSettings.id, settings.id))
        .returning();

      res.json(updatedSettings);
    } catch (err) {
      console.error("Error updating tips visibility setting:", err);
      res.status(500).json({ error: "Failed to update tips visibility setting" });
    }
  });

  // Add this endpoint before httpServer creation
  app.post("/api/admin/sync-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }
      // Get all users with Stripe customer IDs
      const usersWithStripe = await db
        .select()
        .from(users)
        .where(sql`stripe_customer_id IS NOT NULL`);

      // Sync subscriptions for each user
      const results = await Promise.all(
        usersWithStripe.map(async (user) => {
          if (!user.stripeCustomerId) return null;
          try {
            const subscriptions = await syncStripeSubscriptions(
              user.stripeCustomerId,
              user.id,
            );
            return {
              userId: user.id,
              subscriptionCount: subscriptions.length,
              success: true,
            };
          } catch (error) {
            console.error(`Failed to sync user ${user.id}:`, error);
            return {
              userId: user.id,
              error: error instanceof Error ? error.message : "Unknown error",
              success: false,
            };
          }
        }),
      );
      res.json({ results });
    } catch (err) {
      console.error("Error syncing subscriptions:", err);
      res.status(500).json({ error: "Failed to sync subscriptions" });
    }
  });

  // Add new endpoint for syncing all subscriptions (preserves cancelled ones)
  app.post("/api/admin/sync-all-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }
      // Get all users with Stripe customer IDs
      const usersWithStripe = await db
        .select()
        .from(users)
        .where(sql`stripe_customer_id IS NOT NULL`);

      // Sync subscriptions for each user using the new function that preserves cancelled ones
      const results = await Promise.all(
        usersWithStripe.map(async (user) => {
          if (!user.stripeCustomerId) return null;
          try {
            const subscriptions = await syncAllStripeSubscriptions(
              user.stripeCustomerId,
              user.id,
            );
            return {
              userId: user.id,
              subscriptionCount: subscriptions.length,
              success: true,
            };
          } catch (error) {
            console.error(
              `Failed to sync all subscriptions for user ${user.id}:`,
              error,
            );
            return {
              userId: user.id,
              error: error instanceof Error ? error.message : "Unknown error",
              success: false,
            };
          }
        }),
      );
      res.json({ results });
    } catch (err) {
      console.error("Error syncing all subscriptions:", err);
      res.status(500).json({ error: "Failed to sync all subscriptions" });
    }
  });

  // Endpoint for syncing scheduled subscriptions
  app.post("/api/admin/sync-scheduled-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get all users with Stripe customer IDs
      const usersWithStripe = await db
        .select()
        .from(users)
        .where(sql`stripe_customer_id IS NOT NULL`);

      let totalSchedules = 0;
      const results = [];

      // Process each user
      for (const stripeUser of usersWithStripe) {
        if (!stripeUser.stripeCustomerId) continue;

        try {
          // Fetch subscription schedules from Stripe for this customer
          // Note: List operation doesn't include phase metadata, so we need to retrieve each schedule individually
          const schedulesList = await stripe.subscriptionSchedules.list({
            customer: stripeUser.stripeCustomerId,
          });

          for (const schedulePreview of schedulesList.data) {
            // Only process schedules that haven't created a subscription yet
            // Skip if: schedule has been released, or already has a subscription attached
            if (schedulePreview.released_subscription || schedulePreview.subscription) {
              console.log(`Skipping schedule ${schedulePreview.id} - already has subscription`);
              continue;
            }
            
            // Only process not_started schedules to avoid conflicts with active schedules
            if (schedulePreview.status === 'not_started') {
              try {
                // Retrieve full schedule object to access phase metadata
                const schedule = await stripe.subscriptionSchedules.retrieve(schedulePreview.id);
                
                // For scheduled subscriptions that haven't started yet, use the first phase
                // This represents the subscription that will be created when the schedule activates
                const targetPhase = schedule.phases[0];
                
                if (!targetPhase || !targetPhase.items || targetPhase.items.length === 0) {
                  console.warn(`No items in schedule phases for schedule ${schedule.id}`);
                  continue;
                }

                // Extract price info - handle both string ID and expanded object cases
                const priceData = targetPhase.items[0].price;
                let priceId: string;
                let priceObject: any = null;
                
                // Check if price is already expanded as an object or just a string ID
                if (typeof priceData === 'object' && priceData !== null && 'id' in priceData) {
                  // Price is expanded - extract ID and use the full object
                  priceId = priceData.id;
                  priceObject = priceData;
                  console.log(`Price already expanded for schedule ${schedule.id}: ${priceId}`);
                } else {
                  // Price is just a string ID
                  priceId = priceData as string;
                  console.log(`Price is string ID for schedule ${schedule.id}: ${priceId}`);
                }

                // Determine tier/add-on and billing period from price ID
                let tier = null;
                let productId = null;
                let productType: 'plan' | 'addon' = 'plan';
                let billingPeriod: 'monthly' | 'yearly' = 'monthly';
                let actualPrice = null;
                let websiteProgressId = null;
                
                // Get the actual price from the schedule (may be discounted)
                if (priceObject && 'unit_amount' in priceObject) {
                  // We have the expanded price object
                  actualPrice = priceObject.unit_amount;
                  if ('recurring' in priceObject && priceObject.recurring && 'interval' in priceObject.recurring) {
                    billingPeriod = priceObject.recurring.interval === 'year' ? 'yearly' : 'monthly';
                  }
                  console.log(`Price extracted from expanded object: ${actualPrice} ${priceObject.currency || ''} (${billingPeriod})`);
                } else {
                  // Price not expanded, fetch it from Stripe
                  console.log(`Fetching price from Stripe: ${priceId}`);
                  try {
                    const fetchedPrice = await stripe.prices.retrieve(priceId);
                    actualPrice = fetchedPrice.unit_amount;
                    if (fetchedPrice.recurring) {
                      billingPeriod = fetchedPrice.recurring.interval === 'year' ? 'yearly' : 'monthly';
                    }
                    console.log(`Fetched price: ${actualPrice} ${fetchedPrice.currency} (${billingPeriod})`);
                  } catch (priceError) {
                    console.error(`Failed to fetch price ${priceId}:`, priceError);
                  }
                }

                // First, try to find website from phase metadata (metadata is stored in phases, not on the schedule)
                if (targetPhase.metadata && targetPhase.metadata.website_domain) {
                  const websiteDomain = targetPhase.metadata.website_domain;
                  console.log(`Found website_domain in phase metadata: ${websiteDomain}`);
                  
                  const websites = await db
                    .select()
                    .from(websiteProgress)
                    .where(
                      and(
                        eq(websiteProgress.userId, stripeUser.id),
                        eq(websiteProgress.domain, websiteDomain)
                      )
                    )
                    .limit(1);
                  
                  if (websites.length > 0) {
                    websiteProgressId = websites[0].id;
                    console.log(`Linked schedule to website ${websiteProgressId} (domain: ${websiteDomain})`);
                  } else {
                    console.warn(`Website with domain ${websiteDomain} not found for user ${stripeUser.id}, skipping schedule ${schedule.id}`);
                    continue;
                  }
                }

                // Check if this is an add-on
                if (PRICE_TO_ADDON_MAP[priceId]) {
                  productType = 'addon';
                  productId = PRICE_TO_ADDON_MAP[priceId];
                  tier = productId; // For add-ons, tier is the add-on ID (e.g., "analytics", "premium_email")
                  console.log(`Found add-on schedule: ${schedule.id} (${productId})`);

                  // If we don't have a website from metadata, fall back to latest website
                  if (!websiteProgressId) {
                    const userWebsites = await db
                      .select()
                      .from(websiteProgress)
                      .where(eq(websiteProgress.userId, stripeUser.id))
                      .orderBy(desc(websiteProgress.id))
                      .limit(1);
                    
                    if (userWebsites.length > 0) {
                      websiteProgressId = userWebsites[0].id;
                      console.log(`Linking add-on to latest website ${websiteProgressId} (no metadata provided)`);
                    } else {
                      console.warn(`No website found for user ${stripeUser.id}, skipping add-on schedule ${schedule.id}`);
                      continue;
                    }
                  }
                } else {
                  // First, try to match against standard subscription prices
                  for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
                    if (priceId === prices.monthly) {
                      tier = tierKey as SubscriptionTier;
                      productId = tierKey;
                      billingPeriod = 'monthly';
                      break;
                    } else if (priceId === prices.yearly) {
                      tier = tierKey as SubscriptionTier;
                      productId = tierKey;
                      billingPeriod = 'yearly';
                      break;
                    }
                  }
                  
                  // If no match found, check phase metadata for tier information
                  if (!tier && targetPhase.metadata && targetPhase.metadata.tier) {
                    tier = targetPhase.metadata.tier as SubscriptionTier;
                    productId = targetPhase.metadata.tier;
                    console.log(`Using tier from phase metadata: ${tier} (discounted price)`);
                  } else if (!tier) {
                    // Try to fetch the full price object from Stripe to get product info
                    try {
                      const fullPrice = await stripe.prices.retrieve(priceId, {
                        expand: ['product']
                      });
                      
                      // Check if the product has tier metadata
                      if (fullPrice.product && typeof fullPrice.product === 'object' && fullPrice.product.metadata && fullPrice.product.metadata.tier) {
                        tier = fullPrice.product.metadata.tier as SubscriptionTier;
                        productId = fullPrice.product.metadata.tier;
                        console.log(`Using tier from product metadata: ${tier} (discounted price)`);
                      }
                    } catch (priceError) {
                      console.error(`Failed to fetch price details for ${priceId}:`, priceError);
                    }
                  }
                  
                  if (!tier || !productId) {
                    console.warn(`Unable to determine tier for schedule ${schedule.id} with price ${priceId}`);
                    continue;
                  }
                }

                // Check if we already have this schedule in our database
                const existingSubscription = await db
                  .select()
                  .from(subscriptionsTable)
                  .where(eq(subscriptionsTable.stripeSubscriptionId, schedule.id))
                  .limit(1);

                if (existingSubscription.length > 0) {
                  console.log(`Schedule ${schedule.id} already exists in database, skipping`);
                  continue;
                }

                // Create subscription record with schedule ID as stripeSubscriptionId
                await storage.createSubscription({
                  userId: stripeUser.id,
                  productType,
                  productId,
                  tier,
                  status: 'active',
                  price: actualPrice, // Use the actual price from schedule (may be discounted)
                  vatNumber: null,
                  pdfUrl: null,
                  addOns: [],
                  billingPeriod: billingPeriod,
                  createdAt: new Date(schedule.created * 1000),
                  websiteProgressId, // Linked via metadata or fallback logic
                  stripeSubscriptionId: schedule.id, // Store schedule ID here
                });

                totalSchedules++;
                console.log(`Created subscription record for schedule ${schedule.id} (user ${stripeUser.id})`);
              } catch (error) {
                console.error(`Failed to process schedule ${schedule.id}:`, error);
              }
            }
          }

          results.push({
            userId: stripeUser.id,
            success: true,
          });
        } catch (error) {
          console.error(`Failed to sync scheduled subscriptions for user ${stripeUser.id}:`, error);
          results.push({
            userId: stripeUser.id,
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });
        }
      }

      res.json({
        message: `Synced ${totalSchedules} scheduled subscriptions`,
        totalSchedules,
        results,
      });
    } catch (err) {
      console.error("Error syncing scheduled subscriptions:", err);
      res.status(500).json({ error: "Failed to sync scheduled subscriptions" });
    }
  });

  // Admin website progress endpoints
  app.get("/api/admin/websites", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Filter websites based on account kind
      let websiteQuery = db
        .select({
          id: websiteProgress.id,
          userId: websiteProgress.userId,
          domain: websiteProgress.domain,
          projectName: websiteProgress.projectName,
          currentStage: websiteProgress.currentStage,
          userEmail: users.email,
          bonusEmails: websiteProgress.bonusEmails,
          bonusEmailsExpiry: websiteProgress.bonusEmailsExpiry,
          bookingEnabled: websiteProgress.bookingEnabled,
        })
        .from(websiteProgress)
        .leftJoin(users, eq(websiteProgress.userId, users.id));

      // Customer users only see their own websites (always allowed)
      // Staff users see all websites ONLY if they have canViewWebsites permission
      if (user.accountKind === AccountKind.CUSTOMER) {
        websiteQuery = websiteQuery.where(eq(websiteProgress.userId, user.id));
      } else if (user.accountKind === AccountKind.STAFF) {
        // Staff must have permission to view websites
        if (!hasPermission(user.role, 'canViewWebsites')) {
          return res.status(403).json({ error: "Not authorized" });
        }
      }

      const websites = await websiteQuery;

      // Get the selected_template_id and status for each website
      // Use a subquery to get the most recent record for each websiteProgressId
      const onboardingFormRows = await db
        .select({
          websiteProgressId: onboardingFormResponses.websiteProgressId,
          selectedTemplateId: onboardingFormResponses.selectedTemplateId,
          status: onboardingFormResponses.status,
        })
        .from(onboardingFormResponses)
        .where(
          inArray(
            onboardingFormResponses.websiteProgressId,
            websites.map(w => w.id)
          )
        )
        .orderBy(desc(onboardingFormResponses.id));

      // Create maps, keeping only the most recent record for each websiteProgressId
      // Since we ordered by ID descending, the first occurrence will be the most recent
      const templateIdMap = new Map();
      const statusMap = new Map();
      for (const row of onboardingFormRows) {
        // Only set if not already set (first occurrence is most recent due to ordering)
        if (!statusMap.has(row.websiteProgressId)) {
          templateIdMap.set(row.websiteProgressId, row.selectedTemplateId);
          statusMap.set(row.websiteProgressId, row.status);
        }
      }

      // Get stages and subscription status for each website
      const websitesWithStages = await Promise.all(
        websites.map(async (website) => {
          const stages = await db
            .select()
            .from(websiteStages)
            .where(eq(websiteStages.websiteProgressId, website.id))
            .orderBy(websiteStages.stageNumber);

          // Get subscription for this website (plan subscription)
          // First try to get an active subscription, if not found get the most recent one
          const activeSubscription = await db
            .select()
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.websiteProgressId, website.id),
                eq(subscriptionsTable.productType, 'plan'),
                eq(subscriptionsTable.status, 'active')
              )
            )
            .limit(1)
            .then(rows => rows[0] || null);

          const subscription = activeSubscription || await db
            .select()
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.websiteProgressId, website.id),
                eq(subscriptionsTable.productType, 'plan')
              )
            )
            .orderBy(desc(subscriptionsTable.createdAt))
            .limit(1)
            .then(rows => rows[0] || null);

          return { 
            ...website, 
            stages,
            subscriptionStatus: subscription?.status || null,
            subscriptionTier: subscription?.tier || null,
            selectedTemplateId: templateIdMap.get(website.id) || null,
            onboardingStatus: statusMap.get(website.id) || null
          };
        }),
      );

      // Disable caching to ensure fresh data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json({ websites: websitesWithStages });
    } catch (err) {
      console.error("Error fetching websites:", err);
      res.status(500).json({ error: "Failed to fetch websites" });
    }
  });

  app.get("/api/admin/websites/:websiteId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.websiteId);

      // Fetch the website with user information
      const website = await db
        .select({
          id: websiteProgress.id,
          userId: websiteProgress.userId,
          domain: websiteProgress.domain,
          projectName: websiteProgress.projectName,
          currentStage: websiteProgress.currentStage,
          websiteLanguage: websiteProgress.websiteLanguage,
          media: websiteProgress.media,
          bookingEnabled: websiteProgress.bookingEnabled,
          userEmail: users.email,
        })
        .from(websiteProgress)
        .leftJoin(users, eq(websiteProgress.userId, users.id))
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Check if user has permission to view this website
      // Allow if: (1) user owns the website, OR (2) user is staff with canViewWebsites permission
      const ownsWebsite = website.userId === user.id;
      const hasViewPermission = user.accountKind === AccountKind.STAFF && hasPermission(user.role, 'canViewWebsites');
      
      if (!ownsWebsite && !hasViewPermission) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get stages for this website
      const stages = await db
        .select()
        .from(websiteStages)
        .where(eq(websiteStages.websiteProgressId, website.id))
        .orderBy(websiteStages.stageNumber);

      res.json({ ...website, stages });
    } catch (err) {
      console.error("Error fetching website:", err);
      res.status(500).json({ error: "Failed to fetch website" });
    }
  });

  app.patch("/api/admin/websites/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);
      const { domain, bookingEnabled } = req.body;

      const updates: Partial<{ domain: string; bookingEnabled: boolean; updatedAt: Date }> = {
        updatedAt: new Date(),
      };

      if (domain !== undefined) {
        if (typeof domain !== 'string' || domain.trim().length === 0) {
          return res.status(400).json({ error: "Domain must be a non-empty string" });
        }
        updates.domain = domain.trim();
      }

      if (bookingEnabled !== undefined) {
        if (typeof bookingEnabled !== 'boolean') {
          return res.status(400).json({ error: "bookingEnabled must be a boolean" });
        }
        updates.bookingEnabled = bookingEnabled;
      }

      if (Object.keys(updates).length <= 1) {
        return res.status(400).json({ error: "Provide at least one of: domain, bookingEnabled" });
      }

      const [updatedWebsite] = await db
        .update(websiteProgress)
        .set(updates)
        .where(eq(websiteProgress.id, websiteId))
        .returning();

      if (!updatedWebsite) {
        return res.status(404).json({ error: "Website not found" });
      }

      res.json(updatedWebsite);
    } catch (err) {
      console.error("Error updating website:", err);
      res.status(500).json({ error: "Failed to update website" });
    }
  });

  // Admin endpoint to grant bonus emails to a website
  app.post("/api/admin/websites/:id/bonus-emails", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);
      const { bonusEmails, expiryDate } = req.body;

      if (typeof bonusEmails !== 'number' || bonusEmails < 0) {
        return res.status(400).json({ error: "bonusEmails must be a positive number" });
      }

      if (!expiryDate) {
        return res.status(400).json({ error: "expiryDate is required" });
      }

      const expiry = new Date(expiryDate);
      if (isNaN(expiry.getTime())) {
        return res.status(400).json({ error: "Invalid expiryDate format" });
      }

      // Reject expiry dates in the past
      if (expiry.getTime() <= Date.now()) {
        return res.status(400).json({ error: "expiryDate must be in the future" });
      }

      // Update the website with bonus emails
      const [updatedWebsite] = await db
        .update(websiteProgress)
        .set({ 
          bonusEmails: bonusEmails,
          bonusEmailsExpiry: expiry,
          updatedAt: new Date()
        })
        .where(eq(websiteProgress.id, websiteId))
        .returning();

      if (!updatedWebsite) {
        return res.status(404).json({ error: "Website not found" });
      }

      res.json({ 
        success: true, 
        bonusEmails: updatedWebsite.bonusEmails,
        bonusEmailsExpiry: updatedWebsite.bonusEmailsExpiry
      });
    } catch (err) {
      console.error("Error setting bonus emails:", err);
      res.status(500).json({ error: "Failed to set bonus emails" });
    }
  });

  // Admin endpoint to clear bonus emails from a website
  app.delete("/api/admin/websites/:id/bonus-emails", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);

      // Clear bonus emails
      const [updatedWebsite] = await db
        .update(websiteProgress)
        .set({ 
          bonusEmails: 0,
          bonusEmailsExpiry: null,
          updatedAt: new Date()
        })
        .where(eq(websiteProgress.id, websiteId))
        .returning();

      if (!updatedWebsite) {
        return res.status(404).json({ error: "Website not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error clearing bonus emails:", err);
      res.status(500).json({ error: "Failed to clear bonus emails" });
    }
  });

  app.delete("/api/admin/websites/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);

      // Delete onboarding form responses first due to foreign key constraint
      await db
        .delete(onboardingFormResponses)
        .where(eq(onboardingFormResponses.websiteProgressId, websiteId));

      // Delete stages due to foreign key constraint
      await db
        .delete(websiteStages)
        .where(eq(websiteStages.websiteProgressId, websiteId));

      // Then delete the website progress
      await db.delete(websiteProgress).where(eq(websiteProgress.id, websiteId));

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting website progress:", err);
      res.status(500).json({ error: "Failed to delete website progress" });
    }
  });

  app.patch("/api/admin/websites/:id/stages/:number", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);
      const stageNumber = parseInt(req.params.number);
      const { status, waitingInfo, reminderInterval, sendEmail } = req.body;

      if (
        !["pending", "in-progress", "waiting", "completed"].includes(status)
      ) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Get website and stage info
      const website = await db
        .select({
          domain: websiteProgress.domain,
          projectName: websiteProgress.projectName,
          userEmail: users.email,
          username: users.username,
          language: users.language,
        })
        .from(websiteProgress)
        .leftJoin(users, eq(websiteProgress.userId, users.id))
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      const stage = await db
        .select()
        .from(websiteStages)
        .where(
          sql`website_progress_id = ${websiteId} AND stage_number = ${stageNumber}`,
        )
        .then((rows) => rows[0]);

      await db
        .update(websiteStages)
        .set({
          status,
          waiting_info: status === "waiting" ? waitingInfo : null,
          completedAt: status === "completed" ? new Date() : null,
          reminder_interval: parseInt(reminderInterval) || 1,
        })
        .where(
          sql`website_progress_id = ${websiteId} AND stage_number = ${stageNumber}`,
        );

      // Update currentStage based on completed stages
      const allStages = await db
        .select()
        .from(websiteStages)
        .where(eq(websiteStages.websiteProgressId, websiteId))
        .orderBy(websiteStages.stageNumber);

      if (allStages.length > 0) {
        // Find the first incomplete stage
        const firstIncompleteStage = allStages.find(
          (s) => s.status !== "completed"
        );

        let newCurrentStage: number;
        if (!firstIncompleteStage) {
          // All stages completed, set to the last stage number
          newCurrentStage = allStages.length;
        } else {
          // Set to the first incomplete stage number
          newCurrentStage = firstIncompleteStage.stageNumber;
        }

        await db
          .update(websiteProgress)
          .set({
            currentStage: newCurrentStage,
            updatedAt: new Date(),
          })
          .where(eq(websiteProgress.id, websiteId));
      }

      // If "Website Launch" stage is being completed, reset changesUsed to 0
      // This is because pre-launch changes shouldn't count towards the limit
      if (stage.title === "Website Launch" && status === "completed" && website) {
        const currentMonthYear = getCurrentMonthYear();
        
        // Get the user ID from the website
        const websiteWithUserId = await db
          .select({ userId: websiteProgress.userId })
          .from(websiteProgress)
          .where(eq(websiteProgress.id, websiteId))
          .then((rows) => rows[0]);

        if (websiteWithUserId) {
          // Find and update the changes record for this domain and month
          const changesRecord = await db
            .select()
            .from(websiteChanges)
            .where(
              sql`user_id = ${websiteWithUserId.userId} AND domain = ${website.domain} AND month_year = ${currentMonthYear}`,
            )
            .then((rows) => rows[0]);

          if (changesRecord) {
            // Reset changesUsed to 0
            await db
              .update(websiteChanges)
              .set({
                changesUsed: 0,
                updatedAt: new Date(),
              })
              .where(
                sql`id = ${changesRecord.id} AND user_id = ${websiteWithUserId.userId} AND domain = ${website.domain}`,
              );
          }
        }
      }

      // Send email notification if requested
      if (sendEmail && website) {
        await sendSubscriptionEmail("stage-update", {
          username: website.username,
          email: website.userEmail,
          domain: website.domain,
          projectName: website.projectName || website.domain,
          stageName: stage.title,
          oldStatus: stage.status,
          newStatus: status,
          waitingInfo: waitingInfo,
          language: website.language || "en",
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating website stage:", err);
      res.status(500).json({ error: "Failed to update website stage" });
    }
  });

  // Get onboarding form response for a website progress entry (Admin only)
  app.get("/api/admin/websites/:id/onboarding-form", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.id);

      // Get onboarding form response for this website progress entry
      const onboardingResponse = await db
        .select()
        .from(onboardingFormResponses)
        .where(eq(onboardingFormResponses.websiteProgressId, websiteId))
        .then((rows) => rows[0]);

      if (!onboardingResponse) {
        return res.status(404).json({ error: "No onboarding form response found for this website" });
      }

      res.json(onboardingResponse);
    } catch (err) {
      console.error("Error fetching onboarding form response:", err);
      res.status(500).json({ error: "Failed to fetch onboarding form response" });
    }
  });

  // Get customer's own onboarding form responses
  app.get("/api/websites/:id/onboarding-form", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.id);

      // Verify that this website belongs to the authenticated user
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      if (website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to view this website's onboarding form" });
      }

      // Get onboarding form response for this website progress entry
      const onboardingResponse = await db
        .select()
        .from(onboardingFormResponses)
        .where(eq(onboardingFormResponses.websiteProgressId, websiteId))
        .then((rows) => rows[0]);

      if (!onboardingResponse) {
        return res.status(404).json({ error: "No onboarding form response found for this website" });
      }

      res.json(onboardingResponse);
    } catch (err) {
      console.error("Error fetching customer onboarding form response:", err);
      res.status(500).json({ error: "Failed to fetch onboarding form response" });
    }
  });

  // Admin: Get all website invoices (for admin invoices tab)
  app.get("/api/admin/invoices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const invoices = await storage.getAllWebsiteInvoices();
      
      // Get website details for each invoice
      const invoicesWithWebsites = await Promise.all(
        invoices.map(async (invoice) => {
          const website = await db
            .select({
              id: websiteProgress.id,
              domain: websiteProgress.domain,
              projectName: websiteProgress.projectName,
              userId: websiteProgress.userId,
            })
            .from(websiteProgress)
            .where(eq(websiteProgress.id, invoice.websiteProgressId))
            .then((rows) => rows[0]);

          return {
            ...invoice,
            website,
          };
        })
      );

      res.json(invoicesWithWebsites);
    } catch (err) {
      console.error("Error fetching all invoices:", err);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Admin: Get invoices for a specific website
  app.get("/api/admin/websites/:websiteId/invoices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.websiteId);
      const invoices = await storage.getWebsiteInvoices(websiteId);

      res.json(invoices);
    } catch (err) {
      console.error("Error fetching website invoices:", err);
      res.status(500).json({ error: "Failed to fetch website invoices" });
    }
  });

  // Admin: Create/upload invoice for a website
  app.post("/api/admin/websites/:websiteId/invoices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const websiteId = parseInt(req.params.websiteId);
      const { title, description, pdfUrl, cloudinaryPublicId, amount, currency, issueDate, invoiceNumber } = req.body;

      if (!title || !pdfUrl || !cloudinaryPublicId) {
        return res.status(400).json({ error: "Title, PDF URL, and Cloudinary Public ID are required" });
      }

      const invoice = await storage.createWebsiteInvoice({
        websiteProgressId: websiteId,
        title,
        description: description || null,
        pdfUrl,
        cloudinaryPublicId,
        amount: amount ? parseInt(amount) : null,
        currency: currency || "eur",
        issueDate: issueDate ? new Date(issueDate) : null,
        invoiceNumber: invoiceNumber || null,
        uploadedBy: user.id,
      });

      res.json(invoice);
    } catch (err) {
      console.error("Error creating invoice:", err);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Admin: Delete an invoice
  app.delete("/api/admin/invoices/:invoiceId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const invoiceId = parseInt(req.params.invoiceId);
      await storage.deleteWebsiteInvoice(invoiceId);

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting invoice:", err);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Admin: Create manual draft invoice for any website
  app.post("/api/admin/invoices/create-draft", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageWebsites')) {
        return res.status(403).json({ success: false, error: "Not authorized" });
      }

      const { websiteProgressId, title, description, amount, currency } = req.body;

      if (!websiteProgressId) {
        return res.status(400).json({ success: false, error: "Website is required" });
      }

      const parsedWebsiteId = parseInt(websiteProgressId);
      if (isNaN(parsedWebsiteId)) {
        return res.status(400).json({ success: false, error: "Invalid website ID" });
      }

      if (!title) {
        return res.status(400).json({ success: false, error: "Title is required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: "Amount must be a valid number greater than 0" });
      }

      // Verify the website exists
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, parsedWebsiteId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ success: false, error: "Website not found" });
      }

      // Find an active subscription for this website (prefer plan over addon)
      const subscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.websiteProgressId, parsedWebsiteId),
            eq(subscriptionsTable.status, 'active')
          )
        );

      // Prefer plan subscription, fall back to first addon, or null
      const planSubscription = subscriptions.find(s => s.productType === 'plan');
      const subscriptionId = planSubscription?.id || subscriptions[0]?.id || null;

      const now = new Date();
      const amountInCents = Math.round(parsedAmount * 100);

      const invoiceResult = await db
        .insert(websiteInvoices)
        .values({
          websiteProgressId: parsedWebsiteId,
          subscriptionId: subscriptionId,
          paymentIntentId: null,
          title,
          description: description || null,
          amount: amountInCents,
          currency: (currency || 'EUR').toUpperCase(),
          status: 'DRAFT',
          issueDate: now,
          createdAt: now,
          pdfUrl: '',
          cloudinaryPublicId: '',
        })
        .returning();

      console.log(`✅ Manual DRAFT invoice created with ID: ${invoiceResult[0].id} for website ${website.domain}`);

      res.json({ 
        success: true, 
        invoice: invoiceResult[0],
        message: "Draft invoice created successfully"
      });
    } catch (err) {
      console.error("Error creating manual draft invoice:", err);
      res.status(500).json({ success: false, error: "Failed to create draft invoice" });
    }
  });

  // Admin: Create invoice with Wrapp.ai
  app.post("/api/admin/invoices/:invoiceId/create-with-wrapp", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    try {
      // Extract and validate invoiceId
      const invoiceId = parseInt(req.params.invoiceId);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ success: false, message: "Invalid invoice ID" });
      }

      console.log(`[Wrapp Invoice] Processing invoice ID: ${invoiceId}`);

      // Fetch the DRAFT invoice from database
      const [invoice] = await db
        .select()
        .from(websiteInvoices)
        .where(and(
          eq(websiteInvoices.id, invoiceId),
          eq(websiteInvoices.status, "DRAFT")
        ));

      if (!invoice) {
        console.error(`[Wrapp Invoice] Invoice ${invoiceId} not found or not in DRAFT status`);
        return res.status(404).json({ 
          success: false, 
          message: "Invoice not found or not in DRAFT status" 
        });
      }

      console.log(`[Wrapp Invoice] Found DRAFT invoice:`, {
        id: invoice.id,
        title: invoice.title,
        amount: invoice.amount,
        currency: invoice.currency
      });

      // Fetch website progress to get domain and user
      const [website] = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, invoice.websiteProgressId))
        .limit(1);

      if (!website) {
        throw new Error(`Website progress not found for invoice ${invoiceId}`);
      }

      console.log(`[Wrapp Invoice] Found website:`, {
        id: website.id,
        domain: website.domain,
        userId: website.userId
      });

      // Fetch user information
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, website.userId))
        .limit(1);

      if (!user) {
        throw new Error(`User not found for website ${website.id}`);
      }

      // Try to fetch onboarding form response for additional customer info
      const [onboarding] = await db
        .select()
        .from(onboardingFormResponses)
        .where(eq(onboardingFormResponses.websiteProgressId, website.id))
        .orderBy(desc(onboardingFormResponses.createdAt))
        .limit(1);

      // Fetch subscription related to this website for VAT
      const subscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.websiteProgressId, website.id));

      // Get VAT from subscription (prefer plan subscription, or first one with VAT)
      const planSubscription = subscriptions.find(s => s.productType === 'plan');
      const subscriptionWithVat = subscriptions.find(s => s.vatNumber);
      const subscriptionVat = planSubscription?.vatNumber || subscriptionWithVat?.vatNumber;
      const subscriptionWithAddress = subscriptions.find(s => s.city && s.street && s.number && s.postalCode);
      const subscriptionCity = planSubscription?.city || subscriptionWithAddress?.city;
      const subscriptionStreet = planSubscription?.street || subscriptionWithAddress?.street;
      const subscriptionNumber = planSubscription?.number || subscriptionWithAddress?.number;
      const subscriptionPostalCode = planSubscription?.postalCode || subscriptionWithAddress?.postalCode;
      const subscriptionInvoiceType = planSubscription?.invoiceType || "invoice";
      const subscriptionClassificationType = planSubscription?.classificationType;
      const subscriptionInvoiceTypeCode = planSubscription?.invoiceTypeCode;
      const subscriptionProductName = planSubscription?.productName;

      // Build customer object
      const customerName = onboarding?.contactName || onboarding?.businessName || user.username || user.email;
      const customerEmail = onboarding?.contactEmail || onboarding?.accountEmail || user.email;

      if (!customerName || !customerEmail) {
        throw new Error(`Insufficient customer information for invoice ${invoiceId}`);
      }

      const customer = {
        name: customerName,
        email: customerEmail,
        countryCode: "GR", // Default to Greece
        vat: subscriptionVat || user.vatNumber || undefined,
        city: subscriptionCity || undefined,
        street: subscriptionStreet || undefined,
        number: subscriptionNumber || undefined,
        postalCode: subscriptionPostalCode || undefined
      };

      console.log(`[Wrapp Invoice] Customer info:`, {
        name: customer.name,
        email: customer.email,
        vat: customer.vat
      });

      // Prepare data and call Wrapp service
      const wrappResponse = await wrappApiService.createInvoice({
        amount: invoice.amount || 0, // Already in cents from DB
        currency: invoice.currency || "EUR",
        title: invoice.title,
        description: invoice.description || "",
        customer: customer,
        invoiceType: subscriptionInvoiceType,
        classificationType: subscriptionClassificationType || undefined,
        invoiceTypeCode: subscriptionInvoiceTypeCode || undefined,
        productName: subscriptionProductName || undefined
      });

      console.log('[Create Invoice] Wrapp response:', wrappResponse);

      // Extract invoice_id from Wrapp response (can be 'id' or 'invoice_id')
      const wrappInvoiceId = wrappResponse.id || wrappResponse.invoice_id;

      if (!wrappInvoiceId) {
        throw new Error('Wrapp API did not return invoice_id');
      }

      console.log('[Create Invoice] Wrapp invoice ID:', wrappInvoiceId);

      // Update database with Wrapp invoice ID and mark as COMPLETED since creation was successful
      const updatedInvoices = await db
        .update(websiteInvoices)
        .set({
          wrappInvoiceId: wrappInvoiceId,  // Critical: Save for future Wrapp API calls
          status: 'COMPLETED',  // Mark as completed since Wrapp invoice creation was successful
          errorMessage: null // Clear any previous error
        })
        .where(eq(websiteInvoices.id, invoiceId))
        .returning();

      const updatedInvoice = updatedInvoices[0];

      if (!updatedInvoice) {
        throw new Error('Failed to update invoice in database');
      }

      console.log('[Create Invoice] Updated invoice in DB:', {
        id: updatedInvoice.id,
        wrappInvoiceId: updatedInvoice.wrappInvoiceId,
        status: updatedInvoice.status
      });

      // Verify it was saved
      if (!updatedInvoice.wrappInvoiceId) {
        throw new Error('Failed to save wrappInvoiceId to database');
      }

      // Return success response to frontend
      return res.json({
        success: true,
        message: 'Invoice created successfully',
        invoice: updatedInvoice
      });

    } catch (error: any) {
      console.error('[Create Invoice] Error:', error);

      // Extract invoiceId for error handling
      const invoiceId = parseInt(req.params.invoiceId);

      // Store error message but keep status as DRAFT so it can be retried
      if (!isNaN(invoiceId)) {
        try {
          await db
            .update(websiteInvoices)
            .set({
              errorMessage: error.message || 'Unknown error occurred'
            })
            .where(eq(websiteInvoices.id, invoiceId));

          console.log(`[Create Invoice] Stored error message for invoice ${invoiceId}, status remains DRAFT`);
        } catch (updateError: any) {
          console.error('[Create Invoice] Failed to update invoice error message:', updateError);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create invoice with Wrapp',
        error: error.message
      });
    }
  });

  // Admin: Generate PDF for Wrapp invoice
  app.post("/api/admin/invoices/:invoiceId/generate-pdf", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    try {
      const invoiceId = parseInt(req.params.invoiceId);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ success: false, message: "Invalid invoice ID" });
      }

      const { locale } = req.body || {};
      const pdfLocale = locale === 'en' ? 'en' : 'el';

      console.log(`[Generate PDF] Processing invoice ID: ${invoiceId}, locale: ${pdfLocale}`);

      // Fetch the invoice from database
      const [invoice] = await db
        .select()
        .from(websiteInvoices)
        .where(eq(websiteInvoices.id, invoiceId));

      if (!invoice) {
        return res.status(404).json({ 
          success: false, 
          message: "Invoice not found" 
        });
      }

      if (!invoice.wrappInvoiceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Invoice does not have a Wrapp invoice ID. Please create with Wrapp first." 
        });
      }

      console.log(`[Generate PDF] Found invoice with wrappInvoiceId: ${invoice.wrappInvoiceId}`);

      // Call Wrapp API to generate PDF
      const wrappResponse = await wrappApiService.generateInvoicePdf(
        invoice.wrappInvoiceId,
        pdfLocale
      );

      console.log('[Generate PDF] Wrapp response:', wrappResponse);

      return res.json({
        success: true,
        message: 'PDF generation started. Webhook will be sent upon completion.',
        response: wrappResponse
      });

    } catch (error: any) {
      console.error('[Generate PDF] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: error.message
      });
    }
  });

  // Admin: Cancel Wrapp Invoice
  app.post("/api/admin/invoices/:invoiceId/cancel-wrapp", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    try {
      const invoiceId = parseInt(req.params.invoiceId);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ success: false, message: "Invalid invoice ID" });
      }

      console.log(`[Cancel Wrapp Invoice] Processing invoice ID: ${invoiceId}`);

      // Fetch the invoice from database
      const [invoice] = await db
        .select()
        .from(websiteInvoices)
        .where(eq(websiteInvoices.id, invoiceId));

      if (!invoice) {
        return res.status(404).json({ 
          success: false, 
          message: "Invoice not found" 
        });
      }

      if (!invoice.wrappInvoiceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Invoice does not have a Wrapp invoice ID" 
        });
      }

      // Update invoice: clear wrappInvoiceId and set status to DRAFT
      await db
        .update(websiteInvoices)
        .set({
          wrappInvoiceId: null,
          status: 'DRAFT'
        })
        .where(eq(websiteInvoices.id, invoiceId));

      console.log(`[Cancel Wrapp Invoice] Invoice ${invoiceId} cancelled successfully`);

      return res.json({
        success: true,
        message: 'Wrapp invoice cancelled successfully'
      });

    } catch (error: any) {
      console.error('[Cancel Wrapp Invoice] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel Wrapp invoice',
        error: error.message
      });
    }
  });

  // Admin: Update invoice PDF and details
  app.patch("/api/admin/invoices/:invoiceId/pdf", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    try {
      const invoiceId = parseInt(req.params.invoiceId);
      if (isNaN(invoiceId)) {
        return res.status(400).json({ success: false, message: "Invalid invoice ID" });
      }

      const { pdfUrl, cloudinaryPublicId, title, description, amount, currency, issueDate, invoiceNumber } = req.body;

      if (!pdfUrl) {
        return res.status(400).json({ 
          success: false, 
          message: "PDF URL is required" 
        });
      }

      console.log(`[Update Invoice] Updating invoice ${invoiceId}`);

      // Fetch the invoice to verify it exists
      const [invoice] = await db
        .select()
        .from(websiteInvoices)
        .where(eq(websiteInvoices.id, invoiceId));

      if (!invoice) {
        return res.status(404).json({ 
          success: false, 
          message: "Invoice not found" 
        });
      }

      // Update invoice with PDF URL and any other provided fields
      const updateData: {
        pdfUrl: string;
        cloudinaryPublicId?: string;
        status?: string;
        title?: string;
        description?: string | null;
        amount?: number | null;
        currency?: string;
        issueDate?: Date | null;
        invoiceNumber?: string | null;
      } = {
        pdfUrl: pdfUrl
      };

      if (cloudinaryPublicId) {
        updateData.cloudinaryPublicId = cloudinaryPublicId;
      }

      if (title !== undefined) {
        updateData.title = title;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      if (amount !== undefined) {
        updateData.amount = amount ? parseInt(String(amount)) * 100 : null;
      }

      if (currency !== undefined) {
        updateData.currency = currency;
      }

      if (issueDate !== undefined) {
        updateData.issueDate = issueDate ? new Date(issueDate) : null;
      }

      if (invoiceNumber !== undefined) {
        updateData.invoiceNumber = invoiceNumber || null;
      }

      // Mark as COMPLETED if it was DRAFT
      if (invoice.status === 'DRAFT') {
        updateData.status = 'COMPLETED';
      }

      const [updatedInvoice] = await db
        .update(websiteInvoices)
        .set(updateData)
        .where(eq(websiteInvoices.id, invoiceId))
        .returning();

      console.log('[Update Invoice] ✅ Invoice updated successfully');

      return res.json({
        success: true,
        message: 'Invoice updated successfully',
        invoice: updatedInvoice
      });

    } catch (error: any) {
      console.error('[Update Invoice] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update invoice',
        error: error.message
      });
    }
  });

  // User: Get invoices for their own website
  app.get("/api/websites/:websiteId/invoices", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.websiteId);

      // Verify that this website belongs to the authenticated user
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      if (website.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to view this website's invoices" });
      }

      const invoices = await storage.getWebsiteInvoices(websiteId);

      res.json(invoices);
    } catch (err) {
      console.error("Error fetching website invoices:", err);
      res.status(500).json({ error: "Failed to fetch website invoices" });
    }
  });

  // Generate Cloudinary signature for signed uploads
  app.post("/api/cloudinary/signature", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
      const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
      
      if (!cloudinaryApiSecret || !cloudinaryApiKey) {
        console.error("Cloudinary credentials missing");
        return res.status(500).json({ error: "Server configuration error" });
      }

      // Extract parameters to sign from request body
      const paramsToSign = req.body.paramsToSign || {};
      
      console.log("[Cloudinary Signature] Params received:", paramsToSign);
      
      // Sort parameters alphabetically and create signature string
      const sortedParams = Object.keys(paramsToSign)
        .sort()
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');
      
      console.log("[Cloudinary Signature] String to sign:", sortedParams);
      
      const signatureString = `${sortedParams}${cloudinaryApiSecret}`;
      const signature = createHash("sha1").update(signatureString).digest("hex");

      console.log("[Cloudinary Signature] Generated signature:", signature);

      res.json({ 
        signature,
        api_key: cloudinaryApiKey
      });
    } catch (err) {
      console.error("Error generating Cloudinary signature:", err);
      res.status(500).json({ error: "Failed to generate signature" });
    }
  });

  // Get all media files from Cloudinary folder for a website
  app.get("/api/websites/:id/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.id);
      
      // Get user
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get website
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Allow if user owns the website OR if user is administrator
      if (website.userId !== req.user.id && user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized to view this website" });
      }

      // Get Cloudinary credentials
      const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
      const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim();
      const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();

      if (!cloudinaryApiSecret || !cloudinaryApiKey || !cloudinaryCloudName) {
        return res.status(500).json({ error: "Cloudinary configuration missing" });
      }

      const authString = Buffer.from(`${cloudinaryApiKey}:${cloudinaryApiSecret}`).toString('base64');
      // Remove .pending-onboarding suffix if present
      const cleanDomain = website.domain.replace('.pending-onboarding', '');
      const folderName = `Website Media/${user.email}/${cleanDomain}`;

      const mediaItems: Array<{url: string, publicId: string, name: string, previewUrl?: string, format?: string | null}> = [];
      const resourceTypes = ['image', 'video', 'raw'];

      // List all resources in the folder for each resource type
      for (const resourceType of resourceTypes) {
        try {
          const listResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/resources/${resourceType}/upload?prefix=${encodeURIComponent(folderName)}&max_results=500&context=true`,
            {
              method: "GET",
              headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (!listResponse.ok) {
            console.error(`Failed to list ${resourceType} files:`, await listResponse.text());
            continue;
          }

          const listResult = await listResponse.json();
          const resources = listResult.resources || [];

          for (const resource of resources) {
            // Extract filename - try multiple sources
            let fileName = resource.original_filename || resource.filename;
            if (!fileName && resource.public_id) {
              // Extract from public_id (last part after /)
              const publicIdParts = resource.public_id.split('/');
              const lastPart = publicIdParts[publicIdParts.length - 1];
              // If it has an extension, use it; otherwise try to get from format
              if (lastPart.includes('.')) {
                fileName = lastPart;
              } else if (resource.format) {
                fileName = `${lastPart}.${resource.format}`;
              } else {
                fileName = lastPart;
              }
            }
            if (!fileName) {
              fileName = 'Untitled';
            }

            // For images, use Cloudinary transformation to get thumbnail
            let previewUrl = resource.secure_url;
            if (resourceType === 'image' && resource.format) {
              // Generate a thumbnail URL using Cloudinary transformations
              previewUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/w_400,h_300,c_fill,q_auto,f_auto/${resource.public_id}`;
            }

            mediaItems.push({
              url: resource.secure_url,
              publicId: resource.public_id,
              name: fileName,
              previewUrl: previewUrl,
              format: resource.format || null
            });
          }
        } catch (error) {
          console.error(`Error listing ${resourceType} files:`, error);
        }
      }

      res.json({ media: mediaItems });
    } catch (err) {
      console.error("Error fetching media:", err);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Add media to website
  app.post("/api/websites/:id/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.id);
      
      // Get user role
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Verify that this website belongs to the authenticated user or user is admin
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Allow if user owns the website OR if user is administrator
      if (website.userId !== req.user.id && user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized to modify this website" });
      }

      const schema = z.object({
        url: z.string().url(),
        publicId: z.string(),
        name: z.string(),
      });

      const mediaItem = schema.parse(req.body);
      
      // Get current media array
      const currentMedia = (website.media as Array<{url: string, publicId: string, name: string}>) || [];
      
      // Add new media item
      const updatedMedia = [...currentMedia, mediaItem];
      
      // Update database
      await db
        .update(websiteProgress)
        .set({ media: updatedMedia })
        .where(eq(websiteProgress.id, websiteId));

      // Send admin notification email (non-blocking, only for non-admin uploads)
      console.log(`[Media Upload] User role: ${user.role}, checking if should send email...`);
      if (user.role !== UserRole.ADMINISTRATOR) {
        console.log(`[Media Upload] User is not admin, preparing email notification...`);
        try {
          const escapeHtml = (str: string) => 
            str.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');

          const adminEmailHtml = loadTemplate(
            "admin-media-upload-notification.html",
            {
              username: escapeHtml(user.username || user.email),
              email: escapeHtml(user.email),
              projectName: escapeHtml(website.projectName || website.domain),
              uploadDate: new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              fileName: escapeHtml(mediaItem.name),
              fileUrl: mediaItem.url.replace(/"/g, '&quot;'),
            },
            "en"
          );

          console.log(`[Media Upload] Sending email to development@hayc.gr...`);
          EmailService.sendEmail({
            to: "development@hayc.gr",
            subject: `New Media Upload - ${website.projectName || website.domain}`,
            message: `New media file "${mediaItem.name}" was uploaded by ${user.username || user.email} for project ${website.projectName || website.domain}.`,
            fromEmail: "noreply@hayc.gr",
            html: adminEmailHtml,
          }).then((result) => {
            if (result.success) {
              console.log(`[Media Upload] Email sent successfully! MessageId: ${result.messageId}`);
            } else {
              console.error(`[Media Upload] Email send failed: ${result.error}`);
            }
          }).catch((err) => console.error("Failed to send admin media notification:", err));
        } catch (emailError) {
          console.error("Error preparing admin media notification:", emailError);
        }
      } else {
        console.log(`[Media Upload] User is admin, skipping email notification`);
      }

      res.json({ success: true, media: updatedMedia });
    } catch (err) {
      console.error("Error adding media:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid media data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to add media" });
    }
  });

  // Delete media from website
  app.delete("/api/websites/:id/media/:publicId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.id);
      const publicId = req.params.publicId;
      
      // Get user role
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Verify that this website belongs to the authenticated user or user is admin
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId))
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Allow if user owns the website OR if user is administrator
      if (website.userId !== req.user.id && user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized to modify this website" });
      }

      // Get current media array
      const currentMedia = (website.media as Array<{url: string, publicId: string, name: string}>) || [];
      
      // Check if media item exists
      const mediaExists = currentMedia.some(item => item.publicId === publicId);
      if (!mediaExists) {
        return res.status(404).json({ error: "Media not found" });
      }

      // Validate Cloudinary configuration before making any changes
      const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
      const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim();
      const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();

      if (!cloudinaryApiSecret || !cloudinaryApiKey || !cloudinaryCloudName) {
        console.error("Cloudinary credentials missing");
        return res.status(500).json({ error: "Failed to delete media - missing configuration" });
      }

      // Delete from Cloudinary first using Admin API with Basic Auth
      try {

        // Use Basic Auth (API Key:API Secret encoded in base64)
        const authString = Buffer.from(`${cloudinaryApiKey}:${cloudinaryApiSecret}`).toString('base64');

        const deleteResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Basic ${authString}`,
              "Content-Type": "application/json"
            }
          }
        );

        const deleteResult = await deleteResponse.json();

        // Admin API returns { deleted: { public_id: 'ok' } } on success
        if (!deleteResult.deleted || Object.keys(deleteResult.deleted).length === 0) {
          console.error("Cloudinary deletion failed:", deleteResult);
          return res.status(500).json({ error: "Failed to delete media from storage" });
        }
      } catch (cloudinaryErr) {
        console.error("Error deleting from Cloudinary:", cloudinaryErr);
        return res.status(500).json({ error: "Failed to delete media from storage" });
      }

      // Only update database after successful Cloudinary deletion
      const updatedMedia = currentMedia.filter(item => item.publicId !== publicId);
      await db
        .update(websiteProgress)
        .set({ media: updatedMedia })
        .where(eq(websiteProgress.id, websiteId));

      res.json({ success: true, media: updatedMedia });
    } catch (err) {
      console.error("Error deleting media:", err);
      res.status(500).json({ error: "Failed to delete media" });
    }
  });

  app.patch("/api/user/language", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const schema = z.object({
        language: z.string().min(2).max(5),
      });

      const { language } = schema.parse(req.body);
      const updatedUser = await storage.updateUser(req.user.id, { language });

      // Remove sensitive information before sending
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (err) {
      console.error("Error updating language preference:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid language", details: err.errors });
      }
      res.status(500).json({ error: "Failed to update language preference" });
    }
  });

  app.patch("/api/user/tips-notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const schema = z.object({
        enabled: z.boolean(),
      });

      const { enabled } = schema.parse(req.body);
      const updatedUser = await storage.updateUser(req.user.id, {
        tipsEmailNotifications: enabled.toString(),
      });

      // Remove sensitive information before sending
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (err) {
      console.error("Error updating tips notifications preference:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid notification setting", details: err.errors });
      }
      res
        .status(500)
        .json({ error: "Failed to update notification preference" });
    }
  });

  app.patch("/api/user/phone", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const schema = z.object({
        phone: z.string().optional().nullable(),
      });

      const { phone } = schema.parse(req.body);

      // Validate phone number format if provided
      if (phone && phone.trim() !== "") {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.trim())) {
          return res.status(400).json({ error: "Invalid phone number format" });
        }
      }

      const updatedUser = await storage.updateUser(req.user.id, {
        phone: phone?.trim() || null,
      });

      // Remove sensitive information before sending
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (err) {
      console.error("Error updating phone number:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid phone number", details: err.errors });
      }
      res.status(500).json({ error: "Failed to update phone number" });
    }
  });

  // Add endpoint for sending test emails (admin only)
  app.post("/api/admin/send-test-email", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Check if the user is an administrator
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const schema = z.object({
        email: z.string().email(),
        templateType: z.enum([
          "purchased",
          "cancelled",
          "refunded",
          "failed",
          "card-expiring",
          "waiting",
          "registered",
          "resumed",
          "upgraded",
          "user-registered",
          "new-tip-notification",
          "review-verified-free-month",
          "stage-update",
          "stage-waiting-reminder",
          "website-change-recorded",
          "change-request-completed",
          "website-progress-created",
          "contact-form-email",
          "onboarding-form-confirmation",
          "password-reset-email",
          "admin-cancellation-notice",
          "admin-cancellation-notice-admin",
          "admin-change-request-notification",
          "admin-new-lead-notification",
          "admin-new-subscription-notification",
          "admin-onboarding-form-notification",
          "admin-review-check-notification",
          "admin-review-verified-notification",
          "admin-subscription-resumed-notification",
          "admin-subscription-upgrade-notification",
          "admin-website-progress-created",
        ]),
        language: z.string().min(2).max(5),
      });

      const { email, templateType, language } = schema.parse(req.body);

      // Sample data for each template type
      const mockWebsitesHtml = `
        <div style="margin: 25px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Your Websites</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li style="margin-bottom: 8px;">example.com</li>
            <li style="margin-bottom: 8px;">testbusiness.gr</li>
          </ul>
        </div>
      `;

      const mockData = {
        purchased: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          amount: "99.99",
          baseAmount: "79.99",
          currency: "EUR",
          startDate: new Date(),
          hasAddOns: true,
          addOns: [{ name: "Advanced Analytics", price: 20.0 }],
          addOnsHtml: `
            <div class="addon-item">
              <div class="price-row">
                <span>Advanced Analytics</span>
                <span>EUR 20.00</span>
              </div>
            </div>
          `,
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        cancelled: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          cancellationDate: new Date(),
          accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        refunded: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          amount: "99.99",
          currency: "EUR",
          refundDate: new Date(),
          transactionId: "txn_" + Math.random().toString(36).substring(2, 15),
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        failed: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          amount: "99.99",
          currency: "EUR",
          failureDate: new Date(),
          failureReason: "Card declined",
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        "card-expiring": {
          username: "Test User",
          email: email,
          lastFourDigits: "4242",
          expirationDate: "12/2025",
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        waiting: {
          username: "Test User",
          email: email,
          waitingMessage:
            "Your subscription is currently waiting for processing.",
          language: language,
        },
        registered: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          registrationDate: new Date().toLocaleDateString(),
          language: language,
        },
        resumed: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          amount: "99.99",
          currency: "EUR",
          resumeDate: new Date(),
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        upgraded: {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          upgradeDate: new Date(),
          nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          currency: "EUR",
          monthlySavings: "131.88",
          hasWebsites: true,
          websitesHtml: mockWebsitesHtml,
          language: language,
        },
        "user-registered": {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          registrationDate: new Date().toLocaleDateString(),
          language: language,
        },
        "new-tip-notification": {
          username: "Test User",
          email: email,
          tipTitle: "Sample Tip Title",
          tipPreview: "This is a preview of the tip content...",
          dashboardUrl: `${req.protocol}://${req.get("host")}/dashboard`,
          language: language,
        },
        "review-verified-free-month": {
          username: "Test User",
          email: email,
          plan: "Pro Plan",
          verificationDate: new Date().toLocaleDateString(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          isRefund: false,
          language: language,
        },
        "stage-update": {
          username: "Test User",
          email: email,
          domain: "example.com",
          stageName: "UI/UX Development",
          oldStatus: "pending",
          newStatus: "in-progress",
          waitingInfo: "We are now working on your website design",
          language: language,
        },
        "stage-waiting-reminder": {
          username: "Test User",
          email: email,
          stageName: "Content Collection",
          waitingInfo: "We need you to provide the content for your website",
          domain: "example.com",
          language: language,
        },
        "website-change-recorded": {
          username: "Test User",
          email: email,
          domain: "example.com",
          projectName: "My Awesome Website",
          changeDescription: "Updated homepage banner image",
          changesUsed: 1,
          changesAllowed: 2,
          remainingChanges: 1,
          recordedDate: new Date().toLocaleDateString(),
          language: language,
        },
        "change-request-completed": {
          username: "Test User",
          email: email,
          domain: "example.com",
          projectName: "My Awesome Website",
          changeDescription: "Updated homepage banner image and improved mobile responsiveness",
          completedDate: new Date().toLocaleDateString(),
          changeLogId: 123,
          language: language,
        },
        "website-progress-created": {
          username: "Test User",
          email: email,
          domain: "example.com",
          currentStage: 1,
          createdDate: new Date().toLocaleDateString(),
          language: language,
        },
        "contact-form-email": {
          name: "Test User",
          email: email,
          subject: "Test Contact Form Subject",
          message: "This is a test message from the contact form.",
          language: language,
        },
        "onboarding-form-confirmation": {
          contactName: "Test User",
          businessName: "Test Business",
          email: email,
          submissionId: "ONBOARD_TEST_123",
          submittedAt: new Date().toLocaleString(),
          language: language,
        },
        "password-reset-email": {
          username: "Test User",
          resetLink: `${getBaseUrl()}/reset-password?token=test_token_123`,
          language: language,
        },
        "admin-cancellation-notice": {
          username: "Test User",
          userId: 123,
          email: email,
          plan: "Pro Plan",
          cancellationDate: new Date().toLocaleDateString(),
          accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          reason: "Test cancellation reason",
          language: language,
        },
        "admin-cancellation-notice-admin": {
          username: "Test User",
          userId: 123,
          email: email,
          plan: "Pro Plan",
          cancellationDate: new Date().toLocaleDateString(),
          accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          reason: "Test cancellation reason",
          language: language,
        },
        "admin-change-request-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          domain: "example.com",
          changeDescription: "Updated homepage banner",
          changeDetails: "Changed the main banner image and updated the call-to-action button",
          submittedAt: new Date().toLocaleString(),
          language: language,
        },
        "admin-new-lead-notification": {
          name: "Test Prospect",
          email: "prospect@example.com",
          phone: "+30 123 456 7890",
          message: "Interested in the Pro plan for my business website",
          submittedAt: new Date().toLocaleString(),
          language: language,
        },
        "admin-new-subscription-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          plan: "Pro Plan",
          billingPeriod: "monthly",
          amount: "99.99",
          currency: "EUR",
          startDate: new Date().toLocaleDateString(),
          language: language,
        },
        "admin-onboarding-form-notification": {
          fullName: "Test User",
          businessName: "Test Business",
          email: email,
          submittedAt: new Date().toLocaleString(),
          dashboardUrl: `${process.env.VITE_APP_URL || 'https://hayc.gr'}/admin`,
          language: language,
        },
        "admin-review-check-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          reviewText: "Great service, very professional!",
          reviewDate: new Date().toLocaleDateString(),
          facebookUrl: "https://www.facebook.com/haycWebsites/reviews",
          trustpilotUrl: "https://www.trustpilot.com/review/hayc.gr",
          g2Url: "https://www.g2.com/products/hayc/reviews",
          requestDate: new Date().toLocaleDateString(),
          language: language,
        },
        "admin-review-verified-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          reviewText: "Great service, very professional!",
          verifiedDate: new Date().toLocaleDateString(),
          language: language,
        },
        "admin-subscription-resumed-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          plan: "Pro Plan",
          resumedDate: new Date().toLocaleDateString(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          language: language,
        },
        "admin-subscription-upgrade-notification": {
          username: "Test User",
          userId: 123,
          email: email,
          oldPlan: "Basic Plan",
          newPlan: "Pro Plan",
          upgradeDate: new Date().toLocaleDateString(),
          language: language,
        },
        "admin-website-progress-created": {
          username: "Test User",
          userId: 123,
          email: email,
          domain: "example.com",
          currentStage: 1,
          createdDate: new Date().toLocaleDateString(),
          language: language,
        },
      };

      // Send the test email
      await sendSubscriptionEmail(templateType, mockData[templateType]);

      res.json({
        success: true,
        message: `Test ${templateType} email sent to ${email}`,
      });
    } catch (err) {
      console.error("Error sending test email:", err);
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid request data", details: err.errors });
      }
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Admin subscription cancellation endpoint
  app.post("/api/admin/subscriptions/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscriptionId = parseInt(req.params.id);
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "Cancellation reason is required" });
      }

      // Get the subscription details
      const subscription = await db
        .select({
          id: subscriptionsTable.id,
          userId: subscriptionsTable.userId,
          tier: subscriptionsTable.tier,
          userEmail: users.email,
          username: users.username,
          language: users.language,
          stripeCustomerId: users.stripeCustomerId,
          websiteProgressId: subscriptionsTable.websiteProgressId,
        })
        .from(subscriptionsTable)
        .leftJoin(users, eq(subscriptionsTable.userId, users.id))
        .where(eq(subscriptionsTable.id, subscriptionId))
        .then((rows) => rows[0]);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      if (!subscription.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer ID found" });
      }

      // Get Stripe subscriptions for this customer
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: subscription.stripeCustomerId,
        status: "active",
      });

      // Find matching Stripe subscription by tier
      const stripeSubscription = stripeSubscriptions.data.find((stripeSub) => {
        const priceId = stripeSub.items.data[0]?.price.id;
        return (
          priceId ===
            SUBSCRIPTION_PRICES[subscription.tier as SubscriptionTier]
              ?.monthly ||
          priceId ===
            SUBSCRIPTION_PRICES[subscription.tier as SubscriptionTier]?.yearly
        );
      });

      if (!stripeSubscription) {
        return res.status(404).json({ error: "Stripe subscription not found" });
      }

      // Cancel the Stripe subscription
      await stripe.subscriptions.cancel(stripeSubscription.id);

      // Update local subscription status
      await db
        .update(subscriptionsTable)
        .set({
          status: "cancelled",
          cancellationReason: reason,
          accessUntil: new Date(stripeSubscription.current_period_end * 1000),
        })
        .where(eq(subscriptionsTable.id, subscriptionId));

      // Fetch website info if subscription is linked to a website
      let websiteDomain = null;
      let websiteProjectName = null;
      if (subscription.websiteProgressId) {
        const websiteProgressResult = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, subscription.websiteProgressId))
          .limit(1);
        
        if (websiteProgressResult.length > 0) {
          websiteDomain = websiteProgressResult[0].domain;
          websiteProjectName = websiteProgressResult[0].projectName;
        }
      }

      // Send cancellation email to the user
      await sendSubscriptionEmail("cancelled", {
        username: subscription.username,
        email: subscription.userEmail,
        plan: subscription.tier,
        cancellationDate: new Date(),
        accessUntil: new Date(stripeSubscription.current_period_end * 1000),
        language: subscription.language || "en",
        adminCancellation: true,
        cancellationReason: reason,
        domain: websiteDomain,
        projectName: websiteProjectName || websiteDomain,
      });

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-cancellation-notice-admin.html",
        {
          username: subscription.username,
          email: subscription.userEmail,
          plan: subscription.tier,
          cancellationDate: new Date().toLocaleDateString(),
          accessUntil: new Date(
            stripeSubscription.current_period_end * 1000,
          ).toLocaleDateString(),
          cancellationReason: reason,
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🚨 Subscription Cancelled (Admin Action) - Tasks Required for ${subscription.username}`,
        html: adminEmailHtml,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Scheduled subscription upgrade endpoint
  app.post("/api/subscriptions/:id/upgrade-scheduled", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriptionId = parseInt(req.params.id);
      const {
        targetBillingPeriod,
        vatNumber,
        invoiceType,
        scheduledStartDate,
      } = req.body;

      if (targetBillingPeriod !== "yearly") {
        return res
          .status(400)
          .json({ error: "Only upgrades to yearly billing are supported" });
      }

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser?.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: "User or Stripe customer not found" });
      }

      // Get the local subscription
      const localSubscription = await db
        .select()
        .from(subscriptionsTable)
        .where(and(
          eq(subscriptionsTable.id, subscriptionId),
          eq(subscriptionsTable.userId, currentUser.id)
        ))
        .then((rows) => rows[0]);

      if (!localSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const tier = localSubscription.tier as SubscriptionTier;
      const yearlyPriceId = SUBSCRIPTION_PRICES[tier]?.yearly;

      if (!yearlyPriceId) {
        return res
          .status(400)
          .json({ error: "Yearly price not found for this tier" });
      }

      // Get Stripe subscriptions for this customer with expanded data
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: currentUser.stripeCustomerId,
        status: "active",
        expand: ["data.items", "data.items.data.price"],
      });

      // Find matching Stripe subscription
      let stripeSubscription = null;
      let foundTier = null;

      for (const stripeSub of stripeSubscriptions.data) {
        const priceId = stripeSub.items.data[0]?.price.id;
        if (!priceId) continue;

        for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
          if (priceId === prices.monthly || priceId === prices.yearly) {
            if (tierKey === tier) {
              stripeSubscription = stripeSub;
              break;
            }
          }
        }
        if (stripeSubscription) break;
      }

      if (!stripeSubscription) {
        return res
          .status(404)
          .json({ error: "Active Stripe subscription not found" });
      }

      // Check current billing period
      const currentPriceId = stripeSubscription.items.data[0]?.price.id;
      const isCurrentlyMonthly =
        currentPriceId === SUBSCRIPTION_PRICES[tier]?.monthly;

      if (!isCurrentlyMonthly) {
        return res
          .status(400)
          .json({ error: "Can only upgrade monthly subscriptions to yearly" });
      }

      // Schedule the upgrade to happen at the end of current period
      const scheduledDate = new Date(scheduledStartDate);
      const currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000,
      );

      // Update the subscription to change at period end
      await stripe.subscriptions.update(stripeSubscription.id, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: yearlyPriceId,
          },
        ],
        proration_behavior: "none", // No immediate charge
        billing_cycle_anchor: Math.floor(scheduledDate.getTime() / 1000), // Start new billing cycle at scheduled date
      });

      // Update local subscription to reflect the scheduled change
      const yearlyPriceInCents = Math.round(subscriptionPlans[tier].yearlyPrice * 100);
      await db
        .update(subscriptionsTable)
        .set({
          billingPeriod: "yearly",
          vatNumber: vatNumber || null,
          invoiceType: invoiceType || "invoice",
          price: yearlyPriceInCents, // Update to yearly price in cents
        })
        .where(eq(subscriptionsTable.id, subscriptionId));

      // Send confirmation email to user
      await sendSubscriptionEmail("upgraded", {
        username: currentUser.username,
        email: currentUser.email,
        plan: tier,
        upgradeDate: scheduledDate,
        nextBillingDate: scheduledDate,
        currency: "EUR",
        monthlySavings: (
          subscriptionPlans[tier].price * 12 -
          subscriptionPlans[tier].yearlyPrice
        ).toFixed(2),
        language: currentUser.language || "en",
        isScheduled: true,
      });

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-subscription-upgrade-notification.html",
        {
          username: currentUser.username,
          email: currentUser.email,
          plan: tier,
          upgradeDate: scheduledDate.toLocaleDateString(),
          nextBillingDate: scheduledDate.toLocaleDateString(),
          currency: "EUR",
          monthlySavings: (
            subscriptionPlans[tier].price * 12 -
            subscriptionPlans[tier].yearlyPrice
          ).toFixed(2),
          isScheduled: true,
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `📅 Yearly Upgrade Scheduled - ${currentUser.username}`,
        html: adminEmailHtml,
      });

      res.json({
        success: true,
        message: "Upgrade scheduled successfully",
        scheduledStartDate: scheduledDate.toISOString(),
      });
    } catch (error: any) {
      console.error("Error scheduling upgrade:", error);
      res.status(500).json({
        error: "Failed to schedule upgrade",
        details: error.message,
      });
    }
  });

  // Validate coupon code endpoint - Returns discount details for a coupon
  app.post("/api/coupons/validate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { couponCode, yearlyAmount } = req.body;

      if (!couponCode || typeof couponCode !== "string") {
        return res.status(400).json({ error: "Coupon code is required" });
      }

      // Try to retrieve the coupon from Stripe
      let coupon;
      try {
        coupon = await stripe.coupons.retrieve(couponCode.trim().toUpperCase());
      } catch (stripeError: any) {
        // Also try with the original case
        try {
          coupon = await stripe.coupons.retrieve(couponCode.trim());
        } catch (e) {
          return res.status(404).json({ 
            error: "Invalid coupon code",
            valid: false 
          });
        }
      }

      // Check if coupon is valid
      if (!coupon.valid) {
        return res.status(400).json({ 
          error: "This coupon has expired or is no longer valid",
          valid: false 
        });
      }

      // Calculate discount amount
      let discountAmount = 0;
      let discountType: "percent" | "fixed" = "percent";
      let discountValue = 0;

      if (coupon.percent_off) {
        discountType = "percent";
        discountValue = coupon.percent_off;
        if (yearlyAmount) {
          discountAmount = (yearlyAmount * coupon.percent_off) / 100;
        }
      } else if (coupon.amount_off) {
        discountType = "fixed";
        discountValue = coupon.amount_off / 100; // Convert from cents to euros
        discountAmount = discountValue;
      }

      res.json({
        valid: true,
        couponId: coupon.id,
        name: coupon.name || coupon.id,
        discountType,
        discountValue,
        discountAmount,
        percentOff: coupon.percent_off || null,
        amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months || null,
      });
    } catch (error: any) {
      console.error("Error validating coupon:", error);
      res.status(500).json({
        error: "Failed to validate coupon",
        valid: false,
      });
    }
  });

  // Subscription upgrade preview endpoint - Shows proration details before upgrade
  app.get("/api/subscriptions/:id/upgrade-preview", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriptionId = parseInt(req.params.id);

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser?.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: "User or Stripe customer not found" });
      }

      // Get the local subscription
      const [localSubscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(and(
          eq(subscriptionsTable.id, subscriptionId),
          eq(subscriptionsTable.userId, currentUser.id)
        ));

      if (!localSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Use the stored stripeSubscriptionId to get the correct Stripe subscription
      let stripeSubscription = null;
      let foundTier = null;

      if (localSubscription.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            localSubscription.stripeSubscriptionId,
            {
              expand: ["items", "items.data.price"],
            }
          );

          // Find the tier by matching the price ID
          const priceId = stripeSubscription.items.data[0]?.price.id;
          if (priceId) {
            for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
              if (priceId === prices.monthly || priceId === prices.yearly) {
                foundTier = tierKey;
                break;
              }
            }
          }
        } catch (error) {
          console.error("Error retrieving Stripe subscription:", error);
        }
      }

      // Fallback: if we don't have stripeSubscriptionId or retrieval failed, search all subscriptions
      if (!stripeSubscription) {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: currentUser.stripeCustomerId,
          status: "active",
          expand: ["data.items", "data.items.data.price"],
        });

        for (const stripeSub of stripeSubscriptions.data) {
          const priceId = stripeSub.items.data[0]?.price.id;
          if (!priceId) continue;

          // For addons, check if this subscription matches by productId
          if (localSubscription.productType === "addon" && localSubscription.productId) {
            // Check if any item matches the addon (monthly or yearly price)
            const addonPriceIds = getAddonPriceIds(localSubscription.productId);
            if (addonPriceIds.length > 0 && stripeSub.items.data.some(item => addonPriceIds.includes(item.price.id))) {
              stripeSubscription = stripeSub;
              foundTier = localSubscription.tier;
              break;
            }
          } else {
            // For regular plans, match by price ID
            for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
              if (priceId === prices.monthly || priceId === prices.yearly) {
                // Also check if the tier matches the local subscription
                if (localSubscription.tier === tierKey) {
                  stripeSubscription = stripeSub;
                  foundTier = tierKey;
                  break;
                }
              }
            }
          }
          if (stripeSubscription) break;
        }
      }

      if (!stripeSubscription) {
        return res
          .status(404)
          .json({ error: "Active Stripe subscription not found" });
      }

      const actualTier = (foundTier || localSubscription.tier) as SubscriptionTier;

      // Check if currently on monthly
      const currentPriceId = stripeSubscription.items.data[0]?.price.id;
      let isCurrentlyMonthly = false;
      let yearlyPriceId: string | undefined;

      // For addons, check billing period from Stripe price or local subscription
      if (localSubscription.productType === "addon") {
        // Check billing period from the Stripe price object
        const currentPrice = stripeSubscription.items.data[0]?.price;
        if (currentPrice?.recurring?.interval) {
          isCurrentlyMonthly = currentPrice.recurring.interval === "month";
        } else {
          // Fallback to local subscription billing period
          isCurrentlyMonthly = localSubscription.billingPeriod === "monthly";
        }
        
        // Check if this addon has a yearly price ID defined in schema
        const addonYearlyConfig = localSubscription.productId ? ADDON_YEARLY_PRICE_MAP[localSubscription.productId] : undefined;
        yearlyPriceId = addonYearlyConfig?.priceId;
      } else {
        // For regular plans, check against SUBSCRIPTION_PRICES
        isCurrentlyMonthly = currentPriceId === SUBSCRIPTION_PRICES[actualTier]?.monthly;
        yearlyPriceId = SUBSCRIPTION_PRICES[actualTier]?.yearly;
      }

      if (!isCurrentlyMonthly) {
        return res
          .status(400)
          .json({ error: "Can only preview upgrade for monthly subscriptions" });
      }

      // Verify yearly price exists (for both plans and add-ons with yearly pricing)
      if (!yearlyPriceId) {
        // For addons without yearly price, return error
        if (localSubscription.productType === "addon") {
          return res
            .status(400)
            .json({ error: "Yearly pricing not available for this add-on" });
        }
        return res
          .status(400)
          .json({ error: "Yearly price not found for this tier" });
      }

      // For both plans and addons with yearly pricing, use Stripe's preview invoice
      let prorationCredit = 0;
      let yearlyCharge = 0;
      let daysRemaining = 0;
      let currency = "EUR";

      // Use Stripe's preview invoice for both plans and add-ons with yearly pricing
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentUser.stripeCustomerId,
        subscription: stripeSubscription.id,
        subscription_items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: yearlyPriceId!,
          },
        ],
        subscription_proration_behavior: "create_prorations",
        subscription_proration_date: Math.floor(Date.now() / 1000),
      });

      // Find the proration line items
      for (const line of upcomingInvoice.lines.data) {
        if (line.proration) {
          // Negative amount means credit
          if (line.amount < 0) {
            prorationCredit = Math.abs(line.amount) / 100; // Convert from cents to euros
          }
        } else {
          // This is the new yearly subscription charge
          yearlyCharge = line.amount / 100;
        }
      }

      // Calculate days remaining
      const currentPeriodEnd = stripeSubscription.current_period_end * 1000;
      const now = Date.now();
      daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd - now) / (1000 * 60 * 60 * 24)));

      // Net amount to pay
      const amountDue = upcomingInvoice.amount_due / 100;
      currency = upcomingInvoice.currency.toUpperCase();

      res.json({
        success: true,
        preview: {
          prorationCredit,
          yearlyCharge,
          amountDue,
          daysRemaining,
          currency: upcomingInvoice.currency.toUpperCase(),
        },
      });
    } catch (error: any) {
      console.error("Error previewing upgrade:", error);
      res.status(500).json({
        error: "Failed to preview upgrade",
        details: error.message,
      });
    }
  });

  // Subscription upgrade endpoint - Immediate upgrade with prorations
  app.post("/api/subscriptions/:id/upgrade", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriptionId = parseInt(req.params.id);
      const { targetBillingPeriod, vatNumber, invoiceType, couponCode } = req.body;

      if (targetBillingPeriod !== "yearly") {
        return res
          .status(400)
          .json({ error: "Only upgrades to yearly billing are supported" });
      }

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser?.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: "User or Stripe customer not found" });
      }

      // Get the local subscription
      const localSubscription = await db
        .select()
        .from(subscriptionsTable)
        .where(and(
          eq(subscriptionsTable.id, subscriptionId),
          eq(subscriptionsTable.userId, currentUser.id)
        ))
        .then((rows) => rows[0]);

      if (!localSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      console.log('[UPGRADE] Local subscription:', JSON.stringify({
        id: localSubscription.id,
        productType: localSubscription.productType,
        productId: localSubscription.productId,
        tier: localSubscription.tier,
      }));

      const tier = localSubscription.tier as SubscriptionTier;
      const isAddon = localSubscription.productType === "addon";

      // Get Stripe subscription - use stored stripeSubscriptionId first
      let stripeSubscription = null;
      let yearlyPriceId: string | undefined;
      let yearlyPriceInCents: number;

      if (localSubscription.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            localSubscription.stripeSubscriptionId,
            { expand: ["items", "items.data.price"] }
          );
        } catch (error) {
          console.error("Error retrieving Stripe subscription:", error);
        }
      }

      // Fallback: search all subscriptions
      if (!stripeSubscription) {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: currentUser.stripeCustomerId,
          status: "active",
          expand: ["data.items", "data.items.data.price"],
        });

        for (const stripeSub of stripeSubscriptions.data) {
          const priceId = stripeSub.items.data[0]?.price.id;
          if (!priceId) continue;

          if (isAddon && localSubscription.productId) {
            // For add-ons, match by any addon price ID (monthly or yearly)
            const addonPriceIds = getAddonPriceIds(localSubscription.productId);
            if (addonPriceIds.length > 0 && stripeSub.items.data.some(item => addonPriceIds.includes(item.price.id))) {
              stripeSubscription = stripeSub;
              break;
            }
          } else {
            // For regular plans, match by price ID
            for (const [tierKey, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
              if (priceId === prices.monthly || priceId === prices.yearly) {
                if (localSubscription.tier === tierKey) {
                  stripeSubscription = stripeSub;
                  break;
                }
              }
            }
          }
          if (stripeSubscription) break;
        }
      }

      if (!stripeSubscription) {
        return res
          .status(404)
          .json({ error: "Active Stripe subscription not found" });
      }

      // Check current billing period
      const currentPrice = stripeSubscription.items.data[0]?.price;
      const isCurrentlyMonthly = currentPrice?.recurring?.interval === "month";

      if (!isCurrentlyMonthly) {
        return res
          .status(400)
          .json({ error: "Can only upgrade monthly subscriptions to yearly" });
      }

      // Get the yearly price ID and price in cents
      if (isAddon && localSubscription.productId) {
        console.log('[UPGRADE] Looking up yearly price for addon:', localSubscription.productId);
        console.log('[UPGRADE] ADDON_YEARLY_PRICE_MAP keys:', Object.keys(ADDON_YEARLY_PRICE_MAP));
        console.log('[UPGRADE] ADDON_YEARLY_PRICE_MAP:', JSON.stringify(ADDON_YEARLY_PRICE_MAP));
        const addonYearlyConfig = ADDON_YEARLY_PRICE_MAP[localSubscription.productId];
        console.log('[UPGRADE] Found config:', addonYearlyConfig);
        if (!addonYearlyConfig) {
          return res
            .status(400)
            .json({ error: "Yearly pricing not available for this add-on" });
        }
        yearlyPriceId = addonYearlyConfig.priceId;
        yearlyPriceInCents = Math.round(addonYearlyConfig.yearlyPrice * 100);
      } else {
        yearlyPriceId = SUBSCRIPTION_PRICES[tier]?.yearly;
        if (!yearlyPriceId) {
          return res
            .status(400)
            .json({ error: "Yearly price not found for this tier" });
        }
        yearlyPriceInCents = Math.round(subscriptionPlans[tier].yearlyPrice * 100);
      }

      // Check if subscription has an existing schedule (from previous attempt)
      let existingSchedule = null;
      try {
        const schedules = await stripe.subscriptionSchedules.list({
          subscription: stripeSubscription.id,
          limit: 1,
        });
        if (schedules.data.length > 0) {
          existingSchedule = schedules.data[0];
        }
      } catch (scheduleError) {
        console.log(
          "No existing schedule found, proceeding with direct update",
        );
      }

      // If there's an existing schedule, cancel it first
      if (existingSchedule && existingSchedule.status !== "canceled") {
        await stripe.subscriptionSchedules.cancel(existingSchedule.id);
      }

      // Build subscription update options
      const subscriptionUpdateOptions: any = {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: yearlyPriceId,
          },
        ],
        proration_behavior: "create_prorations", // This will create credits/charges for the difference
        billing_cycle_anchor: "now", // Start new billing cycle immediately
      };

      // Apply coupon if provided
      if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
        // Validate coupon exists before applying
        try {
          let validCoupon;
          try {
            validCoupon = await stripe.coupons.retrieve(couponCode.trim().toUpperCase());
          } catch {
            validCoupon = await stripe.coupons.retrieve(couponCode.trim());
          }
          
          if (validCoupon && validCoupon.valid) {
            subscriptionUpdateOptions.discounts = [{ coupon: validCoupon.id }];
          }
        } catch (couponError: any) {
          console.log("Coupon not found or invalid, proceeding without discount:", couponError.message);
        }
      }

      // Immediately update the subscription to yearly billing with prorations
      const updatedSubscription = await stripe.subscriptions.update(
        stripeSubscription.id,
        subscriptionUpdateOptions,
      );

      // Update local subscription with VAT number, invoice type, and price
      await db
        .update(subscriptionsTable)
        .set({
          vatNumber: vatNumber || null,
          invoiceType: invoiceType || "invoice",
          billingPeriod: "yearly", // Update to reflect the immediate change
          price: yearlyPriceInCents, // Update to yearly price in cents
        })
        .where(eq(subscriptionsTable.id, subscriptionId));

      // Get updated subscriptions
      const updatedSubscriptions = await storage.getUserSubscriptions(
        currentUser.id,
      );

      // Calculate savings for email (handle both plans and add-ons)
      let monthlySavings: string;
      let planName: string;
      
      if (isAddon && localSubscription.productId) {
        const addonConfig = ADDON_YEARLY_PRICE_MAP[localSubscription.productId];
        const addon = availableAddOns.find(a => a.id === localSubscription.productId);
        const monthlyPrice = addon?.price || 10;
        const yearlyPrice = addonConfig?.yearlyPrice || monthlyPrice * 10;
        monthlySavings = (monthlyPrice * 12 - yearlyPrice).toFixed(2);
        planName = addon?.name || localSubscription.productId;
      } else {
        const plan = subscriptionPlans[tier];
        monthlySavings = (plan.price * 12 - plan.yearlyPrice).toFixed(2);
        planName = tier;
      }
      
      const nextBillingDate = new Date(
        updatedSubscription.current_period_end * 1000,
      );

      // Fetch website domain if subscription is linked to a website
      let websiteDomain = null;
      if (localSubscription.websiteProgressId) {
        const websiteProgressResult = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, localSubscription.websiteProgressId))
          .limit(1);
        
        if (websiteProgressResult.length > 0) {
          websiteDomain = websiteProgressResult[0].domain;
        }
      }

      // Send upgrade confirmation email to user
      await sendSubscriptionEmail("upgraded", {
        username: currentUser.username,
        email: currentUser.email,
        plan: planName,
        upgradeDate: new Date(),
        nextBillingDate: nextBillingDate,
        currency: "EUR",
        monthlySavings: monthlySavings,
        language: currentUser.language || "en",
        isScheduled: false, // Immediate upgrade, not scheduled
        isImmediate: true,
        domain: websiteDomain,
      });

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-subscription-upgrade-notification.html",
        {
          username: currentUser.username,
          email: currentUser.email,
          plan: planName,
          upgradeDate: new Date().toLocaleDateString(),
          nextBillingDate: nextBillingDate.toLocaleDateString(),
          currency: "EUR",
          monthlySavings: monthlySavings,
          isScheduled: false, // Immediate upgrade
          isImmediate: true,
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🚀 Yearly Upgrade Completed - ${currentUser.username}`,
        html: adminEmailHtml,
      });

      res.json({
        success: true,
        subscriptions: updatedSubscriptions,
        message: "Yearly upgrade completed successfully with immediate billing",
        upgradeDate: new Date().toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        prorationApplied: true,
      });
    } catch (error: any) {
      console.error("Error processing immediate upgrade:", error);

      // Handle specific Stripe errors
      if (error.type === "StripeInvalidRequestError") {
        if (error.message && error.message.includes("schedule")) {
          return res.status(400).json({
            error:
              "Unable to upgrade subscription due to existing schedule. Please contact support.",
            details: error.message,
          });
        }
      }

      res.status(500).json({
        error: "Failed to process upgrade",
        details: error.message,
      });
    }
  });

  // Legacy subscription upgrade request endpoint - sends notification to admin
  app.post("/api/subscriptions/:id/request-legacy-upgrade", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const subscriptionId = parseInt(req.params.id);

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get the subscription
      const subscription = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.id, subscriptionId),
            eq(subscriptionsTable.userId, currentUser.id)
          )
        )
        .then((rows) => rows[0]);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Verify it's a legacy subscription
      if (!subscription.isLegacy) {
        return res.status(400).json({ error: "This is not a legacy subscription" });
      }

      // Send admin notification email
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `💎 Legacy Subscriber Upgrade Request - ${currentUser.username}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Legacy Subscriber Wants to Upgrade to Yearly!</h2>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Customer Information:</h3>
              <p><strong>Name:</strong> ${currentUser.username}</p>
              <p><strong>Email:</strong> ${currentUser.email}</p>
              <p><strong>Phone:</strong> ${currentUser.phone || "Not provided"}</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0;">Current Subscription Details:</h3>
              <p><strong>Subscription ID:</strong> ${subscription.id}</p>
              <p><strong>Current Tier:</strong> ${subscription.tier || "N/A"}</p>
              <p><strong>Current Price:</strong> €${subscription.price ? (subscription.price / 100).toFixed(2) : "N/A"}/month</p>
              <p><strong>Billing Period:</strong> ${subscription.billingPeriod}</p>
              <p><strong>Status:</strong> ${subscription.status}</p>
              <p><strong>Stripe Subscription ID:</strong> ${subscription.stripeSubscriptionId || "N/A"}</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Action Required:</h3>
              <p>This customer has a special legacy price and wants to upgrade to yearly billing while maintaining their special pricing.</p>
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Review their current Stripe subscription</li>
                <li>Calculate appropriate yearly pricing (typically ~17% discount from 12x monthly)</li>
                <li>Create custom yearly price in Stripe if needed</li>
                <li>Contact customer with upgrade offer</li>
                <li>Process upgrade manually to preserve their special pricing</li>
              </ol>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated notification from your hayc platform.
            </p>
          </div>
        `,
      });

      res.json({
        success: true,
        message: "Upgrade request sent to team successfully",
      });
    } catch (error: any) {
      console.error("Error sending legacy upgrade request:", error);
      res.status(500).json({
        error: "Failed to send upgrade request",
        details: error.message,
      });
    }
  });

  // User feedback endpoint - sends feedback to admin
  app.post("/api/feedback", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { feedback } = req.body;

      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ error: "Feedback cannot be empty" });
      }

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Send admin notification email
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `💬 User Feedback - ${currentUser.username}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Feedback from User</h2>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">User Information:</h3>
              <p><strong>Name:</strong> ${currentUser.username}</p>
              <p><strong>Email:</strong> ${currentUser.email}</p>
              <p><strong>Phone:</strong> ${currentUser.phone || "Not provided"}</p>
              <p><strong>User ID:</strong> ${currentUser.id}</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0;">Feedback:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${feedback}</p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Submitted on: ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      });

      res.json({
        success: true,
        message: "Thank you for your feedback!",
      });
    } catch (error: any) {
      console.error("Error sending feedback:", error);
      res.status(500).json({
        error: "Failed to send feedback",
        details: error.message,
      });
    }
  });

  // Tier upgrade request endpoint - sends notification to admin
  app.post("/api/upgrade-request", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { requestedTier, currentTier, feature, message, websiteId } = req.body;

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get website name if websiteId is provided
      let websiteName = null;
      if (websiteId) {
        const website = await db
          .select()
          .from(websiteProgress)
          .where(eq(websiteProgress.id, websiteId))
          .then((rows) => rows[0]);
        
        if (website) {
          websiteName = website.websiteName;
        }
      }

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-tier-upgrade-request-notification.html",
        {
          username: currentUser.username,
          userId: currentUser.id,
          email: currentUser.email,
          currentTier: currentTier || "None",
          requestedTier: requestedTier,
          feature: feature,
          message: message || "No additional notes provided",
          websiteName: websiteName,
          requestDate: new Date().toLocaleDateString(),
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🚀 Tier Upgrade Request - ${currentUser.username} (${currentTier} → ${requestedTier})`,
        html: adminEmailHtml,
      });

      res.json({
        success: true,
        message: "Upgrade request sent successfully",
      });
    } catch (error: any) {
      console.error("Error processing upgrade request:", error);
      res.status(500).json({
        error: "Failed to send upgrade request",
        details: error.message,
      });
    }
  });

  // Verify review and apply coupon endpoint
  app.post("/api/admin/users/:id/verify-review", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || !hasPermission(adminUser.role, 'canManageUsers')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const userId = parseInt(req.params.id);
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res
          .status(400)
          .json({ error: "User has no Stripe customer ID" });
      }

      // Get user's active subscriptions
      const userSubscriptions = await storage.getUserSubscriptions(userId);
      const activeSubscriptions = userSubscriptions.filter(
        (sub) => sub.status === "active",
      );

      if (activeSubscriptions.length === 0) {
        return res
          .status(400)
          .json({ error: "User has no active subscription" });
      }

      // Get Stripe subscriptions for this customer
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        expand: ["data.items", "data.items.data.price"],
      });

      // Find all matching Stripe subscriptions and their corresponding prices
      const matchingSubscriptions = [];

      for (const stripeSub of stripeSubscriptions.data) {
        const priceId = stripeSub.items.data[0]?.price.id;
        if (!priceId) continue;

        // Find the tier for this price ID
        let tier: SubscriptionTier | undefined;
        let billingPeriod: "monthly" | "yearly" | undefined;

        for (const [t, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
          if (prices.monthly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "monthly";
            break;
          }
          if (prices.yearly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "yearly";
            break;
          }
        }

        if (tier && billingPeriod) {
          const plan = subscriptionPlans[tier];
          const price =
            billingPeriod === "monthly" ? plan.price : plan.yearlyPrice / 12; // Convert yearly to monthly for comparison

          matchingSubscriptions.push({
            stripeSubscription: stripeSub,
            tier,
            billingPeriod,
            monthlyPrice: price,
            yearlyPrice: plan.yearlyPrice,
          });
        }
      }

      if (matchingSubscriptions.length === 0) {
        return res
          .status(404)
          .json({ error: "No matching Stripe subscriptions found" });
      }

      // Separate monthly and yearly subscriptions
      const monthlySubscriptions = matchingSubscriptions.filter(
        (sub) => sub.billingPeriod === "monthly",
      );
      const yearlySubscriptions = matchingSubscriptions.filter(
        (sub) => sub.billingPeriod === "yearly",
      );

      // Find the cheapest monthly subscription
      const cheapestMonthly =
        monthlySubscriptions.length > 0
          ? monthlySubscriptions.reduce((cheapest, current) => {
              return current.monthlyPrice < cheapest.monthlyPrice
                ? current
                : cheapest;
            })
          : null;

      // Find the cheapest yearly subscription (converted to monthly price for comparison)
      const cheapestYearly =
        yearlySubscriptions.length > 0
          ? yearlySubscriptions.reduce((cheapest, current) => {
              return current.monthlyPrice < cheapest.monthlyPrice
                ? current
                : cheapest;
            })
          : null;

      let selectedSubscription = null;
      let actionType = null; // 'coupon' or 'refund'

      // Compare and decide which discount to apply
      if (cheapestMonthly && cheapestYearly) {
        // Both exist - compare prices and choose the cheaper option
        if (cheapestMonthly.monthlyPrice <= cheapestYearly.monthlyPrice) {
          selectedSubscription = cheapestMonthly;
          actionType = "coupon";
        } else {
          selectedSubscription = cheapestYearly;
          actionType = "refund";
        }
      } else if (cheapestMonthly) {
        // Only monthly exists
        selectedSubscription = cheapestMonthly;
        actionType = "coupon";
      } else if (cheapestYearly) {
        // Only yearly exists
        selectedSubscription = cheapestYearly;
        actionType = "refund";
      } else {
        return res
          .status(400)
          .json({ error: "No eligible subscriptions found" });
      }

      // Apply the selected action
      if (actionType === "refund") {
        // For yearly subscriptions, apply partial refund
        try {
          // Calculate refund amount (one month worth)
          const refundAmount = Math.round(
            (selectedSubscription.yearlyPrice / 12) * 100,
          ); // Convert to cents

          // Get the latest paid invoice for this subscription to find payment intent
          const invoices = await stripe.invoices.list({
            subscription: selectedSubscription.stripeSubscription.id,
            status: "paid",
            limit: 1,
          });

          if (invoices.data.length === 0) {
            return res
              .status(400)
              .json({ error: "No paid invoices found for this subscription" });
          }

          const invoice = invoices.data[0];
          if (!invoice.payment_intent) {
            return res.status(400).json({
              error: "No payment intent found for the latest invoice",
            });
          }

          // Create partial refund
          const refund = await stripe.refunds.create({
            payment_intent: invoice.payment_intent as string,
            amount: refundAmount,
            reason: "requested_by_customer",
            metadata: {
              reason:
                "Review verification - one month refund for yearly subscription",
              admin_id: adminUser.id.toString(),
              user_id: user.id.toString(),
              subscription_tier: selectedSubscription.tier,
            },
          });

          // Send notification email to user about their refund
          const userEmailHtml = loadTemplate(
            "review-verified-free-month.html",
            {
              username: user.username,
              plan: selectedSubscription.tier,
              verificationDate: new Date().toLocaleDateString(),
              refundAmount: (refundAmount / 100).toFixed(2),
              currency: "EUR",
              isRefund: true,
            },
            user.language || "en",
          );

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject:
              "🎉 Congratulations! Your Reviews Have Been Verified - Refund Processed!",
            html: userEmailHtml,
          });

          // Send admin notification
          const adminEmailHtml = loadTemplate(
            "admin-review-verified-notification.html",
            {
              username: user.username,
              email: user.email,
              adminName: adminUser.username,
              verificationDate: new Date().toLocaleDateString(),
              refundAmount: (refundAmount / 100).toFixed(2),
              currency: "EUR",
              isRefund: true,
            },
            "en",
          );

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: "development@hayc.gr",
            subject: `✅ Review Verified - Refund Processed for ${user.username}`,
            html: adminEmailHtml,
          });

          res.json({
            success: true,
            message: `Refunded one month: ${(refundAmount / 100).toFixed(2)}€ to the user.`,
            refundAmount: (refundAmount / 100).toFixed(2),
            isRefund: true,
            appliedTo: `${selectedSubscription.tier} (yearly)`,
          });
        } catch (refundError: any) {
          console.error("Error processing refund:", refundError);
          return res.status(500).json({ error: "Failed to process refund" });
        }
      } else if (actionType === "coupon") {
        // For monthly subscriptions, apply coupon

        // Check if the selected subscription already has the coupon applied
        if (
          selectedSubscription.stripeSubscription.discount &&
          selectedSubscription.stripeSubscription.discount.coupon.id ===
            "H0KCP9s8"
        ) {
          return res.status(400).json({
            error:
              "User already has this coupon applied to their cheapest subscription",
            couponAlreadyApplied: true,
          });
        }

        // Apply the coupon to the selected subscription only
        const updatedSubscription = await stripe.subscriptions.update(
          selectedSubscription.stripeSubscription.id,
          {
            coupon: "H0KCP9s8",
          },
        );

        // Send notification email to user about their free month
        const userEmailHtml = loadTemplate(
          "review-verified-free-month.html",
          {
            username: user.username,
            plan: selectedSubscription.tier,
            verificationDate: new Date().toLocaleDateString(),
            nextBillingDate: new Date(
              updatedSubscription.current_period_end * 1000,
            ).toLocaleDateString(),
            isRefund: false,
          },
          user.language || "en",
        );

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject:
            "🎉 Congratulations! Your Reviews Have Been Verified - Free Month Applied!",
          html: userEmailHtml,
        });

        // Send admin notification
        const adminEmailHtml = loadTemplate(
          "admin-review-verified-notification.html",
          {
            username: user.username,
            email: user.email,
            adminName: adminUser.username,
            verificationDate: new Date().toLocaleDateString(),
            isRefund: false,
          },
          "en",
        );

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: "development@hayc.gr",
          subject: `✅ Review Verified - Coupon Applied for ${user.username}`,
          html: adminEmailHtml,
        });

        res.json({
          success: true,
          message: "Coupon applied successfully",
          isRefund: false,
          appliedTo: `${selectedSubscription.tier} (monthly)`,
        });
      }
    } catch (err: any) {
      console.error("Error verifying review:", err);

      // Handle specific Stripe errors
      if (err.type === "StripeInvalidRequestError") {
        if (err.message && err.message.includes("used up")) {
          return res.status(400).json({
            error:
              "The coupon has reached its usage limit and cannot be applied to more subscriptions",
            couponExhausted: true,
          });
        }
        if (err.message && err.message.includes("already has")) {
          return res.status(400).json({
            error: "User already has this coupon applied",
            couponAlreadyApplied: true,
          });
        }
      }

      res.status(500).json({ error: "Failed to process review verification" });
    }
  });

  // Get coupon information endpoint
  app.get("/api/admin/coupon-info/:couponId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const couponId = req.params.couponId;

      // Fetch coupon information from Stripe
      const coupon = await stripe.coupons.retrieve(couponId);

      let duration = "Unknown";
      if (coupon.duration === "forever") {
        duration = "Forever";
      } else if (coupon.duration === "once") {
        duration = "One time";
      } else if (coupon.duration === "repeating" && coupon.duration_in_months) {
        duration = `${coupon.duration_in_months} month${coupon.duration_in_months > 1 ? "s" : ""}`;
      }

      res.json({
        name: coupon.name || "Discount Coupon",
        duration: duration,
        percentOff: coupon.percent_off || 0,
        amountOff: coupon.amount_off || 0,
        currency: coupon.currency,
        valid: coupon.valid,
      });
    } catch (err) {
      console.error("Error fetching coupon info:", err);
      res.status(500).json({ error: "Failed to fetch coupon information" });
    }
  });

  // Check user coupon status endpoint
  app.get("/api/admin/users/:id/coupon-status/:couponId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const userId = parseInt(req.params.id);
      const couponId = req.params.couponId;
      const user = await storage.getUserById(userId);

      if (!user || !user.stripeCustomerId) {
        return res
          .status(404)
          .json({ error: "User not found or has no Stripe customer ID" });
      }

      // Get user's active subscriptions
      const userSubscriptions = await storage.getUserSubscriptions(userId);
      const activeSubscriptions = userSubscriptions.filter(
        (sub) => sub.status === "active",
      );

      if (activeSubscriptions.length === 0) {
        return res.json({ hasCoupon: false, hasActiveSubscription: false });
      }

      // Get Stripe subscriptions for this customer
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        expand: ["data.items", "data.items.data.price"],
      });

      // Find all matching Stripe subscriptions and their corresponding prices
      const matchingSubscriptions = [];

      for (const stripeSub of stripeSubscriptions.data) {
        const priceId = stripeSub.items.data[0]?.price.id;
        if (!priceId) continue;

        // Find the tier for this price ID
        let tier: SubscriptionTier | undefined;
        let billingPeriod: "monthly" | "yearly" | undefined;

        for (const [t, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
          if (prices.monthly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "monthly";
            break;
          }
          if (prices.yearly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "yearly";
            break;
          }
        }

        if (tier && billingPeriod) {
          const plan = subscriptionPlans[tier];
          const price =
            billingPeriod === "monthly" ? plan.price : plan.yearlyPrice / 12; // Convert yearly to monthly for comparison

          matchingSubscriptions.push({
            stripeSubscription: stripeSub,
            tier,
            billingPeriod,
            monthlyPrice: price,
          });
        }
      }

      if (matchingSubscriptions.length === 0) {
        return res.json({ hasCoupon: false, hasActiveSubscription: true });
      }

      // Find the cheapest subscription
      const cheapestSubscription = matchingSubscriptions.reduce(
        (cheapest, current) => {
          return current.monthlyPrice < cheapest.monthlyPrice
            ? current
            : cheapest;
        },
      );

      // Check if the cheapest subscription has the specific coupon applied
      const hasCoupon =
        cheapestSubscription.stripeSubscription.discount &&
        cheapestSubscription.stripeSubscription.discount.coupon.id === couponId;

      res.json({
        hasCoupon: hasCoupon,
        hasActiveSubscription: true,
        couponName: hasCoupon
          ? cheapestSubscription.stripeSubscription.discount.coupon.name
          : null,
        appliedToTier: hasCoupon ? cheapestSubscription.tier : null,
      });
    } catch (err) {
      console.error("Error checking user coupon status:", err);
      res.status(500).json({ error: "Failed to check coupon status" });
    }
  });

  // User coupon status endpoint (for authenticated user checking their own status)
  app.get("/api/user/coupon-status/:couponId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const couponId = req.params.couponId;

      // If user has no Stripe customer ID, they can't have a coupon
      if (!user.stripeCustomerId) {
        return res.json({ hasCoupon: false, hasActiveSubscription: false });
      }

      // Get user's active subscriptions
      const userSubscriptions = await storage.getUserSubscriptions(user.id);
      const activeSubscriptions = userSubscriptions.filter(
        (sub) => sub.status === "active",
      );

      if (activeSubscriptions.length === 0) {
        return res.json({ hasCoupon: false, hasActiveSubscription: false });
      }

      // Get Stripe subscriptions for this customer
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        expand: ["data.items", "data.items.data.price"],
      });

      // Find all matching Stripe subscriptions and their corresponding prices
      const matchingSubscriptions = [];

      for (const stripeSub of stripeSubscriptions.data) {
        const priceId = stripeSub.items.data[0]?.price.id;
        if (!priceId) continue;

        // Find the tier for this price ID
        let tier: SubscriptionTier | undefined;
        let billingPeriod: "monthly" | "yearly" | undefined;

        for (const [t, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
          if (prices.monthly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "monthly";
            break;
          }
          if (prices.yearly === priceId) {
            tier = t as SubscriptionTier;
            billingPeriod = "yearly";
            break;
          }
        }

        if (tier && billingPeriod) {
          const plan = subscriptionPlans[tier];
          const price =
            billingPeriod === "monthly" ? plan.price : plan.yearlyPrice / 12; // Convert yearly to monthly for comparison

          matchingSubscriptions.push({
            stripeSubscription: stripeSub,
            tier,
            billingPeriod,
            monthlyPrice: price,
          });
        }
      }

      if (matchingSubscriptions.length === 0) {
        return res.json({ hasCoupon: false, hasActiveSubscription: true });
      }

      // Find the cheapest subscription
      const cheapestSubscription = matchingSubscriptions.reduce(
        (cheapest, current) => {
          return current.monthlyPrice < cheapest.monthlyPrice
            ? current
            : cheapest;
        },
      );

      // Check if the cheapest subscription has the specific coupon applied
      const hasCoupon =
        cheapestSubscription.stripeSubscription.discount &&
        cheapestSubscription.stripeSubscription.discount.coupon.id === couponId;

      res.json({
        hasCoupon: hasCoupon,
        hasActiveSubscription: true,
        couponName: hasCoupon
          ? cheapestSubscription.stripeSubscription.discount.coupon.name
          : null,
        appliedToTier: hasCoupon ? cheapestSubscription.tier : null,
      });
    } catch (err) {
      console.error("Error checking user coupon status:", err);
      res.status(500).json({ error: "Failed to check coupon status" });
    }
  });

  // Admin endpoint to inspect subscription data
  app.get("/api/admin/subscriptions/:id/debug", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscriptionId = parseInt(req.params.id);

      // Get local subscription
      const localSubscription = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.id, subscriptionId))
        .then((rows) => rows[0]);

      if (!localSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Get user details
      const user = await storage.getUserById(localSubscription.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get Stripe subscriptions if user has Stripe customer ID
      let stripeSubscriptions = [];
      if (user.stripeCustomerId) {
        const stripeSubList = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          expand: ["data.items", "data.items.data.price"],
        });
        stripeSubscriptions = stripeSubList.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          priceId: sub.items.data[0]?.price.id,
          created: new Date(sub.created * 1000),
          addOns: sub.items.data.slice(1).map(item => item.price.id)
        }));
      }

      res.json({
        localSubscription: {
          ...localSubscription,
          addOns: localSubscription.addOns || []
        },
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          stripeCustomerId: user.stripeCustomerId
        },
        stripeSubscriptions,
        priceMapping: SUBSCRIPTION_PRICES
      });
    } catch (err) {
      console.error("Error debugging subscription:", err);
      res.status(500).json({ error: "Failed to debug subscription" });
    }
  });

  // Admin endpoint to fix subscription tier
  app.patch("/api/admin/subscriptions/:id/fix-tier", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const subscriptionId = parseInt(req.params.id);
      const { correctTier, reason } = req.body;

      if (!correctTier || !reason) {
        return res.status(400).json({ error: "Correct tier and reason are required" });
      }

      // Validate tier
      if (!['basic', 'essential', 'pro'].includes(correctTier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }

      // Update subscription tier
      const updatedSubscription = await db
        .update(subscriptionsTable)
        .set({ tier: correctTier })
        .where(eq(subscriptionsTable.id, subscriptionId))
        .returning()
        .then((rows) => rows[0]);

      if (!updatedSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ 
        success: true, 
        subscription: updatedSubscription,
        message: `Subscription tier updated to ${correctTier}`
      });
    } catch (err) {
      console.error("Error fixing subscription tier:", err);
      res.status(500).json({ error: "Failed to fix subscription tier" });
    }
  });

  // Test endpoint for CSV parsing
  app.post("/api/admin/test-csv-parse", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { csvContent } = req.body;

      if (!csvContent) {
        return res.status(400).json({ error: "CSV content is required" });
      }

      // Parse CSV without importing
      const { parseCSV } = await import("./migration");
      const parsedUsers = parseCSV(csvContent);

      res.json({ 
        success: true, 
        usersFound: parsedUsers.length,
        users: parsedUsers.slice(0, 5), // Show first 5 users
        preview: true
      });
    } catch (err) {
      console.error("Error parsing CSV:", err);
      res.status(500).json({ error: "Failed to parse CSV" });
    }
  });

  // Migration endpoints
  app.post("/api/admin/import-wordpress-users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { users, csvContent } = req.body;

      let usersToImport = users;

      // If CSV content is provided, parse it
      if (csvContent && !users) {
        const { parseCSV } = await import("./migration");
        usersToImport = parseCSV(csvContent);
      }

      if (!usersToImport || !Array.isArray(usersToImport)) {
        return res.status(400).json({ error: "Users array or CSV content is required" });
      }

      // Import the migration utilities
      const { importWordPressUsers } = await import("./migration");
      const results = await importWordPressUsers(usersToImport);

      res.json(results);
    } catch (err) {
      console.error("Error importing WordPress users:", err);
      res.status(500).json({ error: "Failed to import WordPress users" });
    }
  });

  // Password reset token validation endpoint
  app.get("/api/validate-reset-token/:token", async (req, res) => {
    try {
      const { validatePasswordResetToken } = await import("./migration");
      const result = await validatePasswordResetToken(req.params.token);

      if (result.valid) {
        res.json({ 
          valid: true, 
          username: result.user?.username,
          email: result.user?.email 
        });
      } else {
        res.status(400).json({ valid: false, error: "Invalid or expired token" });
      }
    } catch (err) {
      console.error("Error validating reset token:", err);
      res.status(500).json({ error: "Failed to validate token" });
    }
  });

  // Password reset endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }

      const { resetUserPassword } = await import("./migration");
      const result = await resetUserPassword(token, password);

      if (result.success) {
        res.json({ success: true, message: "Password reset successfully" });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Public endpoint for users to request password reset
  app.post("/api/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Always return success to avoid revealing if user exists
      // This prevents email enumeration attacks
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user exists
      const user = await storage.getUserByEmail(normalizedEmail);
      
      if (user) {
        // Generate reset token
        const crypto = await import("crypto");
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Update user with reset token
        await storage.updateUser(user.id, { passwordResetToken: resetToken });

        // Prepare reset URL
        const { sendPasswordResetEmail } = await import("./migration");
        const resetData = await sendPasswordResetEmail(user.email, resetToken, user.username);

        // Send the actual email using generic template (not migration)
        const userLanguage = user.language || "en";
        const resetEmailHtml = loadTemplate("password-reset-generic.html", {
          username: user.username,
          email: user.email,
          resetUrl: resetData.resetUrl,
          resetToken: resetToken
        }, userLanguage);

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: userLanguage === "gr" ? "🔑 Επαναφορά Κωδικού Πρόσβασης" : "🔑 Reset Your Password",
          html: resetEmailHtml,
        });

        console.log(`Password reset email sent to ${user.email}`);
      } else {
        console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
      }

      // Always return success to prevent email enumeration
      res.json({ 
        success: true, 
        message: "If an account exists with this email, a password reset link has been sent." 
      });
    } catch (err) {
      console.error("Error processing password reset request:", err);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Admin endpoint to send password reset email
  app.post("/api/admin/send-password-reset", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { email, selectedUsers } = req.body;

      if (!email && (!selectedUsers || !Array.isArray(selectedUsers))) {
        return res.status(400).json({ error: "Email or selected users list is required" });
      }

      const { sendPasswordResetEmail } = await import("./migration");
      const results = [];

      // Handle single email or multiple users
      const usersToProcess = email ? [{ email }] : selectedUsers;

      for (const userInfo of usersToProcess) {
        try {
          // Get user from database
          const user = await storage.getUserByEmail(userInfo.email);
          if (!user) {
            results.push({ email: userInfo.email, success: false, error: "User not found" });
            continue;
          }

          // Check if user already has a reset token, if not generate one
          let resetToken = user.passwordResetToken;
          if (!resetToken) {
            const crypto = await import("crypto");
            resetToken = crypto.randomBytes(32).toString('hex');

            // Update user with reset token
            await storage.updateUser(user.id, { passwordResetToken: resetToken });
          }

          const resetData = await sendPasswordResetEmail(user.email, resetToken, user.username);

          // Send the actual email using your existing email system
          const userLanguage = user.language || "en";
          const resetEmailHtml = loadTemplate("password-reset-email.html", {
            username: user.username,
            email: user.email,
            resetUrl: resetData.resetUrl,
            resetToken: resetToken
          }, userLanguage);

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: "🔑 Reset Your Password - New Platform Access",
            html: resetEmailHtml,
          });

          results.push({ 
            email: user.email, 
            success: true, 
            resetUrl: resetData.resetUrl,
            token: resetToken
          });
        } catch (error) {
          console.error(`Error processing password reset for ${userInfo.email}:`, error);
          results.push({ 
            email: userInfo.email, 
            success: false, 
            error: error.message 
          });
        }
      }

      res.json({ results });
    } catch (err) {
      console.error("Error sending password reset emails:", err);
      res.status(500).json({ error: "Failed to send password reset emails" });
    }
  });

  app.post("/api/admin/match-stripe-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Import the migration utilities
      const { matchUsersToStripeSubscriptions } = await import("./migration");
      const results = await matchUsersToStripeSubscriptions();

      res.json(results);
    } catch (err) {
      console.error("Error matching Stripe subscriptions:", err);
      res.status(500).json({ error: "Failed to match Stripe subscriptions" });
    }
  });

  // Delete user endpoint
  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || !hasPermission(adminUser.role, 'canManageUsers')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const userId = parseInt(req.params.id);
      const userToDelete = await storage.getUserById(userId);

      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user has a Stripe customer ID, cancel their subscriptions
      if (userToDelete.stripeCustomerId) {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: userToDelete.stripeCustomerId,
          status: "active",
        });

        // Cancel all active subscriptions
        await Promise.all(
          stripeSubscriptions.data.map((sub) =>
            stripe.subscriptions.cancel(sub.id),
          ),
        );
      }

      // Get all subscriptions for this user
      const userSubscriptions = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId));

      // Delete all transactions for each subscription
      for (const subscription of userSubscriptions) {
        await db
          .delete(transactions)
          .where(eq(transactions.subscriptionId, subscription.id));
      }

      // Now delete all subscriptions
      await db
        .delete(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, userId));

      // Finally delete the user
      await db.delete(users).where(eq(users.id, userId));

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Clear all cancelled and incomplete subscriptions endpoint
  app.delete("/api/admin/clear-non-active-subscriptions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get all non-active subscriptions (anything that's not 'active')
      const subscriptionsToDelete = await db
        .select()
        .from(subscriptionsTable)
        .where(sql`${subscriptionsTable.status} != 'active'`);

      console.log(`Found ${subscriptionsToDelete.length} non-active subscriptions to delete`);

      let deletedTransactions = 0;
      let deletedSubscriptions = 0;

      // Delete all transactions for these subscriptions first
      for (const subscription of subscriptionsToDelete) {
        try {
          const transactionsResult = await db
            .delete(transactions)
            .where(eq(transactions.subscriptionId, subscription.id))
            .returning();
          deletedTransactions += transactionsResult.length;
        } catch (transactionError) {
          console.error(`Error deleting transactions for subscription ${subscription.id}:`, transactionError);
          // Continue with other subscriptions
        }
      }

      // Delete all non-active subscriptions
      try {
        const result = await db
          .delete(subscriptionsTable)
          .where(sql`${subscriptionsTable.status} != 'active'`)
          .returning();
        deletedSubscriptions = result.length;
      } catch (subscriptionError) {
        console.error("Error deleting subscriptions:", subscriptionError);
        throw subscriptionError;
      }

      console.log(`Successfully deleted ${deletedSubscriptions} non-active subscriptions and ${deletedTransactions} transactions`);

      res.json({ 
        success: true, 
        deletedCount: deletedSubscriptions,
        deletedTransactions: deletedTransactions,
        message: `Successfully cleared ${deletedSubscriptions} non-active subscriptions and ${deletedTransactions} associated transactions`
      });
    } catch (err) {
      console.error("Error clearing non-active subscriptions:", err);
      console.error("Full error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({ 
        error: "Failed to clear non-active subscriptions",
        details: err.message 
      });
    }
  });

  app.post("/api/create-billing-portal-session", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Use the authenticated user from req.user
      const currentUser = req.user;
      if (!currentUser?.stripeCustomerId) {
        return res.status(404).json({ error: "Stripe customer not found" });
      }

      // Create a billing portal session without configuration
      const session = await stripe.billingPortal.sessions.create({
        customer: currentUser.stripeCustomerId,
        return_url: `${req.protocol}://${req.get("host")}/dashboard`,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Error creating billing portal session:", err);
      res.status(500).json({
        error: "Failed to create billing portal session",
        details: err.message,
      });
    }
  });

  // Get customer's default payment method details
  app.get("/api/payment-method", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Prevent caching of payment method data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    try {
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!currentUser.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found" });
      }

      // Get customer from Stripe
      const customer = await stripe.customers.retrieve(currentUser.stripeCustomerId);
      
      if (!customer || customer.deleted) {
        return res.status(400).json({ error: "Customer not found in Stripe" });
      }

      let defaultPaymentMethodId = customer.invoice_settings?.default_payment_method || customer.default_source;
      
      // If no default payment method is set on the customer, check active subscriptions
      if (!defaultPaymentMethodId) {
        console.log("[/api/payment-method] No default payment method found on customer, checking active subscriptions...");
        
        // Get user's active subscriptions from database
        const userSubscriptions = await db
          .select()
          .from(subscriptionsTable)
          .where(and(
            eq(subscriptionsTable.userId, currentUser.id),
            or(
              eq(subscriptionsTable.status, 'active'),
              eq(subscriptionsTable.status, 'past_due')
            )
          ))
          .limit(1);

        if (userSubscriptions.length > 0 && userSubscriptions[0].stripeSubscriptionId) {
          console.log("[/api/payment-method] Found active subscription, fetching payment method from Stripe...");
          
          // Get the subscription from Stripe to extract payment method
          const subscription = await stripe.subscriptions.retrieve(userSubscriptions[0].stripeSubscriptionId);
          defaultPaymentMethodId = subscription.default_payment_method;
          
          console.log("[/api/payment-method] Payment method from subscription:", defaultPaymentMethodId ? "found" : "not found");
        }
      }
      
      if (!defaultPaymentMethodId) {
        console.log("[/api/payment-method] No payment method found anywhere");
        return res.json({ hasPaymentMethod: false });
      }

      // Get payment method details
      const paymentMethodId = typeof defaultPaymentMethodId === 'string' ? defaultPaymentMethodId : defaultPaymentMethodId.id;
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      console.log("[/api/payment-method] Successfully retrieved payment method:", paymentMethod.type, paymentMethod.card?.brand, "****" + paymentMethod.card?.last4);

      res.json({
        hasPaymentMethod: true,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        } : null,
      });
    } catch (error: any) {
      console.error("Error retrieving payment method:", error);
      res.status(500).json({
        error: "Failed to retrieve payment method",
        details: error.message,
      });
    }
  });

  // Purchase a single add-on as a standalone subscription for a specific website
  app.post("/api/add-ons/purchase", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { addOnId, websiteProgressId, billingPeriod = 'monthly' } = req.body;

      if (!addOnId) {
        return res.status(400).json({ error: "No add-on selected" });
      }

      if (!websiteProgressId) {
        return res.status(400).json({ error: "Website not specified" });
      }

      // Get the current authenticated user
      const currentUser = await storage.getUserById(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!currentUser.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found. Please contact support." });
      }

      // Verify the website belongs to the user
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, parseInt(websiteProgressId)))
        .where(eq(websiteProgress.userId, currentUser.id))
        .then(rows => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found or access denied" });
      }

      // Check if user already has this add-on for this specific website
      // Check for both 'active' and 'past_due' to prevent duplicates
      const existingAddOnQuery = await db
        .select()
        .from(subscriptionsTable)
        .where(and(
          eq(subscriptionsTable.userId, currentUser.id),
          eq(subscriptionsTable.websiteProgressId, parseInt(websiteProgressId)),
          eq(subscriptionsTable.productType, 'addon'),
          eq(subscriptionsTable.productId, addOnId)
        ));

      const existingAddOn = existingAddOnQuery.find(sub => 
        sub.status === 'active' || sub.status === 'past_due'
      );

      if (existingAddOn) {
        return res.status(409).json({ 
          error: "duplicate_subscription",
          message: "You already have this add-on subscribed for this website" 
        });
      }

      // Map add-on ID to Stripe price ID
      const priceId = ADDON_PRICE_MAP[addOnId];
      
      if (!priceId) {
        return res.status(400).json({ error: `Invalid add-on ID: ${addOnId}` });
      }

      // Get customer's default payment method
      const customer = await stripe.customers.retrieve(currentUser.stripeCustomerId);
      
      if (!customer || customer.deleted) {
        return res.status(400).json({ error: "Customer not found in Stripe" });
      }

      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method || customer.default_source;
      
      if (!defaultPaymentMethodId) {
        return res.status(400).json({ error: "No payment method on file. Please add a payment method first." });
      }

      // Create stable idempotency key to prevent duplicate charges (without timestamp)
      // This allows retries to be deduplicated by Stripe
      const idempotencyKey = `addon_purchase_${currentUser.id}_${websiteProgressId}_${addOnId}`;

      // Create subscription directly using saved payment method
      // Use payment_behavior: 'error_if_incomplete' to fail fast if 3DS/authentication is required
      // Expand latest_invoice.payment_intent to get detailed payment status
      // Note: This requires the payment method to have a valid mandate for off-session usage
      const subscription = await stripe.subscriptions.create({
        customer: currentUser.stripeCustomerId,
        items: [{
          price: priceId,
          quantity: 1,
        }],
        default_payment_method: typeof defaultPaymentMethodId === 'string' ? defaultPaymentMethodId : defaultPaymentMethodId.id,
        payment_behavior: 'error_if_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: currentUser.id.toString(),
          websiteProgressId: websiteProgressId.toString(),
          addOnId: addOnId,
          isAddonOnly: 'true',
        },
      }, {
        idempotencyKey: idempotencyKey,
      });

      // Get the add-on details for the response
      const addOnDetails = availableAddOnsWithPriceIds.find(a => a.id === addOnId);

      // Create subscription record in database
      const [newSubscription] = await db
        .insert(subscriptionsTable)
        .values({
          userId: currentUser.id,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          productType: 'addon',
          productId: addOnId,
          websiteProgressId: parseInt(websiteProgressId),
        })
        .returning();

      console.log('✅ Add-on subscription created via API:', {
        subscriptionId: newSubscription.id,
        stripeSubscriptionId: subscription.id,
        addOnId,
        websiteProgressId: parseInt(websiteProgressId),
      });

      // Create DRAFT invoice for add-on purchase
      const addOnPrice = subscription.items.data[0]?.price?.unit_amount || null;
      if (addOnPrice) {
        const addOn = availableAddOns.find(a => a.id === addOnId);
        const addOnName = addOn?.name || "Add-on";
        const paymentIntentId = await getPaymentIntentFromSubscription(subscription);
        
        await createDraftInvoice({
          websiteProgressId: parseInt(websiteProgressId),
          subscriptionId: newSubscription.id,
          paymentIntentId,
          title: `Invoice for ${addOnName}`,
          description: `Add-on purchase - ${addOnName}`,
          amount: addOnPrice,
          currency: 'EUR',
          context: `add-on purchase via API (${addOnId})`,
        });
      } else {
        console.error('❌ Cannot create draft invoice: add-on price is null');
      }

      res.json({ 
        success: true,
        subscription: {
          id: newSubscription.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          addOnName: addOnDetails?.name || addOnId,
        }
      });
    } catch (error: any) {
      console.error("Error creating add-on subscription:", error);
      
      // Handle specific Stripe errors with structured error codes
      if (error.type === 'StripeCardError') {
        return res.status(400).json({
          error: "card_declined",
          message: "Payment failed. Your card was declined.",
          details: error.message,
        });
      }
      
      if (error.code === 'payment_intent_authentication_failure' || error.decline_code === 'authentication_required') {
        return res.status(400).json({
          error: "authentication_required",
          message: "This card requires additional authentication. Please update your payment method in billing settings.",
          details: error.message,
        });
      }
      
      if (error.code === 'incomplete' || error.message?.includes('incomplete')) {
        return res.status(400).json({
          error: "payment_incomplete",
          message: "Payment could not be completed. Please update your payment method.",
          details: error.message,
        });
      }
      
      res.status(500).json({
        error: "subscription_creation_failed",
        message: "Failed to create subscription. Please try again or contact support.",
        details: error.message,
      });
    }
  });

  // Add the new endpoint here
  app.post("/api/admin/websites", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { userId, domain, currentStage, stages } = req.body;

      // Get the target user's information
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }

      // Validate stages
      if (!stages || !Array.isArray(stages) || stages.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one stage must be selected" });
      }

      // Create website progress
      const [websiteProgressRecord] = await db
        .insert(websiteProgress)
        .values({
          userId: userId,
          domain: domain,
          currentStage: currentStage || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      // Create system tags for the new website
      await storage.createSystemTagsForWebsite(websiteProgressRecord.id);

      // Define available stages mapping
      const availableStages = {
        planning: {
          title: "Planning & Design",
          description:
            "Requirements gathering, structure and functionality planning",
        },
        uiux: {
          title: "UI/UX Development",
          description: "User interface and experience design",
        },
        backend: {
          title: "Backend Development",
          description: "Server-side functionality and database implementation",
        },
        testing: {
          title: "Testing & Optimization",
          description: "Functionality testing and performance optimization",
        },
        delivery: {
          title: "Final Release & Delivery",
          description: "Final checks and website delivery",
        },
        Welcome: {
          title: "Welcome & Project Setup",
          description:
            "Welcome to hayc! We get startedright away by setting up your project and preparing everything for a smooth start",
        },
        Layout: {
          title: "Layout Selection",
          description:
            "We pick the best layout for your website, based on your preferences or examples you’ve shared with us",
        },
        Content: {
          title: "Content Collection & Organization",
          description:
            "We organize the information you provide (via our form or email) and spread your content across the chosen layout",
        },
        Preview: {
          title: "First Demo Preview",
          description:
            "Your website draft is ready! You receive a private link to review and give us your feedback",
        },
        Feedback: {
          title: "Feedback & Refinements",
          description:
            "We make any quick changes or adjustments based on your feedback to make sure everything feels right",
        },
        Launch: {
          title: "Website Launch",
          description: "Your website goes live and is ready for your business!",
        },
        content: {
          title: "Content Creation",
          description: "Writing and organizing website content",
        },
        seo: {
          title: "SEO Optimization",
          description: "Search engine optimization and performance tuning",
        },
        security: {
          title: "Security Implementation",
          description: "Security measures and protection setup",
        },
        analytics: {
          title: "Analytics Setup",
          description: "Analytics and tracking implementation",
        },
        maintenance: {
          title: "Maintenance Setup",
          description: "Ongoing maintenance and support setup",
        },
      };

      // Create custom stages based on selection
      const stageValues = stages.map((stageId: string, index: number) => {
        const stageInfo =
          availableStages[stageId as keyof typeof availableStages];
        if (!stageInfo) {
          throw new Error(`Invalid stage ID: ${stageId}`);
        }

        return {
          websiteProgressId: websiteProgressRecord.id,
          stageNumber: index + 1,
          title: stageInfo.title,
          description: stageInfo.description,
          status: index + 1 === currentStage ? "in-progress" : "pending",
        };
      });

      await db.insert(websiteStages).values(stageValues);

      // Send notification email to the user
      const userEmailHtml = loadTemplate(
        "website-progress-created.html",
        {
          username: targetUser.username,
          domain: domain,
          currentStage: currentStage || 1,
          createdDate: new Date().toLocaleDateString(),
        },
        targetUser.language || "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: targetUser.email,
        replyTo: "support@hayc.gr",
        subject: "🚀 Your Website Development Has Started!",
        html: userEmailHtml,
      });

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-website-progress-created.html",
        {
          username: targetUser.username,
          email: targetUser.email,
          domain: domain,
          currentStage: currentStage || 1,
          createdDate: new Date().toLocaleDateString(),
          adminName: user.username,
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🎯 New Website Progress Created - ${websiteProgressRecord.projectName || domain}`,
        html: adminEmailHtml,
      });

      res.json({ success: true, websiteProgress: websiteProgressRecord });
    } catch (err) {
      console.error("Error creating website progress:", err);
      res.status(500).json({ error: "Failed to create website progress" });
    }
  });

  // GET endpoint to fetch all tips
  app.get("/api/tips", async (req, res) => {
    try {
      const allTips = await db
        .select({
          id: tips.id,
          title: tips.title,
          content: tips.content,
          createdAt: tips.createdAt,
          createdBy: tips.createdBy,
          createdByUsername: users.username,
        })
        .from(tips)
        .leftJoin(users, eq(tips.createdBy, users.id))
        .orderBy(desc(tips.createdAt));

      res.json({ tips: allTips });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ error: "Failed to fetch tips" });
    }
  });

  // Function to send tip notification emails to active users
  async function sendTipNotificationEmails(
    tipTitle: string,
    tipContent: string,
  ) {
    try {
      // Get all users who have active or trialing subscriptions and have notifications enabled
      // Using subquery to ensure each user appears only once, even with multiple subscriptions
      const activeUsers = await db
        .selectDistinct({
          username: users.username,
          email: users.email,
          language: users.language,
        })
        .from(users)
        .innerJoin(subscriptionsTable, eq(users.id, subscriptionsTable.userId))
        .where(
          and(
            or(
              eq(subscriptionsTable.status, "active"),
              eq(subscriptionsTable.status, "trialing")
            ),
            eq(users.tipsEmailNotifications, "true")
          )
        );

      // Send email to each user
      for (const user of activeUsers) {
        try {
          const tipPreview = tipContent.substring(0, 150);
          const dashboardUrl = `${process.env.VITE_APP_URL || 'https://hayc.gr'}/dashboard`;

          const emailHtml = loadTemplate(
            "new-tip-notification.html",
            {
              username: user.username,
              tipTitle: tipTitle,
              tipPreview: tipPreview,
              dashboardUrl: dashboardUrl,
            },
            user.language || "en",
          );

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            replyTo: "support@hayc.gr",
            subject: "💡 New Tip Available - hayc",
            html: emailHtml,
          });

        } catch (emailError) {
          console.error(
            `Failed to send tip notification to ${user.email}:`,
            emailError,
          );
        }
      }
    } catch (error) {
      console.error("Error sending tip notification emails:", error);
      throw error;
    }
  }

  // Function to send reminder emails for waiting stages
  async function sendWaitingStageReminders() {
    try {
      // Get all website progress entries with stages in 'waiting' status
      const websites = await db
        .select({
          id: websiteProgress.id,
          userId: websiteProgress.userId,
          domain: websiteProgress.domain,
          projectName: websiteProgress.projectName,
          userEmail: users.email,
          username: users.username,
          language: users.language,
        })
        .from(websiteProgress)
        .leftJoin(users, eq(websiteProgress.userId, users.id));

      for (const website of websites) {
        const stages = await db
          .select()
          .from(websiteStages)
          .where(eq(websiteStages.websiteProgressId, website.id))
          .where(eq(websiteStages.status, "waiting"));

        for (const stage of stages) {
          // Load reminder email template
          const emailHtml = loadTemplate(
            "stage-waiting-reminder.html",
            {
              username: website.username,
              stageName: stage.title,
              waitingInfo: stage.waiting_info,
              domain: website.domain,
            },
            website.language || "en",
          );

          // Send reminder email
          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: website.userEmail,
            replyTo: "support@hayc.gr",
            subject: "🔔 Action Required: Website Progress Update",
            html: emailHtml,
          });

        }
      }
    } catch (error) {
      console.error("Error sending reminder emails:", error);
    }
  }

  // Schedule reminder emails to be sent every day at 10 AM
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 10 && now.getMinutes() === 0) {
      // Get stages that need reminders
      db.select({
        id: websiteStages.id,
        websiteProgressId: websiteStages.websiteProgressId,
        title: websiteStages.title,
        waiting_info: websiteStages.waiting_info,
        reminder_interval: websiteStages.reminder_interval,
        completedAt: websiteStages.completedAt,
        domain: websiteProgress.domain,
        userEmail: users.email,
        username: users.username,
        language: users.language,
      })
        .from(websiteStages)
        .innerJoin(
          websiteProgress,
          eq(websiteStages.websiteProgressId, websiteProgress.id),
        )
        .innerJoin(users, eq(websiteProgress.userId, users.id))
        .where(eq(websiteStages.status, "waiting"))
        .execute()
        .then((stages) => {
          stages.forEach((stage) => {
            // Check if enough days have passed since the last reminder
            const lastReminder = stage.completedAt || new Date(0);
            const daysSinceReminder = Math.floor(
              (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24),
            );

            if (daysSinceReminder >= (stage.reminder_interval || 1)) {
              // Send reminder and update last reminder date
              sendReminderEmail(stage);
              db.update(websiteStages)
                .set({ completedAt: now })
                .where(eq(websiteStages.id, stage.id))
                .execute();
            }
          });
        });
    }
  }, 60000); // Check every minute

  async function sendReminderEmail(stage: any) {
    const emailHtml = loadTemplate(
      "stage-waiting-reminder.html",
      {
        username: stage.username,
        stageName: stage.title,
        waitingInfo: stage.waiting_info,
        domain: stage.domain,
      },
      stage.language || "en",
    );

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: stage.userEmail,
      replyTo: "support@hayc.gr",
      subject: "🔔 Action Required: Website Progress Update",
      html: emailHtml,
    });

  }

  // Add endpoint for updating transaction PDF
  app.post("/api/admin/transactions/:id/pdf", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || user.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const transactionId = parseInt(req.params.id);
      const { pdfUrl } = req.body;

      if (!pdfUrl) {
        return res.status(400).json({ error: "No PDF URL provided" });
      }

      // Update transaction with PDF URL
      const transaction = await storage.updateTransactionPdf(
        transactionId,
        pdfUrl,
      );

      res.json({ transaction });
    } catch (err) {
      console.error("Error updating transaction PDF:", err);
      res.status(500).json({ error: "Failed to update transaction PDF" });
    }
  });

  // Tips API routes
  app.get("/api/tips", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewTips')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const allTips = await db
        .select({
          id: tips.id,
          title: tips.title,
          content: tips.content,
          createdAt: tips.createdAt,
          createdBy: tips.createdBy,
          createdByUsername: users.username,
        })
        .from(tips)
        .leftJoin(users, eq(tips.createdBy, users.id))
        .orderBy(desc(tips.createdAt));

      res.json({ tips: allTips });
    } catch (err) {
      console.error("Error fetching tips:", err);
      res.status(500).json({ error: "Failed to fetch tips" });
    }
  });

  app.post("/api/admin/tips", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageTips')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { title, content } = req.body;

      if (!title || !content) {
        return res
          .status(400)
          .json({ error: "Title and content are required" });
      }

      const [tip] = await db
        .insert(tips)
        .values({
          title,
          content,
          createdBy: user.id,
          createdAt: new Date(),
        })
        .returning();

      // Send email notifications to users who have notifications enabled (non-blocking)
      sendTipNotificationEmails(title, content).catch((emailError) => {
        console.error("Failed to send tip notification emails:", emailError);
      });

      res.json({ tip });
    } catch (err) {
      console.error("Error creating tip:", err);
      res.status(500).json({ error: "Failed to create tip" });
    }
  });

  app.delete("/api/admin/tips/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canManageTips')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const tipId = parseInt(req.params.id);
      await db.delete(tips).where(eq(tips.id, tipId));

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting tip:", err);
      res.status(500).json({ error: "Failed to delete tip" });
    }
  });

  // Website Changes API endpoints

  // Get current month changes for a user (customer view)
  app.get("/api/website-changes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentMonthYear = getCurrentMonthYear();

      // Get user's website progress entries (ONLY for this user)
      const websites = await db
        .select({
          id: websiteProgress.id,
          domain: websiteProgress.domain,
          projectName: websiteProgress.projectName,
        })
        .from(websiteProgress)
        .where(eq(websiteProgress.userId, user.id));

      // Get or create changes records for each domain (ensuring user and domain isolation)
      const changesData = await Promise.all(
        websites.map(async (website) => {
          // Get the subscription for this specific website
          const websiteSubscription = await db
            .select()
            .from(subscriptionsTable)
            .where(
              sql`website_progress_id = ${website.id} AND status = 'active' AND product_type = 'plan'`
            )
            .orderBy(desc(subscriptionsTable.createdAt))
            .then((rows) => rows[0]);

          // If no subscription for this website, use default (0 changes)
          let changesAllowed = 0;
          if (websiteSubscription) {
            const plan =
              subscriptionPlans[websiteSubscription.tier as SubscriptionTier];
            if (plan) {
              changesAllowed = plan.changesPerMonth;
            }
          }

          let changes = await db
            .select()
            .from(websiteChanges)
            .where(
              sql`user_id = ${user.id} AND domain = ${website.domain} AND month_year = ${currentMonthYear}`,
            )
            .then((rows) => rows[0]);

          if (!changes) {
            // Create new record for this month and domain
            [changes] = await db
              .insert(websiteChanges)
              .values({
                userId: user.id,
                domain: website.domain,
                changesUsed: 0,
                changesAllowed: changesAllowed,
                monthYear: currentMonthYear,
              })
              .returning();
          } else if (changes.changesAllowed !== changesAllowed) {
            // Update existing record if the plan's changesPerMonth has changed
            [changes] = await db
              .update(websiteChanges)
              .set({
                changesAllowed: changesAllowed,
                updatedAt: new Date(),
              })
              .where(
                sql`id = ${changes.id}`
              )
              .returning();
          }

          // Get change logs ONLY for this specific user, domain, and month with strict filtering
          const changeLogs = await db
            .select({
              id: websiteChangeLogs.id,
              changeDescription: websiteChangeLogs.changeDescription,
              adminId: websiteChangeLogs.adminId,
              createdAt: websiteChangeLogs.createdAt,
              adminUsername: users.username,
            })
            .from(websiteChangeLogs)
            .leftJoin(users, eq(websiteChangeLogs.adminId, users.id))
            .where(
              sql`${websiteChangeLogs.userId} = ${user.id} AND ${websiteChangeLogs.domain} = ${website.domain} AND ${websiteChangeLogs.monthYear} = ${currentMonthYear}`,
            )
            .orderBy(desc(websiteChangeLogs.createdAt));

          return {
            ...changes,
            projectName: website.projectName,
            changeLogs,
          };
        }),
      );

      res.json({ changes: changesData });
    } catch (err) {
      console.error("Error fetching website changes:", err);
      res.status(500).json({ error: "Failed to fetch website changes" });
    }
  });

  // Admin endpoint to get all website changes
  app.get("/api/admin/website-changes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !hasPermission(user.role, 'canViewWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const currentMonthYear = getCurrentMonthYear();

      // Get all website changes for current month with user details (ensure proper domain separation)
      // Using raw SQL with DISTINCT ON to prevent duplicates from multiple websiteProgress records
      const allChanges = await db.execute(sql`
        SELECT DISTINCT ON (wc.id)
          wc.id,
          wc.user_id AS "userId",
          wc.domain,
          wp.project_name AS "projectName",
          wc.changes_used AS "changesUsed",
          wc.changes_allowed AS "changesAllowed",
          wc.month_year AS "monthYear",
          wc.created_at AS "createdAt",
          wc.updated_at AS "updatedAt",
          u.username,
          u.email,
          s.tier AS "subscriptionTier"
        FROM website_changes wc
        LEFT JOIN users u ON wc.user_id = u.id
        LEFT JOIN website_progress wp ON wc.domain = wp.domain AND wc.user_id = wp.user_id
        LEFT JOIN subscriptions s ON s.website_progress_id = wp.id 
          AND s.status = 'active' 
          AND s.product_type = 'plan'
        WHERE wc.month_year = ${currentMonthYear}
        ORDER BY wc.id, s.created_at DESC NULLS LAST, wp.created_at DESC
      `).then(result => result.rows as any[]);

      // Get change logs for each change record with strict domain and user isolation
      const changesWithLogs = await Promise.all(
        allChanges.map(async (change) => {
          const changeLogs = await db
            .select({
              id: websiteChangeLogs.id,
              changeDescription: websiteChangeLogs.changeDescription,
              status: websiteChangeLogs.status,
              adminId: websiteChangeLogs.adminId,
              completedBy: websiteChangeLogs.completedBy,
              completedAt: websiteChangeLogs.completedAt,
              userFeedback: websiteChangeLogs.userFeedback,
              createdAt: websiteChangeLogs.createdAt,
              adminUsername: users.username,
            })
            .from(websiteChangeLogs)
            .leftJoin(users, eq(websiteChangeLogs.adminId, users.id))
            .where(
              sql`${websiteChangeLogs.userId} = ${change.userId} AND ${websiteChangeLogs.domain} = ${change.domain} AND ${websiteChangeLogs.monthYear} = ${currentMonthYear}`,
            )
            .orderBy(desc(websiteChangeLogs.createdAt));

          return {
            ...change,
            changeLogs,
          };
        }),
      );

      res.json({ changes: changesWithLogs });
    } catch (err) {
      console.error("Error fetching admin website changes:", err);
      res.status(500).json({ error: "Failed to fetch website changes" });
    }
  });

  // Admin endpoint to record a website change
  app.post("/api/admin/website-changes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const { userId, domain, changeDescription } = req.body;

      if (!userId || !domain || !changeDescription) {
        return res.status(400).json({
          error: "User ID, domain, and change description are required",
        });
      }

      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }

      const currentMonthYear = getCurrentMonthYear();

      // Get user's active subscription
      const userSubscriptions = await storage.getUserSubscriptions(userId);
      const activeSubscription = userSubscriptions.find(
        (sub) => sub.status === "active" && sub.productType === "plan",
      );

      if (!activeSubscription) {
        return res
          .status(400)
          .json({ error: "User has no active subscription" });
      }

      const plan =
        subscriptionPlans[activeSubscription.tier as SubscriptionTier];
      if (!plan) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      // Get or create changes record for this month with proper domain filtering
      let changes = await db
        .select()
        .from(websiteChanges)
        .where(
          sql`user_id = ${userId} AND domain = ${domain} AND month_year = ${currentMonthYear}`,
        )
        .then((rows) => rows[0]);

      if (!changes) {
        // Create new record for this month and domain
        [changes] = await db
          .insert(websiteChanges)
          .values({
            userId: userId,
            domain: domain,
            changesUsed: 0,
            changesAllowed: plan.changesPerMonth,
            monthYear: currentMonthYear,
          })
          .returning();
      }

      // Check if user has changes available (unless unlimited)
      if (
        plan.changesPerMonth !== -1 &&
        changes.changesUsed >= changes.changesAllowed
      ) {
        return res.status(400).json({
          error: "User has reached their monthly changes limit",
          changesUsed: changes.changesUsed,
          changesAllowed: changes.changesAllowed,
        });
      }

      // Record the change log with strict domain filtering
      await db.insert(websiteChangeLogs).values({
        userId: userId,
        domain: domain,
        changeDescription: changeDescription,
        adminId: adminUser.id,
        monthYear: currentMonthYear,
      });

      // Update changes used count for the specific domain (only if not unlimited)
      if (plan.changesPerMonth !== -1) {
        await db
          .update(websiteChanges)
          .set({
            changesUsed: changes.changesUsed + 1,
            updatedAt: new Date(),
          })
          .where(
            sql`id = ${changes.id} AND user_id = ${userId} AND domain = ${domain}`,
          );
      }

      // Send notification email to user - Currently we don't want to send any email to the user about the chagne that we recorded
      // const userEmailHtml = loadTemplate("website-change-recorded.html", {
      //   username: targetUser.username,
      //   domain: domain,
      //   changeDescription: changeDescription,
      //   changesUsed: plan.changesPerMonth === -1 ? 0 : changes.changesUsed + 1,
      //   changesAllowed: plan.changesPerMonth === -1 ? "Unlimited" : plan.changesPerMonth,
      //   remainingChanges: plan.changesPerMonth === -1 ? "Unlimited" : Math.max(0, plan.changesPerMonth - (changes.changesUsed + 1)),
      //   recordedDate: new Date().toLocaleDateString()
      // }, targetUser.language || 'en');

      // await transporter.sendMail({
      //   from: process.env.SMTP_FROM,
      //   to: targetUser.email,
      //   subject: '🔧 Website Change Recorded - hayc',
      //   html: userEmailHtml
      // });

      res.json({ success: true });
    } catch (err) {
      console.error("Error recording website change:", err);
      res.status(500).json({ error: "Failed to record website change" });
    }
  });

  // Admin endpoint to update change log status
  app.patch("/api/admin/website-change-logs/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || !hasPermission(adminUser.role, 'canManageWebsites')) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const changeLogId = parseInt(req.params.id);
      const { status, sendEmail } = req.body;

      if (!status || !["pending", "in-progress", "completed", "confirmed"].includes(status)) {
        return res.status(400).json({ error: "Valid status is required (pending, in-progress, completed, confirmed)" });
      }

      // Get the change log
      const changeLog = await db
        .select()
        .from(websiteChangeLogs)
        .where(eq(websiteChangeLogs.id, changeLogId))
        .then((rows) => rows[0]);

      if (!changeLog) {
        return res.status(404).json({ error: "Change log not found" });
      }

      // Update the change log status
      const updateData: any = { status };
      
      if (status === "completed") {
        updateData.completedBy = adminUser.id;
        updateData.completedAt = new Date();
      }

      await db
        .update(websiteChangeLogs)
        .set(updateData)
        .where(eq(websiteChangeLogs.id, changeLogId));

      // Send email notification if requested and status is completed
      if (sendEmail && status === "completed") {
        const user = await storage.getUserById(changeLog.userId);
        if (user) {
          // Get the website progress to retrieve the project name
          const websiteProgressRecord = await db
            .select()
            .from(websiteProgress)
            .where(
              and(
                eq(websiteProgress.domain, changeLog.domain),
                eq(websiteProgress.userId, changeLog.userId)
              )
            )
            .then((rows) => rows[0]);
          
          const projectName = websiteProgressRecord?.projectName || changeLog.domain;
          
          await sendSubscriptionEmail("change-request-completed", {
            username: user.username,
            email: user.email,
            domain: changeLog.domain,
            projectName: projectName,
            changeDescription: changeLog.changeDescription,
            completedDate: new Date().toLocaleDateString(),
            language: user.language || "en",
            changeLogId: changeLogId,
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating change log status:", err);
      res.status(500).json({ error: "Failed to update change log status" });
    }
  });

  // User endpoint to submit feedback on completed change
  app.post("/api/website-change-logs/:id/feedback", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const changeLogId = parseInt(req.params.id);
      const { feedback, status } = req.body;

      if (!feedback) {
        return res.status(400).json({ error: "Feedback is required" });
      }

      // Get the change log
      const changeLog = await db
        .select()
        .from(websiteChangeLogs)
        .where(eq(websiteChangeLogs.id, changeLogId))
        .then((rows) => rows[0]);

      if (!changeLog) {
        return res.status(404).json({ error: "Change log not found" });
      }

      // Verify this change log belongs to the user
      if (changeLog.userId !== user.id) {
        return res.status(403).json({ error: "Not authorized to provide feedback on this change" });
      }

      // Verify the change is completed
      if (changeLog.status !== "completed") {
        return res.status(400).json({ error: "Can only provide feedback on completed changes" });
      }

      // Update with user feedback
      await db
        .update(websiteChangeLogs)
        .set({
          userFeedback: feedback,
          status: status || "confirmed", // Default to confirmed if user is happy
        })
        .where(eq(websiteChangeLogs.id, changeLogId));

      res.json({ success: true });
    } catch (err) {
      console.error("Error submitting feedback:", err);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Admin endpoint to adjust changes (increase/decrease)
  app.patch("/api/admin/website-changes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const changesId = parseInt(req.params.id);
      const { adjustment, reason } = req.body;

      if (typeof adjustment !== "number" || !reason) {
        return res
          .status(400)
          .json({ error: "Adjustment amount and reason are required" });
      }

      // Get the changes record
      const changes = await db
        .select()
        .from(websiteChanges)
        .where(eq(websiteChanges.id, changesId))
        .then((rows) => rows[0]);

      if (!changes) {
        return res.status(404).json({ error: "Changes record not found" });
      }

      const newChangesUsed = Math.max(0, changes.changesUsed + adjustment);

      // Update the changes record
      await db
        .update(websiteChanges)
        .set({
          changesUsed: newChangesUsed,
          updatedAt: new Date(),
        })
        .where(eq(websiteChanges.id, changesId));

      // Log the adjustment
      await db.insert(websiteChangeLogs).values({
        userId: changes.userId,
        domain: changes.domain,
        changeDescription: `Admin adjustment: ${adjustment > 0 ? "+" : ""}${adjustment} changes. Reason: ${reason}`,
        adminId: adminUser.id,
        monthYear: changes.monthYear,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Error adjusting website changes:", err);
      res.status(500).json({ error: "Failed to adjust website changes" });
    }
  });

  // Admin endpoint to update changes limit
  app.patch("/api/admin/website-changes/:id/limit", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const adminUser = await storage.getUserById(req.user.id);
      if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const changesId = parseInt(req.params.id);
      const { newLimit, reason } = req.body;

      if (typeof newLimit !== "number" || !reason) {
        return res
          .status(400)
          .json({ error: "New limit and reason are required" });
      }

      // Get the changes record
      const changes = await db
        .select()
        .from(websiteChanges)
        .where(eq(websiteChanges.id, changesId))
        .then((rows) => rows[0]);

      if (!changes) {
        return res.status(404).json({ error: "Changes record not found" });
      }

      const oldLimit = changes.changesAllowed;

      // Update the changes limit
      await db
        .update(websiteChanges)
        .set({
          changesAllowed: newLimit,
          updatedAt: new Date(),
        })
        .where(eq(websiteChanges.id, changesId));

      // Log the limit change
      const limitText = newLimit === -1 ? "unlimited" : newLimit.toString();
      const oldLimitText = oldLimit === -1 ? "unlimited" : oldLimit.toString();

      await db.insert(websiteChangeLogs).values({
        userId: changes.userId,
        domain: changes.domain,
        changeDescription: `Limit update: Changed from ${oldLimitText} to ${limitText} changes per month.`,
        adminId: adminUser.id,
        monthYear: changes.monthYear,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating website changes limit:", err);
      res.status(500).json({ error: "Failed to update website changes limit" });
    }
  });

  // Website change request endpoint
  app.post("/api/website-change-request", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { domain, subject, message, files } = req.body;

      if (!domain || !subject || !message) {
        return res
          .status(400)
          .json({ error: "Domain, subject, and message are required" });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentMonthYear = getCurrentMonthYear();

      // Get website by domain to check launch status
      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.domain, domain))
        .limit(1)
        .then((rows) => rows[0]);

      if (!website) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Get stages for this website
      const stages = await db
        .select()
        .from(websiteStages)
        .where(eq(websiteStages.websiteProgressId, website.id))
        .orderBy(websiteStages.stageNumber);

      // Check if "Website Launch" stage is completed
      const websiteLaunchStage = stages.find(
        (stage) => stage.title === "Website Launch"
      );
      const isWebsiteLaunchCompleted = websiteLaunchStage?.status === "completed";

      // Get the subscription for this specific website
      const websiteSubscription = await db
        .select()
        .from(subscriptionsTable)
        .where(
          sql`website_progress_id = ${website.id} AND status = 'active' AND product_type = 'plan'`
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .then((rows) => rows[0]);

      if (!websiteSubscription) {
        return res
          .status(400)
          .json({ error: "No active subscription found for this website" });
      }

      const plan =
        subscriptionPlans[websiteSubscription.tier as SubscriptionTier];
      if (!plan) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      // Get or create changes record for this month
      let changes = await db
        .select()
        .from(websiteChanges)
        .where(
          sql`user_id = ${user.id} AND domain = ${domain} AND month_year = ${currentMonthYear}`,
        )
        .then((rows) => rows[0]);

      if (!changes) {
        // Create new record for this month and domain
        [changes] = await db
          .insert(websiteChanges)
          .values({
            userId: user.id,
            domain: domain,
            changesUsed: 0,
            changesAllowed: plan.changesPerMonth,
            monthYear: currentMonthYear,
          })
          .returning();
      } else if (changes.changesAllowed !== plan.changesPerMonth) {
        // Update existing record if the plan's changesPerMonth has changed
        [changes] = await db
          .update(websiteChanges)
          .set({
            changesAllowed: plan.changesPerMonth,
            updatedAt: new Date(),
          })
          .where(
            sql`id = ${changes.id}`
          )
          .returning();
      }

      // Only check limit if website launch is completed
      // Before launch, allow unlimited changes
      if (isWebsiteLaunchCompleted) {
        // Check if user has changes available (unless unlimited)
        if (
          plan.changesPerMonth !== -1 &&
          changes.changesUsed >= changes.changesAllowed
        ) {
          return res.status(400).json({
            error: "You have reached your monthly changes limit",
            changesUsed: changes.changesUsed,
            changesAllowed: changes.changesAllowed,
          });
        }
      }

      // Parse files if provided
      const parsedFiles = files && Array.isArray(files) ? files : null;

      // Record the change log (adminId is null for customer submissions)
      await db.insert(websiteChangeLogs).values({
        userId: user.id,
        domain: domain,
        changeDescription: `${subject}: ${message}`,
        adminId: null,
        files: parsedFiles,
        monthYear: currentMonthYear,
      });

      // Update changes used count (only if not unlimited AND website launch is completed)
      // Before launch, don't count changes towards the limit
      if (isWebsiteLaunchCompleted && plan.changesPerMonth !== -1) {
        await db
          .update(websiteChanges)
          .set({
            changesUsed: changes.changesUsed + 1,
            updatedAt: new Date(),
          })
          .where(
            sql`id = ${changes.id} AND user_id = ${user.id} AND domain = ${domain}`,
          );
      }

      // Format files as HTML for email (with clickable links)
      // Sanitize file names to prevent XSS in admin emails
      const escapeHtml = (str: string) => 
        str.replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;')
           .replace(/'/g, '&#039;');
      
      let filesHtml: string | null = null;
      if (parsedFiles && parsedFiles.length > 0) {
        const fileItems = parsedFiles.map((file: { name: string; url: string; publicId: string }) => {
          const safeName = escapeHtml(file.name || file.publicId);
          // Cloudinary URLs are already properly encoded, just escape HTML entities for the href attribute
          const safeUrl = file.url.replace(/"/g, '&quot;');
          return `<li style="margin-bottom: 8px;">
            <a href="${safeUrl}" target="_blank" style="color: #007bff; text-decoration: none;">
              📄 ${safeName}
            </a>
          </li>`;
        }).join("");
        filesHtml = `<ul style="margin: 0; padding-left: 20px;">${fileItems}</ul>`;
      }

      // Send admin notification email
      const adminEmailHtml = loadTemplate(
        "admin-change-request-notification.html",
        {
          username: user.username,
          email: user.email,
          domain: website.projectName || domain,
          subject: subject,
          message: message,
          requestDate: new Date().toLocaleDateString(),
          filesHtml: filesHtml,
        },
        "en",
      );

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "development@hayc.gr",
        subject: `🔧 Website Change Request - ${website.projectName || domain}`,
        html: adminEmailHtml,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Error submitting change request:", err);
      res.status(500).json({ error: "Failed to submit change request" });
    }
  });

  // Rate limiter for analytics tracking - 1000 events per hour per IP
  const analyticsTrackingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // limit each IP to 1000 requests per hour
    message: "Too many tracking requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Handle CORS preflight for analytics tracking
  app.options("/api/analytics/track", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });

  // Analytics tracking endpoint (public, no auth required)
  app.post("/api/analytics/track", analyticsTrackingLimiter, async (req, res) => {
    // Set CORS headers to allow tracking from external websites
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    
    try {
      const { key, type, page, referrer, timestamp, sessionId, deviceType } = req.body;

      if (!key || !type || !page) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const analyticsKey = await storage.getAnalyticsKeyByApiKey(key);
      if (!analyticsKey || !analyticsKey.isActive) {
        return res.status(401).json({ error: "Invalid or inactive API key" });
      }

      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const ipHash = createHash("sha256").update(ipAddress).digest("hex");

      await storage.createAnalyticsEvent({
        websiteProgressId: analyticsKey.websiteProgressId,
        eventType: type,
        page,
        referrer: referrer || null,
        userAgent: req.headers["user-agent"] || null,
        ipHash,
        timestamp: new Date(timestamp || Date.now()),
        sessionId: sessionId || null,
        deviceType: deviceType || null,
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Analytics tracking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rate limiter for newsletter subscriptions - 100 per hour per IP
  const newsletterSubscribeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // limit each IP to 100 subscriptions per hour
    message: "Too many subscription requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Handle CORS preflight for newsletter subscribe
  app.options("/api/newsletter/subscribe", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });

  // Newsletter subscription endpoint (public, no auth required)
  // Uses the NEW contacts table with tag support
  app.post("/api/newsletter/subscribe", newsletterSubscribeLimiter, async (req, res) => {
    // Set CORS headers to allow subscriptions from external websites
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    
    try {
      const { key, email, name, firstName, lastName, group, tags: tagNames, subscribed } = req.body;
      
      // Determine subscription status - defaults to true for backward compatibility
      // If 'subscribed' is explicitly false, contact will be added but not subscribed
      const isSubscribed = subscribed !== false;

      if (!key || !email) {
        return res.status(400).json({ error: "Missing required fields: key and email" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Verify API key
      const analyticsKey = await storage.getAnalyticsKeyByApiKey(key);
      if (!analyticsKey || !analyticsKey.isActive) {
        return res.status(401).json({ error: "Invalid or inactive API key" });
      }

      const websiteProgressId = analyticsKey.websiteProgressId;
      
      // Parse name into firstName/lastName if provided
      let parsedFirstName = firstName;
      let parsedLastName = lastName;
      if (name && !firstName && !lastName) {
        const nameParts = name.trim().split(/\s+/);
        parsedFirstName = nameParts[0] || null;
        parsedLastName = nameParts.slice(1).join(' ') || null;
      }

      // Check if contact already exists
      const existingContact = await storage.getContactByEmail(email, websiteProgressId);
      
      // Helper function to assign tags to a contact
      const assignTagsToContact = async (contactId: number) => {
        const tagsToAssign: string[] = [];
        
        // Add group as a tag if provided
        if (group && typeof group === 'string' && group.trim()) {
          tagsToAssign.push(group.trim());
        }
        
        // Add additional tags if provided
        if (tagNames) {
          if (Array.isArray(tagNames)) {
            tagsToAssign.push(...tagNames.filter((t: any) => typeof t === 'string' && t.trim()));
          } else if (typeof tagNames === 'string' && tagNames.trim()) {
            tagsToAssign.push(...tagNames.split(',').map((t: string) => t.trim()).filter(Boolean));
          }
        }

        // Create and assign tags
        for (const tagName of tagsToAssign) {
          try {
            // Check if tag exists, create if not
            let tag = await storage.getTagByName(tagName, websiteProgressId);
            if (!tag) {
              tag = await storage.createTag({
                websiteProgressId,
                name: tagName,
                color: 'bg-blue-100 text-blue-800',
                isSystem: false,
              });
            }
            // Assign tag to contact (will be ignored if already assigned)
            await storage.assignTagToContact(contactId, tag.id);
          } catch (tagError) {
            console.error(`Error assigning tag "${tagName}":`, tagError);
          }
        }
      };

      if (existingContact) {
        // Handle resubscribe: contact wants to subscribe and was previously unsubscribed
        if (isSubscribed && existingContact.status === 'unsubscribed') {
          await storage.updateContact(existingContact.id, websiteProgressId, {
            status: 'active',
            confirmedAt: new Date(),
            unsubscribedAt: null,
          });
          await assignTagsToContact(existingContact.id);
          return res.status(200).json({ success: true, message: "Successfully resubscribed to newsletter" });
        }
        
        // Contact exists - preserve their current subscription status
        // Unsubscribing can only happen via the dedicated unsubscribe link, not through form submissions
        await assignTagsToContact(existingContact.id);
        return res.status(200).json({ success: true, message: "Contact already exists" });
      }

      // Create new contact - status depends on whether they opted in to newsletter
      const newContact = await storage.createContact({
        websiteProgressId,
        email,
        firstName: parsedFirstName,
        lastName: parsedLastName,
        status: isSubscribed ? 'active' : 'unsubscribed',
        confirmedAt: isSubscribed ? new Date() : null,
        unsubscribedAt: isSubscribed ? null : new Date(),
      });

      // Assign tags to the new contact
      await assignTagsToContact(newContact.id);

      const message = isSubscribed 
        ? "Successfully subscribed to newsletter" 
        : "Contact added to list";
      res.status(200).json({ success: true, message });
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle CORS preflight for newsletter unsubscribe
  app.options("/api/newsletter/unsubscribe", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(200);
  });

  // Newsletter unsubscribe endpoint (public, no auth required)
  // Validates HMAC-signed token and updates contact status
  app.get("/api/newsletter/unsubscribe", async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    try {
      const { token, lang } = req.query;
      const language = (lang === 'gr' || lang === 'el') ? 'gr' : 'en';
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'missing_token',
          message: language === 'gr' ? 'Λείπει το token' : 'Missing token' 
        });
      }

      // Verify the token
      const verification = verifyUnsubscribeToken(token);
      
      if (!verification.valid || !verification.payload) {
        const errorMessages: Record<string, { en: string; gr: string }> = {
          'expired': {
            en: 'This unsubscribe link has expired. Please use the link from a more recent email.',
            gr: 'Αυτός ο σύνδεσμος κατάργησης εγγραφής έχει λήξει. Παρακαλώ χρησιμοποιήστε τον σύνδεσμο από ένα πιο πρόσφατο email.'
          },
          'invalid_signature': {
            en: 'Invalid unsubscribe link. The link may have been modified.',
            gr: 'Μη έγκυρος σύνδεσμος κατάργησης εγγραφής. Ο σύνδεσμος μπορεί να έχει τροποποιηθεί.'
          },
          'invalid_format': {
            en: 'Invalid link format.',
            gr: 'Μη έγκυρη μορφή συνδέσμου.'
          },
          'invalid_token': {
            en: 'Invalid unsubscribe link.',
            gr: 'Μη έγκυρος σύνδεσμος κατάργησης εγγραφής.'
          }
        };
        
        const errorKey = verification.error || 'invalid_token';
        const message = errorMessages[errorKey] || errorMessages['invalid_token'];
        
        return res.status(400).json({ 
          success: false, 
          error: errorKey,
          message: language === 'gr' ? message.gr : message.en 
        });
      }

      const { contactId, websiteProgressId, email } = verification.payload;

      // Get the contact
      const contact = await storage.getContactById(contactId, websiteProgressId);
      
      if (!contact) {
        return res.status(404).json({ 
          success: false, 
          error: 'contact_not_found',
          message: language === 'gr' ? 'Η επαφή δεν βρέθηκε.' : 'Contact not found.' 
        });
      }

      // Verify email matches (additional security check)
      if (contact.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
          success: false, 
          error: 'email_mismatch',
          message: language === 'gr' ? 'Μη έγκυρος σύνδεσμος.' : 'Invalid link.' 
        });
      }

      // Check if already unsubscribed
      if (contact.status === 'unsubscribed') {
        return res.status(200).json({ 
          success: true, 
          alreadyUnsubscribed: true,
          message: language === 'gr' ? 'Έχετε ήδη καταργήσει την εγγραφή σας.' : 'You have already unsubscribed.' 
        });
      }

      // Unsubscribe the contact
      await storage.unsubscribeContact(contactId);

      return res.status(200).json({ 
        success: true, 
        message: language === 'gr' 
          ? 'Η εγγραφή σας καταργήθηκε επιτυχώς. Δεν θα λαμβάνετε πλέον emails από εμάς.' 
          : 'You have been successfully unsubscribed. You will no longer receive emails from us.' 
      });
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      return res.status(500).json({ 
        success: false, 
        error: 'server_error',
        message: 'An error occurred. Please try again later.' 
      });
    }
  });

  // Confirm newsletter subscription
  app.get("/api/newsletter/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
              <h2 style="color: #DC2626;">Invalid Confirmation Link</h2>
              <p>The confirmation link appears to be invalid or malformed.</p>
            </body>
          </html>
        `);
      }

      // Get subscriber by token
      const subscriber = await storage.getNewsletterSubscriberByToken(token);

      if (!subscriber) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
              <h2 style="color: #DC2626;">Confirmation Link Not Found</h2>
              <p>This confirmation link is invalid or has already been used.</p>
            </body>
          </html>
        `);
      }

      // Check if already confirmed
      if (subscriber.status === 'confirmed') {
        return res.status(200).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
              <div style="background-color: #F3F4F6; padding: 30px; border-radius: 10px;">
                <h2 style="color: #059669;">✓ Already Confirmed</h2>
                <p>Your subscription has already been confirmed. Thank you!</p>
              </div>
            </body>
          </html>
        `);
      }

      // Confirm the subscription
      await storage.confirmNewsletterSubscriber(token);

      return res.status(200).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
            <div style="background-color: #F0FDF4; padding: 30px; border-radius: 10px; border: 2px solid #059669;">
              <h2 style="color: #059669;">✓ Subscription Confirmed!</h2>
              <p style="font-size: 18px; margin-top: 20px;">Thank you for confirming your subscription.</p>
              <p style="color: #666;">You will now receive our newsletter updates.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Newsletter confirmation error:", error);
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
            <h2 style="color: #DC2626;">Error</h2>
            <p>An error occurred while confirming your subscription. Please try again later.</p>
          </body>
        </html>
      `);
    }
  });

  // Get analytics data for a website (authenticated)
  app.get("/api/analytics/:websiteId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.websiteId);
      const { startDate, endDate } = req.query;

      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId));

      if (!website || website.length === 0) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Allow access if user owns the website OR has permission to view websites
      if (website[0].userId !== req.user.id && !hasPermission(req.user.role, 'canViewWebsites')) {
        return res.status(403).json({ error: "Access denied" });
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const summary = await storage.getAnalyticsSummary(websiteId, start, end);

      res.json(summary);
    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get or create analytics key for a website (authenticated)
  app.get("/api/analytics/keys/:websiteId", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const websiteId = parseInt(req.params.websiteId);

      const website = await db
        .select()
        .from(websiteProgress)
        .where(eq(websiteProgress.id, websiteId));

      if (!website || website.length === 0) {
        return res.status(404).json({ error: "Website not found" });
      }

      // Allow access if user owns the website OR has permission to view websites
      if (website[0].userId !== req.user.id && !hasPermission(req.user.role, 'canViewWebsites')) {
        return res.status(403).json({ error: "Access denied" });
      }

      let analyticsKey = await storage.getAnalyticsKeyByWebsiteId(websiteId);
      
      if (!analyticsKey) {
        analyticsKey = await storage.createAnalyticsKey(websiteId, website[0].domain);
      }

      const trackingScript = `<!-- Hayc Analytics -->
<script>
(function() {
  var apiKey = '${analyticsKey.apiKey}';
  var endpoint = '${req.protocol}://${req.get('host')}/api/analytics/track';
  
  function getSessionId() {
    try {
      var sessionId = sessionStorage.getItem('hayc_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('hayc_session_id', sessionId);
      }
      return sessionId;
    } catch (e) {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }
  
  function detectDevice() {
    var ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'Mobile';
    }
    return 'Desktop';
  }
  
  function trackPageview() {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        type: 'pageview',
        page: window.location.pathname,
        referrer: document.referrer,
        timestamp: Date.now(),
        sessionId: getSessionId(),
        deviceType: detectDevice()
      })
    }).catch(function() {});
  }
  
  if (document.readyState === 'complete') {
    trackPageview();
  } else {
    window.addEventListener('load', trackPageview);
  }
})();
</script>`;

      const phpTrackingCode = `<?php
// Add Hayc Analytics tracking code to WordPress header
function hayc_analytics_tracking_code() {
    ?>
    <!-- Hayc Analytics -->
    <script>
    (function() {
      var apiKey = '${analyticsKey.apiKey}';
      var endpoint = '${req.protocol}://${req.get('host')}/api/analytics/track';
      
      function getSessionId() {
        try {
          var sessionId = sessionStorage.getItem('hayc_session_id');
          if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('hayc_session_id', sessionId);
          }
          return sessionId;
        } catch (e) {
          return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
      }
      
      function detectDevice() {
        var ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
          return 'Tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
          return 'Mobile';
        }
        return 'Desktop';
      }
      
      function trackPageview() {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: apiKey,
            type: 'pageview',
            page: window.location.pathname,
            referrer: document.referrer,
            timestamp: Date.now(),
            sessionId: getSessionId(),
            deviceType: detectDevice()
          })
        }).catch(function() {});
      }
      
      if (document.readyState === 'complete') {
        trackPageview();
      } else {
        window.addEventListener('load', trackPageview);
      }
    })();
    </script>
    <?php
}
add_action('wp_head', 'hayc_analytics_tracking_code');
?>`;

      const phpNewsletterCode = `<?php
/**
 * Hayc Contact Form 7 Integration
 * Sends ALL form submissions to hayc contact list.
 * Checkbox determines if contact is subscribed (receives newsletters) or not.
 */
function hayc_contact_form_handler(\$contact_form) {
    \$submission = WPCF7_Submission::get_instance();
    if (\$submission) {
        \$posted_data = \$submission->get_posted_data();
        
        // Get email - required
        \$email = isset(\$posted_data['your-email']) ? trim(\$posted_data['your-email']) : '';
        
        if (!empty(\$email)) {
            // Get first name
            \$fname = isset(\$posted_data['your-first-name']) ? trim(\$posted_data['your-first-name']) : '';
            
            // Get last name
            \$lname = isset(\$posted_data['your-last-name']) ? trim(\$posted_data['your-last-name']) : '';
            
            // Check if newsletter checkbox is checked
            \$newsletter_opt_in = isset(\$posted_data['newsletter-subscribe']) ? \$posted_data['newsletter-subscribe'] : array();
            \$is_subscribed = (is_array(\$newsletter_opt_in) && !empty(\$newsletter_opt_in)) || 
                             (!is_array(\$newsletter_opt_in) && !empty(\$newsletter_opt_in));

            // Get tags from multiple sources and combine them
            \$all_tags = array();
            
            // Try to get hayc-tags from raw POST (preserves arrays if form sends them)
            if (isset(\$_POST['hayc-tags'])) {
                \$raw_post_tags = \$_POST['hayc-tags'];
                if (is_array(\$raw_post_tags)) {
                    \$all_tags = array_merge(\$all_tags, array_filter(array_map('trim', \$raw_post_tags)));
                } else {
                    \$trimmed = trim(\$raw_post_tags);
                    if (!empty(\$trimmed)) {
                        \$all_tags[] = \$trimmed;
                    }
                }
            } elseif (isset(\$posted_data['hayc-tags'])) {
                // Fallback to CF7 posted data
                \$fixed_tags = \$posted_data['hayc-tags'];
                if (is_array(\$fixed_tags)) {
                    \$all_tags = array_merge(\$all_tags, array_filter(array_map('trim', \$fixed_tags)));
                } else {
                    \$trimmed = trim(\$fixed_tags);
                    if (!empty(\$trimmed)) {
                        \$all_tags[] = \$trimmed;
                    }
                }
            }
            
            // Also check for hayc-user-tag (alternative field for user input)
            if (isset(\$posted_data['hayc-user-tag'])) {
                \$user_tags = \$posted_data['hayc-user-tag'];
                if (is_array(\$user_tags)) {
                    \$all_tags = array_merge(\$all_tags, array_filter(array_map('trim', \$user_tags)));
                } else {
                    \$trimmed = trim(\$user_tags);
                    if (!empty(\$trimmed)) {
                        \$all_tags[] = \$trimmed;
                    }
                }
            }
            
            // Join all tags or use fallback
            \$tags = !empty(\$all_tags) ? implode(', ', \$all_tags) : 'Contact Form';
            
            
            // Send ALL contacts - checkbox determines subscription status
            \$api_data = array(
                'key' => '${analyticsKey.apiKey}',
                'email' => \$email,
                'firstName' => \$fname,
                'lastName' => \$lname,
                'subscribed' => \$is_subscribed,
                'tags' => \$tags
            );
            
            wp_remote_post('${req.protocol}://${req.get('host')}/api/newsletter/subscribe', array(
                'body' => json_encode(\$api_data),
                'headers' => array('Content-Type' => 'application/json'),
                'timeout' => 15
            ));
        }
    }
}
add_action('wpcf7_mail_sent', 'hayc_contact_form_handler');
?>`;

      res.json({ 
        key: analyticsKey,
        trackingScript,
        phpTrackingCode,
        phpNewsletterCode
      });
    } catch (error) {
      console.error("Get analytics key error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle analytics key status (admin only)
  app.patch("/api/analytics/keys/:id/toggle", async (req, res) => {
    if (!req.user || req.user.role !== UserRole.ADMINISTRATOR) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const keyId = parseInt(req.params.id);
      const { isActive } = req.body;

      const updatedKey = await storage.updateAnalyticsKeyStatus(keyId, isActive);
      res.json(updatedKey);
    } catch (error) {
      console.error("Toggle analytics key error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Wrapp webhook endpoint for PDF generation completion
  app.post("/api/wrapp-webhook", express.json(), async (req, res) => {
    try {
      console.log('[Wrapp Webhook] Received webhook:', req.body);
      
      const result = await handleWrappPdfGenerationWebhook(req.body);
      
      if (result.success) {
        return res.status(200).json({ 
          success: true, 
          message: result.message,
          invoiceId: result.invoiceId
        });
      } else {
        console.error('[Wrapp Webhook] Processing failed:', result.message);
        return res.status(400).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error: any) {
      console.error('[Wrapp Webhook] Error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      });
    }
  });

  // SNS webhook endpoint for SES event notifications
  app.post("/api/sns-webhook", express.json({ type: 'text/plain' }), async (req, res) => {
    try {
      const message = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // Handle SNS subscription confirmation
      if (message.Type === 'SubscriptionConfirmation') {
        const https = await import('https');
        https.get(message.SubscribeURL, () => {});
        return res.status(200).json({ message: 'Subscription confirmed' });
      }
      
      // Handle SNS notifications
      if (message.Type === 'Notification') {
        const sesMessage = JSON.parse(message.Message);
        
        if (sesMessage.eventType === 'Delivery' || sesMessage.notificationType === 'Delivery') {
          await handleDeliveryEvent(sesMessage);
        } else if (sesMessage.eventType === 'Bounce' || sesMessage.notificationType === 'Bounce') {
          await handleBounceEvent(sesMessage);
        } else if (sesMessage.eventType === 'Complaint' || sesMessage.notificationType === 'Complaint') {
          await handleComplaintEvent(sesMessage);
        } else if (sesMessage.eventType === 'Open') {
          await handleOpenEvent(sesMessage);
        } else if (sesMessage.eventType === 'Click') {
          await handleClickEvent(sesMessage);
        }
        
        return res.status(200).json({ message: 'Event processed' });
      }
      
      res.status(200).json({ message: 'Unknown message type' });
    } catch (error) {
      console.error('SNS webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============================================
  // Custom Payments API Routes
  // ============================================
  
  // Get all custom payments
  app.get("/api/admin/custom-payments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const payments = await storage.getAllCustomPayments();
      res.json({ payments });
    } catch (error) {
      console.error("Error fetching custom payments:", error);
      res.status(500).json({ error: "Failed to fetch custom payments" });
    }
  });

  // Create custom payment
  app.post("/api/admin/custom-payments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { clientName, email, amount, currency, frequency, startDate, paymentType, description, userId, subscriptionId, notes } = req.body;

      if (!clientName || !amount || !startDate) {
        return res.status(400).json({ error: "Client name, amount, and start date are required" });
      }

      const payment = await storage.createCustomPayment({
        clientName,
        email: email || null,
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency || "eur",
        frequency: frequency || "monthly",
        startDate: new Date(startDate),
        paymentType: paymentType || "cash",
        description: description || null,
        isActive: true,
        userId: userId || null,
        subscriptionId: subscriptionId || null,
        notes: notes || null,
      });

      res.json({ payment });
    } catch (error) {
      console.error("Error creating custom payment:", error);
      res.status(500).json({ error: "Failed to create custom payment" });
    }
  });

  // Update custom payment
  app.patch("/api/admin/custom-payments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const paymentId = parseInt(req.params.id);
      const updates = req.body;

      // Convert amount to cents if provided
      if (updates.amount !== undefined) {
        updates.amount = Math.round(updates.amount * 100);
      }
      
      // Convert startDate to Date if provided
      if (updates.startDate) {
        updates.startDate = new Date(updates.startDate);
      }

      const payment = await storage.updateCustomPayment(paymentId, updates);
      res.json({ payment });
    } catch (error) {
      console.error("Error updating custom payment:", error);
      res.status(500).json({ error: "Failed to update custom payment" });
    }
  });

  // Stop custom payment (deactivate)
  app.post("/api/admin/custom-payments/:id/stop", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const paymentId = parseInt(req.params.id);
      const payment = await storage.stopCustomPayment(paymentId);
      
      // Also mark any pending obligations for this payment as stopped
      const obligations = await storage.getObligationsByCustomPaymentId(paymentId);
      for (const obligation of obligations) {
        if (obligation.status === 'pending' || obligation.status === 'grace') {
          await storage.markObligationStopped(obligation.id);
        }
      }
      
      res.json({ payment });
    } catch (error) {
      console.error("Error stopping custom payment:", error);
      res.status(500).json({ error: "Failed to stop custom payment" });
    }
  });

  // Exclude a specific date from a custom payment (delete single occurrence)
  app.post("/api/admin/custom-payments/:id/exclude-date", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const paymentId = parseInt(req.params.id);
      const { date } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }
      
      // Normalize the date to YYYY-MM-DD format
      const normalizedDate = new Date(date).toISOString().split('T')[0];
      
      const payment = await storage.excludeDateFromCustomPayment(paymentId, normalizedDate);
      res.json({ payment });
    } catch (error) {
      console.error("Error excluding date from custom payment:", error);
      res.status(500).json({ error: "Failed to exclude date from custom payment" });
    }
  });

  // Delete custom payment
  app.delete("/api/admin/custom-payments/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const paymentId = parseInt(req.params.id);
      await storage.deleteCustomPayment(paymentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom payment:", error);
      res.status(500).json({ error: "Failed to delete custom payment" });
    }
  });

  // ============================================
  // Payment Obligations API Routes
  // ============================================

  // Get all payment obligations
  app.get("/api/admin/payment-obligations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { status, outstanding } = req.query;
      
      let obligations;
      if (outstanding === 'true') {
        obligations = await storage.getOutstandingObligations();
      } else if (status && typeof status === 'string') {
        obligations = await storage.getPaymentObligationsByStatus(status);
      } else {
        obligations = await storage.getAllPaymentObligations();
      }
      
      res.json({ obligations });
    } catch (error) {
      console.error("Error fetching payment obligations:", error);
      res.status(500).json({ error: "Failed to fetch payment obligations" });
    }
  });

  // Create payment obligation
  app.post("/api/admin/payment-obligations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { customPaymentId, subscriptionId, userId, clientName, amountDue, currency, dueDate, origin, stripeInvoiceId, graceDays, notes } = req.body;

      if (!clientName || !amountDue || !dueDate) {
        return res.status(400).json({ error: "Client name, amount due, and due date are required" });
      }

      const obligation = await storage.createPaymentObligation({
        customPaymentId: customPaymentId || null,
        subscriptionId: subscriptionId || null,
        userId: userId || null,
        clientName,
        amountDue: Math.round(amountDue * 100), // Convert to cents
        currency: currency || "eur",
        dueDate: new Date(dueDate),
        status: "pending",
        origin: origin || "custom",
        stripeInvoiceId: stripeInvoiceId || null,
        stripePaymentIntentId: null,
        graceDays: graceDays || 7,
        notes: notes || null,
      });

      res.json({ obligation });
    } catch (error) {
      console.error("Error creating payment obligation:", error);
      res.status(500).json({ error: "Failed to create payment obligation" });
    }
  });

  // Update payment obligation
  app.patch("/api/admin/payment-obligations/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const updates = req.body;

      // Convert amount to cents if provided
      if (updates.amountDue !== undefined) {
        updates.amountDue = Math.round(updates.amountDue * 100);
      }
      
      // Convert dueDate to Date if provided
      if (updates.dueDate) {
        updates.dueDate = new Date(updates.dueDate);
      }

      const obligation = await storage.updatePaymentObligation(obligationId, updates);
      res.json({ obligation });
    } catch (error) {
      console.error("Error updating payment obligation:", error);
      res.status(500).json({ error: "Failed to update payment obligation" });
    }
  });

  // Mark obligation as settled (paid)
  app.post("/api/admin/payment-obligations/:id/settle", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const { amountPaid, paymentMethod, reference, notes, paidAt } = req.body;

      // Get the obligation
      const obligation = await storage.getPaymentObligationById(obligationId);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }

      // Create a settlement record
      await storage.createPaymentSettlement({
        obligationId,
        amountPaid: amountPaid ? Math.round(amountPaid * 100) : obligation.amountDue,
        currency: obligation.currency,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paymentMethod: paymentMethod || null,
        reference: reference || null,
        notes: notes || null,
      });

      // Mark the obligation as settled
      const settledObligation = await storage.markObligationSettled(obligationId);
      res.json({ obligation: settledObligation });
    } catch (error) {
      console.error("Error settling payment obligation:", error);
      res.status(500).json({ error: "Failed to settle payment obligation" });
    }
  });

  // Revert obligation to unpaid (undo "mark as paid")
  app.post("/api/admin/payment-obligations/:id/unsettle", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const obligation = await storage.getPaymentObligationById(obligationId);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }
      if (obligation.status !== "settled") {
        return res.status(400).json({ error: "Only settled obligations can be reverted to unpaid" });
      }

      const revertedObligation = await storage.revertObligationToUnpaid(obligationId);
      res.json({ obligation: revertedObligation });
    } catch (error) {
      console.error("Error reverting payment obligation:", error);
      res.status(500).json({ error: "Failed to revert payment obligation" });
    }
  });

  // Mark obligation as stopped
  app.post("/api/admin/payment-obligations/:id/stop", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const obligation = await storage.markObligationStopped(obligationId);
      res.json({ obligation });
    } catch (error) {
      console.error("Error stopping payment obligation:", error);
      res.status(500).json({ error: "Failed to stop payment obligation" });
    }
  });

  // Mark obligation as written off
  app.post("/api/admin/payment-obligations/:id/write-off", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const { notes } = req.body;
      const obligation = await storage.markObligationWrittenOff(obligationId, notes);
      res.json({ obligation });
    } catch (error) {
      console.error("Error writing off payment obligation:", error);
      res.status(500).json({ error: "Failed to write off payment obligation" });
    }
  });

  // Get settlements for an obligation
  app.get("/api/admin/payment-obligations/:id/settlements", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const settlements = await storage.getSettlementsByObligationId(obligationId);
      const totalSettled = await storage.getTotalSettledForObligation(obligationId);
      res.json({ settlements, totalSettled });
    } catch (error) {
      console.error("Error fetching settlements:", error);
      res.status(500).json({ error: "Failed to fetch settlements" });
    }
  });

  // Add partial payment to an obligation
  app.post("/api/admin/payment-obligations/:id/partial-payment", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "administrator";
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const obligationId = parseInt(req.params.id);
      const { amountPaid, paymentMethod, reference, notes, paidAt } = req.body;

      if (!amountPaid) {
        return res.status(400).json({ error: "Amount paid is required" });
      }

      // Get the obligation
      const obligation = await storage.getPaymentObligationById(obligationId);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }

      // Create a settlement record
      const settlement = await storage.createPaymentSettlement({
        obligationId,
        amountPaid: Math.round(amountPaid * 100),
        currency: obligation.currency,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paymentMethod: paymentMethod || null,
        reference: reference || null,
        notes: notes || null,
      });

      // Check if obligation is now fully paid
      const totalSettled = await storage.getTotalSettledForObligation(obligationId);
      if (totalSettled >= obligation.amountDue) {
        await storage.markObligationSettled(obligationId);
      }

      const updatedObligation = await storage.getPaymentObligationById(obligationId);
      res.json({ settlement, obligation: updatedObligation, totalSettled });
    } catch (error) {
      console.error("Error adding partial payment:", error);
      res.status(500).json({ error: "Failed to add partial payment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions for SES event processing
async function handleDeliveryEvent(sesMessage: any) {
  try {
    const messageId = sesMessage.mail?.messageId;
    if (!messageId) return;
    
    const campaignId = await getCampaignIdFromMessageId(messageId);
    if (!campaignId) return;
    
    await db.execute(sql`
      UPDATE newsletter_campaigns 
      SET delivered_count = COALESCE(delivered_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);
  } catch (error) {
    console.error('Error handling delivery event:', error);
  }
}

async function handleBounceEvent(sesMessage: any) {
  try {
    const messageId = sesMessage.mail?.messageId;
    if (!messageId) return;
    
    const campaignId = await getCampaignIdFromMessageId(messageId);
    if (!campaignId) return;
    
    await db.execute(sql`
      UPDATE newsletter_campaigns 
      SET bounce_count = COALESCE(bounce_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);
  } catch (error) {
    console.error('Error handling bounce event:', error);
  }
}

async function handleComplaintEvent(sesMessage: any) {
  try {
    const messageId = sesMessage.mail?.messageId;
    if (!messageId) return;
    
    const campaignId = await getCampaignIdFromMessageId(messageId);
    if (!campaignId) return;
    
    await db.execute(sql`
      UPDATE newsletter_campaigns 
      SET complaint_count = COALESCE(complaint_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);
  } catch (error) {
    console.error('Error handling complaint event:', error);
  }
}

async function handleOpenEvent(sesMessage: any) {
  try {
    const messageId = sesMessage.mail?.messageId;
    if (!messageId) return;
    
    const campaignId = await getCampaignIdFromMessageId(messageId);
    if (!campaignId) return;
    
    await db.execute(sql`
      UPDATE newsletter_campaigns 
      SET open_count = COALESCE(open_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);
  } catch (error) {
    console.error('Error handling open event:', error);
  }
}

async function handleClickEvent(sesMessage: any) {
  try {
    const messageId = sesMessage.mail?.messageId;
    if (!messageId) return;
    
    const campaignId = await getCampaignIdFromMessageId(messageId);
    if (!campaignId) return;
    
    await db.execute(sql`
      UPDATE newsletter_campaigns 
      SET click_count = COALESCE(click_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);
  } catch (error) {
    console.error('Error handling click event:', error);
  }
}

// Helper to get campaign ID from SES message ID
async function getCampaignIdFromMessageId(messageId: string): Promise<number | null> {
  try {
    const result = await db
      .select({ campaignId: campaignMessages.campaignId })
      .from(campaignMessages)
      .where(eq(campaignMessages.messageId, messageId))
      .limit(1);
    
    return result[0]?.campaignId || null;
  } catch (error) {
    console.error('Error getting campaign ID:', error);
    return null;
  }
}

// Helper function to get current month-year string
function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function findUserByEmail(email: string) {
  try {
    const user = await storage.getUserByEmail(email);
    return user;
  } catch (error) {
    console.error("Error finding user:", error);
    return null;
  }
}

const webhookMiddleware = express.raw({ type: "application/json" });

async function syncStripeSubscriptions(
  stripeCustomerId: string,
  userId: number,
): Promise<Subscription[]> {
  try {
    // Get all subscriptions from Stripe with expanded items data
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      expand: ["data.items", "data.items.data.price"], // Expand items and their prices
    });

    // Get existing subscriptions before clearing
    const existingSubscriptions = await storage.getUserSubscriptions(userId);

    // Define active statuses that we'll sync
    const activeStatuses = ["active", "trialing", "past_due", "incomplete"];

    // Filter to get only active-status subscriptions that we'll delete and recreate
    const activeSubscriptions = existingSubscriptions.filter(sub => 
      activeStatuses.includes(sub.status)
    );

    // Preserve PDF URLs, add-ons, and websiteProgressId from active subscriptions
    // Map by stripeSubscriptionId for accurate matching
    const existingPdfUrls = new Map(
      activeSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.pdfUrl]),
    );

    const existingAddOns = new Map(
      activeSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.addOns || []]),
    );

    const existingWebsiteProgressIds = new Map(
      activeSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.websiteProgressId]),
    );

    // Build transaction PDF map from active subscriptions only
    const transactionPdfMap = new Map<string, string | null>();

    // Delete transactions and subscriptions for ONLY active-status subscriptions
    for (const subscription of activeSubscriptions) {
      // Get transactions for this subscription
      const transactionsList = await db
        .select()
        .from(transactions)
        .where(eq(transactions.subscriptionId, subscription.id));

      // Preserve PDF URLs
      for (const transaction of transactionsList) {
        const key = `${subscription.tier}_${transaction.amount}`;
        transactionPdfMap.set(key, transaction.pdfUrl);
      }

      // Delete transactions
      await db
        .delete(transactions)
        .where(eq(transactions.subscriptionId, subscription.id));
    }

    // Delete only active-status subscriptions (cancelled subscriptions remain untouched)
    if (activeSubscriptions.length > 0) {
      const activeSubscriptionIds = activeSubscriptions.map(sub => sub.id);
      await db
        .delete(subscriptionsTable)
        .where(
          sql`${subscriptionsTable.id} IN (${sql.join(activeSubscriptionIds.map(id => sql`${id}`), sql`, `)})`
        );
    }

    console.log(`🔄 Syncing active subscriptions: deleted ${activeSubscriptions.length} active subscriptions, preserved ${existingSubscriptions.length - activeSubscriptions.length} cancelled/other status subscriptions`);

    // Create new subscriptions from active Stripe subscriptions
    for (const stripeSub of stripeSubscriptions.data) {
      const priceId = stripeSub.items.data[0]?.price.id;
      const price = stripeSub.items.data[0]?.price.unit_amount || null;
      
      if (!priceId) {
        console.warn("Missing price ID for subscription:", stripeSub.id);
        continue;
      }

      // Check both monthly and yearly price IDs for current plans
      let tier: SubscriptionTier | undefined;
      let billingPeriod: "monthly" | "yearly" | undefined;
      let productType: 'plan' | 'addon' = 'plan';
      let productId: string | undefined;

      // First, check if it's a tier subscription
      for (const [t, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
        if (prices.monthly === priceId) {
          tier = t as SubscriptionTier;
          billingPeriod = "monthly";
          productType = 'plan';
          productId = undefined;
          break;
        }
        if (prices.yearly === priceId) {
          tier = t as SubscriptionTier;
          billingPeriod = "yearly";
          productType = 'plan';
          productId = undefined;
          break;
        }
      }

      // If not a tier, check if it's an add-on
      if (!tier || !billingPeriod) {
        const addOnId = PRICE_TO_ADDON_MAP[priceId];
        if (addOnId) {
          // This is an add-on subscription
          productType = 'addon';
          productId = addOnId;
          // Get the add-on name from availableAddOns
          const addOnDetails = availableAddOns.find(a => a.id === addOnId);
          tier = (addOnDetails?.name || 'Add-on') as SubscriptionTier; // Use actual add-on name
          // Get billing period from Stripe
          try {
            const priceDetails = await stripe.prices.retrieve(priceId);
            const interval = priceDetails.recurring?.interval;
            billingPeriod = interval === "year" ? "yearly" : "monthly";
          } catch (priceError) {
            billingPeriod = "monthly"; // Default to monthly
          }
        } else {
          // If we don't recognize the price ID, treat it as a legacy subscription
          try {
            const priceDetails = await stripe.prices.retrieve(priceId);
            const interval = priceDetails.recurring?.interval;
            billingPeriod = interval === "year" ? "yearly" : "monthly";
            tier = `legacy_${priceId.substring(0, 10)}` as SubscriptionTier;
            productType = 'plan';
          } catch (priceError) {
            console.warn(`Could not retrieve price details for ${priceId}, using defaults`);
            tier = `legacy_${priceId.substring(0, 10)}` as SubscriptionTier;
            billingPeriod = "monthly";
            productType = 'plan';
          }
        }
      }

      // Only create subscription if it's active or active-like in Stripe
      // Include trialing, past_due, and incomplete subscriptions that users should still have access to
      if (["active", "trialing", "past_due", "incomplete"].includes(stripeSub.status)) {
        // Get add-ons from Stripe subscription items (excluding the main subscription item)
        const stripeAddOnPriceIds = stripeSub.items.data
          .slice(1) // Skip the first item which is the main subscription
          .map((item) => item.price.id)
          .filter(Boolean);

        // Convert Stripe price IDs to our add-on IDs
        const stripeAddOns = stripeAddOnPriceIds
          .map(priceId => PRICE_TO_ADDON_MAP[priceId])
          .filter(Boolean);

        // Use Stripe add-ons if available, otherwise fall back to stored add-ons
        const addOns =
          stripeAddOns.length > 0
            ? stripeAddOns
            : existingAddOns.get(stripeSub.id) || [];

        // Create subscription with preserved PDF URL, add-ons, websiteProgressId, and original Stripe creation date
        try {
          const subscription = await storage.createSubscription({
            userId,
            productType,
            productId,
            tier,
            status: stripeSub.status,
            price,
            vatNumber: null,
            pdfUrl: existingPdfUrls.get(stripeSub.id) || null, // Preserve existing PDF URL
            addOns: addOns, // Include preserved add-ons
            billingPeriod: billingPeriod, // Include detected billing period
            createdAt: new Date(stripeSub.created * 1000), // Use Stripe's original creation timestamp
            websiteProgressId: existingWebsiteProgressIds.get(stripeSub.id) || null, // Preserve website association
            stripeSubscriptionId: stripeSub.id, // Store Stripe subscription ID for future syncs
          });

          // Only create transactions if subscription was successfully created
          if (subscription && subscription.id) {
            // Fetch all invoices for this subscription
            const invoices = await stripe.invoices.list({
              subscription: stripeSub.id,
            });

            // Create transactions for each invoice, preserving existing PDF URLs
            for (const invoice of invoices.data) {
              if (invoice.status === "paid") {
                try {
                  // Create a key to look up existing PDF URL
                  const transactionKey = `${tier}_${invoice.amount_paid}`;
                  const existingPdfUrl = transactionPdfMap.get(transactionKey);

                  const paidAt = invoice.status_transitions?.paid_at 
                    ? new Date(invoice.status_transitions.paid_at * 1000)
                    : new Date(invoice.created * 1000);

                  await storage.createTransaction({
                    subscriptionId: subscription.id,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    status: invoice.status,
                    pdfUrl: existingPdfUrl || null, // Use existing PDF URL if available
                    stripeInvoiceId: invoice.id,
                    paidAt: paidAt,
                    createdAt: paidAt, // Use the actual payment date
                  });
                } catch (transactionError) {
                  console.error(`Failed to create transaction for subscription ${subscription.id}, invoice ${invoice.id}:`, transactionError);
                  // Continue with other transactions instead of failing completely
                }
              }
            }
          }
        } catch (subscriptionError) {
          console.error(`Failed to create subscription for user ${userId}, tier ${tier}, Stripe subscription ${stripeSub.id}:`, subscriptionError);
          // Continue with other subscriptions instead of failing completely
        }
      }
    }

    // Get fresh subscriptions from storage
    const subscriptions = await storage.getUserSubscriptions(userId);

    return subscriptions;
  } catch (error) {
    console.error("Error syncing subscriptions:", error);
    throw error;
  }
}

// New function for syncing all subscriptions while preserving cancelled ones
async function syncAllStripeSubscriptions(
  stripeCustomerId: string,
  userId: number,
): Promise<Subscription[]> {
  try {
    // Get all subscriptions from Stripe with expanded items data (including all statuses)
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all", // This includes active, cancelled, incomplete, etc.
      expand: ["data.items", "data.items.data.price"],
    });

    // Get existing subscriptions and transaction PDFs before clearing ALL subscriptions
    const existingSubscriptions = await storage.getUserSubscriptions(userId);

    // Get ALL subscriptions to delete their transactions first
    const allExistingSubscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));

    // Delete transactions for ALL subscriptions first to avoid foreign key constraint violations
    for (const subscription of allExistingSubscriptions) {
      await db
        .delete(transactionsTable)
        .where(eq(transactionsTable.subscriptionId, subscription.id));
    }

    // Now safe to delete ALL subscriptions
    await db
      .delete(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));

    // Preserve PDF URLs, add-ons, and websiteProgressId from existing subscriptions
    // Map by stripeSubscriptionId for accurate matching
    const existingPdfUrls = new Map(
      existingSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.pdfUrl]),
    );

    const existingAddOns = new Map(
      existingSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.addOns || []]),
    );

    const existingWebsiteProgressIds = new Map(
      existingSubscriptions.map((sub) => [sub.stripeSubscriptionId, sub.websiteProgressId]),
    );

    // Create subscriptions from Stripe subscriptions (include all statuses including incomplete_expired)
    for (const stripeSub of stripeSubscriptions.data) {
      const priceId = stripeSub.items.data[0]?.price.id;
      const price = stripeSub.items.data[0]?.price.unit_amount || null;
      
      if (!priceId) {
        console.warn("Missing price ID for subscription:", stripeSub.id);
        continue;
      }

      // Check both monthly and yearly price IDs for current plans
      let tier: SubscriptionTier | undefined;
      let billingPeriod: "monthly" | "yearly" | undefined;
      let productType: 'plan' | 'addon' = 'plan';
      let productId: string | undefined;

      // First, check if it's a tier subscription
      for (const [t, prices] of Object.entries(SUBSCRIPTION_PRICES)) {
        if (prices.monthly === priceId) {
          tier = t as SubscriptionTier;
          billingPeriod = "monthly";
          productType = 'plan';
          productId = undefined;
          break;
        }
        if (prices.yearly === priceId) {
          tier = t as SubscriptionTier;
          billingPeriod = "yearly";
          productType = 'plan';
          productId = undefined;
          break;
        }
      }

      // If not a tier, check if it's an add-on
      if (!tier || !billingPeriod) {
        const addOnId = PRICE_TO_ADDON_MAP[priceId];
        if (addOnId) {
          // This is an add-on subscription
          productType = 'addon';
          productId = addOnId;
          // Get the add-on name from availableAddOns
          const addOnDetails = availableAddOns.find(a => a.id === addOnId);
          tier = (addOnDetails?.name || 'Add-on') as SubscriptionTier; // Use actual add-on name
          console.log(`Add-on subscription detected: ${addOnId} (${tier}), priceId: ${priceId}`);
          // Get billing period from Stripe
          try {
            const priceDetails = await stripe.prices.retrieve(priceId);
            const interval = priceDetails.recurring?.interval;
            billingPeriod = interval === "year" ? "yearly" : "monthly";
          } catch (priceError) {
            billingPeriod = "monthly"; // Default to monthly
          }
        } else {
          // If we don't recognize the price ID, treat it as a legacy subscription
          console.log(`Legacy/Unknown price ID: ${priceId} - treating as legacy subscription`);
          try {
            const priceDetails = await stripe.prices.retrieve(priceId);
            const interval = priceDetails.recurring?.interval;
            billingPeriod = interval === "year" ? "yearly" : "monthly";
            tier = `legacy_${priceId.substring(0, 10)}` as SubscriptionTier;
            productType = 'plan';
            console.log(`Legacy subscription mapped to tier: ${tier}, billing: ${billingPeriod}`);
          } catch (priceError) {
            console.warn(`Could not retrieve price details for ${priceId}, using defaults`);
            tier = `legacy_${priceId.substring(0, 10)}` as SubscriptionTier;
            billingPeriod = "monthly";
            productType = 'plan';
          }
        }
      }

      // Create subscription with preserved PDF URL, add-ons, websiteProgressId, and original Stripe creation date
      try {
        const subscription = await storage.createSubscription({
          userId,
          productType,
          productId,
          tier,
          status: stripeSub.status, // This could be active, cancelled, etc.
          price,
          vatNumber: null,
          pdfUrl: existingPdfUrls.get(stripeSub.id) || null,
          addOns: existingAddOns.get(stripeSub.id) || [], // Use preserved add-ons for this Stripe subscription
          billingPeriod,
          createdAt: new Date(stripeSub.created * 1000),
          websiteProgressId: existingWebsiteProgressIds.get(stripeSub.id) || null, // Preserve website association
          stripeSubscriptionId: stripeSub.id, // Store Stripe subscription ID for future syncs
        });

        // Only create transactions if subscription was successfully created
        if (subscription && subscription.id) {
          // Fetch all invoices for this subscription
          const invoices = await stripe.invoices.list({
            subscription: stripeSub.id,
          });

          // Create transactions for each invoice with correct dates
          for (const invoice of invoices.data) {
            if (invoice.status === "paid") {
              try {
                const paidAt = invoice.status_transitions?.paid_at 
                  ? new Date(invoice.status_transitions.paid_at * 1000)
                  : new Date(invoice.created * 1000);

                await storage.createTransaction({
                  subscriptionId: subscription.id,
                  amount: invoice.amount_paid,
                  currency: invoice.currency,
                  status: invoice.status,
                  pdfUrl: null, // PDF URLs are preserved on the subscription level, not transaction level in this sync
                  stripeInvoiceId: invoice.id,
                  paidAt: paidAt,
                  createdAt: paidAt, // Use the actual payment date
                });
              } catch (transactionError) {
                console.error(`Failed to create transaction for subscription ${subscription.id}, invoice ${invoice.id}:`, transactionError);
                // Continue with other transactions instead of failing completely
              }
            }
          }
        } else {
          console.error(`Subscription creation returned null or undefined for user ${userId}, tier ${tier}, Stripe subscription ${stripeSub.id}`);
        }
      } catch (subscriptionError) {
        console.error(`Failed to create subscription for user ${userId}, tier ${tier}, Stripe subscription ${stripeSub.id}:`, subscriptionError);
        console.error('Subscription error details:', {
          message: subscriptionError.message,
          stack: subscriptionError.stack,
          tier: tier,
          userId: userId,
          stripeSubId: stripeSub.id,
          status: stripeSub.status
        });
        // Continue with other subscriptions instead of failing completely
      }
    }

    // Get all subscriptions from storage
    const allSubscriptions = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .orderBy(desc(subscriptionsTable.createdAt));

    console.log(`✅ Created ${allSubscriptions.length} subscriptions in database:`);
    allSubscriptions.forEach((sub, index) => {
      console.log(`  ${index + 1}. Tier: ${sub.tier} | Status: ${sub.status} | Billing: ${sub.billingPeriod} | Created: ${sub.createdAt?.toISOString()}`);
    });
    console.log(`\n`);

    return allSubscriptions;
  } catch (error) {
    console.error("Error syncing all subscriptions:", error);
    throw error;
  }
}

// Add a function to check for expiring cards (can be called by a cron job)
async function checkExpiringCards() {
  try {
    const date = new Date();
    date.setMonth(date.getMonth() + 1); // Check cards expiring in the next month

    const paymentMethods = await stripe.paymentMethods.list({
      type: "card",
      limit: 100,
    });

    for (const paymentMethod of paymentMethods.data) {
      if (!paymentMethod.card) continue;

      const expMonth = paymentMethod.card.exp_month;
      const expYear = paymentMethod.card.exp_year;

      if (expYear === date.getFullYear() && expMonth === date.getMonth() + 1) {
        const customer = await stripe.customers.retrieve(
          paymentMethod.customer as string,
        );
        if (!customer || customer.deleted || !customer.email) continue;

        // Get user's preferred language from database or Stripe metadata if available
        // For now we'll check if there's a user with this Stripe customer ID
        const user = await storage.getUserByStripeCustomerId(customer.id);
        // This would require additional data storage for user language preferences
        // For now we'll default to English, but you could enhance this
        const userLanguage = user?.preferredLanguage || "en";

        await sendSubscriptionEmail("card-expiring", {
          username: customer.name,
          email: customer.email,
          lastFourDigits: paymentMethod.card.last4,
          expirationDate: `${expMonth}/${expYear}`,
          language: userLanguage,
        });
      }
    }
  } catch (error) {
    console.error("Error checking expiring cards:", error);
  }
}