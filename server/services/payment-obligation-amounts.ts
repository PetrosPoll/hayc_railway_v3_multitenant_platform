/**
 * Normalize settlement amounts from the admin UI.
 * The API accepts euros (decimal); DB stores integer cents.
 */
export function eurosToCents(euros: number | string | null | undefined): number | null {
  if (euros === null || euros === undefined || euros === "") return null;
  const n = typeof euros === "string" ? parseFloat(euros) : euros;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Resolve amount to store on a settlement.
 * - If amountPaidEuros is provided, convert to cents.
 * - Otherwise use obligationAmountDueCents (already cents).
 */
export function resolveSettlementAmountCents(opts: {
  amountPaidEuros?: number | string | null;
  obligationAmountDueCents: number;
}): number {
  const fromEuros = eurosToCents(opts.amountPaidEuros);
  if (fromEuros !== null) return fromEuros;
  return opts.obligationAmountDueCents;
}
