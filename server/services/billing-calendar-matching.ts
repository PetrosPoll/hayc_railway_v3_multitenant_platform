import { PaymentObligationStatus } from "@shared/schema";

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
