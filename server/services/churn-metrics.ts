/**
 * Logo / MRR churn metrics from subscription_events (Europe/Athens months).
 * State at T = latest row with status_after IS NOT NULL AND effective_at < T.
 */
import { and, eq, gte, lt, sql, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  AccountKind,
  subscriptionEventReasonAudits,
  subscriptionEvents,
  subscriptions,
  users,
} from "@shared/schema";
import {
  currentAthensYearMonth,
  listYearMonths,
  monthBoundsAthens,
  parseYearMonth,
  tenureBucketMonths,
} from "./churn-metrics-dates";

export {
  addMonthsYm,
  athensLocalToUtc,
  currentAthensYearMonth,
  defaultSeriesRange,
  lastCompletedAthensMonth,
  listYearMonths,
  monthBoundsAthens,
  parseYearMonth,
  tenureBucketMonths,
} from "./churn-metrics-dates";

export type PlanFilter = "all" | "basic" | "essential" | "pro";

export type MonthlyChurnMetrics = {
  month: string;
  isPartial: boolean;
  /** True when month ends at/before events cutover (subscription-row backfill only). */
  isApproximate: boolean;
  customersStart: number;
  customersEnd: number;
  churnedCount: number;
  logoChurnPct: number | null;
  logoChurnT3mPct: number | null;
  mrrStartCents: number;
  mrrEndCents: number;
  grossMrrChurnPct: number | null;
  nrrPct: number | null;
  churnedVoluntary: number;
  churnedInvoluntary: number;
  involuntarySharePct: number | null;
  newMrrCents: number;
  reactivationMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  netNewMrrCents: number;
  newCustomers: number;
  reactivatedCustomers: number;
  churnByReason: Record<string, number>;
  churnByTenure: { "0-3": number; "4-12": number; "13+": number };
  smallSample: boolean;
};

export type PendingRow = {
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  mrrCents: number;
  accessUntil: string | null;
  daysLeft: number | null;
  reasonCode: string | null;
  subscriptionId: number;
};

export type DunningRow = {
  customerId: number;
  email: string;
  username: string;
  mrrCents: number;
  failedSince: string | null;
  accessUntil: string | null;
  subscriptionId: number;
};

export type ChurnedRow = {
  eventId: number;
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  tenureBucket: "0-3" | "4-12" | "13+";
  tenureMonths: number | null;
  mrrLostCents: number;
  churnKind: string | null;
  reasonCode: string | null;
  reasonNote: string | null;
  preLaunch: boolean | null;
  churnDate: string;
};

export type ReactivationRow = {
  eventId: number;
  customerId: number;
  email: string;
  username: string;
  churnedOn: string | null;
  returnedOn: string;
  gapDays: number | null;
  mrrCents: number;
};

export type CohortCustomerRow = {
  customerId: number;
  email: string;
  username: string;
  planTier: string | null;
  mrrCents: number | null;
  status: string | null;
  extra?: Record<string, unknown>;
};

function monthsBetween(a: Date, b: Date): number {
  const years = b.getUTCFullYear() - a.getUTCFullYear();
  const months = b.getUTCMonth() - a.getUTCMonth();
  return Math.max(0, years * 12 + months);
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Number(((num / den) * 100).toFixed(2));
}

type CustomerState = {
  customerId: number;
  status: string;
  mrrCents: number;
  tier: string | null;
};

async function customerStatesAt(before: Date): Promise<Map<number, CustomerState>> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (e.customer_id)
      e.customer_id,
      e.status_after,
      COALESCE(e.mrr_after_cents, 0) AS mrr_after_cents,
      e.tier_after
    FROM subscription_events e
    INNER JOIN users u ON u.id = e.customer_id
    WHERE e.status_after IS NOT NULL
      AND e.effective_at < ${before}
      AND COALESCE(e.metrics_ignored, false) = false
      AND u.account_kind = ${AccountKind.CUSTOMER}
      AND u.is_demo = false
    ORDER BY e.customer_id, e.effective_at DESC, e.id DESC
  `);

  const map = new Map<number, CustomerState>();
  for (const r of result.rows as Array<Record<string, unknown>>) {
    map.set(Number(r.customer_id), {
      customerId: Number(r.customer_id),
      status: String(r.status_after),
      mrrCents: Number(r.mrr_after_cents ?? 0),
      tier: r.tier_after != null ? String(r.tier_after) : null,
    });
  }
  return map;
}

function filterActiveByPlan(
  states: Map<number, CustomerState>,
  plan?: PlanFilter,
): CustomerState[] {
  const active = [...states.values()].filter((s) => s.status === "active");
  if (!plan || plan === "all") return active;
  return active.filter((s) => s.tier === plan);
}

async function firstNewAtByCustomer(
  customerIds: number[],
): Promise<Map<number, Date>> {
  const map = new Map<number, Date>();
  if (customerIds.length === 0) return map;
  const result = await db.execute(sql`
    SELECT customer_id, MIN(effective_at) AS first_at
    FROM subscription_events
    WHERE type = 'new'
      AND customer_id IN (${sql.join(
        customerIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    GROUP BY customer_id
  `);
  for (const row of result.rows as Array<Record<string, unknown>>) {
    map.set(Number(row.customer_id), new Date(row.first_at as string));
  }
  return map;
}

async function mrrMovementsInMonth(
  start: Date,
  end: Date,
): Promise<{
  newMrrCents: number;
  reactivationMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  newCustomers: number;
  reactivatedCustomers: number;
}> {
  const result = await db.execute(sql`
    SELECT
      e.type,
      COALESCE(SUM(e.mrr_delta_cents), 0)::bigint AS delta_sum,
      COUNT(DISTINCT e.customer_id)::int AS customer_count
    FROM subscription_events e
    INNER JOIN users u ON u.id = e.customer_id
    WHERE e.effective_at >= ${start}
      AND e.effective_at < ${end}
      AND e.type IN ('new', 'reactivation', 'expansion', 'contraction', 'churn')
      AND COALESCE(e.metrics_ignored, false) = false
      AND u.account_kind = ${AccountKind.CUSTOMER}
      AND u.is_demo = false
    GROUP BY e.type
  `);

  const out = {
    newMrrCents: 0,
    reactivationMrrCents: 0,
    expansionMrrCents: 0,
    contractionMrrCents: 0,
    churnedMrrCents: 0,
    newCustomers: 0,
    reactivatedCustomers: 0,
  };

  for (const r of result.rows as Array<Record<string, unknown>>) {
    const type = String(r.type);
    const delta = Number(r.delta_sum ?? 0);
    const count = Number(r.customer_count ?? 0);
    if (type === "new") {
      out.newMrrCents = delta;
      out.newCustomers = count;
    } else if (type === "reactivation") {
      out.reactivationMrrCents = delta;
      out.reactivatedCustomers = count;
    } else if (type === "expansion") {
      out.expansionMrrCents = delta;
    } else if (type === "contraction") {
      out.contractionMrrCents = delta;
    } else if (type === "churn") {
      out.churnedMrrCents = delta;
    }
  }
  return out;
}

async function churnReasonAndTenure(
  start: Date,
  end: Date,
  cohortIds: Set<number>,
): Promise<{
  byReason: Record<string, number>;
  byTenure: { "0-3": number; "4-12": number; "13+": number };
  voluntary: number;
  involuntary: number;
}> {
  const byReason: Record<string, number> = {};
  const byTenure = { "0-3": 0, "4-12": 0, "13+": 0 };
  let voluntary = 0;
  let involuntary = 0;
  if (cohortIds.size === 0) {
    return { byReason, byTenure, voluntary, involuntary };
  }

  const rows = await db
    .select({
      customerId: subscriptionEvents.customerId,
      churnKind: subscriptionEvents.churnKind,
      reasonCode: subscriptionEvents.reasonCode,
      effectiveAt: subscriptionEvents.effectiveAt,
    })
    .from(subscriptionEvents)
    .innerJoin(users, eq(subscriptionEvents.customerId, users.id))
    .where(
      and(
        eq(subscriptionEvents.type, "churn"),
        eq(subscriptionEvents.metricsIgnored, false),
        gte(subscriptionEvents.effectiveAt, start),
        lt(subscriptionEvents.effectiveAt, end),
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
        inArray(subscriptionEvents.customerId, [...cohortIds]),
      ),
    );

  // One churn per customer in month (latest)
  const latest = new Map<number, (typeof rows)[0]>();
  for (const row of rows) {
    const prev = latest.get(row.customerId);
    if (!prev || new Date(row.effectiveAt) > new Date(prev.effectiveAt)) {
      latest.set(row.customerId, row);
    }
  }

  const firstNew = await firstNewAtByCustomer([...latest.keys()]);
  for (const row of latest.values()) {
    const code = row.reasonCode || "unknown";
    byReason[code] = (byReason[code] || 0) + 1;
    if (row.churnKind === "involuntary") involuntary += 1;
    else voluntary += 1;
    const first = firstNew.get(row.customerId);
    const months = first
      ? monthsBetween(first, new Date(row.effectiveAt))
      : null;
    byTenure[tenureBucketMonths(months)] += 1;
  }

  return { byReason, byTenure, voluntary, involuntary };
}

function emptyMetrics(
  month: string,
  isPartial: boolean,
  isApproximate = false,
): MonthlyChurnMetrics {
  return {
    month,
    isPartial,
    isApproximate,
    customersStart: 0,
    customersEnd: 0,
    churnedCount: 0,
    logoChurnPct: null,
    logoChurnT3mPct: null,
    mrrStartCents: 0,
    mrrEndCents: 0,
    grossMrrChurnPct: null,
    nrrPct: null,
    churnedVoluntary: 0,
    churnedInvoluntary: 0,
    involuntarySharePct: null,
    newMrrCents: 0,
    reactivationMrrCents: 0,
    expansionMrrCents: 0,
    contractionMrrCents: 0,
    churnedMrrCents: 0,
    netNewMrrCents: 0,
    newCustomers: 0,
    reactivatedCustomers: 0,
    churnByReason: {},
    churnByTenure: { "0-3": 0, "4-12": 0, "13+": 0 },
    smallSample: true,
  };
}

export async function getMonthlyChurn(
  month: string,
  plan: PlanFilter = "all",
  now = new Date(),
  cutoverAt: Date | null = null,
): Promise<MonthlyChurnMetrics> {
  parseYearMonth(month);
  const { start, end } = monthBoundsAthens(month);
  const current = currentAthensYearMonth(now);
  const isPartial = month === current;
  // Month is approximate if it ended at/before cutover (only backfill events).
  const isApproximate = cutoverAt != null ? end.getTime() <= cutoverAt.getTime() : true;
  if (month > current) return emptyMetrics(month, true, isApproximate);

  const [startStates, endStates, movements] = await Promise.all([
    customerStatesAt(start),
    customerStatesAt(end),
    mrrMovementsInMonth(start, end),
  ]);

  const cohort = filterActiveByPlan(startStates, plan);
  const cohortIds = new Set(cohort.map((c) => c.customerId));

  let churnedCount = 0;
  let mrrStart = 0;
  let mrrEndCohort = 0;
  let grossLost = 0;

  for (const c of cohort) {
    mrrStart += c.mrrCents;
    const endState = endStates.get(c.customerId);
    const endMrr =
      endState && endState.status === "active" ? endState.mrrCents : 0;
    mrrEndCohort += endMrr;
    if (!endState || endState.status === "churned") {
      churnedCount += 1;
    }
    grossLost += Math.max(c.mrrCents - endMrr, 0);
  }

  const customersEnd = filterActiveByPlan(endStates, plan).length;
  const { byReason, byTenure, voluntary, involuntary } =
    await churnReasonAndTenure(start, end, cohortIds);

  // Align voluntary/involuntary with logo churned in cohort (reason query may miss missing churn rows)
  let churnedVoluntary = voluntary;
  let churnedInvoluntary = involuntary;
  if (churnedVoluntary + churnedInvoluntary !== churnedCount) {
    // Fall back: count from end-state churned in cohort using latest churn kind in month
    churnedVoluntary = Math.min(voluntary, churnedCount);
    churnedInvoluntary = Math.max(0, churnedCount - churnedVoluntary);
  }

  const netNewMrrCents =
    movements.newMrrCents +
    movements.reactivationMrrCents +
    movements.expansionMrrCents +
    movements.contractionMrrCents +
    movements.churnedMrrCents;

  return {
    month,
    isPartial,
    isApproximate,
    customersStart: cohort.length,
    customersEnd,
    churnedCount,
    logoChurnPct: pct(churnedCount, cohort.length),
    logoChurnT3mPct: null, // filled by getChurnSeries
    mrrStartCents: mrrStart,
    mrrEndCents: mrrEndCohort,
    grossMrrChurnPct: pct(grossLost, mrrStart),
    nrrPct: pct(mrrEndCohort, mrrStart),
    churnedVoluntary,
    churnedInvoluntary,
    involuntarySharePct: pct(churnedInvoluntary, churnedCount),
    newMrrCents: movements.newMrrCents,
    reactivationMrrCents: movements.reactivationMrrCents,
    expansionMrrCents: movements.expansionMrrCents,
    contractionMrrCents: movements.contractionMrrCents,
    churnedMrrCents: movements.churnedMrrCents,
    netNewMrrCents,
    newCustomers: movements.newCustomers,
    reactivatedCustomers: movements.reactivatedCustomers,
    churnByReason: byReason,
    churnByTenure: byTenure,
    smallSample: cohort.length < 30,
  };
}

export async function getChurnSeries(
  from: string,
  to: string,
  plan: PlanFilter = "all",
  now = new Date(),
): Promise<MonthlyChurnMetrics[]> {
  const { getEventsCutoverAt } = await import("./subscription-events");
  const cutoverAt = await getEventsCutoverAt();
  const months = listYearMonths(from, to);
  const series: MonthlyChurnMetrics[] = [];
  for (const month of months) {
    series.push(await getMonthlyChurn(month, plan, now, cutoverAt));
  }

  for (let i = 0; i < series.length; i++) {
    let churnedSum = 0;
    let startSum = 0;
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      churnedSum += series[j].churnedCount;
      startSum += series[j].customersStart;
    }
    series[i].logoChurnT3mPct = pct(churnedSum, startSum);
  }
  return series;
}

/**
 * Live strip: DB active plans are source of truth (matches Stripe-connected reality).
 * Period-end cancels with status cancelled stay out of "ενεργοί" (they belong in pending).
 * MRR from event-log for those active customers when available.
 */
export async function getLiveSnapshot(plan: PlanFilter = "all"): Promise<{
  activeCustomers: number;
  mrrCents: number;
  arpaCents: number;
  activeFromSubscriptions: number;
}> {
  const states = await customerStatesAt(new Date());

  const subRows = await db
    .select({
      userId: subscriptions.userId,
      tier: subscriptions.tier,
      price: subscriptions.price,
      billingPeriod: subscriptions.billingPeriod,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(
      and(
        sql`LOWER(${subscriptions.status}) IN ('active', 'trialing', 'past_due')`,
        sql`COALESCE(${subscriptions.productType}, 'plan') = 'plan'`,
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
        sql`${users.email} NOT LIKE '%@hayc.test'`,
      ),
    );

  const subCustomers = new Set<number>();
  const priceFallback = new Map<number, number>();
  for (const r of subRows) {
    if (plan !== "all" && r.tier !== plan) continue;
    subCustomers.add(r.userId);
    const monthly = Math.round(
      (r.price ?? 0) / (r.billingPeriod === "yearly" ? 12 : 1),
    );
    // One fallback per customer (avoid summing duplicate active plan rows)
    if (!priceFallback.has(r.userId)) priceFallback.set(r.userId, monthly);
  }

  let mrrCents = 0;
  for (const customerId of subCustomers) {
    const st = states.get(customerId);
    // Prefer Stripe-reconciled event MRR (includes addons) when present
    if (st && st.mrrCents > 0) {
      mrrCents += st.mrrCents;
    } else {
      mrrCents += priceFallback.get(customerId) ?? 0;
    }
  }

  const activeCustomers = subCustomers.size;
  return {
    activeCustomers,
    mrrCents,
    arpaCents:
      activeCustomers > 0 ? Math.round(mrrCents / activeCustomers) : 0,
    activeFromSubscriptions: activeCustomers,
  };
}

async function latestMrrForCustomers(
  customerIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (customerIds.length === 0) return map;
  const result = await db.execute(sql`
    SELECT DISTINCT ON (e.customer_id)
      e.customer_id,
      COALESCE(e.mrr_after_cents, 0) AS mrr_after_cents
    FROM subscription_events e
    WHERE e.status_after IS NOT NULL
      AND e.customer_id IN (${sql.join(
        customerIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    ORDER BY e.customer_id, e.effective_at DESC, e.id DESC
  `);
  for (const r of result.rows as Array<Record<string, unknown>>) {
    map.set(Number(r.customer_id), Number(r.mrr_after_cents ?? 0));
  }
  return map;
}

export async function getPendingCancellations(): Promise<PendingRow[]> {
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      customerId: subscriptions.userId,
      email: users.email,
      username: users.username,
      planTier: subscriptions.tier,
      accessUntil: subscriptions.accessUntil,
      price: subscriptions.price,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(
      and(
        eq(subscriptions.cancelAtPeriodEnd, true),
        sql`LOWER(${subscriptions.status}) IN ('active', 'trialing', 'past_due')`,
        sql`COALESCE(${subscriptions.productType}, 'plan') = 'plan'`,
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
      ),
    );

  const mrrMap = await latestMrrForCustomers(rows.map((r) => r.customerId));
  const now = Date.now();

  // Latest cancel_scheduled reason per customer
  const reasons = new Map<number, string | null>();
  if (rows.length > 0) {
    const reasonRows = await db.execute(sql`
      SELECT DISTINCT ON (customer_id)
        customer_id, reason_code
      FROM subscription_events
      WHERE type = 'cancel_scheduled'
        AND customer_id IN (${sql.join(
          rows.map((r) => sql`${r.customerId}`),
          sql`, `,
        )})
      ORDER BY customer_id, effective_at DESC, id DESC
    `);
    for (const r of reasonRows.rows as Array<Record<string, unknown>>) {
      reasons.set(
        Number(r.customer_id),
        r.reason_code != null ? String(r.reason_code) : null,
      );
    }
  }

  const pending: PendingRow[] = rows.map((r) => {
    const access = r.accessUntil ? new Date(r.accessUntil) : null;
    const daysLeft =
      access != null
        ? Math.max(0, Math.ceil((access.getTime() - now) / (24 * 3600_000)))
        : null;
    return {
      customerId: r.customerId,
      email: r.email,
      username: r.username,
      planTier: r.planTier,
      mrrCents: mrrMap.get(r.customerId) ?? r.price ?? 0,
      accessUntil: access?.toISOString() ?? null,
      daysLeft,
      reasonCode: reasons.get(r.customerId) ?? null,
      subscriptionId: r.subscriptionId,
    };
  });

  pending.sort((a, b) => {
    if (a.daysLeft == null && b.daysLeft == null) return 0;
    if (a.daysLeft == null) return 1;
    if (b.daysLeft == null) return -1;
    return a.daysLeft - b.daysLeft;
  });
  return pending;
}

export async function getInDunning(): Promise<DunningRow[]> {
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      customerId: subscriptions.userId,
      email: users.email,
      username: users.username,
      accessUntil: subscriptions.accessUntil,
      price: subscriptions.price,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .where(
      and(
        sql`LOWER(${subscriptions.status}) = 'past_due'`,
        sql`COALESCE(${subscriptions.productType}, 'plan') = 'plan'`,
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
      ),
    );

  const mrrMap = await latestMrrForCustomers(rows.map((r) => r.customerId));
  const failedSince = new Map<number, string>();
  if (rows.length > 0) {
    const failRows = await db.execute(sql`
      SELECT DISTINCT ON (customer_id)
        customer_id, effective_at
      FROM subscription_events
      WHERE type = 'payment_failed'
        AND customer_id IN (${sql.join(
          rows.map((r) => sql`${r.customerId}`),
          sql`, `,
        )})
      ORDER BY customer_id, effective_at DESC, id DESC
    `);
    for (const r of failRows.rows as Array<Record<string, unknown>>) {
      failedSince.set(
        Number(r.customer_id),
        new Date(r.effective_at as string).toISOString(),
      );
    }
  }

  return rows.map((r) => ({
    customerId: r.customerId,
    email: r.email,
    username: r.username,
    mrrCents: mrrMap.get(r.customerId) ?? r.price ?? 0,
    failedSince: failedSince.get(r.customerId) ?? null,
    accessUntil: r.accessUntil ? new Date(r.accessUntil).toISOString() : null,
    subscriptionId: r.subscriptionId,
  }));
}

/** One row per customer (latest churn in window); MRR lost = sum of churn deltas in window. */
export async function getChurnedCustomers(month: string): Promise<ChurnedRow[]> {
  const { start, end } = monthBoundsAthens(month);
  return getChurnedCustomersInRange(start, end);
}

export async function getChurnedCustomersInRange(
  start: Date,
  end: Date,
): Promise<ChurnedRow[]> {
  const rows = await db
    .select({
      eventId: subscriptionEvents.id,
      customerId: subscriptionEvents.customerId,
      email: users.email,
      username: users.username,
      planTier: subscriptionEvents.tierAfter,
      mrrDeltaCents: subscriptionEvents.mrrDeltaCents,
      churnKind: subscriptionEvents.churnKind,
      reasonCode: subscriptionEvents.reasonCode,
      reasonNote: subscriptionEvents.reasonNote,
      preLaunch: subscriptionEvents.preLaunch,
      effectiveAt: subscriptionEvents.effectiveAt,
    })
    .from(subscriptionEvents)
    .innerJoin(users, eq(subscriptionEvents.customerId, users.id))
    .where(
      and(
        eq(subscriptionEvents.type, "churn"),
        eq(subscriptionEvents.metricsIgnored, false),
        gte(subscriptionEvents.effectiveAt, start),
        lt(subscriptionEvents.effectiveAt, end),
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
      ),
    )
    .orderBy(desc(subscriptionEvents.effectiveAt));

  // Collapse plan+addon churn noise → one customer row
  const byCustomer = new Map<
    number,
    {
      latest: (typeof rows)[0];
      mrrLostCents: number;
    }
  >();
  for (const r of rows) {
    const prev = byCustomer.get(r.customerId);
    if (!prev) {
      byCustomer.set(r.customerId, {
        latest: r,
        mrrLostCents: Math.abs(r.mrrDeltaCents ?? 0),
      });
    } else {
      prev.mrrLostCents += Math.abs(r.mrrDeltaCents ?? 0);
      if (new Date(r.effectiveAt) > new Date(prev.latest.effectiveAt)) {
        prev.latest = r;
      } else if (
        new Date(r.effectiveAt).getTime() ===
          new Date(prev.latest.effectiveAt).getTime() &&
        r.planTier &&
        !prev.latest.planTier
      ) {
        prev.latest = r;
      }
    }
  }

  const collapsed = [...byCustomer.values()];
  const firstNew = await firstNewAtByCustomer(
    collapsed.map((c) => c.latest.customerId),
  );

  return collapsed
    .map(({ latest: r, mrrLostCents }) => {
      const first = firstNew.get(r.customerId);
      const tenureMonths = first
        ? monthsBetween(first, new Date(r.effectiveAt))
        : null;
      return {
        eventId: r.eventId,
        customerId: r.customerId,
        email: r.email,
        username: r.username,
        planTier: r.planTier,
        tenureBucket: tenureBucketMonths(tenureMonths),
        tenureMonths,
        mrrLostCents,
        churnKind: r.churnKind,
        reasonCode: r.reasonCode,
        reasonNote: r.reasonNote,
        preLaunch: r.preLaunch,
        churnDate: new Date(r.effectiveAt).toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.churnDate).getTime() - new Date(a.churnDate).getTime(),
    );
}

/** Distinct customers who churned in [fromYm, toYm] (inclusive months). */
export async function getPeriodChurnSummary(
  fromYm: string,
  toYm: string,
): Promise<{
  from: string;
  to: string;
  distinctChurned: number;
  mrrLostCents: number;
  isApproximate: boolean;
  eventsCutoverAt: string | null;
}> {
  const { getEventsCutoverAt } = await import("./subscription-events");
  const cutoverAt = await getEventsCutoverAt();
  const { start } = monthBoundsAthens(fromYm);
  const { end } = monthBoundsAthens(toYm);
  const rows = await getChurnedCustomersInRange(start, end);
  const isApproximate =
    cutoverAt == null || start.getTime() < cutoverAt.getTime();
  return {
    from: fromYm,
    to: toYm,
    distinctChurned: rows.length,
    mrrLostCents: rows.reduce((s, r) => s + r.mrrLostCents, 0),
    isApproximate,
    eventsCutoverAt: cutoverAt?.toISOString() ?? null,
  };
}

export async function getReactivations(month: string): Promise<ReactivationRow[]> {
  const { start, end } = monthBoundsAthens(month);
  const rows = await db
    .select({
      eventId: subscriptionEvents.id,
      customerId: subscriptionEvents.customerId,
      email: users.email,
      username: users.username,
      mrrAfterCents: subscriptionEvents.mrrAfterCents,
      effectiveAt: subscriptionEvents.effectiveAt,
    })
    .from(subscriptionEvents)
    .innerJoin(users, eq(subscriptionEvents.customerId, users.id))
    .where(
      and(
        eq(subscriptionEvents.type, "reactivation"),
        gte(subscriptionEvents.effectiveAt, start),
        lt(subscriptionEvents.effectiveAt, end),
        eq(users.accountKind, AccountKind.CUSTOMER),
        eq(users.isDemo, false),
      ),
    )
    .orderBy(desc(subscriptionEvents.effectiveAt));

  const out: ReactivationRow[] = [];
  for (const r of rows) {
    const [priorChurn] = await db
      .select({ effectiveAt: subscriptionEvents.effectiveAt })
      .from(subscriptionEvents)
      .where(
        and(
          eq(subscriptionEvents.customerId, r.customerId),
          eq(subscriptionEvents.type, "churn"),
          lt(subscriptionEvents.effectiveAt, r.effectiveAt),
        ),
      )
      .orderBy(desc(subscriptionEvents.effectiveAt))
      .limit(1);

    const churnedOn = priorChurn
      ? new Date(priorChurn.effectiveAt)
      : null;
    const returnedOn = new Date(r.effectiveAt);
    const gapDays =
      churnedOn != null
        ? Math.round(
            (returnedOn.getTime() - churnedOn.getTime()) / (24 * 3600_000),
          )
        : null;

    out.push({
      eventId: r.eventId,
      customerId: r.customerId,
      email: r.email,
      username: r.username,
      churnedOn: churnedOn?.toISOString() ?? null,
      returnedOn: returnedOn.toISOString(),
      gapDays,
      mrrCents: r.mrrAfterCents ?? 0,
    });
  }
  return out;
}

export type CohortMetric =
  | "customers_start"
  | "customers_end"
  | "logo_churn"
  | "involuntary"
  | "voluntary"
  | "new_customers"
  | "reactivations"
  | "pending_cancellations"
  | "in_dunning";

export async function getCohortCustomers(
  month: string,
  metric: CohortMetric,
  plan: PlanFilter = "all",
): Promise<CohortCustomerRow[]> {
  if (metric === "pending_cancellations") {
    const rows = await getPendingCancellations();
    return rows.map((r) => ({
      customerId: r.customerId,
      email: r.email,
      username: r.username,
      planTier: r.planTier,
      mrrCents: r.mrrCents,
      status: "pending_cancel",
      extra: { daysLeft: r.daysLeft, accessUntil: r.accessUntil },
    }));
  }
  if (metric === "in_dunning") {
    const rows = await getInDunning();
    return rows.map((r) => ({
      customerId: r.customerId,
      email: r.email,
      username: r.username,
      planTier: null,
      mrrCents: r.mrrCents,
      status: "past_due",
      extra: { failedSince: r.failedSince },
    }));
  }

  const { start, end } = monthBoundsAthens(month);

  if (metric === "new_customers" || metric === "reactivations") {
    const type = metric === "new_customers" ? "new" : "reactivation";
    const rows = await db
      .select({
        customerId: subscriptionEvents.customerId,
        email: users.email,
        username: users.username,
        planTier: subscriptionEvents.tierAfter,
        mrrCents: subscriptionEvents.mrrAfterCents,
        status: subscriptionEvents.statusAfter,
      })
      .from(subscriptionEvents)
      .innerJoin(users, eq(subscriptionEvents.customerId, users.id))
      .where(
        and(
          eq(subscriptionEvents.type, type),
          gte(subscriptionEvents.effectiveAt, start),
          lt(subscriptionEvents.effectiveAt, end),
          eq(users.accountKind, AccountKind.CUSTOMER),
          eq(users.isDemo, false),
        ),
      );
    return rows.map((r) => ({
      customerId: r.customerId,
      email: r.email,
      username: r.username,
      planTier: r.planTier,
      mrrCents: r.mrrCents,
      status: r.status,
    }));
  }

  const startStates = await customerStatesAt(start);
  const endStates = await customerStatesAt(end);
  const cohort = filterActiveByPlan(startStates, plan);

  if (metric === "customers_start") {
    return hydrateUsers(
      cohort.map((c) => ({
        customerId: c.customerId,
        planTier: c.tier,
        mrrCents: c.mrrCents,
        status: c.status,
      })),
    );
  }

  if (metric === "customers_end") {
    const endActive = filterActiveByPlan(endStates, plan);
    return hydrateUsers(
      endActive.map((c) => ({
        customerId: c.customerId,
        planTier: c.tier,
        mrrCents: c.mrrCents,
        status: c.status,
      })),
    );
  }

  const churned = cohort.filter((c) => {
    const end = endStates.get(c.customerId);
    return !end || end.status === "churned";
  });

  if (metric === "logo_churn") {
    return hydrateUsers(
      churned.map((c) => ({
        customerId: c.customerId,
        planTier: c.tier,
        mrrCents: c.mrrCents,
        status: "churned",
      })),
    );
  }

  // voluntary / involuntary from churn events in month ∩ cohort
  const churnRows = await getChurnedCustomers(month);
  const cohortSet = new Set(churned.map((c) => c.customerId));
  const filtered = churnRows.filter((r) => {
    if (!cohortSet.has(r.customerId)) return false;
    if (metric === "involuntary") return r.churnKind === "involuntary";
    if (metric === "voluntary") return r.churnKind !== "involuntary";
    return true;
  });
  return filtered.map((r) => ({
    customerId: r.customerId,
    email: r.email,
    username: r.username,
    planTier: r.planTier,
    mrrCents: r.mrrLostCents,
    status: "churned",
    extra: { churnKind: r.churnKind, reasonCode: r.reasonCode },
  }));
}

async function hydrateUsers(
  rows: Array<{
    customerId: number;
    planTier: string | null;
    mrrCents: number;
    status: string | null;
  }>,
): Promise<CohortCustomerRow[]> {
  if (rows.length === 0) return [];
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
    })
    .from(users)
    .where(
      inArray(
        users.id,
        rows.map((r) => r.customerId),
      ),
    );
  const byId = new Map(userRows.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = byId.get(r.customerId);
    return {
      customerId: r.customerId,
      email: u?.email ?? "",
      username: u?.username ?? "",
      planTier: r.planTier,
      mrrCents: r.mrrCents,
      status: r.status,
    };
  });
}

export async function updateEventReason(input: {
  eventId: number;
  editedByUserId: number;
  reasonCode: string;
  reasonNote?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [event] = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.id, input.eventId))
    .limit(1);
  if (!event) return { ok: false, error: "Event not found" };
  if (event.type !== "churn" && event.type !== "cancel_scheduled") {
    return { ok: false, error: "Only churn / cancel_scheduled reasons are editable" };
  }

  await db.insert(subscriptionEventReasonAudits).values({
    eventId: input.eventId,
    editedByUserId: input.editedByUserId,
    oldReasonCode: event.reasonCode,
    newReasonCode: input.reasonCode,
    oldReasonNote: event.reasonNote,
    newReasonNote: input.reasonNote ?? null,
  });

  await db
    .update(subscriptionEvents)
    .set({
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote ?? null,
    })
    .where(eq(subscriptionEvents.id, input.eventId));

  return { ok: true };
}

export function livePendingSummary(pending: PendingRow[]): {
  count: number;
  mrrAtRiskCents: number;
} {
  const seen = new Set<number>();
  let mrrAtRiskCents = 0;
  for (const p of pending) {
    if (seen.has(p.customerId)) continue;
    seen.add(p.customerId);
    mrrAtRiskCents += p.mrrCents;
  }
  return { count: seen.size, mrrAtRiskCents };
}
