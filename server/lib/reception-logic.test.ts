import { describe, expect, it } from "vitest";
import {
  contactFolder,
  isStuck,
  mimeAllowed,
  nextChecklistStatus,
  zipEntryName,
  zipStore,
} from "./reception-logic";
import { RECEPTION_TYPE_SEEDS } from "./reception-catalog";

describe("reception checklist status", () => {
  const four = [
    { required: true, received: true },
    { required: true, received: true },
    { required: true, received: false },
    { required: true, received: false },
  ];

  it("marks a vehicle claim missing docs when 2 of 4 are in", () => {
    expect(nextChecklistStatus("service", "new", four)).toBe("missing_docs");
  });

  it("becomes complete when every required doc is in", () => {
    expect(
      nextChecklistStatus(
        "service",
        "missing_docs",
        four.map((d) => ({ ...d, received: true })),
      ),
    ).toBe("complete");
  });

  it("does not move a request the agent already sent", () => {
    expect(nextChecklistStatus("service", "sent", four)).toBe("sent");
  });

  it("leaves lead statuses alone", () => {
    expect(nextChecklistStatus("lead", "new", [])).toBe("new");
  });
});

describe("reception catalog", () => {
  it("keeps health claims free of uploads", () => {
    const health = RECEPTION_TYPE_SEEDS.find((t) => t.key === "claim_health");
    expect(health?.allowUploads).toBe(false);
    expect(health?.requiredDocs.length).toBeGreaterThan(0);
    expect(RECEPTION_TYPE_SEEDS.find((t) => t.key === "claim_vehicle")?.allowUploads).toBe(true);
  });
});

describe("reception files", () => {
  it("builds one folder per contact under the site", () => {
    expect(contactFolder("giorgos-papadopoulos-site", "Μαρία Ιωάννου", 10)).toBe(
      "giorgos-papadopoulos-site/leads/maria-ioannou-a",
    );
  });

  it("rejects non-document mime types", () => {
    expect(mimeAllowed("image/jpeg")).toBe(true);
    expect(mimeAllowed("application/pdf")).toBe(true);
    expect(mimeAllowed("application/x-msdownload")).toBe(false);
  });

  it("names zip entries doc_key_n.ext", () => {
    expect(zipEntryName("photos", 1, "jpg")).toBe("photos_1.jpg");
    const zip = zipStore([{ name: "photos_1.jpg", data: Buffer.from("img") }]);
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(zip.includes(Buffer.from("photos_1.jpg"))).toBe(true);
  });

  it("flags a request with no activity for 7 days", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isStuck(old, "missing_docs")).toBe(true);
    expect(isStuck(new Date(), "missing_docs")).toBe(false);
    expect(isStuck(old, "closed")).toBe(false);
  });
});
