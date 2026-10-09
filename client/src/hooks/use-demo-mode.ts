import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { readStoredImpersonation } from "@/lib/impersonation-storage";

/**
 * Demo portal users may browse but not mutate.
 *
 * - isDemo (read-only UI): only when the logged-in user has isDemo=true AND
 *   staff is NOT impersonating them.
 * - isStaffSeeding (bypass inactive-plan greyscale for seeding): only when
 *   impersonating a demo user. Live customer impersonation is unchanged.
 */
export function useDemoMode() {
  const { user, impersonation } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const isImpersonating = Boolean(
    impersonation?.active || readStoredImpersonation()?.active,
  );
  const accountIsDemo = Boolean(user?.isDemo);

  // Public demo visitor / demo login without impersonation → read-only UI
  const isDemo = accountIsDemo && !isImpersonating;

  // Admin seeding a demo via View as customer only (not live accounts)
  const isStaffSeeding = accountIsDemo && isImpersonating;

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

  return { isDemo, isStaffSeeding, blockIfDemo, notifyReadOnly };
}
