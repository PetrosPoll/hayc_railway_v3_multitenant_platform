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

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert automation body (plain text + **bold** / *italic* / __underline__) to safe HTML.
 */
export function formatAutomationBodyToHtml(input: string): string {
  const parts: string[] = [];
  let i = 0;
  let plain = "";

  const flushPlain = () => {
    if (!plain) return;
    parts.push(escapeHtmlText(plain).replace(/\n/g, "<br>"));
    plain = "";
  };

  const findClosing = (marker: string, from: number): number => {
    let idx = from;
    while (idx < input.length) {
      const found = input.indexOf(marker, idx);
      if (found === -1) return -1;
      if (marker === "*" && input.startsWith("**", found)) {
        idx = found + 2;
        continue;
      }
      return found;
    }
    return -1;
  };

  while (i < input.length) {
    if (input.startsWith("**", i)) {
      const end = findClosing("**", i + 2);
      if (end !== -1) {
        flushPlain();
        const inner = input.slice(i + 2, end);
        parts.push(`<strong>${escapeHtmlText(inner).replace(/\n/g, "<br>")}</strong>`);
        i = end + 2;
        continue;
      }
    }
    if (input.startsWith("__", i)) {
      const end = findClosing("__", i + 2);
      if (end !== -1) {
        flushPlain();
        const inner = input.slice(i + 2, end);
        parts.push(`<u>${escapeHtmlText(inner).replace(/\n/g, "<br>")}</u>`);
        i = end + 2;
        continue;
      }
    }
    if (input[i] === "*" && !input.startsWith("**", i)) {
      const end = findClosing("*", i + 1);
      if (end !== -1) {
        flushPlain();
        const inner = input.slice(i + 1, end);
        parts.push(`<em>${escapeHtmlText(inner).replace(/\n/g, "<br>")}</em>`);
        i = end + 1;
        continue;
      }
    }
    plain += input[i];
    i += 1;
  }
  flushPlain();
  return parts.join("");
}

export const DEFAULT_VISITOR_SUBJECT = {
  en: "We received your message — {{siteLabel}}",
  gr: "Λάβαμε το μήνυμά σας — {{siteLabel}}",
} as const;

export const DEFAULT_VISITOR_INTRO = {
  en: "Hi {{name}}, thank you for reaching out. We have received your message and will get back to you as soon as possible.",
  gr: "Γεια σου {{name}}, ευχαριστούμε που επικοινωνήσατε μαζί μας. Λάβαμε το μήνυμά σας και θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.",
} as const;
