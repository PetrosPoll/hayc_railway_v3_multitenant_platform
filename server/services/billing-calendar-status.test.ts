import { describe, expect, it } from "vitest";
import {
  computeCalendarTotals,
  outstandingCents,
  collectedNetCents,
  canceledCents,
  statusGroup,
} from "./billing-calendar-status";

describe("calendar totals formulas", () => {
  it("computes mixed month fixture", () => {
    const rows = [
      { status: "settled", amountDue: 4900, amountPaidCents: 4900, amountRefundedCents: 0 },
      { status: "upcoming", amountDue: 4400, amountPaidCents: 0, amountRefundedCents: 0 },
      { status: "pending", amountDue: 2000, amountPaidCents: 0, amountRefundedCents: 0 },
      {
        status: "retrying",
        amountDue: 4900,
        amountPaidCents: 0,
        amountRefundedCents: 0,
      },
      {
        status: "partially_paid",
        amountDue: 10000,
        amountPaidCents: 4000,
        amountRefundedCents: 0,
      },
      {
        status: "written_off",
        amountDue: 3000,
        amountPaidCents: 0,
        amountRefundedCents: 0,
      },
      {
        status: "partially_refunded",
        amountDue: 5000,
        amountPaidCents: 5000,
        amountRefundedCents: 2000,
      },
      {
        status: "will_not_renew",
        amountDue: 4900,
        amountPaidCents: 0,
        amountRefundedCents: 0,
      },
      {
        status: "stopped",
        amountDue: 2200,
        amountPaidCents: 0,
        amountRefundedCents: 0,
      },
      {
        status: "upcoming",
        amountDue: 1000,
        amountPaidCents: 0,
        amountRefundedCents: 0,
        riskFlags: ["card_expiring"],
      },
    ];

    const t = computeCalendarTotals(rows);
    // collected: 4900 + 4000 + (5000-2000) = 11900
    expect(t.collectedCents).toBe(11900);
    // expected: 4400 + 2000 + 4900 (will_not_renew) + 1000 = 12300
    expect(t.expectedCents).toBe(12300);
    // outstanding: 4900 + 6000 = 10900
    expect(t.outstandingCents).toBe(10900);
    // canceled: written_off 3000 + stopped 2200 = 5200 (refunds not here)
    expect(t.canceledCents).toBe(5200);
    expect(t.lostCents).toBe(5200);
    expect(t.monthTotalCents).toBe(11900 + 12300 + 10900);
    expect(t.atRiskCount).toBe(1);
    expect(t.atRiskCents).toBe(1000);
  });

  it("stopped counts as canceled, not expected or month total", () => {
    const t = computeCalendarTotals([
      { status: "stopped", amountDue: 5000, amountPaidCents: 0, amountRefundedCents: 0 },
      { status: "upcoming", amountDue: 1000, amountPaidCents: 0, amountRefundedCents: 0 },
    ]);
    expect(statusGroup("stopped")).toBe("canceled");
    expect(t.canceledCents).toBe(5000);
    expect(t.expectedCents).toBe(1000);
    expect(t.monthTotalCents).toBe(1000);
  });

  it("will_not_renew counts in expected", () => {
    expect(statusGroup("will_not_renew")).toBe("expected");
    const t = computeCalendarTotals([
      {
        status: "will_not_renew",
        amountDue: 4900,
        amountPaidCents: 0,
        amountRefundedCents: 0,
      },
    ]);
    expect(t.expectedCents).toBe(4900);
    expect(t.canceledCents).toBe(0);
    expect(t.monthTotalCents).toBe(4900);
  });

  it("outstanding for partially_paid is remainder", () => {
    expect(
      outstandingCents({
        status: "partially_paid",
        amountDue: 10000,
        amountPaidCents: 2500,
        amountRefundedCents: 0,
      }),
    ).toBe(7500);
  });

  it("collected net subtracts refunds", () => {
    expect(
      collectedNetCents({
        status: "partially_refunded",
        amountPaidCents: 5000,
        amountRefundedCents: 2000,
      }),
    ).toBe(3000);
  });

  it("canceledCents includes written_off and stopped", () => {
    expect(canceledCents({ status: "written_off", amountDue: 3000 })).toBe(3000);
    expect(canceledCents({ status: "stopped", amountDue: 1500 })).toBe(1500);
    expect(canceledCents({ status: "upcoming", amountDue: 1500 })).toBe(0);
  });
});

describe("orphan matching status rules", () => {
  it("open statuses map to expected or outstanding until stopped", () => {
    expect(statusGroup("upcoming")).toBe("expected");
    expect(statusGroup("pending")).toBe("expected");
    expect(statusGroup("delinquent")).toBe("outstanding");
    expect(statusGroup("stopped")).toBe("canceled");
  });
});
