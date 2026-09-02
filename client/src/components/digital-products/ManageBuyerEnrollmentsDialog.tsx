import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  formatEnrollmentAccessLabel,
  getBuyerEnrollment,
  isBuyerEnrolledInCourse,
  type NormalizedBuyer,
  type NormalizedEnrollment,
} from "@/components/digital-products/buyersTableUtils";
import { EditEnrollmentAccessDialog } from "@/components/digital-products/EditEnrollmentAccessDialog";
import type { Product } from "@/types/digital-products";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  buyer: NormalizedBuyer | null;
  courses: Product[];
  onChanged: () => void;
};

function CompletionBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-[8rem]">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{clamped}%</span>
      </div>
    </div>
  );
}

export function ManageBuyerEnrollmentsDialog({
  open,
  onOpenChange,
  siteId,
  buyer,
  courses,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);
  const [editEnrollment, setEditEnrollment] = useState<NormalizedEnrollment | null>(null);
  const [confirmUnenrollCourse, setConfirmUnenrollCourse] = useState<Product | null>(null);

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.status !== b.status) return a.status === "published" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [courses]);

  const { enrolledCourses, availableCourses } = useMemo(() => {
    const enrolled: Product[] = [];
    const available: Product[] = [];
    for (const course of sortedCourses) {
      if (buyer && isBuyerEnrolledInCourse(buyer, course.id, course.title)) {
        enrolled.push(course);
      } else {
        available.push(course);
      }
    }
    return { enrolledCourses: enrolled, availableCourses: available };
  }, [sortedCourses, buyer]);

  const buyerLabel = buyer?.name?.trim() || buyer?.email || "—";

  const runEnrollment = async (courseId: string, enrolled: boolean) => {
    if (!buyer?.id) return;
    setPendingCourseId(courseId);
    try {
      const res = await fetch(`/api/hdp/enrollments/${encodeURIComponent(siteId)}`, {
        method: enrolled ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: buyer.id, courseId }),
      });

      if (!res.ok) {
        let message = enrolled
          ? t("digitalProductsManagement.buyers.enrollments.unenrollFailed")
          : t("digitalProductsManagement.buyers.enrollments.enrollFailed");
        try {
          const body = await res.json();
          if (body && typeof body.error === "string") message = body.error;
        } catch {
          // keep default
        }
        toast({ title: message, variant: "destructive" });
        return;
      }

      toast({
        title: enrolled
          ? t("digitalProductsManagement.buyers.enrollments.unenrollSuccess")
          : t("digitalProductsManagement.buyers.enrollments.enrollSuccess"),
      });
      onChanged();
      if (enrolled) setConfirmUnenrollCourse(null);
    } catch {
      toast({
        title: enrolled
          ? t("digitalProductsManagement.buyers.enrollments.unenrollFailed")
          : t("digitalProductsManagement.buyers.enrollments.enrollFailed"),
        variant: "destructive",
      });
    } finally {
      setPendingCourseId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90dvh] p-0 gap-0">
          <div className="shrink-0 px-6 pt-6 pb-4 pr-14">
            <DialogHeader className="text-left">
              <DialogTitle>{t("digitalProductsManagement.buyers.enrollments.title")}</DialogTitle>
              <DialogDescription>
                {t("digitalProductsManagement.buyers.enrollments.subtitle", { name: buyerLabel })}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-2 space-y-6">
            {sortedCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("digitalProductsManagement.buyers.enrollments.noCourses")}
              </p>
            ) : (
              <>
                {enrolledCourses.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {t("digitalProductsManagement.buyers.enrollments.enrolledSection")}
                    </p>
                    <ul className="divide-y rounded-md border">
                      {enrolledCourses.map((course) => {
                        const enrollment = buyer
                          ? getBuyerEnrollment(buyer, course.id, course.title)
                          : undefined;
                        const busy = pendingCourseId === course.id;
                        return (
                          <li key={course.id} className="px-3 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">{course.title || "—"}</p>
                                  {enrollment?.accessExpired ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs bg-red-600 hover:bg-red-600"
                                    >
                                      {t("digitalProductsManagement.buyers.enrollments.expired")}
                                    </Badge>
                                  ) : null}
                                </div>
                                {enrollment ? (
                                  <>
                                    <p
                                      className={cn(
                                        "text-xs font-medium",
                                        enrollment.accessExpired
                                          ? "text-muted-foreground line-through"
                                          : enrollment.accessType === "lifetime" ||
                                              enrollment.accessDays == null
                                            ? "text-green-700 dark:text-green-500"
                                            : "text-muted-foreground",
                                      )}
                                    >
                                      {formatEnrollmentAccessLabel(enrollment, t)}
                                    </p>
                                    <CompletionBar
                                      percent={enrollment.completionPercent}
                                      label={t(
                                        "digitalProductsManagement.buyers.enrollments.progressLabel",
                                      )}
                                    />
                                  </>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                                {enrollment ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={!buyer?.id || busy}
                                    onClick={() => setEditEnrollment(enrollment)}
                                  >
                                    {t("digitalProductsManagement.buyers.enrollments.editAccess")}
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={!buyer?.id || busy || pendingCourseId !== null}
                                  onClick={() => setConfirmUnenrollCourse(course)}
                                >
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    t("digitalProductsManagement.buyers.enrollments.unenroll")
                                  )}
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {availableCourses.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {t("digitalProductsManagement.buyers.enrollments.availableSection")}
                    </p>
                    <ul className="divide-y rounded-md border">
                      {availableCourses.map((course) => {
                        const busy = pendingCourseId === course.id;
                        return (
                          <li
                            key={course.id}
                            className="flex items-center justify-between gap-3 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{course.title || "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {course.status === "published"
                                  ? t("digitalProductsManagement.status.published")
                                  : t("digitalProductsManagement.status.draft")}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!buyer?.id || busy || pendingCourseId !== null}
                              onClick={() => void runEnrollment(course.id, false)}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                t("digitalProductsManagement.buyers.enrollments.enroll")
                              )}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("digitalProductsManagement.common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditEnrollmentAccessDialog
        open={!!editEnrollment}
        onOpenChange={(next) => {
          if (!next) setEditEnrollment(null);
        }}
        siteId={siteId}
        buyerId={buyer?.id ?? ""}
        enrollment={editEnrollment}
        onSaved={onChanged}
      />

      <AlertDialog
        open={!!confirmUnenrollCourse}
        onOpenChange={(next) => {
          if (!next && !pendingCourseId) setConfirmUnenrollCourse(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("digitalProductsManagement.buyers.enrollments.unenrollConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("digitalProductsManagement.buyers.enrollments.unenrollConfirmDescription", {
                name: buyerLabel,
                course: confirmUnenrollCourse?.title || "—",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pendingCourseId}>
              {t("digitalProductsManagement.common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!pendingCourseId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmUnenrollCourse) {
                  void runEnrollment(confirmUnenrollCourse.id, true);
                }
              }}
            >
              {pendingCourseId === confirmUnenrollCourse?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("digitalProductsManagement.buyers.enrollments.unenrollConfirmAction")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
