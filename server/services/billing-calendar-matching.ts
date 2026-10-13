import type Stripe from "stripe";
import { PaymentObligationStatus } from "@shared/schema";

/** Human-readable decline reason from a Stripe Charge (charge.failed). */
export function failureReasonFromCharge(charge: Stripe.Charge): string {
  const parts = [
    charge.failure_message,
    charge.outcome?.seller_message,
    charge.failure_code,
    charge.outcome?.reason,
  ].filter((x): x is string => !!x && String(x).trim().length > 0);
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.slice(0, 2).join(" — ") || "payment_failed";
}

/** Open (non-terminal) statuses that should become stopped when a sub ends. */
export const OPEN_OBLIGATION_STATUSES = [
  PaymentObligationStatus.UPCOMING,
  PaymentObligationStatus.PENDING,
  PaymentObligationStatus.GRACE,
  PaymentObligationStatus.ACTION_REQUIRED,
  PaymentObligationStatus.RETRYING,
  PaymentObligationStatus.DELINQUENT,
  PaymentObligationStatus.DISPUTED,
  PaymentObligationStatus.WILL_NOT_RENEW,
  PaymentObligationStatus.PAUSED,
  PaymentObligationStatus.PARTIALLY_PAID,
  PaymentObligationStatus.FAILED,
] as const;

/** Local statuses that must not keep open upcoming rows. */
export function isLocalSubCancelled(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "cancelled" || s === "canceled" || s === "incomplete_expired";
}

export function isOpenObligationStatus(status: string): boolean {
  return (OPEN_OBLIGATION_STATUSES as readonly string[]).includes(status);
}

/**
 * Split a charge/invoice refund across paid obligation lines (plan+addon+setup share one invoice).
 * Greedy fill in the given order (caller should sort smallest-first): exhaust each line up to
 * its paid amount before the next. Stripe refunds the charge total, not a specific product.
 */
export function allocateRefundCents(
  paidAmounts: number[],
  refundedTotal: number,
): number[] {
  const n = paidAmounts.length;
  if (n === 0) return [];
  const totalPaid = paidAmounts.reduce((a, b) => a + Math.max(0, b), 0);
  if (totalPaid <= 0 || refundedTotal <= 0) return paidAmounts.map(() => 0);

  let remaining = Math.min(refundedTotal, totalPaid);
  const shares: number[] = [];
  for (let i = 0; i < n; i++) {
    const take = Math.min(Math.max(0, paidAmounts[i]), remaining);
    shares.push(take);
    remaining -= take;
  }
  return shares;
}
