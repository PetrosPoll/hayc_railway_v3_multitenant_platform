import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import {
  churnSettings,
  churnStripeEventReceipts,
  customerStripeAccounts,
  subscriptionEvents,
  users,
  websiteProgress,
  websiteStages,
  type SubscriptionEvent,
} from "@shared/schema";

export type SubEventType =
  | "new"
  | "reactivation"
  | "expansion"
  | "contraction"
  | "cancel_scheduled"
  | "cancel_reverted"
  | "payment_failed"
  | "payment_recovered"
  | "pause"
  | "resume"
  | "churn";

export type SubStatusAfter = "active" | "paused" | "churned";

export type InsertSubscriptionEventInput = {
  customerId: number;
  stripeSubscriptionId?: string | null;
  stripeEventId?: string | null;
  type: SubEventType;
  effectiveAt: Date;
  statusAfter?: SubStatusAfter | null;
  mrrAfterCents?: number | null;
  mrrDeltaCents?: number | null;
  tierAfter?: string | null;
  churnKind?: "voluntary" | "involuntary" | null;
  reasonCode?: string | null;
  reasonNote?: string | null;
  preLaunch?: boolean | null;
  source: "webhook" | "backfill" | "admin";
};

export async function getEventsCutoverAt(): Promise<Date | null> {
  const [row] = await db.select().from(churnSettings).where(eq(churnSettings.id, 1)).limit(1);
  return row?.eventsCutoverAt ?? null;
}

/** Record Stripe event id for idempotency (always, even when cutover blocks business writes). */
export async function recordStripeEventReceipt(
  stripeEventId: string,
): Promise<{ alreadyProcessed: boolean }> {
  try {
    await db.insert(churnStripeEventReceipts).values({ stripeEventId });
    return { alreadyProcessed: false };
  } catch (err: any) {
    if (err?.code === "23505") return { alreadyProcessed: true };
    throw err;
  }
}

/**
 * Whether a webhook may write a business event at effectiveAt.
 * cutover NULL → never (handler no-op for business rows).
 * Otherwise only effectiveAt >= cutover.
 */
export async function webhookMayWriteEvent(effectiveAt: Date): Promise<boolean> {
  const cutover = await getEventsCutoverAt();
  if (!cutover) return false;
  return effectiveAt.getTime() >= cutover.getTime();
}

/** Backfill may write only when cutover is set and effectiveAt < cutover. */
export async function backfillMayWriteEvent(effectiveAt: Date): Promise<boolean> {
  const cutover = await getEventsCutoverAt();
  if (!cutover) return false;
  return effectiveAt.getTime() < cutover.getTime();
}

/** Idempotent insert: if stripeEventId already exists, return existing row and skipped=true. */
export async function insertSubscriptionEvent(
  input: InsertSubscriptionEventInput,
): Promise<{ event: SubscriptionEvent | null; skipped: boolean }> {
  if (input.stripeEventId) {
    const [existing] = await db
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.stripeEventId, input.stripeEventId))
      .limit(1);
    if (existing) {
      return { event: existing, skipped: true };
    }
  }

  try {
    const [created] = await db
      .insert(subscriptionEvents)
      .values({
        customerId: input.customerId,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        stripeEventId: input.stripeEventId ?? null,
        type: input.type,
        effectiveAt: input.effectiveAt,
        statusAfter: input.statusAfter ?? null,
        mrrAfterCents: input.mrrAfterCents ?? null,
        mrrDeltaCents: input.mrrDeltaCents ?? null,
        tierAfter: input.tierAfter ?? null,
        churnKind: input.churnKind ?? null,
        reasonCode: input.reasonCode ?? null,
        reasonNote: input.reasonNote ?? null,
        preLaunch: input.preLaunch ?? null,
        source: input.source,
      })
      .returning();
    return { event: created, skipped: false };
  } catch (err: any) {
    if (err?.code === "23505" && input.stripeEventId) {
      const [existing] = await db
        .select()
        .from(subscriptionEvents)
        .where(eq(subscriptionEvents.stripeEventId, input.stripeEventId))
        .limit(1);
      return { event: existing ?? null, skipped: true };
    }
    throw err;
  }
}

export async function ensureCustomerStripeAccount(
  customerId: number,
  stripeCustomerId: string,
): Promise<void> {
  if (!stripeCustomerId) return;
  await db
    .insert(customerStripeAccounts)
    .values({ customerId, stripeCustomerId })
    .onConflictDoNothing({ target: customerStripeAccounts.stripeCustomerId });
}

export async function resolveHaycCustomerIdFromStripeCustomer(
  stripeCustomerId: string,
): Promise<number | null> {
  const [mapped] = await db
    .select({ customerId: customerStripeAccounts.customerId })
    .from(customerStripeAccounts)
    .where(eq(customerStripeAccounts.stripeCustomerId, stripeCustomerId))
    .limit(1);
  if (mapped) return mapped.customerId;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1);
  if (user) {
    await ensureCustomerStripeAccount(user.id, stripeCustomerId);
    return user.id;
  }
  return null;
}

/** Latest status-bearing event before T (status_after IS NOT NULL). */
export async function customerStatusAt(
  customerId: number,
  at: Date,
): Promise<SubStatusAfter | null> {
  const [row] = await db
    .select({ statusAfter: subscriptionEvents.statusAfter })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.customerId, customerId),
        isNotNull(subscriptionEvents.statusAfter),
        sql`${subscriptionEvents.effectiveAt} < ${at}`,
      ),
    )
    .orderBy(desc(subscriptionEvents.effectiveAt), desc(subscriptionEvents.id))
    .limit(1);
  return (row?.statusAfter as SubStatusAfter) ?? null;
}

export async function customerHasPriorChurn(customerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: subscriptionEvents.id })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.customerId, customerId),
        eq(subscriptionEvents.type, "churn"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function latestCancelScheduledReason(
  customerId: number,
  stripeSubscriptionId: string | null,
): Promise<{ reasonCode: string | null; reasonNote: string | null } | null> {
  const conditions = [
    eq(subscriptionEvents.customerId, customerId),
    eq(subscriptionEvents.type, "cancel_scheduled"),
  ];
  if (stripeSubscriptionId) {
    conditions.push(eq(subscriptionEvents.stripeSubscriptionId, stripeSubscriptionId));
  }
  const [row] = await db
    .select({
      reasonCode: subscriptionEvents.reasonCode,
      reasonNote: subscriptionEvents.reasonNote,
    })
    .from(subscriptionEvents)
    .where(and(...conditions))
    .orderBy(desc(subscriptionEvents.effectiveAt), desc(subscriptionEvents.id))
    .limit(1);
  return row ?? null;
}

/**
 * pre_launch: true if churn before launched_at or never launched (and we have stage history);
 * false if after launch; null if unknown (no stage history / no launch signal).
 */
export async function resolvePreLaunchForCustomer(
  customerId: number,
  churnEffectiveAt: Date,
): Promise<boolean | null> {
  const sites = await db
    .select({
      id: websiteProgress.id,
      launchedAt: websiteProgress.launchedAt,
    })
    .from(websiteProgress)
    .where(eq(websiteProgress.userId, customerId));

  if (sites.length === 0) return null;

  const siteIds = sites.map((s) => s.id);
  const stageRows = await db
    .select({ id: websiteStages.id })
    .from(websiteStages)
    .where(inArray(websiteStages.websiteProgressId, siteIds))
    .limit(1);

  if (stageRows.length === 0) return null;

  // Customer-level: pre-launch if EVERY site with history is pre-launch (conservative: any launched site after churn → false)
  let anyLaunchedBeforeChurn = false;
  let anyNeverLaunched = false;

  for (const site of sites) {
    if (site.launchedAt) {
      if (site.launchedAt <= churnEffectiveAt) {
        anyLaunchedBeforeChurn = true;
      }
    } else {
      anyNeverLaunched = true;
    }
  }

  if (anyLaunchedBeforeChurn) return false;
  if (anyNeverLaunched) return true;
  // All sites have launchedAt > churnEffectiveAt
  return true;
}

export function mapStripePortalFeedbackToReasonCode(
  feedback: string | null | undefined,
): string {
  switch (feedback) {
    case "too_expensive":
      return "price";
    case "unused":
    case "too_complex":
      return "not_using";
    case "switched_service":
      return "switched_competitor";
    case "missing_features":
      return "missing_feature";
    case "customer_service":
    case "low_quality":
      return "service_issue";
    case "other":
      return "other";
    default:
      return "unknown";
  }
}

export function eventTimestampFromStripe(
  event: Stripe.Event,
  fallback: Date = new Date(),
): Date {
  if (event.created) return new Date(event.created * 1000);
  return fallback;
}
