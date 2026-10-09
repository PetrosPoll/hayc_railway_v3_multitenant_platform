import { describe, expect, it } from "vitest";
import { classifyInvoicePaidEvent } from "./invoice-paid-classification";

describe("classifyInvoicePaidEvent", () => {
  it("subscription_create → new when no prior churn", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_create",
        hasPriorChurn: false,
        wasPastDue: false,
        mrrAfterCents: 4900,
        mrrBeforeCents: 0,
      }),
    ).toEqual({ kind: "new" });
  });

  it("subscription_create → reactivation when prior churn exists", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_create",
        hasPriorChurn: true,
        wasPastDue: false,
        mrrAfterCents: 4900,
        mrrBeforeCents: 0,
      }),
    ).toEqual({ kind: "reactivation" });
  });

  it("renewal (subscription_cycle) with zero prior events → no event (never new)", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_cycle",
        hasPriorChurn: false,
        wasPastDue: false,
        mrrAfterCents: 4900,
        mrrBeforeCents: 4900,
      }),
    ).toEqual({ kind: "none" });
  });

  it("subscription_cycle → payment_recovered when sub was past_due", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_cycle",
        hasPriorChurn: false,
        wasPastDue: true,
        mrrAfterCents: 4900,
        mrrBeforeCents: 4900,
      }),
    ).toEqual({ kind: "payment_recovered" });
  });

  it("subscription_update → expansion / contraction from MRR delta", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_update",
        hasPriorChurn: false,
        wasPastDue: false,
        mrrAfterCents: 5900,
        mrrBeforeCents: 4900,
      }),
    ).toEqual({ kind: "expansion" });

    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_update",
        hasPriorChurn: false,
        wasPastDue: false,
        mrrAfterCents: 4400,
        mrrBeforeCents: 4900,
      }),
    ).toEqual({ kind: "contraction" });
  });

  it("subscription_update with unchanged MRR → none", () => {
    expect(
      classifyInvoicePaidEvent({
        billingReason: "subscription_update",
        hasPriorChurn: false,
        wasPastDue: false,
        mrrAfterCents: 4900,
        mrrBeforeCents: 4900,
      }),
    ).toEqual({ kind: "none" });
  });
});
