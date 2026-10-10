/** Build Meta / Facebook Commerce Manager product catalog RSS XML. */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function formatPrice(price: unknown, currency: unknown): string {
  const n =
    typeof price === "string"
      ? Number.parseFloat(price)
      : typeof price === "number"
        ? price
        : NaN;
  const cur =
    typeof currency === "string" && currency.trim()
      ? currency.trim().toUpperCase()
      : "EUR";
  const amount = Number.isFinite(n) ? n : 0;
  return `${amount.toFixed(2)} ${cur}`;
}

export type FacebookFeedProduct = Record<string, unknown>;

export function buildFacebookProductCatalogXml(input: {
  siteId: string;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  products: FacebookFeedProduct[];
}): string {
  const brand = input.brandName?.trim() || "HAYC";
  const fallbackImage = input.brandLogoUrl?.trim() || "";

  const items = input.products
    .filter((p) => String(p.status ?? "").toLowerCase() === "published")
    .map((p) => {
      const id = String(p.id ?? "").trim();
      if (!id) return null;
      const title =
        pickString(p.title, p.name) || `Product ${id}`;
      const description =
        pickString(p.description, p.shortDescription, p.summary) || title;
      const link =
        pickString(p.enrollUrl, p.link, p.url) ||
        `https://hayc.gr`;
      const image =
        pickString(
          p.coverImageUrl,
          p.coverImage,
          p.imageUrl,
          p.image,
          p.thumbnailUrl,
          p.thumbnail,
        ) || fallbackImage;
      if (!image) return null;

      const price = formatPrice(p.price, p.currency);
      return { id, title, description, link, image, price };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const itemXml = items
    .map(
      (item) => `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.image)}</g:image_link>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>in stock</g:availability>
      <g:price>${escapeXml(item.price)}</g:price>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(`${brand} — Digital products`)}</title>
    <link>https://hayc.gr</link>
    <description>${escapeXml(`Facebook catalog feed for site ${input.siteId}`)}</description>
${itemXml}
  </channel>
</rss>
`;
}
