import { describe, expect, it } from "vitest";
import { unpaidStatusForCustomDue } from "./billing-custom-status";

describe("unpaidStatusForCustomDue", () => {
  const today = new Date(2026, 9, 13); // Oct 13 local

  it("future due → upcoming", () => {
    expect(unpaidStatusForCustomDue(new Date(2026, 9, 20), 7, today)).toBe("upcoming");
  });

  it("due today → pending", () => {
    expect(unpaidStatusForCustomDue(new Date(2026, 9, 13), 7, today)).toBe("pending");
  });

  it("within grace → grace", () => {
    expect(unpaidStatusForCustomDue(new Date(2026, 9, 10), 7, today)).toBe("grace");
  });

  it("past grace → delinquent", () => {
    expect(unpaidStatusForCustomDue(new Date(2026, 8, 1), 7, today)).toBe("delinquent");
  });
});
