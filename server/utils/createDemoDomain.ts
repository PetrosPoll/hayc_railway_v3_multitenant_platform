import { db } from "../db";
import { websiteDomains } from "@shared/schema";

export async function createDemoDomain(websiteProgressId: number, slug: string): Promise<void> {
  const cleanSlug = slug.replace(/\.pending-onboarding$/, '').toLowerCase();
  const domain = `${cleanSlug}.sites.hayc.gr`;

  await db
    .insert(websiteDomains)
    .values({
      websiteProgressId,
      domain,
      isPrimary: true,
    })
    .onConflictDoNothing();
}
