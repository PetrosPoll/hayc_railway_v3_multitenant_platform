import { describe, expect, it } from "vitest";
import { athensMonthStart } from "./blog-quota";

describe("athensMonthStart", () => {
  it("starts October 2026 at 21:00 UTC the previous day", () => {
    expect(athensMonthStart(new Date("2026-10-15T12:00:00.000Z")).toISOString())
      .toBe("2026-09-30T21:00:00.000Z");
  });
});
