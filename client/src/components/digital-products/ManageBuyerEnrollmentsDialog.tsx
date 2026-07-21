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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  isBuyerEnrolledInCourse,
  type NormalizedBuyer,
} from "@/components/digital-products/buyersTableUtils";
import type { Product } from "@/types/digital-products";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  buyer: NormalizedBuyer | null;
  courses: Product[];
  onChanged: () => void;
};

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

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      if (a.status !== b.status) return a.status === "published" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [courses]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90dvh] p-0 gap-0">
        <div className="shrink-0 px-6 pt-6 pb-4 pr-14">
          <DialogHeader className="text-left">
            <DialogTitle>{t("digitalProductsManagement.buyers.enrollments.title")}</DialogTitle>
            <DialogDescription>
              {t("digitalProductsManagement.buyers.enrollments.subtitle", { name: buyerLabel })}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-2">
          {sortedCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("digitalProductsManagement.buyers.enrollments.noCourses")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sortedCourses.map((course) => {
                const enrolled = buyer
                  ? isBuyerEnrolledInCourse(buyer, course.id, course.title)
                  : false;
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
                        {enrolled
                          ? ` · ${t("digitalProductsManagement.buyers.enrollments.enrolled")}`
                          : ` · ${t("digitalProductsManagement.buyers.enrollments.notEnrolled")}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={enrolled ? "outline" : "default"}
                      disabled={!buyer?.id || busy || pendingCourseId !== null}
                      onClick={() => void runEnrollment(course.id, enrolled)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : enrolled ? (
                        t("digitalProductsManagement.buyers.enrollments.unenroll")
                      ) : (
                        t("digitalProductsManagement.buyers.enrollments.enroll")
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("digitalProductsManagement.common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
