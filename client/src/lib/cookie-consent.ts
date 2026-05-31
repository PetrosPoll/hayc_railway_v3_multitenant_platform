export const COOKIE_CONSENT_STORAGE_KEY = "hayc_cookie_consent";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_UPDATED_EVENT = "hayc:cookie-consent-updated";

export const GA_MEASUREMENT_ID = "G-RGCJJSJEY0";
export const META_PIXEL_ID = "590733836695526";

export type CookieConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

let analyticsLoaded = false;
let marketingLoaded = false;

export function isTrackingEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    !hostname.includes("replit.dev")
  );
}

export function getStoredConsent(): CookieConsentPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CookieConsentPreferences;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(preferences: Pick<CookieConsentPreferences, "analytics" | "marketing">): CookieConsentPreferences {
  const stored: CookieConsentPreferences = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: stored }));
  return stored;
}

function loadGoogleAnalytics(): void {
  if (analyticsLoaded || typeof window === "undefined") return;
  analyticsLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};

function loadMetaPixel(): void {
  if (marketingLoaded || typeof window === "undefined") return;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue.push(args);
      }
    } as FbqStub;

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }

  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
  marketingLoaded = true;
}

export function applyConsent(preferences: CookieConsentPreferences): void {
  if (!isTrackingEnvironment()) return;

  if (preferences.analytics) {
    loadGoogleAnalytics();
  }

  if (preferences.marketing) {
    loadMetaPixel();
  }
}

export function consentRequiresReload(
  previous: CookieConsentPreferences | null,
  next: CookieConsentPreferences,
): boolean {
  if (!previous) return false;
  return (
    (previous.analytics && !next.analytics) ||
    (previous.marketing && !next.marketing)
  );
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqStub;
    _fbq?: FbqStub;
  }
}
