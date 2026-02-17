import i18n from 'i18next'; // Core i18n library
import { initReactI18next } from 'react-i18next'; // React integration
import LanguageDetector from 'i18next-browser-languagedetector'; // Detects browser language

// Import translation files
import en from './locales/en.json';
import gr from './locales/gr.json';

i18n
  .use(LanguageDetector) // Auto-detects user's language from browser settings
  .use(initReactI18next) // Connects i18next to React
  .init({
    resources: {
      en: { translation: en }, // English translations
      gr: { translation: gr }, // Greek translations
    },
    fallbackLng: "en", // Default to English if no matching language is found
    interpolation: { escapeValue: false }, // Allows variables inside translations (e.g., {{price}})
  });

export default i18n;
