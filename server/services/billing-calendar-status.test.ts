import { describe, expect, it } from "vitest";
import {
  computeCalendarTotals,
  outstandingCents,
  collectedNetCents,
  lostCents,
} from "./billing-calendar-status";

describe("calendar totals formulas", () => {
  it("computes mixed month fixture (test 20)", () => {
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
    // expected: 4400 + 2000 + 1000 = 7400
    expect(t.expectedCents).toBe(7400);
    // outstanding: 4900 + 6000 = 10900
    expect(t.outstandingCents).toBe(10900);
    // lost: 3000 + 2000 refund = 5000
    expect(t.lostCents).toBe(5000);
    expect(t.monthTotalCents).toBe(11900 + 7400 + 10900);
    expect(t.atRiskCount).toBe(1);
    expect(t.atRiskCents).toBe(1000);
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

  it("lost includes written_off full amount", () => {
    expect(
      lostCents({
        status: "written_off",
        amountDue: 3000,
        amountRefundedCents: 0,
      }),
    ).toBe(3000);
  });
});
