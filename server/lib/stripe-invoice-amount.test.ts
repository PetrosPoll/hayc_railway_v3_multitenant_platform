import { describe, expect, it } from "vitest";
import {
  centsAfterCoupon,
  chargedCentsForInvoiceLine,
  discountedDraftAmount,
  lowestPriceAfterCoupons,
  paidCentsForInvoiceLine,
  type InvoiceAmountLine,
  type InvoiceAmountSource,
} from "./stripe-invoice-amount";

function invoiceWith(line: InvoiceAmountLine, extras: Partial<InvoiceAmountSource> = {}): InvoiceAmountSource {
  return {
    subtotal: line.amount,
    total: line.amount,
    lines: { data: [line] },
    ...extras,
  };
}

describe("chargedCentsForInvoiceLine", () => {
  it("uses the amount the customer paid after a Stripe discount", () => {
    const line: InvoiceAmountLine = {
      id: "il_plan",
      amount: 3900,
      discountable: true,
      discount_amounts: [{ amount: 500 }],
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 3400,
      total_discount_amounts: [{ amount: 500 }],
    });

    expect(chargedCentsForInvoiceLine(invoice, line)).toBe(3400);
    expect(discountedDraftAmount(3900, line, invoice)).toBe(3400);
  });

  it("keeps the list amount when there is no discount", () => {
    const line: InvoiceAmountLine = { id: "il_plan", amount: 3900, discountable: true };
    const invoice = invoiceWith(line);

    expect(chargedCentsForInvoiceLine(invoice, line)).toBe(3900);
    expect(discountedDraftAmount(3900, line, invoice)).toBeNull();
  });

  it("allocates an invoice-level discount that is missing from the line", () => {
    const line: InvoiceAmountLine = {
      id: "il_plan",
      amount: 3900,
      discountable: true,
      discount_amounts: [],
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 3400,
      total_discount_amounts: [{ amount: 500 }],
    });

    expect(chargedCentsForInvoiceLine(invoice, line)).toBe(3400);
  });

  it("does not subtract a discount that is already included in the line amount", () => {
    const line: InvoiceAmountLine = {
      id: "il_plan",
      amount: 3400,
      discountable: true,
      discount_amounts: [{ amount: 500 }],
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 3400,
      total_discount_amounts: [{ amount: 500 }],
    });

    expect(chargedCentsForInvoiceLine(invoice, line)).toBe(3400);
  });

  it("uses the paid invoice total when the coupon is not copied onto the line", () => {
    const line: InvoiceAmountLine = {
      id: "il_legacy",
      amount: 3900,
      discountable: true,
      discount_amounts: [],
      price: { unit_amount: 3900 },
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 3400,
      amount_paid: 3400,
    });

    expect(paidCentsForInvoiceLine(invoice, line)).toBe(3400);
    expect(discountedDraftAmount(3900, line, invoice)).toBe(3400);
  });

  it("takes a fixed coupon off the catalog price", () => {
    expect(centsAfterCoupon(3900, { amount_off: 400 })).toBe(3500);
    expect(centsAfterCoupon(3045, { amount_off: 145 })).toBe(2900);
    expect(lowestPriceAfterCoupons(3900, [{ percent_off: 10 }, { amount_off: 400 }])).toBe(3500);
  });

  it("replaces a catalog price of 39 with the paid 35 when the line is already discounted", () => {
    const line: InvoiceAmountLine = {
      id: "il_legacy",
      amount: 3500,
      discountable: true,
      discount_amounts: [],
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 3500,
      amount_paid: 3500,
    });

    expect(discountedDraftAmount(3900, line, invoice, 3900)).toBe(3500);
  });

  it("adds exclusive tax on top of the discounted line", () => {
    const line: InvoiceAmountLine = {
      id: "il_plan",
      amount: 3900,
      discountable: true,
      discount_amounts: [{ amount: 500 }],
      tax_amounts: [{ amount: 816, inclusive: false }],
    };
    const invoice = invoiceWith(line, {
      subtotal: 3900,
      total: 4216,
      total_discount_amounts: [{ amount: 500 }],
    });

    expect(chargedCentsForInvoiceLine(invoice, line)).toBe(4216);
  });
});
