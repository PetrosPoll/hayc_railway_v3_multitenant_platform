/** Normalized enrolled course from HDP buyers payload. */
export interface EnrolledCourse {
  id: string | null;
  title: string;
}

/** Normalized row for HDP GET /internal/sites/:siteId/buyers (shape may vary). */
export interface NormalizedBuyer {
  id: string;
  name: string | null;
  email: string;
  enrolledCourses: EnrolledCourse[];
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

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseEnrolledCourses(raw: Record<string, unknown>): EnrolledCourse[] {
  const out: EnrolledCourse[] = [];
  const seen = new Set<string>();

  const push = (id: string | null, title: string) => {
    const t = title.trim();
    if (!t && !id) return;
    const key = id ?? `title:${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, title: t || "—" });
  };

  if (Array.isArray(raw.courses)) {
    for (const item of raw.courses as unknown[]) {
      if (typeof item === "string" && item.trim()) {
        push(null, item);
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const c = item as Record<string, unknown>;
        const id = asId(c.id ?? c.courseId ?? c.course_id);
        const title =
          (typeof c.title === "string" && c.title) ||
          (typeof c.name === "string" && c.name) ||
          "";
        push(id, title);
      }
    }
  }

  if (Array.isArray(raw.enrollments)) {
    for (const item of raw.enrollments as unknown[]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const e = item as Record<string, unknown>;
      const course =
        e.course && typeof e.course === "object" && !Array.isArray(e.course)
          ? (e.course as Record<string, unknown>)
          : null;
      const id = asId(e.courseId ?? e.course_id ?? course?.id ?? course?.courseId);
      const title =
        (typeof e.courseTitle === "string" && e.courseTitle) ||
        (typeof e.title === "string" && e.title) ||
        (typeof course?.title === "string" && course.title) ||
        (typeof course?.name === "string" && course.name) ||
        "";
      push(id, title);
    }
  }

  if (Array.isArray(raw.courseTitles)) {
    for (const title of raw.courseTitles as unknown[]) {
      if (typeof title === "string" && title.trim()) push(null, title);
    }
  }

  if (Array.isArray(raw.enrolledCourses)) {
    for (const item of raw.enrolledCourses as unknown[]) {
      if (typeof item === "string" && item.trim()) {
        push(null, item);
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const c = item as Record<string, unknown>;
        push(asId(c.id ?? c.courseId), typeof c.title === "string" ? c.title : typeof c.name === "string" ? c.name : "");
      }
    }
  }

  if (Array.isArray(raw.courseIds)) {
    for (const idRaw of raw.courseIds as unknown[]) {
      const id = asId(idRaw);
      if (id) push(id, "");
    }
  }

  return out;
}

function normalizeOne(raw: Record<string, unknown>): NormalizedBuyer {
  const id = asId(raw.id ?? raw.buyerId ?? raw.buyer_id) ?? "";
  const email = typeof raw.email === "string" ? raw.email : "";
  const nameRaw = raw.name ?? raw.fullName;
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
  const enrolledCourses = parseEnrolledCourses(raw);

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
    id,
    name,
    email,
    enrolledCourses,
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

export function formatCoursesCell(
  enrolledCourses: EnrolledCourse[],
  tCoursesCount: (count: number) => string
): string {
  const titles = enrolledCourses.map((c) => c.title).filter((t) => t && t !== "—");
  if (titles.length === 0) return "—";
  const joined = titles.join(", ");
  if (joined.length <= MAX_COURSES_JOIN_LEN) return joined;
  return tCoursesCount(titles.length);
}

export function formatTotalSpent(euroStr: string, tFree: string): string {
  const n = Number.parseFloat(euroStr);
  if (!Number.isFinite(n) || n === 0) return tFree;
  return `€${euroStr}`;
}

export function isBuyerEnrolledInCourse(buyer: NormalizedBuyer, courseId: string, courseTitle?: string): boolean {
  const id = courseId.trim();
  if (buyer.enrolledCourses.some((c) => c.id && c.id === id)) return true;
  if (courseTitle) {
    const needle = courseTitle.trim().toLowerCase();
    if (needle && buyer.enrolledCourses.some((c) => !c.id && c.title.trim().toLowerCase() === needle)) {
      return true;
    }
  }
  return false;
}
