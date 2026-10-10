/**
 * Admin overrides for churn metrics:
 * - ignore churn event (false positive)
 * - offline active (pays outside Stripe) with optional until → then churn
 */
import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "../db";
import {
  churnIgnoredChurns,
  churnOfflineActives,
  subscriptionEvents,
  users,
  AccountKind,
} from "@shared/schema";
import { insertSubscriptionEvent } from "./subscription-events";

const OFFLINE_ACTIVE_ID = (customerId: number) =>
  `admin:offline-active:${customerId}`;
const OFFLINE_END_ID = (customerId: number) =>
  `admin:offline-end:${customerId}`;

function athensDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function setChurnEventIgnored(input: {
  eventId: number;
  ignored: boolean;
  editedByUserId: number;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [event] = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.id, input.eventId))
    .limit(1);
  if (!event) return { ok: false, error: "Event not found" };
  if (event.type !== "churn") {
    return { ok: false, error: "Only churn events can be ignored" };
  }

  const day = athensDay(new Date(event.effectiveAt));

  await db
    .update(subscriptionEvents)
    .set(
      input.ignored
        ? {
            metricsIgnored: true,
            metricsIgnoredAt: new Date(),
            metricsIgnoredByUserId: input.editedByUserId,
            metricsIgnoredNote: input.note?.trim() || null,
          }
        : {
            metricsIgnored: false,
            metricsIgnoredAt: null,
            metricsIgnoredByUserId: null,
            metricsIgnoredNote: null,
          },
    )
    .where(eq(subscriptionEvents.id, input.eventId));

  if (input.ignored) {
    await db
      .insert(churnIgnoredChurns)
      .values({
        customerId: event.customerId,
        effectiveDay: day,
        note: input.note?.trim() || null,
        createdByUserId: input.editedByUserId,
      })
      .onConflictDoUpdate({
        target: [churnIgnoredChurns.customerId, churnIgnoredChurns.effectiveDay],
        set: {
          note: input.note?.trim() || null,
          createdByUserId: input.editedByUserId,
        },
      });
  } else {
    await db
      .delete(churnIgnoredChurns)
      .where(
        and(
          eq(churnIgnoredChurns.customerId, event.customerId),
          eq(churnIgnoredChurns.effectiveDay, day),
        ),
      );
  }

  return { ok: true };
}

/** Re-apply durable ignore rows onto churn events (call after backfill rebuild). */
export async function reapplyIgnoredChurnFlags(): Promise<number> {
  const ignored = await db.select().from(churnIgnoredChurns);
  let n = 0;
  for (const row of ignored) {
    const updated = await db.execute(sql`
      UPDATE subscription_events e
      SET
        metrics_ignored = true,
        metrics_ignored_at = COALESCE(metrics_ignored_at, NOW()),
        metrics_ignored_by_user_id = COALESCE(metrics_ignored_by_user_id, ${row.createdByUserId}),
        metrics_ignored_note = COALESCE(metrics_ignored_note, ${row.note})
      WHERE e.customer_id = ${row.customerId}
        AND e.type = 'churn'
        AND to_char(e.effective_at AT TIME ZONE 'Europe/Athens', 'YYYY-MM-DD') = ${row.effectiveDay}
    `);
    n += Number((updated as { rowCount?: number }).rowCount ?? 0);
  }
  return n;
}

async function clearOfflineAdminEvents(customerId: number) {
  await db
    .delete(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.customerId, customerId),
        eq(subscriptionEvents.source, "admin"),
        like(subscriptionEvents.stripeEventId, "admin:offline-%"),
      ),
    );
}

async function latestChurnEvent(customerId: number) {
  const [row] = await db
    .select()
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.customerId, customerId),
        eq(subscriptionEvents.type, "churn"),
      ),
    )
    .orderBy(desc(subscriptionEvents.effectiveAt), desc(subscriptionEvents.id))
    .limit(1);
  return row ?? null;
}

export async function setOfflineActive(input: {
  customerId: number;
  mrrCents: number;
  untilAt?: Date | null;
  note?: string | null;
  createdByUserId: number;
  /** When true (default), ignore latest Stripe churn so they leave «έφυγαν». */
  ignoreLatestChurn?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(input.mrrCents) || input.mrrCents <= 0) {
    return { ok: false, error: "mrrCents must be a positive amount in cents" };
  }
  if (input.untilAt && input.untilAt.getTime() <= Date.now()) {
    return { ok: false, error: "untilAt must be in the future" };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, input.customerId),
        eq(users.accountKind, AccountKind.CUSTOMER),
      ),
    )
    .limit(1);
  if (!user) return { ok: false, error: "Customer not found" };

  const startedAt = new Date();
  if (input.ignoreLatestChurn !== false) {
    const churn = await latestChurnEvent(input.customerId);
    if (churn && !churn.metricsIgnored) {
      await setChurnEventIgnored({
        eventId: churn.id,
        ignored: true,
        editedByUserId: input.createdByUserId,
        note:
          input.note?.trim() ||
          "Ignored via offline-active override",
      });
    }
  }

  await clearOfflineAdminEvents(input.customerId);

  await db
    .insert(churnOfflineActives)
    .values({
      customerId: input.customerId,
      mrrCents: input.mrrCents,
      startedAt,
      untilAt: input.untilAt ?? null,
      note: input.note?.trim() || null,
      createdByUserId: input.createdByUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: churnOfflineActives.customerId,
      set: {
        mrrCents: input.mrrCents,
        startedAt,
        untilAt: input.untilAt ?? null,
        note: input.note?.trim() || null,
        createdByUserId: input.createdByUserId,
        updatedAt: new Date(),
      },
    });

  await insertSubscriptionEvent({
    customerId: input.customerId,
    stripeSubscriptionId: null,
    stripeEventId: OFFLINE_ACTIVE_ID(input.customerId),
    type: "reactivation",
    effectiveAt: startedAt,
    statusAfter: "active",
    mrrAfterCents: input.mrrCents,
    mrrDeltaCents: input.mrrCents,
    tierAfter: null,
    reasonCode: "other",
    reasonNote: input.note?.trim() || "Offline payment",
    source: "admin",
  });

  if (input.untilAt) {
    await insertSubscriptionEvent({
      customerId: input.customerId,
      stripeSubscriptionId: null,
      stripeEventId: OFFLINE_END_ID(input.customerId),
      type: "churn",
      effectiveAt: input.untilAt,
      statusAfter: "churned",
      mrrAfterCents: 0,
      mrrDeltaCents: -input.mrrCents,
      tierAfter: null,
      churnKind: "voluntary",
      reasonCode: "other",
      reasonNote: "Offline active period ended",
      source: "admin",
    });
  }

  return { ok: true };
}

export async function clearOfflineActive(input: {
  customerId: number;
  editedByUserId: number;
  churnNow?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(churnOfflineActives)
    .where(eq(churnOfflineActives.customerId, input.customerId))
    .limit(1);
  if (!row) return { ok: false, error: "No offline active record" };

  const mrr = row.mrrCents;
  await clearOfflineAdminEvents(input.customerId);
  await db
    .delete(churnOfflineActives)
    .where(eq(churnOfflineActives.customerId, input.customerId));

  if (input.churnNow !== false) {
    await insertSubscriptionEvent({
      customerId: input.customerId,
      stripeSubscriptionId: null,
      stripeEventId: `admin:offline-cleared:${input.customerId}:${Date.now()}`,
      type: "churn",
      effectiveAt: new Date(),
      statusAfter: "churned",
      mrrAfterCents: 0,
      mrrDeltaCents: -mrr,
      churnKind: "voluntary",
      reasonCode: "other",
      reasonNote: "Offline active cleared by admin",
      source: "admin",
    });
  }

  return { ok: true };
}

export async function listOfflineActives() {
  return db
    .select({
      customerId: churnOfflineActives.customerId,
      email: users.email,
      mrrCents: churnOfflineActives.mrrCents,
      startedAt: churnOfflineActives.startedAt,
      untilAt: churnOfflineActives.untilAt,
      note: churnOfflineActives.note,
    })
    .from(churnOfflineActives)
    .innerJoin(users, eq(users.id, churnOfflineActives.customerId))
    .orderBy(churnOfflineActives.startedAt);
}
