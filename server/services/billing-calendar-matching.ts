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
 * Split a charge/invoice refund across paid obligation lines (plan+addon share one invoice).
 * Proportional by paid cents; remainder on the last line. Never exceeds each line's paid.
 */
export function allocateRefundCents(
  paidAmounts: number[],
  refundedTotal: number,
): number[] {
  const n = paidAmounts.length;
  if (n === 0) return [];
  const totalPaid = paidAmounts.reduce((a, b) => a + Math.max(0, b), 0);
  if (totalPaid <= 0 || refundedTotal <= 0) return paidAmounts.map(() => 0);

  const capped = Math.min(refundedTotal, totalPaid);
  const shares: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const paid = Math.max(0, paidAmounts[i]);
    let share: number;
    if (i === n - 1) {
      share = Math.min(paid, capped - allocated);
    } else {
      share = Math.min(paid, Math.round((capped * paid) / totalPaid));
      share = Math.min(share, capped - allocated);
    }
    shares.push(share);
    allocated += share;
  }
  let shortfall = capped - allocated;
  for (let i = 0; i < n && shortfall > 0; i++) {
    const room = Math.max(0, paidAmounts[i]) - shares[i];
    const add = Math.min(room, shortfall);
    shares[i] += add;
    shortfall -= add;
  }
  return shares;
}
