import { describe, expect, it } from "vitest";
import {
  eurosToCents,
  resolveSettlementAmountCents,
} from "./payment-obligation-amounts";

describe("eurosToCents", () => {
  it("converts euros to cents", () => {
    expect(eurosToCents(49)).toBe(4900);
    expect(eurosToCents(49.5)).toBe(4950);
    expect(eurosToCents("12.34")).toBe(1234);
  });

  it("returns null for empty/invalid", () => {
    expect(eurosToCents(null)).toBeNull();
    expect(eurosToCents(undefined)).toBeNull();
    expect(eurosToCents("")).toBeNull();
    expect(eurosToCents(Number.NaN)).toBeNull();
  });
});

describe("resolveSettlementAmountCents", () => {
  it("does not multiply cents again when euros are sent (fixes 100x bug)", () => {
    // UI sends amountDue/100 (euros). Obligation due is 4900 cents (€49).
    expect(
      resolveSettlementAmountCents({
        amountPaidEuros: 49,
        obligationAmountDueCents: 4900,
      }),
    ).toBe(4900);
  });

  it("defaults to obligation amount when euros omitted", () => {
    expect(
      resolveSettlementAmountCents({
        amountPaidEuros: null,
        obligationAmountDueCents: 4400,
      }),
    ).toBe(4400);
  });

  it("supports partial euros", () => {
    expect(
      resolveSettlementAmountCents({
        amountPaidEuros: 20,
        obligationAmountDueCents: 4900,
      }),
    ).toBe(2000);
  });
});
