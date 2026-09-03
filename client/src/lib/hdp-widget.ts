/** Public HDP store base URL (customer-facing widget). */
export const HDP_PUBLIC_BASE_URL = (
  (import.meta.env.VITE_HDP_PUBLIC_URL as string | undefined) ??
  (import.meta.env.VITE_HDP_INTERNAL_URL as string | undefined)
)
  ?.trim()
  .replace(/\/$/, "") || "https://hdp.hayc.gr";

export type HdpWidgetMessage =
  | { type: "hdp-widget-success" }
  | { type: "hdp-widget-checkout"; url: string }
  | { type: "hdp-widget-close" };

export function buildHdpWidgetUrl(params: {
  siteId: string;
  courseId: string;
  returnUrl?: string;
  preview?: boolean;
}): string {
  const url = new URL(`${HDP_PUBLIC_BASE_URL}/widget`);
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

export function parseHdpWidgetMessage(data: unknown): HdpWidgetMessage | null {
  if (!data || typeof data !== "object") return null;
  const type = (data as { type?: unknown }).type;
  if (type === "hdp-widget-success") return { type: "hdp-widget-success" };
  if (type === "hdp-widget-close") return { type: "hdp-widget-close" };
  if (type === "hdp-widget-checkout") {
    const url = (data as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("https://")) {
      return { type: "hdp-widget-checkout", url };
    }
  }
  return null;
}

export function isAllowedHdpWidgetOrigin(origin: string): boolean {
  try {
    return origin === new URL(HDP_PUBLIC_BASE_URL).origin;
  } catch {
    return false;
  }
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
