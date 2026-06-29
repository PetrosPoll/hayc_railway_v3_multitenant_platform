export const IMPERSONATION_BANNER_OFFSET_CLASS = "top-10";

export function impersonationBannerSpacerClass(active: boolean): string {
  return active ? "h-10 shrink-0" : "";
}

export function impersonationNavTopClass(active: boolean): string {
  return active ? IMPERSONATION_BANNER_OFFSET_CLASS : "top-0";
}

export function impersonationDashboardPadClass(active: boolean): string {
  return active ? "pt-[calc(7rem+2.5rem)]" : "pt-28";
}

export function impersonationStickyTopClass(active: boolean): string {
  return active ? IMPERSONATION_BANNER_OFFSET_CLASS : "top-0";
}
