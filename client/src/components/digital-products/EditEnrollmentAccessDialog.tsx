import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { NormalizedEnrollment } from "@/components/digital-products/buyersTableUtils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  buyerId: string;
  enrollment: NormalizedEnrollment | null;
  onSaved: () => void;
};

export function EditEnrollmentAccessDialog({
  open,
  onOpenChange,
  siteId,
  buyerId,
  enrollment,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [accessMode, setAccessMode] = useState<"lifetime" | "limited">("lifetime");
  const [accessDays, setAccessDays] = useState("60");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!enrollment) return;
    if (enrollment.accessType === "limited" && enrollment.accessDays != null) {
      setAccessMode("limited");
      setAccessDays(String(enrollment.accessDays));
    } else {
      setAccessMode("lifetime");
      setAccessDays("60");
    }
  }, [enrollment, open]);

  const handleSave = async () => {
    if (!enrollment?.courseId || !buyerId) return;

    let payloadAccessDays: number | null = null;
    if (accessMode === "limited") {
      const days = Number.parseInt(accessDays, 10);
      if (!Number.isFinite(days) || days < 1) {
        toast({
          title: t("digitalProductsManagement.buyers.enrollments.accessInvalidDays"),
          variant: "destructive",
        });
        return;
      }
      payloadAccessDays = days;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/hdp/enrollments/${encodeURIComponent(siteId)}/access`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerId,
            courseId: enrollment.courseId,
            accessDays: payloadAccessDays,
          }),
        },
      );

      if (!res.ok) {
        let message = t("digitalProductsManagement.buyers.enrollments.accessUpdateFailed");
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
        title: t("digitalProductsManagement.buyers.enrollments.accessUpdateSuccess"),
      });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({
        title: t("digitalProductsManagement.buyers.enrollments.accessUpdateFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("digitalProductsManagement.buyers.enrollments.editAccessTitle")}
          </DialogTitle>
          <DialogDescription>
            {enrollment?.courseTitle
              ? t("digitalProductsManagement.buyers.enrollments.editAccessSubtitle", {
                  course: enrollment.courseTitle,
                })
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={accessMode === "lifetime" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccessMode("lifetime")}
            >
              {t("digitalProductsManagement.courseEditor.access.lifetime")}
            </Button>
            <Button
              type="button"
              variant={accessMode === "limited" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccessMode("limited")}
            >
              {t("digitalProductsManagement.courseEditor.access.limited")}
            </Button>
          </div>

          {accessMode === "limited" ? (
            <div className="space-y-2">
              <Label htmlFor="enrollment-access-days">
                {t("digitalProductsManagement.courseEditor.access.daysLabel")}
              </Label>
              <Input
                id="enrollment-access-days"
                type="number"
                min={1}
                step={1}
                value={accessDays}
                onChange={(e) => setAccessDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("digitalProductsManagement.buyers.enrollments.accessOverrideHint")}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("digitalProductsManagement.common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("digitalProductsManagement.common.saving")}
              </>
            ) : (
              t("digitalProductsManagement.common.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
