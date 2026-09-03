import type { Product } from "@/types/digital-products";

export function normalizeHdpProduct(raw: Record<string, unknown>): Product {
  const priceRaw = raw.price;
  const parsedPrice =
    typeof priceRaw === "string"
      ? Number.parseFloat(priceRaw)
      : typeof priceRaw === "number"
        ? priceRaw
        : 0;

  return {
    id: String(raw.id ?? ""),
    type: raw.type === "course" ? "course" : "course",
    title: typeof raw.title === "string" ? raw.title : "",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    currency: typeof raw.currency === "string" ? raw.currency : "EUR",
    status: raw.status === "published" ? "published" : "draft",
    accessType: raw.accessType === "limited" ? "limited" : raw.accessType === "lifetime" ? "lifetime" : undefined,
    accessDays:
      raw.accessDays != null && Number.isFinite(Number(raw.accessDays))
        ? Number(raw.accessDays)
        : null,
    enrollUrl: typeof raw.enrollUrl === "string" ? raw.enrollUrl : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function normalizeHdpProductsPayload(data: unknown): Product[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { products?: unknown[] })?.products)
      ? (data as { products: unknown[] }).products
      : [];
  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map(normalizeHdpProduct);
}
