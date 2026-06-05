export type ChurnSubscriptionRow = {
  id: number;
  userId: number;
  createdAt: Date | null;
  status: string | null;
  cancelledAt: Date | null;
  accessUntil: Date | null;
  productType: string | null;
  reactivationOf: number | null;
};

export type MonthlyChurnEntry = {
  month: string;
  subscriptionsAtStart: number;
  churnedSubscriptions: number;
  churnRate: number | null;
};

export type ProductChurnStats = {
  firstSubscriptionDate: string | null;
  totalSubscriptionsEver: number;
  totalChurnedSubscriptions: number;
  totalChurnRate: number;
  lifetimeChurnRate: number;
  thisYearChurnRate: number;
  averageMonthlyChurn: number;
  monthly: MonthlyChurnEntry[];
};

type SubscriptionLifecycle = {
  id: number;
  userId: number;
  startDate: Date;
  endDate: Date | null;
};

function resolveEndDate(row: ChurnSubscriptionRow): Date | null {
  const status = (row.status || "").toLowerCase();
  const isCancelledStatus = status === "cancelled" || status === "canceled";
  const cancelledAt = row.cancelledAt ? new Date(row.cancelledAt) : null;
  const accessUntil = row.accessUntil ? new Date(row.accessUntil) : null;
  return cancelledAt || (isCancelledStatus ? accessUntil : null);
}

function buildLifecycles(rows: ChurnSubscriptionRow[]): SubscriptionLifecycle[] {
  const reactivatedSubscriptionIds = new Set(
    rows
      .map((row) => row.reactivationOf)
      .filter((id): id is number => id != null),
  );

  const lifecycles: SubscriptionLifecycle[] = [];

  for (const row of rows) {
    if (!row.createdAt) continue;

    const rawEndDate = resolveEndDate(row);
    const isReactivated = reactivatedSubscriptionIds.has(row.id);

    lifecycles.push({
      id: row.id,
      userId: row.userId,
      startDate: new Date(row.createdAt),
      endDate: isReactivated ? null : rawEndDate,
    });
  }

  return lifecycles;
}

function countMonthsSinceFirst(firstSubscriptionDate: Date, now: Date): number {
  const startYear = firstSubscriptionDate.getUTCFullYear();
  const startMonth = firstSubscriptionDate.getUTCMonth();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth();
  return Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
}

export function computeProductChurnStats(
  rows: ChurnSubscriptionRow[],
  now: Date = new Date(),
): ProductChurnStats {
  const lifecycles = buildLifecycles(rows);

  const totalSubscriptionsEver = lifecycles.length;
  const churnedLifecycles = lifecycles.filter((s) => !!s.endDate);
  const totalChurnedSubscriptions = churnedLifecycles.length;
  const totalChurnRate =
    totalSubscriptionsEver > 0
      ? Number(((totalChurnedSubscriptions / totalSubscriptionsEver) * 100).toFixed(2))
      : 0;

  const uniqueCustomerIds = new Set(lifecycles.map((s) => s.userId));
  const churnedCustomerIds = new Set(
    churnedLifecycles.map((s) => s.userId),
  );
  const totalUniqueCustomers = uniqueCustomerIds.size;
  const lifetimeChurnRate =
    totalUniqueCustomers > 0
      ? Number(((churnedCustomerIds.size / totalUniqueCustomers) * 100).toFixed(2))
      : 0;

  const startTimestamps = lifecycles.map((s) => s.startDate.getTime());
  const firstSubscriptionDate =
    startTimestamps.length > 0 ? new Date(Math.min(...startTimestamps)) : null;

  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

  const trueChurnedInYear = churnedLifecycles.filter(
    (s) => s.endDate! >= yearStart && s.endDate! < yearEnd,
  ).length;

  const activeOnJan1 = lifecycles.filter((s) => {
    const startedBeforeYear = s.startDate < yearStart;
    const notEndedBeforeYear = !s.endDate || s.endDate >= yearStart;
    return startedBeforeYear && notEndedBeforeYear;
  }).length;

  const thisYearChurnRate =
    activeOnJan1 > 0
      ? Number(((trueChurnedInYear / activeOnJan1) * 100).toFixed(2))
      : 0;

  const monthsSinceFirst = firstSubscriptionDate
    ? countMonthsSinceFirst(firstSubscriptionDate, now)
    : 0;
  const averageMonthlyChurn =
    monthsSinceFirst > 0
      ? Number((lifetimeChurnRate / monthsSinceFirst).toFixed(2))
      : 0;

  const monthly: MonthlyChurnEntry[] = [];

  if (firstSubscriptionDate) {
    const cursor = new Date(
      Date.UTC(firstSubscriptionDate.getUTCFullYear(), firstSubscriptionDate.getUTCMonth(), 1),
    );
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    while (cursor <= lastMonth) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );

      const subscriptionsAtStart = lifecycles.filter((s) => {
        const startedBeforeMonth = s.startDate < monthStart;
        const notEndedBeforeMonth = !s.endDate || s.endDate >= monthStart;
        return startedBeforeMonth && notEndedBeforeMonth;
      }).length;

      const churnedInMonth = lifecycles.filter(
        (s) => !!s.endDate && s.endDate >= monthStart && s.endDate < monthEnd,
      ).length;

      monthly.push({
        month: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
        subscriptionsAtStart,
        churnedSubscriptions: churnedInMonth,
        churnRate:
          subscriptionsAtStart > 0
            ? Number(((churnedInMonth / subscriptionsAtStart) * 100).toFixed(2))
            : null,
      });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return {
    firstSubscriptionDate: firstSubscriptionDate?.toISOString() ?? null,
    totalSubscriptionsEver,
    totalChurnedSubscriptions,
    totalChurnRate,
    lifetimeChurnRate,
    thisYearChurnRate,
    averageMonthlyChurn,
    monthly,
  };
}

export function filterRowsByProductType(
  rows: ChurnSubscriptionRow[],
  productType: "plan" | "addon",
): ChurnSubscriptionRow[] {
  if (productType === "addon") {
    return rows.filter((row) => row.productType === "addon");
  }
  return rows.filter((row) => row.productType !== "addon");
}
