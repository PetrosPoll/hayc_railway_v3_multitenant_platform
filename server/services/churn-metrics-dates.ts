const ATHENS = "Europe/Athens";

export function parseYearMonth(ym: string): { y: number; m: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) throw new Error(`Invalid month: ${ym}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw new Error(`Invalid month: ${ym}`);
  return { y, m };
}

/** Instant corresponding to Athens wall-clock y-m-d h:mi:s. */
export function athensLocalToUtc(
  y: number,
  month: number,
  day: number,
  h = 0,
  mi = 0,
  s = 0,
): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const localLabel = `${y}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
  for (const offset of ["+02:00", "+03:00"] as const) {
    const candidate = new Date(`${localLabel}${offset}`);
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: ATHENS,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(candidate).map((p) => [p.type, p.value]),
    );
    if (
      Number(parts.year) === y &&
      Number(parts.month) === month &&
      Number(parts.day) === day &&
      Number(parts.hour) === h &&
      Number(parts.minute) === mi &&
      Number(parts.second) === s
    ) {
      return candidate;
    }
  }
  return new Date(`${localLabel}+02:00`);
}

export function monthBoundsAthens(ym: string): { start: Date; end: Date } {
  const { y, m } = parseYearMonth(ym);
  const start = athensLocalToUtc(y, m, 1, 0, 0, 0);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = athensLocalToUtc(nextY, nextM, 1, 0, 0, 0);
  return { start, end };
}

export function currentAthensYearMonth(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}`;
}

export function addMonthsYm(ym: string, delta: number): string {
  const { y, m } = parseYearMonth(ym);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function listYearMonths(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addMonthsYm(cur, 1);
  }
  return out;
}

export function lastCompletedAthensMonth(now = new Date()): string {
  return addMonthsYm(currentAthensYearMonth(now), -1);
}

export function defaultSeriesRange(now = new Date()): { from: string; to: string } {
  const to = lastCompletedAthensMonth(now);
  return { from: addMonthsYm(to, -11), to };
}

export function tenureBucketMonths(
  months: number | null,
): "0-3" | "4-12" | "13+" {
  if (months == null || months <= 3) return "0-3";
  if (months <= 12) return "4-12";
  return "13+";
}
