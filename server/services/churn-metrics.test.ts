import { describe, expect, it } from "vitest";
import {
  addMonthsYm,
  athensLocalToUtc,
  currentAthensYearMonth,
  defaultSeriesRange,
  lastCompletedAthensMonth,
  listYearMonths,
  monthBoundsAthens,
  tenureBucketMonths,
} from "./churn-metrics-dates";

describe("churn-metrics date helpers", () => {
  it("parses Athens month bounds as midnight local", () => {
    const { start, end } = monthBoundsAthens("2026-03");
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Athens",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(fmt.format(start)).toMatch(/^2026-03-01/);
    expect(fmt.format(end)).toMatch(/^2026-04-01/);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("handles DST spring-forward month start", () => {
    const start = athensLocalToUtc(2026, 3, 1, 0, 0, 0);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Athens",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(start);
    const hour = parts.find((p) => p.type === "hour")?.value;
    expect(hour).toBe("00");
  });

  it("lists months inclusively", () => {
    expect(listYearMonths("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("adds months across year boundary", () => {
    expect(addMonthsYm("2025-12", 1)).toBe("2026-01");
    expect(addMonthsYm("2026-01", -1)).toBe("2025-12");
  });

  it("default series is 12 completed months", () => {
    const now = new Date("2026-10-10T12:00:00+03:00");
    const { from, to } = defaultSeriesRange(now);
    expect(to).toBe(lastCompletedAthensMonth(now));
    expect(listYearMonths(from, to)).toHaveLength(12);
    expect(to < currentAthensYearMonth(now)).toBe(true);
  });

  it("tenure buckets", () => {
    expect(tenureBucketMonths(0)).toBe("0-3");
    expect(tenureBucketMonths(3)).toBe("0-3");
    expect(tenureBucketMonths(4)).toBe("4-12");
    expect(tenureBucketMonths(12)).toBe("4-12");
    expect(tenureBucketMonths(13)).toBe("13+");
    expect(tenureBucketMonths(null)).toBe("0-3");
  });
});
