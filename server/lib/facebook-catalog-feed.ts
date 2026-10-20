import { eq } from "drizzle-orm";
import { db } from "../db";
import { websiteProgress } from "@shared/schema";
import { normalizeSyncedHdpProduct } from "@shared/hdp-enroll";
import { buildFacebookProductCatalogXml } from "./facebook-product-feed";

export {
  facebookCatalogFeedToken,
  publicFacebookCatalogFeedPath,
  publicFacebookCatalogFeedUrl,
  verifyFacebookCatalogFeedToken,
} from "./facebook-product-feed";

function firstString(
  obj: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractBrandMeta(
  payload: Record<string, unknown>,
  fallbackName: string | null,
): { brandName: string | null; brandLogoUrl: string | null } {
  const nested =
    payload.brand && typeof payload.brand === "object" && !Array.isArray(payload.brand)
      ? (payload.brand as Record<string, unknown>)
      : null;
  const theme =
    payload.theme && typeof payload.theme === "object" && !Array.isArray(payload.theme)
      ? (payload.theme as Record<string, unknown>)
      : null;

  const brandName =
    firstString(nested, ["brandName", "name"]) ||
    firstString(payload, ["brandName", "name"]) ||
    fallbackName;

  const brandLogoUrl =
    firstString(nested, ["logoUrl", "logo_url", "logo"]) ||
    firstString(theme, ["logoUrl", "logo_url", "logo"]) ||
    firstString(payload, ["logoUrl", "logo_url", "logo"]);

  return { brandName, brandLogoUrl };
}

function asProductList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    );
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["products", "courses", "items"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object",
        );
      }
    }
  }
  return [];
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, { headers });
  if (res.status === 204) {
    return { ok: true, status: 204, data: [] };
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return { ok: res.ok, status: res.status, data: text.slice(0, 1000) };
  }
  try {
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch {
    return { ok: false, status: res.status, data: null };
  }
}

export async function buildFacebookCatalogXmlForSite(
  siteId: string,
): Promise<{ xml: string; status: number; error?: string }> {
  const [website] = await db
    .select({
      id: websiteProgress.id,
      siteId: websiteProgress.siteId,
      digitalProductsEnabled: websiteProgress.digitalProductsEnabled,
      projectName: websiteProgress.projectName,
    })
    .from(websiteProgress)
    .where(eq(websiteProgress.siteId, siteId))
    .limit(1);

  if (!website) {
    return { xml: "", status: 404, error: "Site not found" };
  }
  if (!website.digitalProductsEnabled) {
    return { xml: "", status: 404, error: "Digital products not enabled" };
  }

  const HDP_INTERNAL_URL =
    process.env.HDP_INTERNAL_URL ?? process.env.VITE_HDP_INTERNAL_URL;
  const HDP_INTERNAL_TOKEN =
    process.env.HDP_INTERNAL_TOKEN ?? process.env.VITE_HDP_INTERNAL_TOKEN;
  if (!HDP_INTERNAL_URL || !HDP_INTERNAL_TOKEN) {
    return {
      xml: "",
      status: 503,
      error: "HDP internal service not configured",
    };
  }

  const headers = { "x-internal-token": HDP_INTERNAL_TOKEN };
  const [previewRes, productsRes, brandRes] = await Promise.all([
    fetchJson(
      `${HDP_INTERNAL_URL}/internal/sites/${encodeURIComponent(siteId)}/courses/published-preview`,
      headers,
    ),
    fetchJson(
      `${HDP_INTERNAL_URL}/internal/sites/${encodeURIComponent(siteId)}/products`,
      headers,
    ),
    fetchJson(`${HDP_INTERNAL_URL}/api/brand/${encodeURIComponent(siteId)}`).catch(
      () => ({ ok: false, status: 0, data: null }),
    ),
  ]);

  if (!productsRes.ok && !previewRes.ok) {
    return {
      xml: "",
      status: productsRes.status || previewRes.status || 502,
      error:
        typeof productsRes.data === "string"
          ? productsRes.data
          : "Failed to fetch HDP products",
    };
  }

  const hdpPublicUrl = (
    process.env.HDP_PUBLIC_URL ??
    process.env.HDP_INTERNAL_URL ??
    process.env.VITE_HDP_INTERNAL_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");

  // Prefer published-preview (same source as website sync). Those rows often omit
  // `status`, so mark them published explicitly.
  const previewList = previewRes.ok ? asProductList(previewRes.data) : [];
  const productsList = productsRes.ok ? asProductList(productsRes.data) : [];

  const sourceList =
    previewList.length > 0
      ? previewList.map((item) => ({ ...item, status: "published" }))
      : productsList;

  const products = sourceList.map((item) =>
    hdpPublicUrl ? normalizeSyncedHdpProduct(item, siteId, hdpPublicUrl) : item,
  );

  let brandName: string | null = website.projectName || null;
  let brandLogoUrl: string | null = null;
  if (brandRes.ok && brandRes.data && typeof brandRes.data === "object") {
    const extracted = extractBrandMeta(
      brandRes.data as Record<string, unknown>,
      brandName,
    );
    brandName = extracted.brandName;
    brandLogoUrl = extracted.brandLogoUrl;
  }

  return {
    status: 200,
    xml: buildFacebookProductCatalogXml({
      siteId,
      brandName,
      brandLogoUrl,
      products,
    }),
  };
}
