import { describe, it, expect } from "vitest";
import { parseSiteForms } from "./form-automations";

/**
 * `config.forms` is authored in the client website repo, so parseSiteForms
 * treats it as untrusted input: it rebuilds every entry field by field and
 * skips anything malformed rather than failing the whole list.
 */
describe("parseSiteForms", () => {
  it("defaults entries published before `type` existed to contact", () => {
    // The array live in maria-papadopoulou's S3 config.json today.
    const config = {
      forms: [
        { id: "contact-page", name: "Contact", page: "/contact" },
        { id: "blog-comment", name: "Blog Comment", page: "/blog-details" },
      ],
    };

    expect(parseSiteForms(config)).toEqual([
      { id: "contact-page", name: "Contact", type: "contact", page: "/contact" },
      { id: "blog-comment", name: "Blog Comment", type: "contact", page: "/blog-details" },
    ]);
  });

  it("carries `type` through so the dashboard can tell the two apart", () => {
    const config = {
      forms: [
        { id: "contact-page", name: "Contact", page: "/contact", type: "contact" },
        { id: "newsletter-footer", name: "Newsletter", type: "newsletter" },
      ],
    };

    expect(parseSiteForms(config).map((f) => [f.id, f.type])).toEqual([
      ["contact-page", "contact"],
      ["newsletter-footer", "newsletter"],
    ]);
  });

  it("treats an unrecognised type as a contact form rather than dropping the form", () => {
    const config = { forms: [{ id: "x", name: "X", type: "webhook" }] };
    expect(parseSiteForms(config)[0].type).toBe("contact");
  });

  it("omits `page` for site-wide forms such as a footer signup", () => {
    const config = { forms: [{ id: "newsletter-footer", name: "Newsletter", type: "newsletter" }] };
    expect(parseSiteForms(config)[0]).not.toHaveProperty("page");
  });

  it("skips malformed entries instead of hiding every other form", () => {
    const config = {
      forms: [
        { id: "good", name: "Good" },
        { id: "   ", name: "blank id" },
        { id: "no-name", name: "" },
        { name: "no id at all" },
        null,
        "not an object",
        ["nested array"],
        { id: "also-good", name: "Also Good" },
      ],
    };

    expect(parseSiteForms(config).map((f) => f.id)).toEqual(["good", "also-good"]);
  });

  it("returns nothing when forms is absent or not an array", () => {
    expect(parseSiteForms({})).toEqual([]);
    expect(parseSiteForms({ forms: { id: "not-an-array" } })).toEqual([]);
    expect(parseSiteForms(null)).toEqual([]);
    expect(parseSiteForms(undefined)).toEqual([]);
  });
});
