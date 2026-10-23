import { describe, expect, it } from "vitest";
import { sanitizeBlogHtml, slugifyTitle } from "./blog-html";

describe("sanitizeBlogHtml", () => {
  it("drops scripts and keeps paragraphs and links", () => {
    const html = sanitizeBlogHtml(
      `<p>Hello</p><script>alert(1)</script><a href="https://example.com">site</a><img src=x>`,
    );
    expect(html).toBe(
      `<p>Hello</p><a href="https://example.com" rel="noopener noreferrer" target="_blank">site</a>`,
    );
  });
});

describe("slugifyTitle", () => {
  it("keeps greek words and collapses spaces", () => {
    expect(slugifyTitle("Καλοκαιρινό service!")).toBe("καλοκαιρινο-service");
  });
});
