import type { CSSProperties } from "react";

export const IMPERSONATION_BANNER_HEIGHT = "2.5rem";

export function impersonationRootStyle(active: boolean): CSSProperties | undefined {
  if (!active) return undefined;
  return {
    "--impersonation-banner-height": IMPERSONATION_BANNER_HEIGHT,
  } as CSSProperties;
}

export function impersonationDashboardPadClass(active: boolean): string {
  return active ? "pt-6" : "pt-28";
}

/** Full viewport height minus impersonation banner (when active). */
export const impersonationMinHSvh =
  "min-h-[calc(100svh-var(--impersonation-banner-height,0px))]";

export const impersonationHSvh =
  "h-[calc(100svh-var(--impersonation-banner-height,0px))]";

export const impersonationSidebarFixed =
  "top-[var(--impersonation-banner-height,0px)] h-[calc(100svh-var(--impersonation-banner-height,0px))]";
