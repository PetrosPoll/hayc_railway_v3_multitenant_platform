export const LANDING_PAGE_VARIANTS = [
  "version-1",
  "version-2",
  "version-3",
  "version-4",
  "version-5",
] as const;

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
