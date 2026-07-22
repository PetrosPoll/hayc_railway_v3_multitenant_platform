import i18n from 'i18next'; // Core i18n library
import { initReactI18next } from 'react-i18next'; // React integration
import LanguageDetector from 'i18next-browser-languagedetector'; // Detects browser language

// Landing slices only (landingPage + cookieConsent). Small, so they stay in the
// initial bundle for a fast landing page. The full translations are loaded lazily
// via loadFullTranslations() before the main app renders.
import enLanding from './locales/landing/en.json';
import grLanding from './locales/landing/gr.json';

i18n
  .use(LanguageDetector) // Auto-detects user's language from browser settings
  .use(initReactI18next) // Connects i18next to React
  .init({
    resources: {
      en: { translation: enLanding },
      gr: { translation: grLanding },
    },
    fallbackLng: "en", // Default to English if no matching language is found
    interpolation: { escapeValue: false }, // Allows variables inside translations (e.g., {{price}})
  });

let fullTranslationsPromise: Promise<void> | null = null;

async function applyFullTranslations(): Promise<void> {
  const [en, gr] = await Promise.all([
    import('./locales/en.json'),
    import('./locales/gr.json'),
  ]);
  const enData = (en as { default?: unknown }).default ?? en;
  const grData = (gr as { default?: unknown }).default ?? gr;
  i18n.addResourceBundle('en', 'translation', enData as object, true, true);
  i18n.addResourceBundle('gr', 'translation', grData as object, true, true);
}

/**
 * Loads the complete translation set (lazy chunk) and merges it into i18n.
 * Called before the main app renders so the landing bundle stays lean.
 */
export function loadFullTranslations(): Promise<void> {
  if (!fullTranslationsPromise) {
    fullTranslationsPromise = applyFullTranslations();
  }
  return fullTranslationsPromise;
}

// Dev: re-merge locale JSON after Vite HMR so newly added keys appear without a hard refresh.
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => {
    fullTranslationsPromise = applyFullTranslations();
  });
}

export default i18n;
