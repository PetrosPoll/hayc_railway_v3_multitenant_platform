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

/** Extend ended cores through brief gaps (e.g. monthly cancel → yearly next day). */
export const DEFAULT_CORE_GAP_BRIDGE_MS = 48 * 60 * 60 * 1000;

export function bridgeShortCoreGaps(
  intervals: SubInterval[],
  maxGapMs = DEFAULT_CORE_GAP_BRIDGE_MS,
): SubInterval[] {
  const cores = intervals
    .filter((i) => i.hasCore && i.endMs != null)
    .sort((a, b) => a.endMs! - b.endMs!);
  if (cores.length === 0) return intervals;

  const extendEnd = new Map<string, number>();
  for (const ended of cores) {
    const gapStart = ended.endMs!;
    const next = intervals
      .filter(
        (i) =>
          i.hasCore && i.startMs >= gapStart && i.startMs - gapStart <= maxGapMs,
      )
      .sort((a, b) => a.startMs - b.startMs)[0];
    if (next && next.startMs > gapStart) {
      extendEnd.set(ended.subId, next.startMs);
    }
  }

  if (extendEnd.size === 0) return intervals;
  return intervals.map((iv) => {
    const bridged = extendEnd.get(iv.subId);
    if (bridged == null || iv.endMs == null) return iv;
    return { ...iv, endMs: Math.max(iv.endMs, bridged) };
  });
}

export function buildLogoTransitions(intervals: SubInterval[]): LogoTransition[] {
  const bridged = bridgeShortCoreGaps(intervals);
  const core = bridged.filter((i) => i.hasCore);
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
    const snap = coverageAt(t, bridged);
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
