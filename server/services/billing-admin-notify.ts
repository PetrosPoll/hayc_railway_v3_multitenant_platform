import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { adminNotifications, appSettings, billingEmailLog } from "@shared/schema";

export async function createAdminNotification(input: {
  type: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(adminNotifications).values({
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    payload: input.payload ?? null,
  });
}

export async function listUnreadAdminNotifications(limit = 50) {
  return db
    .select()
    .from(adminNotifications)
    .where(isNull(adminNotifications.readAt))
    .orderBy(desc(adminNotifications.createdAt))
    .limit(limit);
}

export async function markAdminNotificationRead(id: number) {
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(eq(adminNotifications.id, id));
}

export async function markAllAdminNotificationsRead() {
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(isNull(adminNotifications.readAt));
}

/** Returns true if this is the first send for template+attemptKey. */
export async function claimBillingEmailSend(input: {
  template: string;
  attemptKey: string;
  obligationId?: number | null;
  userId?: number | null;
}): Promise<boolean> {
  try {
    await db.insert(billingEmailLog).values({
      template: input.template,
      attemptKey: input.attemptKey,
      obligationId: input.obligationId ?? null,
      userId: input.userId ?? null,
    });
    return true;
  } catch (err: any) {
    if (err?.code === "23505") return false;
    throw err;
  }
}

export async function getCalendarEmailSettings() {
  const [row] = await db.select().from(appSettings).limit(1);
  return {
    realtimeEmail: row?.calendarRealtimeEmail ?? true,
    actionRequired: row?.calendarCustomerEmailActionRequired ?? false,
    cancelConfirmed: row?.calendarCustomerEmailCancelConfirmed ?? false,
    endingSoon: row?.calendarCustomerEmailEndingSoon ?? false,
    offlineReminder: row?.calendarCustomerEmailOfflineReminder ?? false,
    offlineOverdue: row?.calendarCustomerEmailOfflineOverdue ?? false,
  };
}

export async function countUnreadAdminNotifications(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adminNotifications)
    .where(isNull(adminNotifications.readAt));
  return row?.n ?? 0;
}
