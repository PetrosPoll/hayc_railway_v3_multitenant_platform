/** Normalized enrolled course from HDP buyers payload. */
export interface EnrolledCourse {
  id: string | null;
  title: string;
}

export type CourseAccessType = "lifetime" | "limited";

/** Per-enrollment details from HDP buyers API. */
export interface NormalizedEnrollment {
  courseId: string | null;
  courseTitle: string;
  enrolledAt: Date | null;
  completionPercent: number;
  accessType: CourseAccessType | null;
  accessDays: number | null;
  accessExpiresAt: Date | null;
  daysRemaining: number | null;
  accessExpired: boolean;
  hasAccess: boolean;
}

/** Normalized row for HDP GET /internal/sites/:siteId/buyers (shape may vary). */
export interface NormalizedBuyer {
  id: string;
  name: string | null;
  email: string;
  enrolledCourses: EnrolledCourse[];
  enrollments: NormalizedEnrollment[];
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

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseAccessType(value: unknown): CourseAccessType | null {
  if (value === "lifetime" || value === "limited") return value;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseEnrollmentRecord(raw: Record<string, unknown>): NormalizedEnrollment | null {
  const courseObj =
    raw.course && typeof raw.course === "object" && !Array.isArray(raw.course)
      ? (raw.course as Record<string, unknown>)
      : null;

  const courseId = asId(raw.courseId ?? raw.course_id ?? courseObj?.id ?? courseObj?.courseId);
  const courseTitle =
    (typeof raw.courseTitle === "string" && raw.courseTitle) ||
    (typeof raw.title === "string" && raw.title) ||
    (typeof courseObj?.title === "string" && courseObj.title) ||
    (typeof courseObj?.name === "string" && courseObj.name) ||
    "";

  if (!courseId && !courseTitle.trim()) return null;

  const completionRaw = parseNumber(raw.completionPercent ?? raw.completion_percent) ?? 0;
  const completionPercent = Math.min(100, Math.max(0, Math.round(completionRaw)));

  const accessType = parseAccessType(raw.accessType ?? raw.access_type);
  const accessDays = parseNumber(raw.accessDays ?? raw.access_days);
  const daysRemainingRaw = parseNumber(raw.daysRemaining ?? raw.days_remaining);
  const daysRemaining =
    daysRemainingRaw != null ? Math.max(0, Math.round(daysRemainingRaw)) : null;

  return {
    courseId,
    courseTitle: courseTitle.trim() || "—",
    enrolledAt: parseDate(raw.enrolledAt ?? raw.enrolled_at ?? raw.createdAt ?? raw.created_at),
    completionPercent,
    accessType,
    accessDays,
    accessExpiresAt: parseDate(raw.accessExpiresAt ?? raw.access_expires_at ?? raw.expiresAt),
    daysRemaining,
    accessExpired: raw.accessExpired === true || raw.access_expired === true,
    hasAccess: raw.hasAccess !== false && raw.has_access !== false,
  };
}

function enrollmentsToCourses(enrollments: NormalizedEnrollment[]): EnrolledCourse[] {
  const out: EnrolledCourse[] = [];
  const seen = new Set<string>();
  for (const e of enrollments) {
    const key = e.courseId ?? `title:${e.courseTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: e.courseId, title: e.courseTitle });
  }
  return out;
}

function parseEnrollments(raw: Record<string, unknown>): NormalizedEnrollment[] {
  if (!Array.isArray(raw.enrollments)) return [];
  return raw.enrollments
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x))
    .map(parseEnrollmentRecord)
    .filter((e): e is NormalizedEnrollment => e != null);
}

function parseEnrolledCoursesLegacy(raw: Record<string, unknown>): EnrolledCourse[] {
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

function earliestDate(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

function normalizeOne(raw: Record<string, unknown>): NormalizedBuyer {
  const id = asId(raw.id ?? raw.buyerId ?? raw.buyer_id) ?? "";
  const email = typeof raw.email === "string" ? raw.email : "";
  const nameRaw = raw.name ?? raw.fullName;
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;

  const enrollments = parseEnrollments(raw);
  const enrolledCourses =
    enrollments.length > 0 ? enrollmentsToCourses(enrollments) : parseEnrolledCoursesLegacy(raw);

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
  if (enrollments.length > 0) {
    memberSince = earliestDate([memberSince, ...enrollments.map((e) => e.enrolledAt)]);
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
    enrollments,
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
  tCoursesCount: (count: number) => string,
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
  if (buyer.enrollments.length > 0) {
    return buyer.enrollments.some(
      (e) => (e.courseId && e.courseId === id) ||
        (courseTitle &&
          !e.courseId &&
          e.courseTitle.trim().toLowerCase() === courseTitle.trim().toLowerCase()),
    );
  }
  if (buyer.enrolledCourses.some((c) => c.id && c.id === id)) return true;
  if (courseTitle) {
    const needle = courseTitle.trim().toLowerCase();
    if (needle && buyer.enrolledCourses.some((c) => !c.id && c.title.trim().toLowerCase() === needle)) {
      return true;
    }
  }
  return false;
}

export function getBuyerEnrollment(
  buyer: NormalizedBuyer,
  courseId: string,
  courseTitle?: string,
): NormalizedEnrollment | undefined {
  const id = courseId.trim();
  return buyer.enrollments.find(
    (e) =>
      (e.courseId && e.courseId === id) ||
      (courseTitle &&
        e.courseTitle.trim().toLowerCase() === courseTitle.trim().toLowerCase()),
  );
}

export function formatEnrollmentAccessLabel(
  enrollment: NormalizedEnrollment,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (enrollment.accessExpired) {
    return t("digitalProductsManagement.buyers.enrollments.expired");
  }
  if (enrollment.accessType === "lifetime" || enrollment.accessDays == null) {
    return t("digitalProductsManagement.courseEditor.access.lifetime");
  }
  if (enrollment.daysRemaining != null) {
    return t("digitalProductsManagement.buyers.enrollments.daysRemaining", {
      count: enrollment.daysRemaining,
    });
  }
  if (enrollment.accessExpiresAt) {
    return t("digitalProductsManagement.buyers.enrollments.expiresAt", {
      date: enrollment.accessExpiresAt.toLocaleDateString(undefined, { dateStyle: "medium" }),
    });
  }
  return t("digitalProductsManagement.buyers.enrollments.limitedDays", {
    count: enrollment.accessDays,
  });
}
