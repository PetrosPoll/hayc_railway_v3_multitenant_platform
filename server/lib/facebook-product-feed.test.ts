import { describe, expect, it } from "vitest";
import { buildFacebookProductCatalogXml } from "./facebook-product-feed";

describe("buildFacebookProductCatalogXml", () => {
  it("exports published products with required Meta fields", () => {
    const xml = buildFacebookProductCatalogXml({
      siteId: "site-1",
      brandName: "Demo Brand",
      brandLogoUrl: "https://cdn.example.com/logo.png",
      products: [
        {
          id: "c1",
          title: "Course A",
          description: "Learn A",
          status: "published",
          price: 49,
          currency: "EUR",
          enrollUrl: "https://hdp.example/enroll?courseId=c1",
          coverImageUrl: "https://cdn.example.com/c1.jpg",
        },
        {
          id: "c2",
          title: "Draft",
          status: "draft",
          price: 10,
          enrollUrl: "https://hdp.example/enroll?courseId=c2",
          coverImageUrl: "https://cdn.example.com/c2.jpg",
        },
      ],
    });

    expect(xml).toContain("<g:id>c1</g:id>");
    expect(xml).toContain("<g:title>Course A</g:title>");
    expect(xml).toContain("<g:price>49.00 EUR</g:price>");
    expect(xml).toContain("<g:brand>Demo Brand</g:brand>");
    expect(xml).not.toContain("<g:id>c2</g:id>");
  });

  it("falls back to brand logo when product has no image", () => {
    const xml = buildFacebookProductCatalogXml({
      siteId: "site-1",
      brandLogoUrl: "https://cdn.example.com/logo.png",
      products: [
        {
          id: "c1",
          title: "No image",
          status: "published",
          price: 20,
          currency: "EUR",
          enrollUrl: "https://hdp.example/enroll?c=1",
        },
      ],
    });
    expect(xml).toContain(
      "<g:image_link>https://cdn.example.com/logo.png</g:image_link>",
    );
  });
});
