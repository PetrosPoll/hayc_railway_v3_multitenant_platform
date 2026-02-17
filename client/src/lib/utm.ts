const UTM_STORAGE_KEY = 'hayc_utm_params';
const UTM_EXPIRY_KEY = 'hayc_utm_expiry';
const UTM_EXPIRY_HOURS = 24;

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
}

export function captureUTMParams(): UTMParams | null {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: UTMParams = {};

  const paramKeys: (keyof UTMParams)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
  ];

  let hasParams = false;
  paramKeys.forEach((key) => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
      hasParams = true;
    }
  });

  if (hasParams) {
    const expiry = Date.now() + UTM_EXPIRY_HOURS * 60 * 60 * 1000;
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
      sessionStorage.setItem(UTM_EXPIRY_KEY, expiry.toString());
      console.log('[UTM] Captured and stored UTM params:', utmParams);
    } catch (e) {
      console.warn('[UTM] Failed to store UTM params:', e);
    }
    return utmParams;
  }

  return null;
}

export function getStoredUTMParams(): UTMParams | null {
  if (typeof window === 'undefined') return null;

  try {
    const expiryStr = sessionStorage.getItem(UTM_EXPIRY_KEY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() > expiry) {
        clearStoredUTMParams();
        return null;
      }
    }

    const storedParams = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (storedParams) {
      return JSON.parse(storedParams) as UTMParams;
    }
  } catch (e) {
    console.warn('[UTM] Failed to read stored UTM params:', e);
  }

  return null;
}

export function clearStoredUTMParams(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY);
    sessionStorage.removeItem(UTM_EXPIRY_KEY);
  } catch (e) {
    console.warn('[UTM] Failed to clear stored UTM params:', e);
  }
}

export function initializeUTMCapture(): UTMParams | null {
  const newParams = captureUTMParams();
  if (newParams) {
    return newParams;
  }
  return getStoredUTMParams();
}
