import { describe, expect, it } from "vitest";
import { buildLogoTransitions, type SubInterval } from "./stripe-logo-timeline";

describe("buildLogoTransitions", () => {
  it("emits new then churn for a single core sub", () => {
    const intervals: SubInterval[] = [
      {
        startMs: Date.parse("2026-01-01T00:00:00Z"),
        endMs: Date.parse("2026-03-01T00:00:00Z"),
        mrrCents: 3900,
        tier: "essential",
        hasCore: true,
        subId: "sub_1",
      },
    ];
    const t = buildLogoTransitions(intervals);
    expect(t.map((x) => x.type)).toEqual(["new", "churn"]);
    expect(t[0].mrrAfterCents).toBe(3900);
    expect(t[1].mrrAfterCents).toBe(0);
    expect(t[1].mrrDeltaCents).toBe(-3900);
  });

  it("does not logo-churn when overlapping cores bridge a cancel", () => {
    const intervals: SubInterval[] = [
      {
        startMs: Date.parse("2026-01-01T00:00:00Z"),
        endMs: Date.parse("2026-03-01T00:00:00Z"),
        mrrCents: 3900,
        tier: "essential",
        hasCore: true,
        subId: "sub_a",
      },
      {
        startMs: Date.parse("2026-02-01T00:00:00Z"),
        endMs: null,
        mrrCents: 4900,
        tier: "essential",
        hasCore: true,
        subId: "sub_b",
      },
    ];
    const t = buildLogoTransitions(intervals);
    // MRR drops when first core ends, but logo stays active → contraction, not churn
    expect(t.map((x) => x.type)).toEqual(["new", "expansion", "contraction"]);
    expect(t.some((x) => x.type === "churn")).toBe(false);
    expect(t.at(-1)?.statusAfter).toBe("active");
  });

  it("emits reactivation after a gap", () => {
    const intervals: SubInterval[] = [
      {
        startMs: Date.parse("2026-01-01T00:00:00Z"),
        endMs: Date.parse("2026-02-01T00:00:00Z"),
        mrrCents: 3900,
        tier: "essential",
        hasCore: true,
        subId: "sub_1",
      },
      {
        startMs: Date.parse("2026-04-01T00:00:00Z"),
        endMs: null,
        mrrCents: 3900,
        tier: "essential",
        hasCore: true,
        subId: "sub_2",
      },
    ];
    const t = buildLogoTransitions(intervals);
    expect(t.map((x) => x.type)).toEqual(["new", "churn", "reactivation"]);
  });

  it("bridges a 1-day gap between monthly cancel and yearly start (no logo churn)", () => {
    const endMonthly = Date.parse("2025-11-04T12:00:00Z");
    const startYearly = Date.parse("2025-11-05T12:00:00Z");
    const intervals: SubInterval[] = [
      {
        startMs: Date.parse("2025-01-01T00:00:00Z"),
        endMs: endMonthly,
        mrrCents: 3599,
        tier: "essential",
        hasCore: true,
        subId: "sub_monthly",
      },
      {
        startMs: startYearly,
        endMs: null,
        mrrCents: 2700,
        tier: "essential",
        hasCore: true,
        subId: "sub_yearly",
      },
    ];
    const t = buildLogoTransitions(intervals);
    expect(t.some((x) => x.type === "churn")).toBe(false);
    expect(t.some((x) => x.type === "reactivation")).toBe(false);
    expect(t.map((x) => x.type)).toContain("contraction");
  });

  it("same-ms replace does not create churn", () => {
    const t0 = Date.parse("2026-05-01T00:00:00Z");
    const intervals: SubInterval[] = [
      {
        startMs: Date.parse("2026-01-01T00:00:00Z"),
        endMs: t0,
        mrrCents: 3900,
        tier: "essential",
        hasCore: true,
        subId: "sub_old",
      },
      {
        startMs: t0,
        endMs: null,
        mrrCents: 5900,
        tier: "pro",
        hasCore: true,
        subId: "sub_new",
      },
    ];
    const t = buildLogoTransitions(intervals);
    expect(t.map((x) => x.type)).toEqual(["new", "expansion"]);
  });
});
