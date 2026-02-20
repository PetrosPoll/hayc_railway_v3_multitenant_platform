import { db } from "../db";
import { websiteDomains, websiteProgress } from "@shared/schema";
import { eq } from "drizzle-orm";

const websiteProgressId = parseInt(process.argv[2]);
const slug = process.argv[3];

if (!websiteProgressId || !slug) {
  console.error("Usage: npx ts-node server/scripts/seedDemoDomain.ts <websiteProgressId> <slug>");
  process.exit(1);
}

(async () => {
  try {
    const domain = `${slug}.sites.hayc.gr`;

    await db.insert(websiteDomains).values({
      websiteProgressId,
      domain,
      isPrimary: true,
    });

    await db
      .update(websiteProgress)
      .set({ status: "published" })
      .where(eq(websiteProgress.id, websiteProgressId));

    console.log(`✓ Domain "${domain}" created and site set to published.`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
