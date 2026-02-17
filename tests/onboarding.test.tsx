import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Validation schemas mirroring the onboarding form
const createOnboardingBaseSchema = (t: (key: string) => string) => z.object({
  // Step 1: Business Information
  businessName: z.string().min(2, t("onboarding.requiredField")),
  contactName: z.string().min(2, t("onboarding.requiredField")),
  contactPhone: z.string().min(5, t("onboarding.requiredField")),
  accountEmail: z.string().email().optional(),
  contactEmail: z.string().email(t("onboarding.validEmail")),
  businessDescription: z.string().min(10, t("onboarding.requiredField")),
  
  // Step 2: Domain
  hasDomain: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  existingDomain: z.string().optional(),
  domainAccess: z.string().optional(),
  preferredDomains: z.string().optional(),
  
  // Step 3: Professional Emails
  hasEmails: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  emailProvider: z.string().optional(),
  emailAccess: z.string().optional(),
  existingEmails: z.string().optional(),
  emailCount: z.string().optional(),
  emailNames: z.string().optional(),
  emailRedirect: z.enum(["main-inbox", "separate"], {
    required_error: t("onboarding.requiredField"),
  }).optional(),
  redirectInboxAddress: z.string().email().optional(),
  
  // Step 4: Website Foundation
  hasWebsite: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  websiteLink: z.string().optional(),
  websiteChanges: z.string().optional(),
  wantedPages: z.array(z.string()).optional(),
  notSurePages: z.boolean().optional(),
  hasTextContent: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  textContentFiles: z.any().optional(),
  hasMediaContent: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  mediaContentFiles: z.any().optional(),
  
  // Step 5: Design Preferences
  businessLogo: z.any().optional(),
  createTextLogo: z.boolean().optional(),
  colorPalette: z.string().optional(),
  brandGuide: z.any().optional(),
  inspirationWebsites: z.array(z.string()).optional(),
  preferredFonts: z.string().optional(),
  siteStyle: z.string().optional(),
  
  // Step 6: Social Media
  hasSocialMedia: z.enum(["yes", "no"], {
    required_error: t("onboarding.requiredField"),
  }),
  facebookLink: z.string().optional(),
  instagramLink: z.string().optional(),
  linkedinLink: z.string().optional(),
  tiktokLink: z.string().optional(),
  youtubeLink: z.string().optional(),
  otherSocialLinks: z.string().optional(),
  logoDesignService: z.enum(["none", "basic", "premium"]).optional(),
  
  // Step 7: Practical Information
  projectDeadline: z.string().refine((val) => {
    if (!val) return true;
    const selectedDate = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 15);
    return selectedDate >= minDate;
  }, { message: "Project deadline must be at least 15 days from today" }).optional(),
  additionalNotes: z.string().optional(),
});

const createOnboardingSchema = (t: (key: string) => string) => {
  return createOnboardingBaseSchema(t).refine((data) => {
    if (data.emailRedirect === "main-inbox" && !data.redirectInboxAddress) {
      return false;
    }
    return true;
  }, {
    message: "Please provide the email address where emails should be forwarded",
    path: ["redirectInboxAddress"],
  });
};

const mockT = (key: string) => key;
const schema = createOnboardingBaseSchema(mockT);

describe('Onboarding Form Validation - Step 1: Business Information', () => {
  it('should require businessName with minimum 2 characters', () => {
    const result = schema.shape.businessName.safeParse('');
    expect(result.success).toBe(false);
    
    const validResult = schema.shape.businessName.safeParse('My Business');
    expect(validResult.success).toBe(true);
  });

  it('should reject businessName with less than 2 characters', () => {
    const result = schema.shape.businessName.safeParse('A');
    expect(result.success).toBe(false);
  });

  it('should require contactName with minimum 2 characters', () => {
    const result = schema.shape.contactName.safeParse('');
    expect(result.success).toBe(false);
    
    const validResult = schema.shape.contactName.safeParse('John Doe');
    expect(validResult.success).toBe(true);
  });

  it('should require contactPhone with minimum 5 characters', () => {
    const result = schema.shape.contactPhone.safeParse('1234');
    expect(result.success).toBe(false);
    
    const validResult = schema.shape.contactPhone.safeParse('12345');
    expect(validResult.success).toBe(true);
  });

  it('should validate contactEmail format', () => {
    const invalidResult = schema.shape.contactEmail.safeParse('invalid-email');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.contactEmail.safeParse('test@example.com');
    expect(validResult.success).toBe(true);
  });

  it('should require businessDescription with minimum 10 characters', () => {
    const result = schema.shape.businessDescription.safeParse('Short');
    expect(result.success).toBe(false);
    
    const validResult = schema.shape.businessDescription.safeParse('This is a detailed business description');
    expect(validResult.success).toBe(true);
  });

  it('should allow optional accountEmail', () => {
    const result = schema.shape.accountEmail.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});

describe('Onboarding Form Validation - Step 2: Domain', () => {
  it('should require hasDomain to be yes or no', () => {
    const invalidResult = schema.shape.hasDomain.safeParse('maybe');
    expect(invalidResult.success).toBe(false);
    
    const yesResult = schema.shape.hasDomain.safeParse('yes');
    expect(yesResult.success).toBe(true);
    
    const noResult = schema.shape.hasDomain.safeParse('no');
    expect(noResult.success).toBe(true);
  });

  it('should allow optional existingDomain', () => {
    const result = schema.shape.existingDomain.safeParse(undefined);
    expect(result.success).toBe(true);
    
    const validResult = schema.shape.existingDomain.safeParse('example.com');
    expect(validResult.success).toBe(true);
  });

  it('should allow optional preferredDomains', () => {
    const result = schema.shape.preferredDomains.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});

describe('Onboarding Form Validation - Step 3: Professional Emails', () => {
  it('should require hasEmails to be yes or no', () => {
    const invalidResult = schema.shape.hasEmails.safeParse('unknown');
    expect(invalidResult.success).toBe(false);
    
    const yesResult = schema.shape.hasEmails.safeParse('yes');
    expect(yesResult.success).toBe(true);
  });

  it('should validate emailRedirect enum values', () => {
    const invalidResult = schema.shape.emailRedirect.safeParse('invalid');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.emailRedirect.safeParse('main-inbox');
    expect(validResult.success).toBe(true);
    
    const validResult2 = schema.shape.emailRedirect.safeParse('separate');
    expect(validResult2.success).toBe(true);
  });

  it('should allow optional redirectInboxAddress but validate email format', () => {
    const undefinedResult = schema.shape.redirectInboxAddress.safeParse(undefined);
    expect(undefinedResult.success).toBe(true);
    
    const invalidResult = schema.shape.redirectInboxAddress.safeParse('not-an-email');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.redirectInboxAddress.safeParse('inbox@example.com');
    expect(validResult.success).toBe(true);
  });
});

describe('Onboarding Form Validation - Step 4: Website Foundation', () => {
  it('should require hasWebsite to be yes or no', () => {
    const invalidResult = schema.shape.hasWebsite.safeParse('');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.hasWebsite.safeParse('yes');
    expect(validResult.success).toBe(true);
  });

  it('should require hasTextContent to be yes or no', () => {
    const invalidResult = schema.shape.hasTextContent.safeParse('');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.hasTextContent.safeParse('no');
    expect(validResult.success).toBe(true);
  });

  it('should require hasMediaContent to be yes or no', () => {
    const invalidResult = schema.shape.hasMediaContent.safeParse('');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.hasMediaContent.safeParse('yes');
    expect(validResult.success).toBe(true);
  });

  it('should allow optional wantedPages as array', () => {
    const result = schema.shape.wantedPages.safeParse(undefined);
    expect(result.success).toBe(true);
    
    const validResult = schema.shape.wantedPages.safeParse(['Home', 'About', 'Contact']);
    expect(validResult.success).toBe(true);
  });

  it('should allow optional notSurePages boolean', () => {
    const result = schema.shape.notSurePages.safeParse(undefined);
    expect(result.success).toBe(true);
    
    const validResult = schema.shape.notSurePages.safeParse(true);
    expect(validResult.success).toBe(true);
  });
});

describe('Onboarding Form Validation - Step 6: Social Media', () => {
  it('should require hasSocialMedia to be yes or no', () => {
    const invalidResult = schema.shape.hasSocialMedia.safeParse('');
    expect(invalidResult.success).toBe(false);
    
    const validResult = schema.shape.hasSocialMedia.safeParse('yes');
    expect(validResult.success).toBe(true);
  });

  it('should validate logoDesignService enum', () => {
    const invalidResult = schema.shape.logoDesignService.safeParse('invalid');
    expect(invalidResult.success).toBe(false);
    
    const noneResult = schema.shape.logoDesignService.safeParse('none');
    expect(noneResult.success).toBe(true);
    
    const basicResult = schema.shape.logoDesignService.safeParse('basic');
    expect(basicResult.success).toBe(true);
    
    const premiumResult = schema.shape.logoDesignService.safeParse('premium');
    expect(premiumResult.success).toBe(true);
  });

  it('should allow optional social media links', () => {
    const fbResult = schema.shape.facebookLink.safeParse(undefined);
    expect(fbResult.success).toBe(true);
    
    const igResult = schema.shape.instagramLink.safeParse('https://instagram.com/example');
    expect(igResult.success).toBe(true);
  });
});

describe('Onboarding Form - Multi-step Navigation Logic', () => {
  const steps = [
    { fields: ["businessName", "contactName", "contactPhone", "accountEmail", "contactEmail", "businessDescription"] },
    { fields: ["hasDomain", "existingDomain", "domainAccess", "preferredDomains"] },
    { fields: ["hasEmails", "emailProvider", "emailAccess", "existingEmails", "emailCount", "emailNames", "emailRedirect", "redirectInboxAddress"] },
    { fields: ["hasWebsite", "websiteLink", "websiteChanges", "wantedPages", "notSurePages", "hasTextContent", "textContentFiles", "hasMediaContent", "mediaContentFiles"] },
    { fields: ["businessLogo", "logoDesignService", "colorPalette", "brandGuide", "inspirationWebsites", "preferredFonts", "siteStyle"] },
    { fields: ["hasSocialMedia", "facebookLink", "instagramLink", "linkedinLink", "tiktokLink", "youtubeLink", "otherSocialLinks"] },
    { fields: ["projectDeadline", "additionalNotes"] },
    { fields: [] }, // Review
    { fields: [] }, // Confirmation
  ];

  it('should have 9 steps including review and confirmation', () => {
    expect(steps.length).toBe(9);
  });

  it('step 1 should validate business information fields', () => {
    expect(steps[0].fields).toContain('businessName');
    expect(steps[0].fields).toContain('contactEmail');
    expect(steps[0].fields).toContain('businessDescription');
  });

  it('step 2 should validate domain fields', () => {
    expect(steps[1].fields).toContain('hasDomain');
    expect(steps[1].fields).toContain('existingDomain');
  });

  it('last two steps should have no validation fields', () => {
    expect(steps[7].fields.length).toBe(0); // Review
    expect(steps[8].fields.length).toBe(0); // Confirmation
  });
});
