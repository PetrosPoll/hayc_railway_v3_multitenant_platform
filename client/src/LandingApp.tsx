import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsentProvider } from "@/components/ui/cookie-consent";
import "@/landing-fonts";

const WebsiteCreationRoutes = lazy(() => import("@/pages/website-creation-routes"));

type LandingAppProps = {
  forceEnglish?: boolean;
};

export default function LandingApp({ forceEnglish = false }: LandingAppProps) {
  return (
    <CookieConsentProvider>
      <Suspense fallback={null}>
        <WebsiteCreationRoutes forceEnglish={forceEnglish} />
      </Suspense>
      <Toaster />
    </CookieConsentProvider>
  );
}
