import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

/**
 * Demo portal users may browse but not mutate.
 * Returns helpers to disable UI and short-circuit click handlers.
 */
export function useDemoMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isDemo = Boolean(user?.isDemo);

  const notifyReadOnly = () => {
    toast({
      title: t("demo.readOnlyTitle") || "Demo is read-only",
      description:
        t("demo.readOnlyDescription") ||
        "You can explore this dashboard, but purchases, edits, and deletions are disabled.",
      variant: "destructive",
    });
  };

  /** Call at the start of a write action. Returns true if the action should abort. */
  const blockIfDemo = (): boolean => {
    if (!isDemo) return false;
    notifyReadOnly();
    return true;
  };

  return { isDemo, blockIfDemo, notifyReadOnly };
}
