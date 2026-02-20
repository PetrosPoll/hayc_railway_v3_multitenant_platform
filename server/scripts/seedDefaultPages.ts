import { db } from "../db";
import { websitePages, websiteProgress, onboardingFormResponses } from "@shared/schema";
import { eq } from "drizzle-orm";

const websiteProgressId = parseInt(process.argv[2]);

if (!websiteProgressId) {
  console.error("Usage: doppler run npx ts-node server/scripts/seedDefaultPages.ts <websiteProgressId>");
  process.exit(1);
}

const buildContentJson = (slug: string, businessName: string, businessDescription: string) => {
  switch (slug) {
    case "home":
      return {
        sections: [
          { type: "hero", config: { heading: businessName, subheading: businessDescription } },
          { type: "features", items: [] },
        ],
      };
    case "about":
      return {
        sections: [
          { type: "text", config: { heading: "About Us", body: businessDescription } },
        ],
      };
    case "services":
      return {
        sections: [
          { type: "features", config: { heading: "Our Services" }, items: [] },
        ],
      };
    case "contact":
      return {
        sections: [
          { type: "contact", config: { heading: "Contact Us" } },
        ],
      };
    default:
      return {
        sections: [
          { type: "text", config: { heading: slug, body: "" } },
        ],
      };
  }
};

(async () => {
  try {
    const [site] = await db
      .select()
      .from(websiteProgress)
      .where(eq(websiteProgress.id, websiteProgressId))
      .limit(1);

    if (!site) {
      console.error(`No website_progress found for id ${websiteProgressId}`);
      process.exit(1);
    }

    const [onboarding] = await db
      .select()
      .from(onboardingFormResponses)
      .where(eq(onboardingFormResponses.websiteProgressId, websiteProgressId))
      .limit(1);

    const businessName = onboarding?.businessName ?? site.projectName ?? "My Business";
    const businessDescription = onboarding?.businessDescription ?? "";
    const slugs = (onboarding?.wantedPages && onboarding.wantedPages.length > 0)
      ? onboarding.wantedPages
      : ["home", "about", "services", "contact"];

    for (const slug of slugs) {
      await db
        .insert(websitePages)
        .values({
          websiteProgressId,
          slug: slug.toLowerCase(),
          title: slug.charAt(0).toUpperCase() + slug.slice(1),
          status: "published",
          contentJson: buildContentJson(slug.toLowerCase(), businessName, businessDescription),
        })
        .onConflictDoNothing();

      console.log(`✓ Seeded page: ${slug}`);
    }

    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
