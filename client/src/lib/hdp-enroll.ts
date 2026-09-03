/** Public HDP store base URL (customer-facing enrollment pages). */
export const HDP_PUBLIC_BASE_URL = (
  (import.meta.env.VITE_HDP_PUBLIC_URL as string | undefined) ??
  (import.meta.env.VITE_HDP_INTERNAL_URL as string | undefined)
)
  ?.trim()
  .replace(/\/$/, "") || "https://hdp.hayc.gr";

export function buildHdpEnrollUrl(params: {
  siteId: string;
  courseId: string;
  returnUrl?: string;
  preview?: boolean;
}): string {
  const url = new URL(`${HDP_PUBLIC_BASE_URL}/enroll`);
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

export function resolveEnrollUrl(params: {
  siteId: string;
  courseId: string;
  enrollUrl?: string | null;
  returnUrl?: string;
  preview?: boolean;
}): string {
  const fallbackReturnUrl =
    params.returnUrl ?? (typeof window !== "undefined" ? window.location.href : undefined);

  if (typeof params.enrollUrl === "string" && params.enrollUrl.startsWith("https://")) {
    const url = new URL(params.enrollUrl);
    if (fallbackReturnUrl) {
      url.searchParams.set("returnUrl", fallbackReturnUrl);
    }
    if (params.preview) {
      url.searchParams.set("preview", "true");
    }
    return url.toString();
  }

  return buildHdpEnrollUrl({
    siteId: params.siteId,
    courseId: params.courseId,
    returnUrl: fallbackReturnUrl,
    preview: params.preview,
  });
}

export function openHdpEnrollPage(
  params: {
    siteId: string;
    courseId: string;
    enrollUrl?: string | null;
    returnUrl?: string;
    preview?: boolean;
  },
  options?: { newTab?: boolean },
): void {
  const url = resolveEnrollUrl(params);
  if (options?.newTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = url;
}

export function clearPurchaseSuccessQueryParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("purchase")) return;
  url.searchParams.delete("purchase");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function hasPurchaseSuccessQueryParam(): boolean {
  return new URLSearchParams(window.location.search).get("purchase") === "success";
}
