type TFunction = (key: string) => string;

const fallback: Record<string, Record<string, string>> = {
  selfDescription: {
    know_exactly: "I know exactly what I want",
    rough_idea: "I have a rough idea",
    need_guidance: "I need guidance, I'm not sure yet",
  },
  biggestConcerns: {
    getting_done_fast: "Getting it done fast",
    making_it_look_right: "Making it look right",
    technical_side: "The technical side",
    bringing_clients: "Knowing it will actually bring me clients",
    the_cost: "The cost",
  },
  heardAboutUs: {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    google: "Google",
    referral: "Referral from someone",
    other: "Other",
  },
  hadWebsiteBefore: {
    yes_worked_well: "Yes and it worked well",
    yes_no_results: "Yes, but it didn't bring results",
    no_first_time: "No, this is my first one",
  },
  previousWebsitePlatform: {
    wix: "Wix",
    squarespace: "Squarespace",
    wordpress: "WordPress",
    webflow: "Webflow",
    someone_built_it: "Someone built it for me",
    other: "Other",
  },
  billingPeriod: {
    monthly: "Monthly",
    yearly: "Yearly",
  },
  documentType: {
    invoice: "Invoice (VAT number required)",
    receipt: "Receipt (no VAT number needed)",
  },
  status: {
    draft: "Draft",
    in_progress: "In progress",
    pending_payment: "Pending payment",
    paid: "Paid",
    completed: "Completed",
  },
};

function translate(t: TFunction, key: string, fb: string): string {
  const result = t(key);
  // i18next returns the key itself when no translation is found
  return result && result !== key ? result : fb;
}

function resolveValue(t: TFunction, field: string, rawValue: string): string {
  switch (field) {
    case "selfDescription":
      return translate(t, `getStarted.quickQuestions.selfDescriptionOptions.${rawValue}`, fallback.selfDescription[rawValue] ?? rawValue);
    case "biggestConcerns":
      return translate(t, `getStarted.quickQuestions.concernOptions.${rawValue}`, fallback.biggestConcerns[rawValue] ?? rawValue);
    case "heardAboutUs":
      return translate(t, `getStarted.quickQuestions.heardAboutOptions.${rawValue}`, fallback.heardAboutUs[rawValue] ?? rawValue);
    case "hadWebsiteBefore":
      return translate(t, `getStarted.onboarding.hadWebsiteOptions.${rawValue}`, fallback.hadWebsiteBefore[rawValue] ?? rawValue);
    case "previousWebsitePlatform":
      return translate(t, `getStarted.onboarding.platformOptions.${rawValue}`, fallback.previousWebsitePlatform[rawValue] ?? rawValue);
    case "billingPeriod":
      return translate(t, `dashboard.billingPeriods.${rawValue}`, fallback.billingPeriod[rawValue] ?? rawValue);
    case "documentType":
      if (rawValue === "invoice") return translate(t, "preCheckout.invoiceVatNeeded", fallback.documentType.invoice);
      if (rawValue === "receipt") return translate(t, "preCheckout.receiptNoVatNeeded", fallback.documentType.receipt);
      return rawValue;
    case "status":
      return fallback.status[rawValue] ?? rawValue;
    default:
      return rawValue;
  }
}

/** Maps a get-started submission field + raw value to a translated, human-readable string. */
export function formatGsValue(field: string, value: unknown, t: TFunction): string {
  if (value === null || value === undefined || value === "") return "—";

  if (Array.isArray(value)) {
    const resolved = value.map((v) => resolveValue(t, field, String(v))).filter(Boolean).join(", ");
    return resolved || "—";
  }

  return resolveValue(t, field, String(value));
}
