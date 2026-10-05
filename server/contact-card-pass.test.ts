// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  contactCardUrl,
  getContactCard,
  isContactCardPath,
} from "@shared/contact-cards";
import { createBrandIconPng } from "./lib/brand-icon-png";
import {
  appleWalletConfigured,
  buildContactCardQrPng,
  contactCardOriginFromHost,
} from "./contact-card-pass";

describe("contact cards", () => {
  it("keeps a public page for Petros and Alexandra", () => {
    expect(getContactCard("petros-pollakis")?.name).toBe("Πέτρος Πολλάκης");
    expect(getContactCard("alexandra-kritikou")?.name).toBe("Αλεξάνδρα Κριτικού");
    expect(getContactCard("petros-pollakis")?.links.find((link) => link.kind === "phone")?.href).toBe(
      "tel:+306982249034",
    );
    expect(getContactCard("alexandra-kritikou")?.links.find((link) => link.kind === "instagram")?.href).toBe(
      "https://www.instagram.com/a_kritikou/",
    );
    expect(getContactCard("missing")).toBeUndefined();
  });

  it("builds the public card url", () => {
    expect(contactCardUrl("petros-pollakis")).toBe("https://hayc.gr/card/petros-pollakis");
    expect(contactCardUrl("alexandra-kritikou", "https://hayc.gr/")).toBe(
      "https://hayc.gr/card/alexandra-kritikou",
    );
    expect(isContactCardPath("/card/petros-pollakis")).toBe(true);
    expect(isContactCardPath("/pricing")).toBe(false);
  });

  it("points local QR codes at the public site", () => {
    expect(contactCardOriginFromHost("localhost:5000", "http")).toBe("https://hayc.gr");
    expect(contactCardOriginFromHost("127.0.0.1:5000", "http")).toBe("https://hayc.gr");
    expect(contactCardOriginFromHost("hayc.gr", "https")).toBe("https://hayc.gr");
  });

  it("renders a brand icon and a QR png", async () => {
    const icon = createBrandIconPng(29);
    expect(icon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");

    const qr = await buildContactCardQrPng("https://hayc.gr/card/petros-pollakis");
    expect(qr.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(qr.length).toBeGreaterThan(500);
  });

  it("keeps Apple Wallet unavailable until the signing certificate is set", () => {
    const previous = process.env.APPLE_PASS_TYPE_IDENTIFIER;
    delete process.env.APPLE_PASS_TYPE_IDENTIFIER;
    expect(appleWalletConfigured()).toBe(false);
    if (previous) process.env.APPLE_PASS_TYPE_IDENTIFIER = previous;
  });
});
