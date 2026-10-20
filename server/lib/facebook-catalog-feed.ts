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

  const [productsRes, brandRes] = await Promise.all([
    fetch(
      `${HDP_INTERNAL_URL}/internal/sites/${encodeURIComponent(siteId)}/products`,
      { headers: { "x-internal-token": HDP_INTERNAL_TOKEN } },
    ),
    fetch(
      `${HDP_INTERNAL_URL}/api/brand/${encodeURIComponent(siteId)}`,
    ).catch(() => null),
  ]);

  if (productsRes.status === 204) {
    return {
      status: 200,
      xml: buildFacebookProductCatalogXml({
        siteId,
        brandName: website.projectName,
        products: [],
      }),
    };
  }

  if (!productsRes.ok) {
    const text = await productsRes.text();
    return {
      xml: "",
      status: productsRes.status,
      error: text.slice(0, 1000) || "Failed to fetch HDP products",
    };
  }

  const data = await productsRes.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { products?: unknown[] })?.products)
      ? (data as { products: unknown[] }).products
      : [];

  const hdpPublicUrl = (
    process.env.HDP_PUBLIC_URL ??
    process.env.HDP_INTERNAL_URL ??
    process.env.VITE_HDP_INTERNAL_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const products = list
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    )
    .map((item) =>
      hdpPublicUrl
        ? normalizeSyncedHdpProduct(item, siteId, hdpPublicUrl)
        : item,
    );

  let brandName: string | null = website.projectName || null;
  let brandLogoUrl: string | null = null;
  if (brandRes?.ok) {
    try {
      const brand = (await brandRes.json()) as Record<string, unknown>;
      brandName =
        typeof brand.brandName === "string"
          ? brand.brandName
          : typeof brand.name === "string"
            ? brand.name
            : brandName;
      brandLogoUrl =
        typeof brand.logoUrl === "string"
          ? brand.logoUrl
          : typeof brand.logo === "string"
            ? brand.logo
            : null;
    } catch {
      /* ignore */
    }
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
