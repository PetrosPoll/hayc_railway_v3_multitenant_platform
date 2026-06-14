import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const CookieConsentProvider = lazy(async () => {
  const module = await import("@/components/ui/cookie-consent");
  return { default: module.CookieConsentProvider };
});

type DeferredLandingCookieConsentProps = {
  children: ReactNode;
};

export function DeferredLandingCookieConsent({
  children,
}: DeferredLandingCookieConsentProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const enable = () => setEnabled(true);

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = window.setTimeout(enable, 1);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<>{children}</>}>
      <CookieConsentProvider>{children}</CookieConsentProvider>
    </Suspense>
  );
}
