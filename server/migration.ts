import { storage } from "./storage";
import { hashPassword } from "./auth";
import Stripe from "stripe";
import { UserRole, subscriptionPlans } from "@shared/schema";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
  typescript: true,
});

interface WordPressUser {
  email: string;
  username: string;
  display_name?: string;
  phone?: string;
  user_login?: string;
  user_email?: string;
  user_nicename?: string;
  user_registered?: string;
  first_name?: string;
  last_name?: string;
  // Add any other CSV fields you might have
}

export async function importWordPressUsers(wordpressUsers: WordPressUser[]) {
  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as Array<{ email: string; error: string }>,
    resetTokens: [] as Array<{ email: string; token: string; resetUrl: string }>
  };

  for (const wpUser of wordpressUsers) {
    try {
      // Normalize email and username from different possible CSV field names
      const email = wpUser.email || wpUser.user_email;
      const username = wpUser.username || wpUser.user_login || wpUser.user_nicename || wpUser.display_name || email?.split('@')[0];

      if (!email) {
        results.errors.push({ email: 'unknown', error: 'No email field found in CSV row' });
        continue;
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log(`User ${email} already exists, skipping`);
        results.skipped++;
        continue;
      }

      // Generate a one-time password reset token
      const resetToken = generatePasswordResetToken();

      // Create user account with a random secure password (they'll reset it via token)
      const securePassword = generateSecurePassword();

      // Parse registration date from WordPress data if available
      let registrationDate = new Date(); // Default to now
      if (wpUser.user_registered) {
        try {
          const cleanDateString = wpUser.user_registered.trim();
          if (cleanDateString) {
            const parsed = new Date(cleanDateString);
            if (!isNaN(parsed.getTime())) {
              registrationDate = parsed;
            } else {
              // Try parsing YYYY-MM-DD format
              const dateParts = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (dateParts) {
                registrationDate = new Date(parseInt(dateParts[1]), parseInt(dateParts[2]) - 1, parseInt(dateParts[3]));
              }
            }
          }
        } catch (error) {
          console.log(`Failed to parse registration date for ${email}:`, error);
          // Use current date as fallback
        }
      }

      const newUser = await storage.createUser({
        email: email,
        username: username || email.split('@')[0],
        password: await hashPassword(securePassword),
        phone: wpUser.phone || null,
        stripeCustomerId: null, // Will be set during subscription matching
        role: UserRole.SUBSCRIBER,
        language: "en", // Default, can be updated later
        passwordResetToken: resetToken, // Store the reset token
        createdAt: registrationDate, // Use WordPress registration date
      });

      // Generate reset URL using VITE_APP_URL or production fallback
      const baseUrl = process.env.VITE_APP_URL || 'https://hayc.gr';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      console.log(`[importWordPressUsers] Generated reset URL for ${email}: ${resetUrl}`);

      results.resetTokens.push({
        email: email,
        token: resetToken,
        resetUrl: resetUrl
      });

      console.log(`Imported user: ${email} with reset token: ${resetToken}`);
      results.imported++;

    } catch (error: any) {
      console.error(`Error importing user ${wpUser.email || 'unknown'}:`, error.message);
      results.errors.push({ email: wpUser.email || 'unknown', error: error.message });
    }
  }

  return results;
}

export async function matchUsersToStripeSubscriptions() {
  const results = {
    matched: 0,
    notFound: 0,
    errors: [] as Array<{ email: string; error: string }>
  };

  try {
    // Get all Stripe customers
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const customers = await stripe.customers.list({
        limit: 100,
        ...(startingAfter && { starting_after: startingAfter })
      });

      for (const customer of customers.data) {
        if (!customer.email) continue;

        try {
          // Find user by email in our system
          const user = await storage.getUserByEmail(customer.email);
          if (!user) {
            console.log(`No user found for Stripe customer: ${customer.email}`);
            results.notFound++;
            continue;
          }

          // Update user with Stripe customer ID
          await storage.updateUser(user.id, {
            stripeCustomerId: customer.id
          });

          // Get and sync their subscriptions
          const subscriptions = await syncStripeSubscriptionsForUser(customer.id, user.id);

          console.log(`Matched ${customer.email} - found ${subscriptions.length} subscriptions`);
          results.matched++;

        } catch (error: any) {
          console.error(`Error matching user ${customer.email}:`, error.message);
          results.errors.push({ email: customer.email, error: error.message });
        }
      }

      hasMore = customers.has_more;
      if (hasMore && customers.data.length > 0) {
        startingAfter = customers.data[customers.data.length - 1].id;
      }
    }

  } catch (error: any) {
    console.error("Error during user matching:", error.message);
    throw error;
  }

  return results;
}

async function syncStripeSubscriptionsForUser(stripeCustomerId: string, userId: number) {
  // Get all subscriptions for this customer
  const stripeSubscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    expand: ["data.items", "data.items.data.price"],
  });

  const subscriptions = [];

  for (const stripeSub of stripeSubscriptions.data) {
    const priceId = stripeSub.items.data[0]?.price.id;
    if (!priceId) continue;

    // Map price ID to tier
    let tier: string | undefined;
    let billingPeriod: "monthly" | "yearly" | undefined;

    // Use the centralized subscription plans from shared schema
    const SUBSCRIPTION_PRICES = {
      basic: subscriptionPlans.basic.priceId,
      essential: subscriptionPlans.essential.priceId,
      pro: subscriptionPlans.pro.priceId,
    };

    for (const [t, price] of Object.entries(SUBSCRIPTION_PRICES)) {
      if (price === priceId) {
        tier = t;
        // Assuming priceId format implies billing period, e.g., '_monthly' or '_yearly'
        if (priceId.includes("monthly")) {
          billingPeriod = "monthly";
        } else if (priceId.includes("yearly")) {
          billingPeriod = "yearly";
        }
        break;
      }
    }

    if (!tier || !billingPeriod) {
      console.warn(`Unknown price ID: ${priceId} for customer ${stripeCustomerId}`);
      continue;
    }

    // Get add-ons from Stripe subscription items
    const stripeAddOns = stripeSub.items.data
      .slice(1) // Skip the first item which is the main subscription
      .map((item) => item.price.id)
      .filter(Boolean);

    // Create subscription in our system
    const subscription = await storage.createSubscription({
      userId,
      tier,
      status: stripeSub.status,
      vatNumber: null,
      pdfUrl: null,
      addOns: stripeAddOns,
      billingPeriod: billingPeriod,
      createdAt: new Date(stripeSub.created * 1000),
    });

    // Import transaction history
    const invoices = await stripe.invoices.list({
      subscription: stripeSub.id,
    });

    for (const invoice of invoices.data) {
      if (invoice.status === "paid") {
        const paidAt = invoice.status_transitions?.paid_at 
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(invoice.created * 1000);

        await storage.createTransaction({
          subscriptionId: subscription.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          pdfUrl: null,
          stripeInvoiceId: invoice.id,
          paidAt: paidAt,
          createdAt: paidAt,
        });
      }
    }

    subscriptions.push(subscription);
  }

  return subscriptions;
}

function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateSecurePassword(): string {
  const length = 32;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export function parseCSV(csvContent: string): WordPressUser[] {
  console.log('🔍 CSV Parsing Debug Info:');
  console.log('CSV Content length:', csvContent.length);
  console.log('CSV Content preview:', csvContent.substring(0, 200));

  const lines = csvContent.trim().split('\n');
  console.log('Total lines found:', lines.length);

  if (lines.length === 0) {
    console.log('❌ No lines found in CSV');
    return [];
  }

  // Detect delimiter (check if semicolons are more common than commas in the first line)
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  console.log(`🔍 Detected delimiter: "${delimiter}" (semicolons: ${semicolonCount}, commas: ${commaCount})`);

  // Parse header row with detected delimiter
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
  console.log('Headers found:', headers);
  console.log('Number of headers:', headers.length);

  const users: WordPressUser[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(cell => cell.trim().replace(/"/g, ''));
    console.log(`Row ${i}:`, row);
    console.log(`Row ${i} length:`, row.length);

    const user: any = {};

    headers.forEach((header, index) => {
      if (row[index]) {
        user[header] = row[index];
        console.log(`Mapping: ${header} = ${row[index]}`);
      }
    });

    console.log(`User object for row ${i}:`, user);
    console.log(`Has email field:`, !!(user.email || user.user_email || user['User Email']));

    // Check for email in multiple possible field names
    const emailField = user.email || user.user_email || user['User Email'];
    const usernameField = user.username || user.user_login || user.user_nicename || user.display_name || user['Username'] || user['Display Name'];

    if (emailField) {
      // Parse registration date if available
      const registrationDateField = user['User Registered(date)'] || user['User Registered'] || user.user_registered;
      let parsedRegistrationDate: Date | null = null;

      if (registrationDateField) {
        try {
          // Try parsing different date formats
          const cleanDateString = registrationDateField.trim();
          if (cleanDateString) {
            // Try parsing as ISO date, or common formats
            parsedRegistrationDate = new Date(cleanDateString);
            if (isNaN(parsedRegistrationDate.getTime())) {
              // If parsing fails, try common formats like YYYY-MM-DD
              const dateParts = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (dateParts) {
                parsedRegistrationDate = new Date(parseInt(dateParts[1]), parseInt(dateParts[2]) - 1, parseInt(dateParts[3]));
              }
            }
          }
        } catch (error) {
          console.log(`Failed to parse registration date "${registrationDateField}":`, error);
          parsedRegistrationDate = null;
        }
      }

      // Create normalized user object
      const normalizedUser: WordPressUser = {
        email: emailField,
        username: usernameField || emailField.split('@')[0],
        display_name: user['Display Name'] || user.display_name || user['First Name'] + ' ' + user['Last Name'],
        phone: user.phone || user.Phone,
        user_login: user['Username'] || user.user_login,
        user_email: emailField,
        user_nicename: user['User Nicename'] || user.user_nicename,
        user_registered: registrationDateField,
        first_name: user['First Name'] || user.first_name,
        last_name: user['Last Name'] || user.last_name,
      };

      users.push(normalizedUser);
      console.log(`✅ Added user: ${emailField} (${usernameField})`);
    } else {
      console.log(`❌ Skipped row ${i} - no email found in any expected field`);
    }
  }

  console.log('Final users array length:', users.length);
  return users;
}

export async function sendPasswordResetEmail(email: string, resetToken: string, username: string) {
  // Generate reset URL using VITE_APP_URL or production fallback
  const baseUrl = process.env.VITE_APP_URL || 'https://hayc.gr';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  console.log(`[sendPasswordResetEmail] Generated reset URL for ${email}: ${resetUrl}`);

  // Return the data that can be used to send email via your existing email system
  return {
    email,
    username,
    resetUrl,
    token: resetToken
  };
}

export async function validatePasswordResetToken(token: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token));

    if (!user || !user.passwordResetToken) {
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Error validating reset token:', error);
    return { valid: false };
  }
}

export async function resetUserPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate token first
    const tokenValidation = await validatePasswordResetToken(token);
    if (!tokenValidation.valid || !tokenValidation.user) {
      return { success: false, error: 'Invalid or expired reset token' };
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password and clear the reset token (one-time use)
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        passwordResetToken: null // Clear token after use
      })
      .where(eq(users.id, tokenValidation.user.id));

    return { success: true };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: 'Failed to reset password' };
  }
}