import { desc, eq } from "drizzle-orm";
import {
  getStartedSubmissions,
  onboardingFormResponses,
  websiteProgress,
} from "@shared/schema";
import { db } from "../db";
import { sanitizeBlogHtml } from "./blog-html";
import { researchKeyword, type KeywordResearch } from "./dataforseo";

export type GeneratedBlogPost = {
  title: string;
  excerpt: string;
  html: string;
};

type WebsiteRow = typeof websiteProgress.$inferSelect;

function clip(value: string | null | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

export async function loadBusinessBrief(website: WebsiteRow): Promise<string> {
  const [onboarding] = await db
    .select({
      businessName: onboardingFormResponses.businessName,
      businessDescription: onboardingFormResponses.businessDescription,
    })
    .from(onboardingFormResponses)
    .where(eq(onboardingFormResponses.websiteProgressId, website.id))
    .orderBy(desc(onboardingFormResponses.id))
    .limit(1);
  const [started] = await db
    .select({
      businessName: getStartedSubmissions.businessName,
      businessDescription: getStartedSubmissions.businessDescription,
      services: getStartedSubmissions.services,
      city: getStartedSubmissions.city,
    })
    .from(getStartedSubmissions)
    .where(eq(getStartedSubmissions.websiteProgressId, website.id))
    .orderBy(desc(getStartedSubmissions.id))
    .limit(1);

  const features = [
    "φόρμα επικοινωνίας",
    website.bookingEnabled ? "online κράτηση ραντεβού" : "",
    website.paymentsEnabled ? "online πληρωμές" : "",
    website.digitalProductsEnabled ? "ψηφιακά προϊόντα" : "",
    website.receptionEnabled ? "αιτήματα πελατών" : "",
  ].filter(Boolean);

  return [
    `Όνομα: ${clip(started?.businessName || onboarding?.businessName || website.projectName || website.domain, 200) || "άγνωστο"}`,
    `Τοποθεσία: ${clip(started?.city, 120) || "δεν έχει δοθεί"}`,
    `Περιγραφή: ${clip(started?.businessDescription || onboarding?.businessDescription, 1500) || "δεν έχει δοθεί"}`,
    `Υπηρεσίες: ${clip(started?.services, 1500) || "δεν έχουν δοθεί"}`,
    `Λειτουργίες site: ${features.join(", ")}`,
    `Domain: ${website.domain}`,
  ].join("\n");
}

function researchBrief(research: KeywordResearch): string {
  const lines = research.topResults.map(
    (result, index) => `${index + 1}. ${result.title}${result.description ? ` — ${result.description}` : ""}`,
  );
  return [
    `Λέξη-κλειδί: ${research.keyword}`,
    `Μηνιαίος όγκος αναζήτησης στην Ελλάδα: ${research.searchVolume ?? "άγνωστος"}`,
    "Τι καλύπτουν τα κορυφαία αποτελέσματα Google:",
    lines.join("\n") || "Δεν επιστράφηκαν οργανικά αποτελέσματα.",
  ].join("\n");
}

export async function generateBlogPost(input: {
  topic: string;
  notes?: string;
  website: WebsiteRow;
}): Promise<GeneratedBlogPost> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const [research, business] = await Promise.all([
    researchKeyword(input.topic),
    loadBusinessBrief(input.website),
  ]);
  const model = process.env.ANTHROPIC_BLOG_MODEL || "claude-sonnet-4-5";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: [
        "Γράφεις ένα SEO άρθρο στα ελληνικά για το site μιας μικρής επιχείρησης.",
        "Χρησιμοποίησε μόνο τα στοιχεία επιχείρησης που σου δίνονται.",
        "Μην επινοείς τιμές, αριθμούς, βραβεία, χρόνια εμπειρίας ή ισχυρισμούς που δεν υπάρχουν στα στοιχεία.",
        "Αν κάτι δεν δίνεται, παράλειψέ το.",
        "Το άρθρο καλύπτει το θέμα με βάση την έρευνα Google, χωρίς να αντιγράφει τα αποτελέσματα.",
        "Επέστρεψε μόνο JSON με κλειδιά seoTitle, metaDescription, html.",
        "seoTitle έως 60 χαρακτήρες. metaDescription έως 155 χαρακτήρες.",
        "html χρησιμοποιεί μόνο p, h2, h3, ul, ol, li, strong, em, a, br, blockquote.",
        "Περιέλαβε σαφείς επικεφαλίδες, σύντομη ενότητα FAQ και ένα φυσικό κάλεσμα σε ενέργεια προς τις λειτουργίες του site που δόθηκαν.",
        "Τα links της δράσης είναι σχετικά paths όπως /contact. Μην επινοείς εξωτερικά URLs.",
      ].join(" "),
      messages: [{
        role: "user",
        content: [
          `Θέμα πελάτη: ${input.topic}`,
          `Επιπλέον οδηγίες: ${input.notes?.trim() || "καμία"}`,
          "",
          "Στοιχεία επιχείρησης:",
          business,
          "",
          "Έρευνα:",
          researchBrief(research),
        ].join("\n"),
      }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Claude request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const raw = payload.content?.find((block) => block.type === "text")?.text || "";
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const data = JSON.parse(cleaned) as {
    seoTitle?: unknown;
    metaDescription?: unknown;
    html?: unknown;
  };
  const title = String(data.seoTitle || "").trim().slice(0, 70);
  const excerpt = String(data.metaDescription || "").trim().slice(0, 170);
  const html = sanitizeBlogHtml(String(data.html || ""));
  if (!title || !html) throw new Error("Claude returned an empty article");
  return { title, excerpt, html };
}
