/** Normalized row for HDP GET /internal/sites/:siteId/buyers (shape may vary). */
export interface NormalizedBuyer {
  name: string | null;
  email: string;
  courseTitles: string[];
  /** Euro amount as from HDP, e.g. "500.00" */
  totalSpent: string;
  memberSince: Date | null;
}

const MAX_COURSES_JOIN_LEN = 80;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function earliestDate(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

function normalizeOne(raw: Record<string, unknown>): NormalizedBuyer {
  const email = typeof raw.email === "string" ? raw.email : "";
  const nameRaw = raw.name ?? raw.fullName;
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;

  let courseTitles: string[] = [];
  if (Array.isArray(raw.courseTitles)) {
    courseTitles = (raw.courseTitles as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } else if (Array.isArray(raw.courses)) {
    courseTitles = (raw.courses as Record<string, unknown>[])
      .map((c) => (typeof c.title === "string" ? c.title : typeof c.name === "string" ? c.name : ""))
      .filter(Boolean);
  } else if (Array.isArray(raw.enrolledCourses)) {
    courseTitles = (raw.enrolledCourses as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }

  const totalRaw = raw.totalSpent ?? raw.total_spent;
  let totalSpent = "0.00";
  if (typeof totalRaw === "number" && Number.isFinite(totalRaw)) {
    totalSpent = totalRaw.toFixed(2);
  } else if (typeof totalRaw === "string" && totalRaw.trim()) {
    totalSpent = totalRaw.trim();
  }

  let memberSince: Date | null = null;
  if (typeof raw.enrolledAt === "string") {
    memberSince = parseDate(raw.enrolledAt);
  }
  if (Array.isArray(raw.enrollments)) {
    const fromEnroll = (raw.enrollments as Record<string, unknown>[])
      .map((e) => parseDate(e.enrolledAt ?? e.createdAt))
      .filter((d): d is Date => d != null);
    memberSince = earliestDate([memberSince, ...fromEnroll]);
  }
  if (memberSince === null && Array.isArray(raw.enrollmentDates)) {
    const ds = (raw.enrollmentDates as unknown[]).map((x) => parseDate(x)).filter((d): d is Date => d != null);
    memberSince = earliestDate(ds);
  }

  return {
    name,
    email,
    courseTitles,
    totalSpent,
    memberSince,
  };
}

export function normalizeBuyersResponse(data: unknown): NormalizedBuyer[] {
  const list = Array.isArray(data) ? data : (data as { buyers?: unknown })?.buyers;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x))
    .map(normalizeOne);
}

export function formatCoursesCell(titles: string[], tCoursesCount: (count: number) => string): string {
  const filtered = titles.filter(Boolean);
  if (filtered.length === 0) return "—";
  const joined = filtered.join(", ");
  if (joined.length <= MAX_COURSES_JOIN_LEN) return joined;
  return tCoursesCount(filtered.length);
}

export function formatTotalSpent(euroStr: string, tFree: string): string {
  const n = Number.parseFloat(euroStr);
  if (!Number.isFinite(n) || n === 0) return tFree;
  return `€${euroStr}`;
}
