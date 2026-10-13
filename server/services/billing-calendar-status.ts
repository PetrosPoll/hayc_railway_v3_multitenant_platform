import { PaymentObligationStatus } from "@shared/schema";

export type CalendarStatus =
  (typeof PaymentObligationStatus)[keyof typeof PaymentObligationStatus];

export const STATUS_GROUP = {
  collected: "collected", // Εισπράχθηκαν
  expected: "expected", // Αναμενόμενα
  outstanding: "outstanding", // Εκκρεμούν
  lost: "lost", // Χάθηκαν
  excluded: "excluded", // not counted
} as const;

export type StatusGroup = (typeof STATUS_GROUP)[keyof typeof STATUS_GROUP];

export function statusGroup(status: string): StatusGroup {
  switch (status) {
    case PaymentObligationStatus.SETTLED:
    case PaymentObligationStatus.PARTIALLY_PAID:
    case PaymentObligationStatus.REFUNDED:
    case PaymentObligationStatus.PARTIALLY_REFUNDED:
      return STATUS_GROUP.collected;
    case PaymentObligationStatus.UPCOMING:
    case PaymentObligationStatus.PENDING:
      return STATUS_GROUP.expected;
    case PaymentObligationStatus.GRACE:
    case PaymentObligationStatus.ACTION_REQUIRED:
    case PaymentObligationStatus.RETRYING:
    case PaymentObligationStatus.DELINQUENT:
    case PaymentObligationStatus.DISPUTED:
      return STATUS_GROUP.outstanding;
    case PaymentObligationStatus.WRITTEN_OFF:
    case PaymentObligationStatus.FAILED:
      return STATUS_GROUP.lost;
    case PaymentObligationStatus.WILL_NOT_RENEW:
    case PaymentObligationStatus.PAUSED:
    case PaymentObligationStatus.STOPPED:
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
  amountPaidCents: number;
  amountRefundedCents: number;
}): number {
  const g = statusGroup(row.status);
  if (g !== STATUS_GROUP.collected && row.status !== PaymentObligationStatus.WRITTEN_OFF) {
    if (
      row.status === PaymentObligationStatus.REFUNDED ||
      row.status === PaymentObligationStatus.PARTIALLY_REFUNDED
    ) {
      return Math.max(0, row.amountPaidCents - row.amountRefundedCents);
    }
  }
  if (g === STATUS_GROUP.collected) {
    return Math.max(0, row.amountPaidCents - row.amountRefundedCents);
  }
  return 0;
}

export function lostCents(row: {
  status: string;
  amountDue: number;
  amountRefundedCents: number;
}): number {
  if (
    row.status === PaymentObligationStatus.WRITTEN_OFF ||
    row.status === PaymentObligationStatus.FAILED
  ) {
    return row.amountDue;
  }
  return row.amountRefundedCents || 0;
}

export type CalendarTotals = {
  collectedCents: number;
  expectedCents: number;
  outstandingCents: number;
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
  let lost = 0;
  let atRiskCount = 0;
  let atRiskCents = 0;

  for (const row of rows) {
    const g = statusGroup(row.status);
    collected += collectedNetCents(row);
    if (g === STATUS_GROUP.expected) {
      expected += row.amountDue;
      if (row.riskFlags?.length) {
        atRiskCount += 1;
        atRiskCents += row.amountDue;
      }
    }
    outstanding += outstandingCents(row);
    lost += lostCents(row);
  }

  return {
    collectedCents: collected,
    expectedCents: expected,
    outstandingCents: outstanding,
    lostCents: lost,
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
  stopped: "Διακόπηκε",
  failed: "Αποτυχία",
};
