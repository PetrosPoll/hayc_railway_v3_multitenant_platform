import { CheckCircle2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useHdpPurchaseSuccess } from "@/hooks/use-hdp-purchase-success";

export function HdpPurchaseSuccessBanner() {
  const { t } = useTranslation();
  const { visible, dismiss } = useHdpPurchaseSuccess();

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-100"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
      <p className="flex-1 text-sm font-medium">
        {t("digitalProductsManagement.widget.purchaseSuccess")}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-green-800 hover:bg-green-100 hover:text-green-900 dark:text-green-200 dark:hover:bg-green-900/40"
        aria-label={t("digitalProductsManagement.common.dismiss")}
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
