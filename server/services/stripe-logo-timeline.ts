/** Pure logo-timeline math (no DB). */

export type SubInterval = {
  startMs: number;
  endMs: number | null;
  mrrCents: number;
  tier: string | null;
  hasCore: boolean;
  subId: string;
};

export type LogoTransition = {
  at: Date;
  type: "new" | "reactivation" | "churn" | "expansion" | "contraction";
  mrrAfterCents: number;
  mrrDeltaCents: number;
  tierAfter: string | null;
  statusAfter: "active" | "churned";
  stripeSubscriptionId: string | null;
  churnKind?: "voluntary" | "involuntary";
};

function coverageAt(
  t: number,
  intervals: SubInterval[],
): { mrr: number; tier: string | null; coreCount: number; anySubId: string | null } {
  let mrr = 0;
  let tier: string | null = null;
  let coreCount = 0;
  let anySubId: string | null = null;
  for (const iv of intervals) {
    if (t < iv.startMs) continue;
    if (iv.endMs != null && t >= iv.endMs) continue;
    mrr += iv.mrrCents;
    if (iv.hasCore) {
      coreCount += 1;
      if (iv.tier) tier = iv.tier;
      anySubId = iv.subId;
    } else if (!anySubId) {
      anySubId = iv.subId;
    }
  }
  return { mrr, tier, coreCount, anySubId };
}

export function buildLogoTransitions(intervals: SubInterval[]): LogoTransition[] {
  const core = intervals.filter((i) => i.hasCore);
  if (core.length === 0) return [];

  const times = new Set<number>();
  for (const iv of core) {
    times.add(iv.startMs);
    if (iv.endMs != null) times.add(iv.endMs);
  }
  const sorted = [...times].sort((a, b) => a - b);

  const out: LogoTransition[] = [];
  let prevCore = 0;
  let prevMrr = 0;
  let hadChurn = false;

  for (const t of sorted) {
    const snap = coverageAt(t, intervals);
    const coreCount = snap.coreCount;
    const mrr = snap.coreCount > 0 ? snap.mrr : 0;

    if (prevCore === 0 && coreCount > 0) {
      out.push({
        at: new Date(t),
        type: hadChurn ? "reactivation" : "new",
        mrrAfterCents: mrr,
        mrrDeltaCents: mrr - prevMrr,
        tierAfter: snap.tier,
        statusAfter: "active",
        stripeSubscriptionId: snap.anySubId,
      });
    } else if (prevCore > 0 && coreCount === 0) {
      hadChurn = true;
      out.push({
        at: new Date(t),
        type: "churn",
        mrrAfterCents: 0,
        mrrDeltaCents: -prevMrr,
        tierAfter: snap.tier,
        statusAfter: "churned",
        stripeSubscriptionId: null,
        churnKind: "voluntary",
      });
    } else if (prevCore > 0 && coreCount > 0 && mrr !== prevMrr) {
      out.push({
        at: new Date(t),
        type: mrr > prevMrr ? "expansion" : "contraction",
        mrrAfterCents: mrr,
        mrrDeltaCents: mrr - prevMrr,
        tierAfter: snap.tier,
        statusAfter: "active",
        stripeSubscriptionId: snap.anySubId,
      });
    }

    prevCore = coreCount;
    prevMrr = mrr;
  }

  return out;
}
