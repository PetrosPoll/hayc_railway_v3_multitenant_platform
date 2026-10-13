import { PaymentObligationStatus } from "@shared/schema";

export type CalendarStatus =
  (typeof PaymentObligationStatus)[keyof typeof PaymentObligationStatus];

export const STATUS_GROUP = {
  collected: "collected", // Εισπράχθηκαν
  expected: "expected", // Αναμενόμενα
  outstanding: "outstanding", // Εκκρεμούν / Overdue
  canceled: "canceled", // Ακυρωμένα
  excluded: "excluded", // not counted (e.g. paused)
} as const;

export type StatusGroup = (typeof STATUS_GROUP)[keyof typeof STATUS_GROUP];

export function statusGroup(status: string): StatusGroup {
  switch (status) {
    case PaymentObligationStatus.SETTLED:
    case PaymentObligationStatus.PARTIALLY_PAID:
    case PaymentObligationStatus.PARTIALLY_REFUNDED:
      return STATUS_GROUP.collected;
    case PaymentObligationStatus.UPCOMING:
    case PaymentObligationStatus.PENDING:
    case PaymentObligationStatus.WILL_NOT_RENEW:
      return STATUS_GROUP.expected;
    case PaymentObligationStatus.GRACE:
    case PaymentObligationStatus.ACTION_REQUIRED:
    case PaymentObligationStatus.RETRYING:
    case PaymentObligationStatus.DELINQUENT:
    case PaymentObligationStatus.DISPUTED:
      return STATUS_GROUP.outstanding;
    case PaymentObligationStatus.STOPPED:
    case PaymentObligationStatus.WRITTEN_OFF:
    case PaymentObligationStatus.FAILED:
    case PaymentObligationStatus.REFUNDED:
      // Full refund: same card/day treatment as cancel (struck, rose), stays visible
      return STATUS_GROUP.canceled;
    case PaymentObligationStatus.PAUSED:
    default:
      return STATUS_GROUP.excluded;
  }
}

/** Urgency for mini-calendar day color (higher = more urgent). */
export function statusUrgency(status: string, riskFlags: string[] = []): number {
  const g = statusGroup(status);
  if (g === STATUS_GROUP.outstanding) return 40;
  if (riskFlags.length > 0 && g === STATUS_GROUP.expected) return 30;
  if (g === STATUS_GROUP.expected) return 20;
  if (g === STATUS_GROUP.collected) return 10;
  if (g === STATUS_GROUP.canceled) return 5;
  return 0;
}

export function outstandingCents(row: {
  status: string;
  amountDue: number;
  amountPaidCents: number;
  amountRefundedCents: number;
}): number {
  if (row.status === PaymentObligationStatus.PARTIALLY_PAID) {
    return Math.max(0, row.amountDue - row.amountPaidCents);
  }
  if (statusGroup(row.status) === STATUS_GROUP.outstanding) {
    return Math.max(0, row.amountDue - row.amountPaidCents);
  }
  return 0;
}

export function collectedNetCents(row: {
  status: string;
  amountDue?: number;
  amountPaidCents: number;
  amountRefundedCents: number;
}): number {
  const g = statusGroup(row.status);
  if (
    row.status === PaymentObligationStatus.REFUNDED ||
    row.status === PaymentObligationStatus.PARTIALLY_REFUNDED
  ) {
    const paid = row.amountPaidCents || row.amountDue || 0;
    return Math.max(0, paid - row.amountRefundedCents);
  }
  if (g === STATUS_GROUP.collected) {
    // Settled rows created before amountPaidCents was set still have due amount
    const paid =
      row.amountPaidCents > 0
        ? row.amountPaidCents
        : row.status === PaymentObligationStatus.SETTLED
          ? row.amountDue || 0
          : row.amountPaidCents;
    return Math.max(0, paid - row.amountRefundedCents);
  }
  return 0;
}

/** Amount that was canceled / written off / refunded (not kept as revenue). */
export function canceledCents(row: {
  status: string;
  amountDue: number;
  amountPaidCents?: number;
  amountRefundedCents?: number;
}): number {
  if (
    row.status === PaymentObligationStatus.REFUNDED ||
    row.status === PaymentObligationStatus.PARTIALLY_REFUNDED
  ) {
    const paid = row.amountPaidCents || row.amountDue;
    return Math.min(Math.max(0, row.amountRefundedCents || 0), paid);
  }
  if (statusGroup(row.status) === STATUS_GROUP.canceled) {
    return row.amountDue;
  }
  return 0;
}

/** @deprecated use canceledCents */
export function lostCents(row: {
  status: string;
  amountDue: number;
  amountRefundedCents: number;
}): number {
  return canceledCents(row);
}

export type CalendarTotals = {
  collectedCents: number;
  expectedCents: number;
  outstandingCents: number;
  canceledCents: number;
  /** @deprecated alias of canceledCents for older clients */
  lostCents: number;
  monthTotalCents: number;
  atRiskCount: number;
  atRiskCents: number;
  vatIncluded: boolean;
};

export function computeCalendarTotals(
  rows: Array<{
    status: string;
    amountDue: number;
    amountPaidCents: number;
    amountRefundedCents: number;
    riskFlags?: string[] | null;
    vatIncluded?: boolean | null;
  }>,
): CalendarTotals {
  let collected = 0;
  let expected = 0;
  let outstanding = 0;
  let canceled = 0;
  let atRiskCount = 0;
  let atRiskCents = 0;

  for (const row of rows) {
    const g = statusGroup(row.status);
    collected += collectedNetCents({
      status: row.status,
      amountDue: row.amountDue,
      amountPaidCents: row.amountPaidCents,
      amountRefundedCents: row.amountRefundedCents,
    });
    if (g === STATUS_GROUP.expected) {
      expected += row.amountDue;
      if (row.riskFlags?.length) {
        atRiskCount += 1;
        atRiskCents += row.amountDue;
      }
    }
    outstanding += outstandingCents(row);
    canceled += canceledCents({
      status: row.status,
      amountDue: row.amountDue,
      amountPaidCents: row.amountPaidCents,
      amountRefundedCents: row.amountRefundedCents,
    });
  }

  return {
    collectedCents: collected,
    expectedCents: expected,
    outstandingCents: outstanding,
    canceledCents: canceled,
    lostCents: canceled,
    monthTotalCents: collected + expected + outstanding,
    atRiskCount,
    atRiskCents,
    vatIncluded: true,
  };
}

export const GREEK_STATUS_LABELS: Record<string, string> = {
  upcoming: "Αναμένεται",
  pending: "Εκκρεμεί επιβεβαίωση",
  grace: "Περίοδος χάριτος",
  action_required: "Απαιτείται ενέργεια",
  retrying: "Επανάληψη χρέωσης",
  delinquent: "Καθυστερημένο",
  disputed: "Αμφισβήτηση",
  settled: "Εισπράχθηκε",
  partially_paid: "Μερική πληρωμή",
  refunded: "Επιστροφή",
  partially_refunded: "Μερική επιστροφή",
  written_off: "Διαγραφή",
  will_not_renew: "Δεν θα ανανεωθεί",
  paused: "Σε παύση",
  stopped: "Ακυρώθηκε",
  failed: "Αποτυχία",
};
