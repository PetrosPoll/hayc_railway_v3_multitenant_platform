type DiscountAmount = { amount: number };

type TaxAmount = { amount: number; inclusive: boolean };

type PretaxCredit = { amount: number; type?: string | null };

export type InvoiceAmountLine = {
  id: string;
  amount: number;
  discountable?: boolean;
  discount_amounts?: DiscountAmount[] | null;
  tax_amounts?: TaxAmount[] | null;
  pretax_credit_amounts?: PretaxCredit[] | null;
  unitAmount?: number | null;
  price?: { unit_amount?: number | null } | string | null;
};

export type InvoiceAmountSource = {
  subtotal?: number | null;
  total?: number | null;
  amount_paid?: number | null;
  total_discount_amounts?: DiscountAmount[] | null;
  lines?: { data?: InvoiceAmountLine[] | null; has_more?: boolean } | null;
};

function lineDiscountCents(line: InvoiceAmountLine): number {
  const fromDiscounts = (line.discount_amounts ?? []).reduce((sum, discount) => sum + discount.amount, 0);
  if (fromDiscounts > 0) return fromDiscounts;

  return (line.pretax_credit_amounts ?? [])
    .filter((credit) => credit.type === "discount")
    .reduce((sum, credit) => sum + credit.amount, 0);
}

function exclusiveTaxCents(line: InvoiceAmountLine): number {
  return (line.tax_amounts ?? [])
    .filter((tax) => tax.inclusive === false)
    .reduce((sum, tax) => sum + tax.amount, 0);
}

function invoiceDiscountCents(invoice: InvoiceAmountSource): number {
  const explicit = (invoice.total_discount_amounts ?? []).reduce(
    (sum, discount) => sum + discount.amount,
    0,
  );
  if (explicit > 0) return explicit;
  if (
    invoice.subtotal != null &&
    invoice.total != null &&
    invoice.subtotal > invoice.total
  ) {
    return invoice.subtotal - invoice.total;
  }
  return 0;
}

function listAmountCents(line: InvoiceAmountLine): number {
  if (line.unitAmount != null) return line.unitAmount;
  if (line.price && typeof line.price !== "string" && line.price.unit_amount != null) {
    return line.price.unit_amount;
  }
  return line.amount;
}

/** Stripe line `amount` sums to `subtotal` (before invoice discounts) on API 2024-06-20. */
function lineAmountsArePreDiscount(invoice: InvoiceAmountSource): boolean {
  const lines = invoice.lines?.data ?? [];
  if (lines.length === 0 || invoice.lines?.has_more) return true;

  const sum = lines.reduce((total, line) => total + line.amount, 0);
  if (invoice.subtotal != null && Math.abs(sum - invoice.subtotal) <= 1) return true;

  const discount = invoiceDiscountCents(invoice);
  if (
    discount > 0 &&
    invoice.total != null &&
    invoice.subtotal != null &&
    Math.abs(sum - invoice.total) <= 1 &&
    sum < invoice.subtotal
  ) {
    return false;
  }

  return true;
}

function allocatedInvoiceDiscountCents(invoice: InvoiceAmountSource, line: InvoiceAmountLine): number {
  const fromLine = lineDiscountCents(line);
  if (fromLine > 0) return fromLine;

  const invoiceDiscount = invoiceDiscountCents(invoice);
  if (invoiceDiscount <= 0) return 0;

  const discountable = (invoice.lines?.data ?? []).filter(
    (candidate) => candidate.discountable !== false && candidate.amount > 0,
  );
  if (!discountable.some((candidate) => candidate.id === line.id)) return 0;
  if (discountable.length === 1) return invoiceDiscount;

  const base = discountable.reduce((sum, candidate) => sum + candidate.amount, 0);
  if (base <= 0) return 0;

  const shares = discountable.map((candidate) => {
    const exact = (invoiceDiscount * candidate.amount) / base;
    const floor = Math.floor(exact);
    return { id: candidate.id, floor, fraction: exact - floor };
  });
  let remainder = invoiceDiscount - shares.reduce((sum, share) => sum + share.floor, 0);
  shares.sort((a, b) => b.fraction - a.fraction);
  for (const share of shares) {
    if (remainder <= 0) break;
    share.floor += 1;
    remainder -= 1;
  }

  return shares.find((share) => share.id === line.id)?.floor ?? 0;
}

/** Gross cents the customer was charged for this line, after Stripe discounts. */
export function chargedCentsForInvoiceLine(
  invoice: InvoiceAmountSource,
  line: InvoiceAmountLine,
): number {
  const tax = exclusiveTaxCents(line);
  if (!lineAmountsArePreDiscount(invoice)) {
    return Math.max(0, line.amount + tax);
  }

  const discount = allocatedInvoiceDiscountCents(invoice, line);
  return Math.max(0, line.amount - discount + tax);
}

function positiveLines(invoice: InvoiceAmountSource): InvoiceAmountLine[] {
  return (invoice.lines?.data ?? []).filter((line) => line.amount > 0);
}

/** What the customer paid for this line. Single-line invoices use the paid invoice total. */
export function paidCentsForInvoiceLine(
  invoice: InvoiceAmountSource,
  line: InvoiceAmountLine,
): number {
  const fromParts = chargedCentsForInvoiceLine(invoice, line);
  if (positiveLines(invoice).length !== 1) return fromParts;

  const paid = invoice.amount_paid ?? invoice.total ?? null;
  if (paid != null && paid > 0 && paid < fromParts) return paid;
  return fromParts;
}

/**
 * Drafts were stored from the Stripe price (before discount).
 * Returns the paid amount when that stored figure is the list price.
 */
export function discountedDraftAmount(
  storedAmount: number | null | undefined,
  line: InvoiceAmountLine,
  invoice: InvoiceAmountSource,
): number | null {
  if (storedAmount == null) return null;
  const charged = paidCentsForInvoiceLine(invoice, line);
  const listAmount = listAmountCents(line);
  if (
    charged > 0 &&
    charged < storedAmount &&
    (storedAmount === line.amount || storedAmount === listAmount)
  ) {
    return charged;
  }
  return null;
}
