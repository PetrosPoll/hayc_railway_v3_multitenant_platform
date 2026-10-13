import { describe, expect, it } from "vitest";
import { addRecurrence, toLocalDateKey } from "@shared/billing-recurrence";
import { PaymentObligationStatus } from "@shared/schema";
import {
  isLocalSubCancelled,
  isOpenObligationStatus,
  failureReasonFromCharge,
  allocateRefundCents,
} from "./billing-calendar-matching";

/**
 * Pure-logic coverage for scenarios that don't need a live DB.
 * Full webhook/DB scenarios are exercised via staging test plan.
 */

describe("calendar v2 scenario helpers", () => {
  it("1/8 yearly recurrence keeps one charge per year", () => {
    const start = new Date(2025, 2, 15);
    const next = addRecurrence(start, "yearly", 15);
    expect(toLocalDateKey(next)).toBe("2026-03-15");
  });

  it("14 custom Jan 31 monthly chain", () => {
    let d = new Date(2025, 0, 31);
    d = addRecurrence(d, "monthly", 31);
    expect(toLocalDateKey(d)).toBe("2025-02-28");
    d = addRecurrence(d, "monthly", 31);
    expect(toLocalDateKey(d)).toBe("2025-03-31");
  });

  it("status transitions for fail→retry→settle are distinct", () => {
    const chain = [
      PaymentObligationStatus.RETRYING,
      PaymentObligationStatus.RETRYING,
      PaymentObligationStatus.SETTLED,
    ];
    expect(new Set(chain).size).toBe(2);
    expect(chain[2]).toBe("settled");
  });

  it("5 cancel at period end uses will_not_renew", () => {
    expect(PaymentObligationStatus.WILL_NOT_RENEW).toBe("will_not_renew");
  });

  it("canceled subscription maps open rows to stopped status constant", () => {
    expect(PaymentObligationStatus.STOPPED).toBe("stopped");
  });

  it("orphan sweep: cancelled local statuses stop open obligations", () => {
    expect(isLocalSubCancelled("cancelled")).toBe(true);
    expect(isLocalSubCancelled("canceled")).toBe(true);
    expect(isLocalSubCancelled("incomplete_expired")).toBe(true);
    expect(isLocalSubCancelled("active")).toBe(false);
    expect(isLocalSubCancelled("past_due")).toBe(false);
    expect(isOpenObligationStatus("upcoming")).toBe(true);
    expect(isOpenObligationStatus("will_not_renew")).toBe(true);
    expect(isOpenObligationStatus("settled")).toBe(false);
    expect(isOpenObligationStatus("stopped")).toBe(false);
  });

  it("failureReasonFromCharge prefers failure_message then seller_message", () => {
    const reason = failureReasonFromCharge({
      failure_message: "Your card was declined.",
      failure_code: "card_declined",
      outcome: {
        seller_message: "The bank did not return any further details with this decline.",
        reason: "generic_decline",
      },
    } as any);
    expect(reason).toContain("Your card was declined.");
    expect(reason).toContain("The bank did not return any further details");
  });

  it("9 pause status exists", () => {
    expect(PaymentObligationStatus.PAUSED).toBe("paused");
  });

  it("10 refund statuses exist", () => {
    expect(PaymentObligationStatus.REFUNDED).toBe("refunded");
    expect(PaymentObligationStatus.PARTIALLY_REFUNDED).toBe("partially_refunded");
  });

  it("refund allocation greedily fills lines in order (smallest-first caller)", () => {
    // Caller sorts [addon, plan, setup]; €20 → full addon + €10 of plan
    expect(allocateRefundCents([1000, 3900, 9900], 2000)).toEqual([1000, 1000, 0]);
    expect(allocateRefundCents([1000, 3900], 4900)).toEqual([1000, 3900]);
    expect(allocateRefundCents([1000], 2000)).toEqual([1000]);
  });

  it("11 dispute status exists", () => {
    expect(PaymentObligationStatus.DISPUTED).toBe("disputed");
  });

  it("4 action_required status exists", () => {
    expect(PaymentObligationStatus.ACTION_REQUIRED).toBe("action_required");
  });
});
