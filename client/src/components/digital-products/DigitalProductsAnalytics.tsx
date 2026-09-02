import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type HdpAnalyticsOverview = {
  totals: {
    enrolledBuyers: number;
    activeEnrollments: number;
    expiredEnrollments: number;
    enrollmentsLast30Days: number;
  };
  courses: Array<{
    courseId: string;
    title: string;
    enrollmentCount: number;
    avgCompletionPercent: number;
    completedCount: number;
  }>;
  recentActivity: Array<{
    buyerEmail: string;
    courseTitle: string;
    lastActivityAt: string;
    completionPercent: number;
  }>;
};

interface Props {
  siteId: string;
}

function formatDate(value: string | null | undefined, locale?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { dateStyle: "medium" });
}

export function DigitalProductsAnalytics({ siteId }: Props) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<HdpAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!siteId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hdp/analytics/${encodeURIComponent(siteId)}/overview`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }
      const json = (await res.json()) as HdpAnalyticsOverview;
      setData(json);
    } catch {
      setError(t("digitalProductsManagement.analytics.loadError"));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [siteId, t]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const sortedCourses = useMemo(() => {
    if (!data?.courses) return [];
    return [...data.courses].sort((a, b) => b.enrollmentCount - a.enrollmentCount);
  }, [data?.courses]);

  const recentActivity = useMemo(() => {
    return (data?.recentActivity ?? []).slice(0, 20);
  }, [data?.recentActivity]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 space-y-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" variant="outline" onClick={() => void fetchAnalytics()}>
            {t("digitalProductsManagement.common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const cards = [
    {
      label: t("digitalProductsManagement.analytics.cards.totalStudents"),
      value: data.totals.enrolledBuyers,
    },
    {
      label: t("digitalProductsManagement.analytics.cards.activeAccess"),
      value: data.totals.activeEnrollments,
    },
    {
      label: t("digitalProductsManagement.analytics.cards.newEnrollments30d"),
      value: data.totals.enrollmentsLast30Days,
    },
    {
      label: t("digitalProductsManagement.analytics.cards.expired"),
      value: data.totals.expiredEnrollments,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("digitalProductsManagement.analytics.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("digitalProductsManagement.analytics.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("digitalProductsManagement.analytics.coursesTable.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sortedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("digitalProductsManagement.analytics.coursesTable.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("digitalProductsManagement.analytics.coursesTable.course")}</TableHead>
                  <TableHead className="text-right">
                    {t("digitalProductsManagement.analytics.coursesTable.enrollments")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("digitalProductsManagement.analytics.coursesTable.avgCompletion")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("digitalProductsManagement.analytics.coursesTable.completed")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCourses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell className="font-medium">{course.title || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.enrollmentCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(course.avgCompletionPercent)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{course.completedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("digitalProductsManagement.analytics.recentActivity.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("digitalProductsManagement.analytics.recentActivity.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("digitalProductsManagement.analytics.recentActivity.email")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.analytics.recentActivity.course")}</TableHead>
                  <TableHead>{t("digitalProductsManagement.analytics.recentActivity.lastActivity")}</TableHead>
                  <TableHead className="text-right">
                    {t("digitalProductsManagement.analytics.recentActivity.completion")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((row, index) => (
                  <TableRow key={`${row.buyerEmail}-${row.courseTitle}-${index}`}>
                    <TableCell className="break-all">{row.buyerEmail || "—"}</TableCell>
                    <TableCell>{row.courseTitle || "—"}</TableCell>
                    <TableCell>{formatDate(row.lastActivityAt, i18n.language)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(row.completionPercent)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
