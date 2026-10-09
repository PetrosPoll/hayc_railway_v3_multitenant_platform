import { useAuth } from "@/components/ui/authContext";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";

function isBlockingDialogOpen() {
  // Radix Dialog / AlertDialog content while open. These mark the rest of the
  // document inert, so the banner cannot receive hover — hide it instead.
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ),
  );
}

export function DemoBanner() {
  const { user, impersonation } = useAuth();
  const { t } = useTranslation();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [peekAway, setPeekAway] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const syncDialogState = () => {
      setDialogOpen(isBlockingDialogOpen());
    };

    syncDialogState();

    const observer = new MutationObserver(syncDialogState);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "role"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!peekAway || dialogOpen) return;

    const onMove = (e: MouseEvent) => {
      const height = bannerRef.current?.offsetHeight ?? 40;
      if (e.clientY > height + 8) {
        setPeekAway(false);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [peekAway, dialogOpen]);

  // Hide while admin is seeding via "View as customer" (ImpersonationBanner shows instead).
  if (!user?.isDemo || impersonation?.active) return null;

  const hidden = peekAway || dialogOpen;

  return (
    <div
      ref={bannerRef}
      className={`sticky top-0 z-[60] w-full bg-amber-500 text-amber-950 text-center text-sm font-medium px-3 py-2 transition-opacity duration-300 ease-out ${
        hidden ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="demo-banner"
      onMouseEnter={() => setPeekAway(true)}
    >
      {t("demo.banner") ||
        "Demo mode — explore freely. Changes are disabled. Ready to build yours? Sign up on hayc."}
    </div>
  );
}
