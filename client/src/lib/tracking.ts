export function trackLeadConversion(): void {
  if (typeof window === "undefined") return;

  if (typeof window.fbq === "function") {
    window.fbq("track", "Lead");
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead");
  }
}

export function applyStoredConsentIfAny(): void {
  if (typeof window === "undefined") return;

  import("@/lib/cookie-consent").then(({ getStoredConsent, applyConsent }) => {
    const stored = getStoredConsent();
    if (stored) {
      applyConsent(stored);
    }
  });
}
