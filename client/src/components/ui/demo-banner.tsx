import { useAuth } from "@/components/ui/authContext";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";

export function DemoBanner() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [peekAway, setPeekAway] = useState(false);

  useEffect(() => {
    if (!peekAway) return;

    const onMove = (e: MouseEvent) => {
      const height = bannerRef.current?.offsetHeight ?? 40;
      // Restore once the cursor leaves the banner's vertical band
      if (e.clientY > height + 8) {
        setPeekAway(false);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [peekAway]);

  if (!user?.isDemo) return null;

  return (
    <div
      ref={bannerRef}
      className={`sticky top-0 z-[60] w-full bg-amber-500 text-amber-950 text-center text-sm font-medium px-3 py-2 transition-opacity duration-300 ease-out ${
        peekAway ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="demo-banner"
      onMouseEnter={() => setPeekAway(true)}
    >
      {t("demo.banner") ||
        "Demo mode — explore freely. Changes are disabled. Ready to build yours? Sign up on hayc."}
    </div>
  );
}
