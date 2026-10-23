import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for Automations v2 helpers that don't need a live DB.
 * Integration coverage for emitEvent / steps lives behind a DB when available.
 */

vi.mock("../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("../email-service", () => ({
  EmailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("../s3-config", () => ({
  getConfig: vi.fn().mockResolvedValue({}),
}));

import { formSubmitDedupeKey } from "./automation-events";
import { syncWebsiteFormFieldsFromConfig } from "./automation-form-fields";
import { db } from "../db";

describe("formSubmitDedupeKey", () => {
  it("is stable within the same minute bucket for the same inputs", () => {
    const a = formSubmitDedupeKey({
      websiteProgressId: 1,
      formId: "contact",
      email: "A@B.com",
      message: "hello",
    });
    const b = formSubmitDedupeKey({
      websiteProgressId: 1,
      formId: "contact",
      email: "a@b.com",
      message: "hello",
    });
    expect(a).toBe(b);
    expect(a).toContain("form:1:contact:a@b.com:");
  });

  it("differs when the message changes", () => {
    const a = formSubmitDedupeKey({
      websiteProgressId: 1,
      formId: "contact",
      email: "a@b.com",
      message: "one",
    });
    const b = formSubmitDedupeKey({
      websiteProgressId: 1,
      formId: "contact",
      email: "a@b.com",
      message: "two",
    });
    expect(a).not.toBe(b);
  });
});

describe("syncWebsiteFormFieldsFromConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts fields with stable keys from config.forms", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (db.select as any).mockReturnValue(selectChain);
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const n = await syncWebsiteFormFieldsFromConfig(42, {
      forms: [
        {
          id: "contact-page",
          name: "Contact",
          fields: [
            { key: "full_name", label: "Full name", type: "text" },
            { label: "Phone Number", type: "tel" },
          ],
        },
      ],
    });

    expect(n).toBe(2);
    expect(db.insert).toHaveBeenCalled();
  });

  it("returns 0 when forms are missing", async () => {
    expect(await syncWebsiteFormFieldsFromConfig(1, {})).toBe(0);
    expect(await syncWebsiteFormFieldsFromConfig(1, null)).toBe(0);
  });
});

describe("automation v2 delay backoff", () => {
  it("documents max attempts = 5", () => {
    // Mirrored from automation-engine-v2.ts — keep in sync if changed.
    const MAX_ATTEMPTS = 5;
    const BACKOFF_MS = [0, 2_000, 10_000, 60_000, 300_000, 900_000];
    expect(MAX_ATTEMPTS).toBe(5);
    expect(BACKOFF_MS.length).toBeGreaterThanOrEqual(MAX_ATTEMPTS);
  });
});
