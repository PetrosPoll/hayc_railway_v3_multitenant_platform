import { describe, expect, it } from "vitest";
import {
  chargedCentsForInvoiceLine,
  discountedDraftAmount,
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
