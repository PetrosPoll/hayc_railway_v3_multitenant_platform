import { db } from "../db";
import { websiteDomains } from "@shared/schema";
import { eq } from "drizzle-orm";
import { adjectives, nouns } from "./wordList";

function generateSlug(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}

async function generateUniqueSlug(maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const slug = generateSlug();
    const domain = `${slug}.sites.hayc.gr`;

    const existing = await db
      .select({ id: websiteDomains.id })
      .from(websiteDomains)
      .where(eq(websiteDomains.domain, domain))
      .limit(1);

    if (!existing.length) return slug;
  }

  // Fallback: append random 4-digit number to guarantee uniqueness
  return `${generateSlug()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createDemoDomain(websiteProgressId: number): Promise<void> {
  const slug = await generateUniqueSlug();
  const domain = `${slug}.sites.hayc.gr`;

  await db
    .insert(websiteDomains)
    .values({
      websiteProgressId,
      domain,
      isPrimary: true,
    })
    .onConflictDoNothing();
}
