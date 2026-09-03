import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { HdpEnrollmentWidgetModal } from "@/components/digital-products/HdpEnrollmentWidgetModal";
import { HdpPurchaseSuccessBanner } from "@/components/digital-products/HdpPurchaseSuccessBanner";
import { buildHdpWidgetUrl } from "@/lib/hdp-widget";

type OpenParams = {
  siteId: string;
  courseId: string;
  preview?: boolean;
  returnUrl?: string;
};

type HdpWidgetHostContextValue = {
  openEnrollment: (params: OpenParams) => void;
  closeEnrollment: () => void;
  buildWidgetUrl: typeof buildHdpWidgetUrl;
};

const HdpWidgetHostContext = createContext<HdpWidgetHostContextValue | null>(null);

type Props = {
  children?: ReactNode;
  /** When set, shows purchase success banner for ?purchase=success */
  showPurchaseBanner?: boolean;
};

/**
 * Host shell for HDP enrollment widget: modal iframe + postMessage handling + optional purchase banner.
 * Mount once on pages where buyers can enroll (course pages, site layout).
 */
export function HdpWidgetHost({ children, showPurchaseBanner = true }: Props) {
  const [widget, setWidget] = useState<OpenParams | null>(null);

  const openEnrollment = useCallback((params: OpenParams) => {
    setWidget(params);
  }, []);

  const closeEnrollment = useCallback(() => {
    setWidget(null);
  }, []);

  const contextValue = useMemo(
    () => ({ openEnrollment, closeEnrollment, buildWidgetUrl: buildHdpWidgetUrl }),
    [openEnrollment, closeEnrollment],
  );

  return (
    <HdpWidgetHostContext.Provider value={contextValue}>
      {showPurchaseBanner ? <HdpPurchaseSuccessBanner /> : null}
      {children}
      <HdpEnrollmentWidgetModal
        open={!!widget}
        onOpenChange={(next) => {
          if (!next) closeEnrollment();
        }}
        siteId={widget?.siteId ?? ""}
        courseId={widget?.courseId ?? null}
        preview={widget?.preview}
        returnUrl={widget?.returnUrl}
      />
    </HdpWidgetHostContext.Provider>
  );
}

export function useHdpWidgetHost(): HdpWidgetHostContextValue {
  const ctx = useContext(HdpWidgetHostContext);
  if (!ctx) {
    throw new Error("useHdpWidgetHost must be used within HdpWidgetHost");
  }
  return ctx;
}

export function useHdpWidgetHostOptional(): HdpWidgetHostContextValue | null {
  return useContext(HdpWidgetHostContext);
}
