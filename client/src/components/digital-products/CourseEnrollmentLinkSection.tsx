import { useMemo, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { openHdpEnrollPage, resolveEnrollUrl } from "@/lib/hdp-enroll";

type Props = {
  siteId: string;
  courseId: string;
  enrollUrl?: string | null;
};

export function CourseEnrollmentLinkSection({ siteId, courseId, enrollUrl }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const link = useMemo(
    () =>
      resolveEnrollUrl({
        siteId,
        courseId,
        enrollUrl,
        returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    [siteId, courseId, enrollUrl],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: t("digitalProductsManagement.enroll.linkCopied") });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t("digitalProductsManagement.enroll.copyFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <Label htmlFor="course-enroll-url">{t("digitalProductsManagement.enroll.enrollmentLink")}</Label>
        <p className="text-sm text-muted-foreground mt-1">
          {t("digitalProductsManagement.enroll.enrollmentLinkHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="course-enroll-url" readOnly value={link} className="font-mono text-xs sm:text-sm" />
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied
              ? t("digitalProductsManagement.enroll.linkCopied")
              : t("digitalProductsManagement.enroll.copyLink")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              openHdpEnrollPage(
                { siteId, courseId, enrollUrl, preview: true },
                { newTab: true },
              )
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("digitalProductsManagement.enroll.previewLink")}
          </Button>
        </div>
      </div>
    </div>
  );
}
