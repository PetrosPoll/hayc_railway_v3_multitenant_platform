import type { SiteFormConfig } from "@shared/schema";

export function parseSiteForms(config: Record<string, unknown> | null | undefined): SiteFormConfig[] {
  if (!config || !Array.isArray(config.forms)) return [];

  const forms: SiteFormConfig[] = [];
  for (const entry of config.forms) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) continue;
    const page = typeof row.page === "string" && row.page.trim() ? row.page.trim() : undefined;
    forms.push({ id, name, ...(page ? { page } : {}) });
  }
  return forms;
}

export function applyFormEmailPlaceholders(
  template: string,
  vars: {
    name: string;
    email: string;
    phone: string;
    message: string;
    siteLabel: string;
  },
): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
    .replace(/\{\{\s*email\s*\}\}/gi, vars.email)
    .replace(/\{\{\s*phone\s*\}\}/gi, vars.phone)
    .replace(/\{\{\s*message\s*\}\}/gi, vars.message)
    .replace(/\{\{\s*siteLabel\s*\}\}/gi, vars.siteLabel);
}

export const DEFAULT_VISITOR_SUBJECT = {
  en: "We received your message — {{siteLabel}}",
  gr: "Λάβαμε το μήνυμά σας — {{siteLabel}}",
} as const;

export const DEFAULT_VISITOR_INTRO = {
  en: "Hi {{name}}, thank you for reaching out. We have received your message and will get back to you as soon as possible.",
  gr: "Γεια σου {{name}}, ευχαριστούμε που επικοινωνήσατε μαζί μας. Λάβαμε το μήνυμά σας και θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.",
} as const;
