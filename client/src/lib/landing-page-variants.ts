export const LANDING_PAGE_AB_VARIANTS = [
  "version-1",
  "version-2",
  "version-3",
  "version-4",
  "version-5",
] as const;

/** Category landing pages for targeted video ads — same funnel as default (incl. qualification). */
export const LANDING_PAGE_CATEGORY_VARIANTS = [
  "doctors",
  "language-teachers",
  "consultants",
  "psychologists",
  "personal-trainers",
  "boat-rentals",
  "transfers-tours",
  "newsletter-marketing",
] as const;

export const LANDING_PAGE_VARIANTS = [
  ...LANDING_PAGE_AB_VARIANTS,
  ...LANDING_PAGE_CATEGORY_VARIANTS,
] as const;

export type LandingPageAbVariant = (typeof LANDING_PAGE_AB_VARIANTS)[number];
export type LandingPageCategoryVariant = (typeof LANDING_PAGE_CATEGORY_VARIANTS)[number];
export type LandingPageVariant = (typeof LANDING_PAGE_VARIANTS)[number] | "default";

export function isLandingPageVariant(value: string | undefined): value is LandingPageVariant {
  if (!value) return false;
  return (LANDING_PAGE_VARIANTS as readonly string[]).includes(value);
}

export function parseLandingPageVariant(value: string | undefined): LandingPageVariant {
  return isLandingPageVariant(value) ? value : "default";
}

export function landingLeadSource(variant: LandingPageVariant): string {
  return variant === "default"
    ? "website-creation-landing"
    : `website-creation-landing-${variant}`;
}

/** Default + category ad landings keep the meeting qualification step. */
export function landingQualificationEnabled(variant: LandingPageVariant): boolean {
  if (variant === "default") return true;
  return (LANDING_PAGE_CATEGORY_VARIANTS as readonly string[]).includes(variant);
}
