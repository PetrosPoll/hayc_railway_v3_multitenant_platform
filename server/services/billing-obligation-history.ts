import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  paymentObligationHistory,
  paymentObligations,
  type PaymentObligation,
} from "@shared/schema";

export type HistorySource = "webhook" | "reconcile" | "admin" | "system" | "sync";

export async function applyStatusChange(
  obligationId: number,
  newStatus: string,
  meta: {
    source: HistorySource;
    actorUserId?: number | null;
    stripeEventId?: string | null;
    note?: string | null;
    patch?: Partial<PaymentObligation>;
  },
): Promise<PaymentObligation> {
  const [current] = await db
    .select()
    .from(paymentObligations)
    .where(eq(paymentObligations.id, obligationId))
    .limit(1);
  if (!current) throw new Error(`Obligation ${obligationId} not found`);

  const oldStatus = current.status;
  const [updated] = await db
    .update(paymentObligations)
    .set({
      ...(meta.patch || {}),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(paymentObligations.id, obligationId))
    .returning();

  if (oldStatus !== newStatus || meta.note) {
    await db.insert(paymentObligationHistory).values({
      obligationId,
      oldStatus,
      newStatus,
      source: meta.source,
      actorUserId: meta.actorUserId ?? null,
      stripeEventId: meta.stripeEventId ?? null,
      note: meta.note ?? null,
    });
  }

  return updated;
}

export async function appendHistoryNote(
  obligationId: number,
  note: string,
  meta: { source: HistorySource; actorUserId?: number | null },
): Promise<void> {
  const [current] = await db
    .select({ status: paymentObligations.status })
    .from(paymentObligations)
    .where(eq(paymentObligations.id, obligationId))
    .limit(1);
  if (!current) return;
  await db.insert(paymentObligationHistory).values({
    obligationId,
    oldStatus: current.status,
    newStatus: current.status,
    source: meta.source,
    actorUserId: meta.actorUserId ?? null,
    note,
  });
}
