import { describe, expect, it } from "vitest";
import {
  facebookCatalogFeedToken,
  publicFacebookCatalogFeedPath,
  verifyFacebookCatalogFeedToken,
} from "./facebook-product-feed";

describe("facebook catalog feed token", () => {
  it("is stable for the same siteId", () => {
    const a = facebookCatalogFeedToken("site-abc");
    const b = facebookCatalogFeedToken("site-abc");
    expect(a).toBe(b);
    expect(a.length).toBe(40);
  });

  it("differs across siteIds", () => {
    expect(facebookCatalogFeedToken("a")).not.toBe(facebookCatalogFeedToken("b"));
  });

  it("verifies matching tokens", () => {
    const siteId = "demo-site";
    const token = facebookCatalogFeedToken(siteId);
    expect(verifyFacebookCatalogFeedToken(siteId, token)).toBe(true);
    expect(verifyFacebookCatalogFeedToken(siteId, "wrong")).toBe(false);
  });

  it("builds a public path with token query", () => {
    const path = publicFacebookCatalogFeedPath("my-site");
    expect(path).toMatch(/^\/public\/facebook-catalog\/my-site\.xml\?token=/);
  });
});
