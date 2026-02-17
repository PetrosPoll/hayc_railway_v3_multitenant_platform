// Helper utility to format onboarding form values for display
// Converts internal values (like "i_will_connect") to human-readable text

export const onboardingValueLabels: Record<string, Record<string, string>> = {
  // Domain connection preference
  domainConnectionPreference: {
    i_will_connect: "I will connect it myself",
    you_connect: "Please connect it for me",
  },
  // Domain purchase preference
  domainPurchasePreference: {
    i_will_buy: "I will purchase the domain",
    you_buy: "Please purchase it for me",
  },
  // Yes/No fields
  hasDomain: {
    yes: "Yes",
    no: "No",
  },
  hasEmails: {
    yes: "Yes",
    no: "No",
  },
  hasWebsite: {
    yes: "Yes",
    no: "No",
  },
  hasTextContent: {
    yes: "Yes",
    no: "No",
  },
  hasMediaContent: {
    yes: "Yes",
    no: "No",
  },
  hasSocialMedia: {
    yes: "Yes",
    no: "No",
  },
  // Email redirect preference
  emailRedirect: {
    "main-inbox": "Redirect all emails to one inbox",
    separate: "Keep emails separate",
  },
  // Logo design service
  logoDesignService: {
    none: "No logo service needed",
    basic: "Basic Logo Design (2 formats + editable file)",
    premium: "Brand Identity Package (logos, colors, fonts, designs)",
  },
  // Website language
  websiteLanguage: {
    en: "English",
    gr: "Greek",
  },
  // Site style
  siteStyle: {
    sharp: "Sharp corners (modern, professional)",
    curved: "Curved corners (friendly, approachable)",
  },
  // Status
  status: {
    draft: "Draft",
    submitted: "Submitted",
    completed: "Completed",
  },
};

// Field labels mapping (camelCase to readable text)
export const onboardingFieldLabels: Record<string, string> = {
  businessName: "Business Name",
  contactName: "Contact Name",
  contactPhone: "Contact Phone",
  contactEmail: "Contact Email",
  accountEmail: "Account Email",
  businessDescription: "Business Description",
  websiteLanguage: "Website Language",
  hasDomain: "Has Domain",
  existingDomain: "Existing Domain",
  domainAccess: "Domain Access",
  domainConnectionPreference: "Domain Connection Preference",
  domainPurchasePreference: "Domain Purchase Preference",
  preferredDomains: "Preferred Domain Names",
  hasEmails: "Has Professional Emails",
  emailProvider: "Email Provider",
  emailAccess: "Email Access",
  existingEmails: "Existing Emails",
  emailCount: "Number of Emails Needed",
  emailNames: "Email Names/Addresses",
  emailRedirect: "Email Redirect Preference",
  redirectInboxAddress: "Redirect Inbox Address",
  hasWebsite: "Has Existing Website",
  websiteLink: "Current Website Link",
  websiteChanges: "Desired Website Changes",
  wantedPages: "Wanted Pages",
  notSurePages: "Not Sure About Pages",
  hasTextContent: "Has Text Content Ready",
  hasMediaContent: "Has Media Content Ready",
  businessLogoUrl: "Business Logo",
  businessLogoName: "Logo File Name",
  businessLogoPublicId: "Logo ID",
  createTextLogo: "Create Text Logo",
  colorPalette: "Color Palette",
  inspirationWebsites: "Inspiration Websites",
  preferredFonts: "Preferred Fonts",
  siteStyle: "Site Style",
  selectedTemplateId: "Selected Template",
  customTemplateRequest: "Custom Template Request",
  hasSocialMedia: "Has Social Media",
  facebookLink: "Facebook",
  instagramLink: "Instagram",
  linkedinLink: "LinkedIn",
  tiktokLink: "TikTok",
  youtubeLink: "YouTube",
  otherSocialLinks: "Other Social Links",
  logoDesignService: "Logo Design Service",
  projectDeadline: "Project Deadline",
  additionalNotes: "Additional Notes",
  submissionId: "Submission ID",
  status: "Status",
  createdAt: "Submitted At",
};

// Format a single value based on field name
export function formatOnboardingValue(fieldName: string, value: any): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  // Check if we have a label mapping for this field
  const fieldLabels = onboardingValueLabels[fieldName];
  if (fieldLabels && typeof value === "string" && fieldLabels[value]) {
    return fieldLabels[value];
  }

  // Handle boolean values
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const filtered = value.filter((v) => v && v.toString().trim());
    return filtered.length > 0 ? filtered.join(", ") : "";
  }

  // Handle date strings
  if (fieldName === "createdAt" && value) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  // Return as-is for other values
  return String(value);
}

// Get a human-readable label for a field name
export function getFieldLabel(fieldName: string): string {
  if (onboardingFieldLabels[fieldName]) {
    return onboardingFieldLabels[fieldName];
  }
  // Fallback: convert camelCase to Title Case with spaces
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
