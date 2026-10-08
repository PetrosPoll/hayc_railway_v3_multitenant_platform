import { useAuth } from "@/components/ui/authContext";
import { useTranslation } from "react-i18next";

export function DemoBanner() {
  const { user } = useAuth();
  const { t } = useTranslation();

  if (!user?.isDemo) return null;

  return (
    <div
      className="sticky top-0 z-[60] w-full bg-amber-500 text-amber-950 text-center text-sm font-medium px-3 py-2"
      data-testid="demo-banner"
    >
      {t("demo.banner") ||
        "Demo mode — explore freely. Changes are disabled. Ready to build yours? Sign up on hayc."}
    </div>
  );
}
