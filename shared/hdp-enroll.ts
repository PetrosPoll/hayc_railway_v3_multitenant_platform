export function buildHdpEnrollUrl(params: {
  hdpPublicUrl: string;
  siteId: string;
  courseId: string;
  returnUrl?: string;
  preview?: boolean;
}): string {
  const base = params.hdpPublicUrl.trim().replace(/\/$/, "");
  const url = new URL(`${base}/enroll`);
  url.searchParams.set("siteId", params.siteId);
  url.searchParams.set("courseId", params.courseId);
  if (params.returnUrl) {
    url.searchParams.set("returnUrl", params.returnUrl);
  }
  if (params.preview) {
    url.searchParams.set("preview", "true");
  }
  return url.toString();
}

/** Append returnUrl to an HDP enroll URL (same-tab redirect — no modal/iframe). */
export function appendReturnUrlToEnrollUrl(enrollUrl: string, returnUrl: string): string {
  const sep = enrollUrl.includes("?") ? "&" : "?";
  return `${enrollUrl}${sep}returnUrl=${encodeURIComponent(returnUrl)}`;
}

export function normalizeSyncedHdpProduct(
  raw: Record<string, unknown>,
  siteId: string,
  hdpPublicUrl: string,
): Record<string, unknown> {
  const courseId = String(raw.id ?? "");
  let enrollUrl =
    typeof raw.enrollUrl === "string" && raw.enrollUrl.startsWith("https://")
      ? raw.enrollUrl
      : null;

  if (!enrollUrl && hdpPublicUrl && courseId) {
    enrollUrl = buildHdpEnrollUrl({ hdpPublicUrl, siteId, courseId });
  }

  const { widgetUrl: _widgetUrl, widget_url: _widget_url, ...rest } = raw;
  return {
    ...rest,
    enrollUrl,
  };
}
