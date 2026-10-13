import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  paymentObligationHistory,
  paymentObligations,
  users,
} from "@shared/schema";
import {
  computeCalendarTotals,
  GREEK_STATUS_LABELS,
  statusGroup,
  statusUrgency,
} from "./billing-calendar-status";

export async function getBillingCalendar(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);

  const rows = await db
    .select({
      obligation: paymentObligations,
      customerEmail: users.email,
      customerUsername: users.username,
    })
    .from(paymentObligations)
    .leftJoin(users, eq(paymentObligations.userId, users.id))
    .where(
      and(
        gte(paymentObligations.dueDate, fromDate),
        lte(paymentObligations.dueDate, toDate),
      ),
    )
    .orderBy(paymentObligations.dueDate);

  const entries = rows.map(({ obligation: o, customerEmail, customerUsername }) => ({
    id: o.id,
    dueDate: o.dueDate,
    periodStart: o.periodStart,
    periodEnd: o.periodEnd,
    status: o.status,
    statusLabel: GREEK_STATUS_LABELS[o.status] || o.status,
    statusGroup: statusGroup(o.status),
    urgency: statusUrgency(o.status, o.riskFlags || []),
    origin: o.origin,
    clientName: o.clientName,
    customerId: o.userId,
    customerEmail: customerEmail || null,
    customerUsername: customerUsername || null,
    amountDueCents: o.amountDue,
    amountPaidCents: o.amountPaidCents,
    amountRefundedCents: o.amountRefundedCents,
    currency: o.currency,
    vatIncluded: o.vatIncluded,
    riskFlags: o.riskFlags || [],
    attemptCount: o.attemptCount,
    nextAttemptAt: o.nextAttemptAt || o.nextRetryDate,
    assumedPaid: o.assumedPaid,
    customPaymentId: o.customPaymentId,
    subscriptionId: o.subscriptionId,
    stripeInvoiceId: o.stripeInvoiceId,
    stripeSubscriptionId: o.stripeSubscriptionId,
    stripeScheduleId: o.stripeScheduleId,
    notes: o.notes,
    lastFailureReason: o.lastFailureReason,
  }));

  const totals = computeCalendarTotals(
    entries.map((e) => ({
      status: e.status,
      amountDue: e.amountDueCents,
      amountPaidCents: e.amountPaidCents,
      amountRefundedCents: e.amountRefundedCents,
      riskFlags: e.riskFlags,
      vatIncluded: e.vatIncluded,
    })),
  );

  const needsAction = entries.filter((e) => {
    if (e.statusGroup === "outstanding") return true;
    if (e.status === "will_not_renew") {
      const due = new Date(e.dueDate!).getTime();
      const in14 = Date.now() + 14 * 86400000;
      return due <= in14;
    }
    if (e.riskFlags.length && e.statusGroup === "expected") {
      const due = new Date(e.dueDate!).getTime();
      return due <= Date.now() + 7 * 86400000;
    }
    return false;
  });

  return { from, to, entries, totals, needsAction };
}

export async function getObligationHistory(obligationId: number) {
  return db
    .select()
    .from(paymentObligationHistory)
    .where(eq(paymentObligationHistory.obligationId, obligationId))
    .orderBy(desc(paymentObligationHistory.createdAt));
}
