/**
 * Creates a test user with a website for testing Booking SSO.
 * Run: npx tsx scripts/create-test-user-website.ts
 *
 * Uses env: DATABASE_URL (required)
 * Optional args: --email=... --password=... (defaults: test-booking@example.com / Test123!)
 */

import { db } from "../server/db";
import { hashPassword } from "../server/auth";
import {
  users,
  websiteProgress,
  websiteStages,
  onboardingFormResponses,
  subscriptions as subscriptionsTable,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_EMAIL = "test-booking@example.com";
const DEFAULT_PASSWORD = "Test123!";
const DEFAULT_PROJECT = "Test Booking Website";

function parseArgs() {
  const args = process.argv.slice(2);
  let email = DEFAULT_EMAIL;
  let password = DEFAULT_PASSWORD;
  for (const arg of args) {
    if (arg.startsWith("--email=")) email = arg.slice(7);
    if (arg.startsWith("--password=")) password = arg.slice(11);
  }
  return { email, password };
}

async function main() {
  const { email, password } = parseArgs();
  const username = email.split("@")[0].replace(/[^a-z0-9]/gi, "") || "testuser";

  console.log("Creating test user:", email);

  // 1. Create user
  const hashedPassword = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      username,
      email,
      password: hashedPassword,
      role: "subscriber",
      accountKind: "customer",
      language: "en",
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  let userId: number;
  if (user) {
    userId = user.id;
    console.log("Created user id:", userId);
  } else {
    const existing = await db.select().from(users).where(eq(users.email, email)).then((r) => r[0]);
    if (!existing) throw new Error("Failed to create or find user");
    userId = existing.id;
    console.log("User already exists, id:", userId);
  }

  // 2. Create website progress (real domain, not .pending-onboarding)
  const domain = `test-booking-${userId}.example.com`;
  const [wp] = await db
    .insert(websiteProgress)
    .values({
      userId,
      domain,
      projectName: DEFAULT_PROJECT,
      websiteLanguage: "en",
      currentStage: 1,
    })
    .returning();

  if (!wp) throw new Error("Failed to create website progress");
  const websiteId = wp.id;
  console.log("Created website id:", websiteId, "domain:", domain);

  // 3. Create website stages (needed for progress bar)
  const defaultStages = [
    { title: "Welcome & Project Setup", description: "Setting up your website project." },
    { title: "Content & Design", description: "Content and design phase." },
    { title: "Website Launch", description: "Launch your website." },
  ];
  for (let i = 0; i < defaultStages.length; i++) {
    await db.insert(websiteStages).values({
      websiteProgressId: websiteId,
      stageNumber: i + 1,
      title: defaultStages[i].title,
      description: defaultStages[i].description,
      status: i === 0 ? "in-progress" : "pending",
    });
  }
  console.log("Created", defaultStages.length, "website stages");

  // 4. Create onboarding form response (status=completed so it shows as normal website)
  const [onboarding] = await db
    .insert(onboardingFormResponses)
    .values({
      websiteProgressId: websiteId,
      businessName: "Test Business",
      contactName: "Test User",
      contactPhone: "+1234567890",
      accountEmail: email,
      contactEmail: email,
      businessDescription: "Test business for booking SSO",
      hasDomain: "no",
      hasEmails: "no",
      hasWebsite: "no",
      hasTextContent: "yes",
      hasMediaContent: "yes",
      hasSocialMedia: "no",
      submissionId: `test-${Date.now()}`,
      status: "completed",
      selectedTemplateId: 1,
    })
    .returning();

  if (!onboarding) throw new Error("Failed to create onboarding response");
  console.log("Created onboarding form (status=completed)");

  // 5. Create active subscription (for firstName/lastName in SSO JWT)
  await db.insert(subscriptionsTable).values({
    userId,
    websiteProgressId: websiteId,
    productType: "plan",
    productId: "essential",
    tier: "essential",
    status: "active",
    price: 3900,
    firstName: "Test",
    lastName: "User",
    billingPeriod: "monthly",
  });
  console.log("Created active subscription");

  console.log("\n--- Done ---");
  console.log("Login at /auth with:");
  console.log("  Email:", email);
  console.log("  Password:", password);
  console.log("Then go to /dashboard, open the website, and use the Booking sidebar item.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
