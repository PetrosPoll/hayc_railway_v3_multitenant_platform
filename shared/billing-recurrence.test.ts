import { describe, expect, it } from "vitest";
import { addRecurrence, iterateRecurrenceDates, toLocalDateKey } from "./billing-recurrence";

describe("addRecurrence monthly clamp", () => {
  it("Jan 31 → Feb 28 (non-leap) → Mar 31", () => {
    const jan31 = new Date(2025, 0, 31);
    const feb = addRecurrence(jan31, "monthly", 31);
    expect(toLocalDateKey(feb)).toBe("2025-02-28");
    const mar = addRecurrence(feb, "monthly", 31);
    expect(toLocalDateKey(mar)).toBe("2025-03-31");
  });

  it("Jan 31 → Feb 29 on leap year → Mar 31", () => {
    const jan31 = new Date(2024, 0, 31);
    const feb = addRecurrence(jan31, "monthly", 31);
    expect(toLocalDateKey(feb)).toBe("2024-02-29");
    const mar = addRecurrence(feb, "monthly", 31);
    expect(toLocalDateKey(mar)).toBe("2024-03-31");
  });

  it("weekly adds 7 days", () => {
    const d = addRecurrence(new Date(2025, 0, 10), "weekly");
    expect(toLocalDateKey(d)).toBe("2025-01-17");
  });
});

describe("iterateRecurrenceDates", () => {
  it("yields clamped monthly dates in range", () => {
    const start = new Date(2025, 0, 31);
    const keys = [
      ...iterateRecurrenceDates(
        start,
        "monthly",
        new Date(2025, 0, 1),
        new Date(2025, 3, 30),
      ),
    ].map(toLocalDateKey);
    expect(keys).toEqual([
      "2025-01-31",
      "2025-02-28",
      "2025-03-31",
      "2025-04-30",
    ]);
  });
});
