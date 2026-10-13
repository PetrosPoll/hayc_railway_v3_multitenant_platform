/**
 * Calendar recurrence helpers shared by client and server.
 * Monthly/yearly advances clamp to the last day of the target month
 * so Jan 31 → Feb 28/29 → Mar 31 (anchor day preserved).
 */

export type BillingFrequency = "weekly" | "monthly" | "yearly";

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Local calendar day as YYYY-MM-DD. */
export function toLocalDateKey(input: string | Date): string {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * UTC calendar day as YYYY-MM-DD.
 * Use for Stripe obligation due dates so the calendar day matches Stripe Dashboard
 * (e.g. 2026-10-30T23:21:54Z → 30 Oct, not 31 Oct in Europe/Athens).
 */
export function toUtcDateKey(input: string | Date): string {
  if (typeof input === "string") {
    // Prefer explicit date prefix only when the string is date-only (no time).
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return toLocalDateKey(input);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Calendar day key for an obligation: Stripe → UTC (match Dashboard); custom → local/Athens. */
export function toObligationDateKey(
  input: string | Date,
  origin?: string | null,
): string {
  if (origin === "stripe") return toUtcDateKey(input);
  return toLocalDateKey(input);
}

/**
 * Advance one period from `from`, keeping `anchorDay` (1–31) for monthly/yearly.
 * Weekly ignores anchor and adds 7 days.
 */
export function addRecurrence(
  from: Date,
  frequency: BillingFrequency,
  anchorDay?: number,
): Date {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = anchorDay ?? from.getDate();

  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (frequency === "yearly") {
    const year = next.getFullYear() + 1;
    const month = next.getMonth();
    const dim = daysInMonth(year, month);
    next.setFullYear(year, month, Math.min(day, dim));
    return next;
  }

  // monthly
  const totalMonths = next.getMonth() + 1;
  const year = next.getFullYear() + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const dim = daysInMonth(year, month);
  next.setFullYear(year, month, Math.min(day, dim));
  return next;
}

export function* iterateRecurrenceDates(
  startDate: Date,
  frequency: BillingFrequency,
  rangeStart: Date,
  rangeEnd: Date,
  excludedKeys: Set<string> = new Set(),
): Generator<Date> {
  const anchorDay = startDate.getDate();
  let current = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );

  // Walk forward until we enter the range (cap iterations)
  let guard = 0;
  while (current < rangeStart && guard < 5000) {
    current = addRecurrence(current, frequency, anchorDay);
    guard++;
  }

  while (current <= rangeEnd && guard < 10000) {
    const key = toLocalDateKey(current);
    if (!excludedKeys.has(key) && current >= rangeStart) {
      yield new Date(current.getFullYear(), current.getMonth(), current.getDate());
    }
    current = addRecurrence(current, frequency, anchorDay);
    guard++;
  }
}
