import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { initializeUTMCapture } from "./lib/utm";
import { loadKeakScript } from "./lib/load-keak";
import LandingApp from "./LandingApp";
import "./i18n";

const MainApp = lazy(() => import("./MainApp"));

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

export default function App() {
  useEffect(() => {
    initializeUTMCapture();
    loadKeakScript();
  }, []);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      console.log("Language changed to:", lng);
    };

    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route
            path="/fast-and-affordable-websites-book-a-call/*"
            element={<LandingApp />}
          />
          <Route
            path="/fast-and-affordable-websites-book-a-call-en/*"
            element={<LandingApp forceEnglish />}
          />
          <Route
            path="*"
            element={
              <Suspense fallback={null}>
                <MainApp />
              </Suspense>
            }
          />
        </Routes>
      </Router>
    </I18nextProvider>
  );
}
