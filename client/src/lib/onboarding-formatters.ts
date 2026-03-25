type Translator = (key: string, options?: Record<string, unknown>) => string;

const valueKeyMap: Record<string, Record<string, string>> = {
  domainConnectionPreference: {
    i_will_connect: "onboarding.options.domainConnectionMyself",
    you_connect: "onboarding.options.domainConnectionYou",
  },
  domainPurchasePreference: {
    i_will_buy: "onboarding.options.domainPurchaseMyself",
    you_buy: "onboarding.options.domainPurchaseYou",
  },
  hasDomain: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  hasEmails: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  hasWebsite: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  hasTextContent: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  hasMediaContent: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  hasSocialMedia: {
    yes: "onboarding.options.yes",
    no: "onboarding.options.no",
  },
  emailRedirect: {
    "main-inbox": "onboarding.options.emailRedirectOne",
    separate: "onboarding.options.emailRedirectSeparate",
  },
  logoDesignService: {
    none: "onboarding.options.logoServiceNone",
    basic: "onboarding.options.logoServiceBasic",
    premium: "onboarding.options.logoServicePremium",
  },
  websiteLanguage: {
    en: "onboarding.english",
    gr: "onboarding.greek",
  },
  siteStyle: {
    sharp: "onboarding.options.siteStyleStraight",
    curved: "onboarding.options.siteStyleCurved",
  },
  status: {
    draft: "onboarding.options.statusDraft",
    submitted: "onboarding.options.statusSubmitted",
    completed: "onboarding.options.statusCompleted",
  },
};

// Format a single value based on field name
export function formatOnboardingValue(
  fieldName: string,
  value: any,
  t?: Translator,
): string {
  const translator: Translator = t ?? ((key) => key);

  if (value === null || value === undefined || value === "") {
    return translator("onboarding.options.notProvided");
  }

  const fieldValueKeys = valueKeyMap[fieldName];
  if (fieldValueKeys && typeof value === "string" && fieldValueKeys[value]) {
    return translator(fieldValueKeys[value]);
  }

  if (typeof value === "boolean") {
    return value
      ? translator("onboarding.options.yes")
      : translator("onboarding.options.no");
  }

  if (Array.isArray(value)) {
    const filtered = value.filter((v) => v && v.toString().trim());
    return filtered.length > 0
      ? filtered.join(", ")
      : translator("onboarding.options.notProvided");
  }

  if (fieldName === "createdAt" && value) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  return String(value);
}

// Get a human-readable label for a field name
export function getFieldLabel(fieldName: string, t?: Translator): string {
  const translator: Translator = t ?? ((key) => key);
  const translated = translator(`onboarding.fields.${fieldName}`);

  if (translated !== `onboarding.fields.${fieldName}`) {
    return translated;
  }

  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
