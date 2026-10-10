/**
 * Rebuild subscription_events from Stripe subscription history (source=backfill).
 *
 * Usage:
 *   doppler run -- npx tsx scripts/backfill-subscription-events.ts --dry-run
 *   doppler run -- npx tsx scripts/backfill-subscription-events.ts
 *   doppler run -- npx tsx scripts/backfill-subscription-events.ts --legacy-local
 *
 * Default: logo timeline + MRR from Stripe subscriptions (accurate history).
 * --legacy-local: old local subscription-row approximation (not for production KPIs).
 *
 * Requires churn_settings.events_cutover_at. Writes only effective_at < cutover.
 * See docs/churn/RUNBOOK.md.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  AccountKind,
  subscriptionEvents,
  subscriptions,
  users,
  websiteProgress,
  websiteStages,
} from "../shared/schema";
import { upsertPriceMapSeed } from "../server/services/stripe-price-map";
import {
  backfillMayWriteEvent,
  ensureCustomerStripeAccount,
  getEventsCutoverAt,
  insertSubscriptionEvent,
} from "../server/services/subscription-events";
import { computeCustomerMrrFromStripe } from "../server/services/customer-mrr";
import { intervalsFromStripeSubscriptions } from "../server/services/stripe-logo-history";
import { buildLogoTransitions } from "../server/services/stripe-logo-timeline";

const dryRun = process.argv.includes("--dry-run");
const legacyLocal = process.argv.includes("--legacy-local");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

type Approx = string;
const approximations: Approx[] = [];
const unmappedPriceIds = new Set<string>();
/** YYYY-MM months with known approximation (legacy mode only) */
const approximateMonths = new Set<string>();

function monthKeyAthens(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
  });
  // en-CA → YYYY-MM-DD; take YYYY-MM
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

async function backfillLaunchedAt() {
  const launchStages = await db
    .select({
      websiteProgressId: websiteStages.websiteProgressId,
      completedAt: websiteStages.completedAt,
    })
    .from(websiteStages)
    .where(
      and(
        eq(websiteStages.title, "Website Launch"),
        eq(websiteStages.status, "completed"),
      ),
    );

  let updated = 0;
  for (const stage of launchStages) {
    if (!stage.completedAt) continue;
    if (dryRun) {
      updated += 1;
      continue;
    }
    const result = await db
      .update(websiteProgress)
      .set({
        launchedAt: sql`COALESCE(${websiteProgress.launchedAt}, ${stage.completedAt})`,
      })
      .where(eq(websiteProgress.id, stage.websiteProgressId))
      .returning({ id: websiteProgress.id });
    updated += result.length;
  }
  return updated;
}

async function seedCustomerStripeAccounts() {
  const rows = await db
    .select({ id: users.id, stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(
      and(
        eq(users.accountKind, AccountKind.CUSTOMER),
        sql`${users.stripeCustomerId} IS NOT NULL`,
      ),
    );
  let n = 0;
  for (const row of rows) {
    if (!row.stripeCustomerId) continue;
    if (!dryRun) {
      await ensureCustomerStripeAccount(row.id, row.stripeCustomerId);
    }
    n += 1;
  }
  return n;
}

async function clearBackfillEvents() {
  if (dryRun) {
    const [count] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.source, "backfill"));
    return count?.c ?? 0;
  }
  const deleted = await db
    .delete(subscriptionEvents)
    .where(eq(subscriptionEvents.source, "backfill"))
    .returning({ id: subscriptionEvents.id });
  return deleted.length;
}

/** Local plan rows → intervals when Stripe no longer has the subscription objects. */
async function localPlanIntervalsForCustomer(customerId: number) {
  const localSubs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, customerId));

  const intervals: import("../server/services/stripe-logo-timeline").SubInterval[] =
    [];

  for (const sub of localSubs) {
    if (!sub.createdAt) continue;
    const isPlan = (sub.productType || "plan") === "plan";
    const isCancelled =
      (sub.status || "").toLowerCase() === "cancelled" ||
      (sub.status || "").toLowerCase() === "canceled";
    // Logo end = access end (period end), not cancel click.
    const endAt = isCancelled
      ? sub.accessUntil ?? sub.cancelledAt ?? null
      : null;
    const mrrGuess = Math.round(
      (sub.price ?? 0) / (sub.billingPeriod === "yearly" ? 12 : 1),
    );
    intervals.push({
      startMs: sub.createdAt.getTime(),
      endMs: endAt ? endAt.getTime() : null,
      mrrCents: mrrGuess,
      tier: sub.tier,
      hasCore: isPlan,
      subId: sub.stripeSubscriptionId || `local:${sub.id}`,
    });
  }
  return intervals;
}

async function emitStripeHistoryForCustomer(
  customerId: number,
  stripeCustomerId: string,
  cutover: Date,
) {
  let lastMrr = 0;
  let lastStatus: "active" | "churned" | null = null;

  try {
    const listed = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    });

    let { intervals, unknownPriceIds, usedVatFallback } =
      await intervalsFromStripeSubscriptions(listed.data);
    unknownPriceIds.forEach((id) => unmappedPriceIds.add(id));
    if (usedVatFallback) {
      approximations.push(
        `customer ${customerId}: used gross/1.24 VAT fallback for some Stripe prices`,
      );
    }

    const stripeCoreCount = intervals.filter((i) => i.hasCore).length;
    if (stripeCoreCount === 0) {
      // Deleted from Stripe — recover logo timeline from local plan rows.
      intervals = await localPlanIntervalsForCustomer(customerId);
      if (intervals.some((i) => i.hasCore)) {
        approximations.push(
          `customer ${customerId}: no Stripe subs left; used local plan rows for logo history`,
        );
      }
    }

    const transitions = buildLogoTransitions(intervals);
    for (const tr of transitions) {
      if (!(await backfillMayWriteEvent(tr.at))) continue;
      if (!dryRun) {
        await insertSubscriptionEvent({
          customerId,
          stripeSubscriptionId: tr.stripeSubscriptionId,
          stripeEventId: `backfill:stripe:${customerId}:${tr.type}:${tr.at.toISOString()}`,
          type: tr.type,
          effectiveAt: tr.at,
          statusAfter: tr.statusAfter,
          mrrAfterCents: tr.mrrAfterCents,
          mrrDeltaCents: tr.mrrDeltaCents,
          tierAfter: tr.tierAfter,
          churnKind: tr.churnKind ?? null,
          reasonCode: tr.type === "churn" ? "unknown" : null,
          source: "backfill",
        });
      }
      lastMrr = tr.mrrAfterCents;
      lastStatus = tr.statusAfter;
    }

    const snap = await computeCustomerMrrFromStripe(
      stripe,
      stripeCustomerId,
      `backfill customer ${customerId}`,
    );
    snap.unknownPriceIds.forEach((id) => unmappedPriceIds.add(id));

    const effectiveAt = new Date(cutover.getTime() - 1000);
    const hasOpenCoreAfterCutover = intervals.some(
      (i) =>
        i.hasCore &&
        i.startMs < cutover.getTime() &&
        (i.endMs == null || i.endMs > cutover.getTime()),
    );

    if (await backfillMayWriteEvent(effectiveAt)) {
      if (snap.activeCoreSubscriptionIds.length > 0) {
        if (lastStatus !== "active" || lastMrr !== snap.mrrCentsExVat) {
          const type =
            lastStatus === "churned" || lastStatus == null
              ? ("reactivation" as const)
              : snap.mrrCentsExVat >= lastMrr
                ? ("expansion" as const)
                : ("contraction" as const);
          approximations.push(
            `customer ${customerId}: cutover reconcile ${type} mrr=${snap.mrrCentsExVat}`,
          );
          if (!dryRun) {
            await insertSubscriptionEvent({
              customerId,
              stripeSubscriptionId: snap.activeCoreSubscriptionIds[0] ?? null,
              stripeEventId: `backfill:snapshot:${customerId}:${cutover.toISOString()}`,
              type,
              effectiveAt,
              statusAfter: "active",
              mrrAfterCents: snap.mrrCentsExVat,
              mrrDeltaCents: snap.mrrCentsExVat - lastMrr,
              tierAfter: snap.coreTier,
              source: "backfill",
            });
          }
        }
      } else if (lastStatus === "active" && !hasOpenCoreAfterCutover) {
        // Truly gone before/at cutover — not a period-end cancel still running.
        approximations.push(
          `customer ${customerId}: cutover reconcile churn (0 live cores, no open interval)`,
        );
        if (!dryRun) {
          await insertSubscriptionEvent({
            customerId,
            stripeSubscriptionId: null,
            stripeEventId: `backfill:snapshot-churn:${customerId}:${cutover.toISOString()}`,
            type: "churn",
            effectiveAt,
            statusAfter: "churned",
            mrrAfterCents: 0,
            mrrDeltaCents: -lastMrr,
            tierAfter: snap.coreTier,
            churnKind: "voluntary",
            reasonCode: "unknown",
            source: "backfill",
          });
        }
      } else if (lastStatus === "active" && hasOpenCoreAfterCutover) {
        approximations.push(
          `customer ${customerId}: period-end cancel after cutover — left active until Stripe deleted webhook`,
        );
      }
    }

    return snap;
  } catch (err: any) {
    approximations.push(
      `customer ${customerId}: Stripe history failed: ${err?.message || err}`,
    );
    return null;
  }
}

/** @deprecated local row approximation — use only with --legacy-local */
async function emitHistoricalForCustomerLegacy(
  customerId: number,
  stripeCustomerId: string,
  cutover: Date,
) {
  const localSubs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, customerId));

  const sorted = [...localSubs].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );

  let hadChurn = false;
  let lastMrr = 0;
  let lastStatus: "active" | "churned" | null = null;

  for (const sub of sorted) {
    if (!sub.createdAt) continue;

    const mrrGuess = Math.round(
      (sub.price ?? 0) / (sub.billingPeriod === "yearly" ? 12 : 1),
    );

    const startType =
      sub.productType === "addon" && lastMrr > 0
        ? ("expansion" as const)
        : hadChurn
          ? ("reactivation" as const)
          : ("new" as const);

    if (await backfillMayWriteEvent(sub.createdAt)) {
      approximateMonths.add(monthKeyAthens(sub.createdAt));
      approximations.push(
        `customer ${customerId} sub #${sub.id}: LEGACY ${startType} at createdAt`,
      );
      if (!dryRun) {
        await insertSubscriptionEvent({
          customerId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeEventId: null,
          type: startType,
          effectiveAt: sub.createdAt,
          statusAfter: "active",
          mrrAfterCents: mrrGuess,
          mrrDeltaCents: mrrGuess - lastMrr,
          tierAfter: sub.tier,
          source: "backfill",
        });
      }
      lastMrr = mrrGuess;
      lastStatus = "active";
    }

    const isCancelled =
      (sub.status || "").toLowerCase() === "cancelled" ||
      (sub.status || "").toLowerCase() === "canceled";

    if (isCancelled) {
      const effectiveAt = sub.cancelledAt ?? sub.accessUntil ?? sub.createdAt;
      if (effectiveAt && (await backfillMayWriteEvent(effectiveAt))) {
        approximateMonths.add(monthKeyAthens(effectiveAt));
        if (!dryRun) {
          await insertSubscriptionEvent({
            customerId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            stripeEventId: null,
            type: "churn",
            effectiveAt,
            statusAfter: "churned",
            mrrAfterCents: 0,
            mrrDeltaCents: -lastMrr,
            tierAfter: sub.tier,
            churnKind: "voluntary",
            reasonCode: "unknown",
            source: "backfill",
          });
        }
        hadChurn = true;
        lastMrr = 0;
        lastStatus = "churned";
      }
    }
  }

  return computeCustomerMrrFromStripe(
    stripe,
    stripeCustomerId,
    `legacy backfill customer ${customerId}`,
  ).catch(() => null);
}
async function findDuplicateCandidates() {
  const byEmail = await db.execute(sql`
    SELECT lower(email) AS key, count(*)::int AS n, array_agg(id) AS ids
    FROM users
    WHERE account_kind = 'customer' AND email IS NOT NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
  `);
  const byVat = await db.execute(sql`
    SELECT vat_number AS key, count(*)::int AS n, array_agg(id) AS ids
    FROM users
    WHERE account_kind = 'customer' AND vat_number IS NOT NULL AND vat_number <> ''
    GROUP BY vat_number
    HAVING count(*) > 1
  `);
  const byDomain = await db.execute(sql`
    SELECT lower(domain) AS key, count(DISTINCT user_id)::int AS n, array_agg(DISTINCT user_id) AS ids
    FROM website_progress
    GROUP BY lower(domain)
    HAVING count(DISTINCT user_id) > 1
  `);
  return { byEmail, byVat, byDomain };
}

type StatusEvent = {
  customerId: number;
  effectiveAt: Date;
  statusAfter: string;
  mrrAfterCents: number | null;
};

/** Quick logo-churn sanity from status-bearing events (Athens month labels via monthKeyAthens). */
function computeLogoChurnLast12Months(events: StatusEvent[], now: Date) {
  // Build per-customer timeline
  const byCustomer = new Map<number, StatusEvent[]>();
  for (const e of events) {
    const list = byCustomer.get(e.customerId) ?? [];
    list.push(e);
    byCustomer.set(e.customerId, list);
  }
  for (const list of byCustomer.values()) {
    list.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  }

  function statusAt(customerId: number, at: Date): string | null {
    const list = byCustomer.get(customerId) ?? [];
    let s: string | null = null;
    for (const e of list) {
      if (e.effectiveAt.getTime() < at.getTime()) s = e.statusAfter;
      else break;
    }
    return s;
  }

  const rows: Array<{
    month: string;
    customersStart: number;
    churnedCount: number;
    logoChurnPct: number | null;
    mrrMovementsApproximate: boolean;
  }> = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const mStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const mEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

    let customersStart = 0;
    let churnedCount = 0;
    for (const customerId of byCustomer.keys()) {
      const atStart = statusAt(customerId, mStart);
      if (atStart !== "active") continue;
      customersStart += 1;
      const atEnd = statusAt(customerId, mEnd);
      if (atEnd !== "active") churnedCount += 1;
    }
    rows.push({
      month,
      customersStart,
      churnedCount,
      logoChurnPct:
        customersStart > 0
          ? Number(((churnedCount / customersStart) * 100).toFixed(2))
          : null,
      mrrMovementsApproximate: approximateMonths.has(month),
    });
  }
  return rows;
}

async function main() {
  console.log(
    `Backfill starting (dryRun=${dryRun}, mode=${legacyLocal ? "legacy-local" : "stripe-history"})…`,
  );

  const cutover = await getEventsCutoverAt();
  if (!cutover) {
    console.error(
      "ERROR: churn_settings.events_cutover_at is NULL. Set it before backfill (see docs/churn/RUNBOOK.md).",
    );
    process.exit(1);
  }
  console.log(`Cutover: ${cutover.toISOString()}`);

  const priceMapCount = dryRun ? 0 : await upsertPriceMapSeed();
  console.log(`stripe_price_map seed rows: ${priceMapCount || "(dry-run skip write)"}`);

  const launched = await backfillLaunchedAt();
  console.log(`launched_at candidates/updates: ${launched}`);

  const mapped = await seedCustomerStripeAccounts();
  console.log(`customer_stripe_accounts seeded: ${mapped}`);

  const cleared = await clearBackfillEvents();
  console.log(`cleared backfill events: ${cleared}`);

  const customers = await db
    .select({
      id: users.id,
      email: users.email,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(
      and(
        eq(users.accountKind, AccountKind.CUSTOMER),
        sql`${users.stripeCustomerId} IS NOT NULL`,
        eq(users.isDemo, false),
      ),
    );

  const recon: Array<{
    customerId: number;
    email: string | null;
    stripeMrr: number;
    activeCores: number;
  }> = [];

  for (const c of customers) {
    if (!c.stripeCustomerId) continue;
    const snap = legacyLocal
      ? await emitHistoricalForCustomerLegacy(c.id, c.stripeCustomerId, cutover)
      : await emitStripeHistoryForCustomer(c.id, c.stripeCustomerId, cutover);
    if (snap) {
      recon.push({
        customerId: c.id,
        email: c.email,
        stripeMrr: snap.mrrCentsExVat,
        activeCores: snap.activeCoreSubscriptionIds.length,
      });
    }
  }

  if (!dryRun) {
    const { reapplyIgnoredChurnFlags } = await import(
      "../server/services/churn-overrides"
    );
    const reapplied = await reapplyIgnoredChurnFlags();
    console.log(`Re-applied ignored churn flags: ${reapplied} event(s)`);
  }

  const activeCustomers = recon.filter((r) => r.activeCores > 0);
  const totalMrr = activeCustomers.reduce((s, r) => s + r.stripeMrr, 0);
  const arpa =
    activeCustomers.length > 0
      ? Math.round(totalMrr / activeCustomers.length)
      : 0;

  const statusRows = await db
    .select({
      customerId: subscriptionEvents.customerId,
      effectiveAt: subscriptionEvents.effectiveAt,
      statusAfter: subscriptionEvents.statusAfter,
      mrrAfterCents: subscriptionEvents.mrrAfterCents,
    })
    .from(subscriptionEvents)
    .where(sql`${subscriptionEvents.statusAfter} IS NOT NULL`);

  const logoChurn = computeLogoChurnLast12Months(
    statusRows.map((r) => ({
      customerId: r.customerId,
      effectiveAt: r.effectiveAt,
      statusAfter: r.statusAfter!,
      mrrAfterCents: r.mrrAfterCents,
    })),
    new Date(),
  );

  const duplicates = await findDuplicateCandidates();

  const reportPath = path.join(process.cwd(), "docs/churn/BACKFILL_REPORT.md");
  const lines: string[] = [];
  lines.push("# Churn backfill report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`dryRun: ${dryRun}`);
  lines.push(`events_cutover_at: ${cutover.toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Customers processed: ${customers.length}`);
  lines.push(`- Backfill events cleared: ${cleared}`);
  lines.push(`- launched_at updates: ${launched}`);
  lines.push(`- customer_stripe_accounts seeded: ${mapped}`);
  lines.push(`- stripe_price_map seed writes: ${priceMapCount}`);
  lines.push(`- Unmapped Stripe price IDs: ${unmappedPriceIds.size}`);
  lines.push(`- Approximations logged: ${approximations.length}`);
  lines.push(
    `- Active customers (live Stripe, ≥1 core sub): ${activeCustomers.length}`,
  );
  lines.push(`- Total MRR ex-VAT (cents): ${totalMrr}`);
  lines.push(`- ARPA ex-VAT (cents): ${arpa} (€${(arpa / 100).toFixed(2)})`);
  lines.push("");
  lines.push("## ARPA (ex VAT)");
  lines.push("");
  lines.push("| metric | value |");
  lines.push("|---|---|");
  lines.push(`| active_customers | ${activeCustomers.length} |`);
  lines.push(`| mrr_cents_ex_vat | ${totalMrr} |`);
  lines.push(`| arpa_cents_ex_vat | ${arpa} |`);
  lines.push("");
  lines.push("## Logo churn (last 12 months) — sanity table");
  lines.push("");
  lines.push(
    legacyLocal
      ? "Mode: **legacy-local** (approximate). Cohort = active at month start → not active at next month start."
      : "Mode: **stripe-history**. Cohort = ≥1 core Stripe sub covering month start → none at next month start.",
  );
  lines.push("");
  lines.push(
    "| month | customers_start | churned_count | logo_churn_pct | mrr_movements |",
  );
  lines.push("|---|---|---|---|---|");
  for (const r of logoChurn) {
    lines.push(
      `| ${r.month} | ${r.customersStart} | ${r.churnedCount} | ${r.logoChurnPct ?? "n/a"} | ${r.mrrMovementsApproximate ? "**approximate**" : "ok / mixed"} |`,
    );
  }
  lines.push("");
  lines.push("## Unmapped price IDs");
  if (unmappedPriceIds.size === 0) lines.push("(none)");
  else [...unmappedPriceIds].forEach((id) => lines.push(`- \`${id}\``));
  lines.push("");
  lines.push("## Approximations");
  if (approximations.length === 0) lines.push("(none)");
  else approximations.slice(0, 500).forEach((a) => lines.push(`- ${a}`));
  if (approximations.length > 500) {
    lines.push(`- … ${approximations.length - 500} more`);
  }
  lines.push("");
  lines.push("## Duplicate candidates");
  lines.push("### Same email");
  lines.push("```");
  lines.push(JSON.stringify(duplicates.byEmail, null, 2));
  lines.push("```");
  lines.push("### Same VAT");
  lines.push("```");
  lines.push(JSON.stringify(duplicates.byVat, null, 2));
  lines.push("```");
  lines.push("### Same domain, multiple users");
  lines.push("```");
  lines.push(JSON.stringify(duplicates.byDomain, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Live Stripe MRR snapshot (ex VAT, per customer)");
  lines.push("| customerId | email | mrr_cents | active_cores |");
  lines.push("|---|---|---|---|");
  for (const r of recon) {
    lines.push(
      `| ${r.customerId} | ${r.email} | ${r.stripeMrr} | ${r.activeCores} |`,
    );
  }
  lines.push("");
  lines.push("## Notes");
  if (legacyLocal) {
    lines.push("- LEGACY: local subscription-row approximation (not for official KPIs).");
  } else {
    lines.push(
      "- Logo timeline rebuilt from Stripe subscriptions (core coverage intervals).",
    );
    lines.push(
      "- MRR from Stripe price items at each sub (ex-VAT); mid-cycle item changes without new sub may be missed.",
    );
    lines.push("- Cancellation reasons default to `unknown` until edited in Admin.");
  }
  lines.push(`- Mode: ${legacyLocal ? "legacy-local" : "stripe-history"}`);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${reportPath}`);
  console.log(
    `ARPA ex-VAT: ${arpa} cents | active: ${activeCustomers.length} | MRR: ${totalMrr}`,
  );
  console.log("Done. Review BACKFILL_REPORT.md before Phase 3 (metrics/UI).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
