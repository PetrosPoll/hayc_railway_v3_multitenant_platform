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

  const apply = () => {
    import("@/lib/cookie-consent").then(({ getStoredConsent, applyConsent }) => {
      const stored = getStoredConsent();
      if (stored) {
        applyConsent(stored);
      }
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(apply, { timeout: 4000 });
    return;
  }

  if (document.readyState === "complete") {
    window.setTimeout(apply, 0);
    return;
  }

  window.addEventListener("load", () => window.setTimeout(apply, 0), { once: true });
}
