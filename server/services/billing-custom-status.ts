import { PaymentObligationStatus } from "@shared/schema";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Unpaid status for a custom due date (local calendar-day rules). */
export function unpaidStatusForCustomDue(
  dueDate: Date,
  graceDays = 7,
  today: Date = new Date(),
): string {
  const due = startOfLocalDay(dueDate);
  const todayDay = startOfLocalDay(today);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  if (due.getTime() > todayDay.getTime()) {
    return PaymentObligationStatus.UPCOMING;
  }
  if (due.getTime() === todayDay.getTime()) {
    return PaymentObligationStatus.PENDING;
  }
  if (todayDay.getTime() <= graceEnd.getTime()) {
    return PaymentObligationStatus.GRACE;
  }
  return PaymentObligationStatus.DELINQUENT;
}
