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
};

export type InvoiceAmountSource = {
  subtotal?: number | null;
  total?: number | null;
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
  return (invoice.total_discount_amounts ?? []).reduce((sum, discount) => sum + discount.amount, 0);
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

/**
 * Drafts were stored from the pre-discount line amount.
 * Returns the discounted charge only when that stored amount is the list line amount.
 */
export function discountedDraftAmount(
  storedAmount: number | null | undefined,
  line: InvoiceAmountLine,
  invoice: InvoiceAmountSource,
): number | null {
  if (storedAmount == null) return null;
  const charged = chargedCentsForInvoiceLine(invoice, line);
  if (charged < storedAmount && storedAmount === line.amount) return charged;
  return null;
}
