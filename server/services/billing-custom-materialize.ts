/**
 * Materialize and age custom payment_obligations (Calendar v2).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  PaymentObligationStatus,
  PaymentOrigin,
  customPayments,
  paymentObligations,
  type CustomPayment,
} from "@shared/schema";
import {
  addRecurrence,
  iterateRecurrenceDates,
  type BillingFrequency,
} from "@shared/billing-recurrence";
import { applyStatusChange } from "./billing-obligation-history";
import { athensLocalToUtc, currentAthensYearMonth } from "./churn-metrics-dates";
import { createAdminNotification } from "./billing-admin-notify";
import { unpaidStatusForCustomDue } from "./billing-custom-status";

export { unpaidStatusForCustomDue } from "./billing-custom-status";

const HORIZON_DAYS = 90;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function athensToday(): Date {
  const ym = currentAthensYearMonth();
  const [y, m] = ym.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    day: "2-digit",
  });
  const day = Number(fmt.format(new Date()));
  return startOfLocalDay(athensLocalToUtc(y, m, day, 0, 0, 0));
}

export async function materializeCustomSeries(
  payment: CustomPayment,
  opts?: { from?: Date; to?: Date },
): Promise<number> {
  if (!payment.isActive) return 0;

  const from = opts?.from ?? startOfLocalDay(new Date());
  const to = opts?.to ?? (() => {
    const d = startOfLocalDay(new Date());
    d.setDate(d.getDate() + HORIZON_DAYS);
    return d;
  })();

  const excluded = new Set(
    (payment.excludedDates || []).map((d) =>
      d.includes("T") ? d.split("T")[0] : d,
    ),
  );
  const start = new Date(payment.startDate);
  const freq = payment.frequency as BillingFrequency;
  let created = 0;

  const dates = Array.from(iterateRecurrenceDates(start, freq, from, to, excluded));
  for (const due of dates) {
    const [existing] = await db
      .select({ id: paymentObligations.id })
      .from(paymentObligations)
      .where(
        and(
          eq(paymentObligations.customPaymentId, payment.id),
          eq(paymentObligations.dueDate, due),
        ),
      )
      .limit(1);
    if (existing) continue;

    const today = athensToday();
    const status =
      due.getTime() > today.getTime()
        ? PaymentObligationStatus.UPCOMING
        : PaymentObligationStatus.PENDING;

    await db.insert(paymentObligations).values({
      customPaymentId: payment.id,
      subscriptionId: payment.subscriptionId || null,
      userId: payment.userId || null,
      clientName: payment.clientName,
      amountDue: payment.amount,
      amountPaidCents: 0,
      amountRefundedCents: 0,
      currency: payment.currency || "eur",
      dueDate: due,
      periodStart: due,
      periodEnd: due,
      status,
      origin: PaymentOrigin.CUSTOM,
      vatIncluded: true,
      assumedPaid: false,
      notes: payment.description || null,
    });
    created++;
  }
  return created;
}

export async function materializeAllActiveCustomSeries(): Promise<number> {
  const payments = await db
    .select()
    .from(customPayments)
    .where(eq(customPayments.isActive, true));
  let total = 0;
  for (const p of payments) {
    total += await materializeCustomSeries(p);
  }
  return total;
}

/** upcoming → pending → grace → delinquent (Athens calendar days). */
export async function ageCustomObligations(): Promise<number> {
  const today = athensToday();
  const rows = await db
    .select()
    .from(paymentObligations)
    .where(
      and(
        eq(paymentObligations.origin, PaymentOrigin.CUSTOM),
        sql`${paymentObligations.status} IN ('upcoming','pending','grace')`,
      ),
    );

  let changed = 0;
  for (const row of rows) {
    const next = unpaidStatusForCustomDue(
      new Date(row.dueDate),
      row.graceDays ?? 7,
      today,
    );

    if (next !== row.status) {
      await applyStatusChange(row.id, next, {
        source: "system",
        note: `Custom aging → ${next}`,
      });
      if (next === PaymentObligationStatus.DELINQUENT) {
        await createAdminNotification({
          type: "custom_delinquent",
          title: `Offline overdue: ${row.clientName}`,
          payload: { obligationId: row.id },
        });
      }
      changed++;
    }
  }
  return changed;
}

/** Apply edit of series amount/frequency to future non-settled rows. */
export async function applyCustomSeriesEditToFuture(
  paymentId: number,
  updates: Partial<CustomPayment>,
): Promise<number> {
  const today = athensToday();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.amount != null) patch.amountDue = updates.amount;
  if (updates.clientName) patch.clientName = updates.clientName;
  if (updates.userId !== undefined) patch.userId = updates.userId;
  if (updates.description !== undefined) patch.notes = updates.description;

  const result = await db
    .update(paymentObligations)
    .set(patch as any)
    .where(
      and(
        eq(paymentObligations.customPaymentId, paymentId),
        eq(paymentObligations.origin, PaymentOrigin.CUSTOM),
        gte(paymentObligations.dueDate, today),
        sql`${paymentObligations.status} NOT IN ('settled','partially_paid','written_off','stopped')`,
      ),
    )
    .returning({ id: paymentObligations.id });

  // Rematerialize if frequency/start changed
  if (updates.frequency || updates.startDate || updates.excludedDates) {
    const [payment] = await db
      .select()
      .from(customPayments)
      .where(eq(customPayments.id, paymentId))
      .limit(1);
    if (payment) await materializeCustomSeries(payment);
  }

  return result.length;
}

export { addRecurrence, HORIZON_DAYS };
