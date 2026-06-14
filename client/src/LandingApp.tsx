import { useEffect } from "react";
import "./landing.css";
import "@/landing-fonts";
import WebsiteCreationRoutes from "@/pages/website-creation-routes";
import { DeferredLandingCookieConsent } from "@/components/landing/deferred-landing-cookie-consent";
import { applyStoredConsentIfAny } from "@/lib/tracking";

type LandingAppProps = {
  forceEnglish?: boolean;
};

export default function LandingApp({ forceEnglish = false }: LandingAppProps) {
  useEffect(() => {
    applyStoredConsentIfAny();
  }, []);

  return (
    <DeferredLandingCookieConsent>
      <WebsiteCreationRoutes forceEnglish={forceEnglish} />
    </DeferredLandingCookieConsent>
  );
}
