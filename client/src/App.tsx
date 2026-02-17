import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { NavMenu } from "@/components/ui/nav-menu";
import { Footer } from "@/components/ui/footer";
import { AuthProvider, useAuth } from "@/components/ui/authContext";
import { ProtectedRoute } from "@/components/ui/protected-route";
import { AdminRoute } from "@/components/ui/admin-route";
import { queryClient } from "./lib/queryClient";
import { initializeUTMCapture } from "./lib/utm";

// Page imports
import Onboarding from "./pages/onboarding";
import OnboardingLogoSuccess from "./pages/onboarding-logo-success";
import Contact from "./pages/contact";
import About from "./pages/about";
import Templates from "./pages/templates";
import TemplateDetail from "./pages/template-detail";
import PreCheckout from "./pages/pre-checkout";
import UpgradeConfirmation from "./pages/upgrade-confirmation";
import Success from "./pages/success";
import WebsiteCreation from "./pages/website-creation";
import WebsiteCreationEN from "./pages/website-creation-en";
import ReviewsProgram from "./pages/reviews-program";
import Home from "./pages/home";
import Auth from "./pages/auth";
import Dashboard from "./pages/dashboard";
import WebsitesList from "./pages/websites-list";
import WebsiteDashboard from "./pages/website-dashboard";
import EmailBuilderPage from "./pages/email-builder";
import CampaignAnalytics from "./pages/campaign-analytics";
import NotFound from "./pages/not-found";
import Admin from "./pages/admin";
import Profile from "./pages/profile";
import ResetPassword from "./pages/reset-password";
import ForgotPassword from "./pages/forgot-password";
import SkTransferProject from "./pages/projects/sktransfer";
import VayoProject from "./pages/projects/vayo";
import GoldenServicesProject from "./pages/projects/goldenservices";
import DelliosGardenExpertsProject from "./pages/projects/delliosgardenexperts";
import AnkologisticsProject from "./pages/projects/ankologistics";
import MarianthiKatsoudaProject from "./pages/projects/marianthikatsouda";
import CancelSubscriptionFeedback from "./pages/cancel-subscription-feedback";
import Legal from "./pages/legal";
import TermsOfService from "./pages/terms-of-service";
import PrivacyPolicy from "./pages/privacy-policy";
import CookiePolicy from "./pages/cookie-policy";
import BillingSubscriptionPolicy from "./pages/billing-subscription-policy";
import AcceptableUsePolicy from "./pages/acceptable-use-policy";
import "./i18n";
import AdminCampaigns from "./pages/admin-campaigns";
import AdminCampaignAnalytics from "./pages/admin-campaign-analytics";
import AdminContacts from "./pages/admin-contacts";
import AdminTags from "./pages/admin-tags";
import AdminTemplates from "./pages/admin-templates";
import AdminEmailBuilder from "./pages/admin-email-builder";
import UnsubscribePage from "./pages/unsubscribe";

// Footer wrapper component that conditionally renders footer
function ConditionalFooter() {
  const { user } = useAuth();
  const location = useLocation();

  // Hide footer for authenticated users on dashboard or onboarding page, and on email builder
  if (
    (user && (location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/'))) ||
    location.pathname === '/onboarding' ||
    location.pathname === '/fast-and-affordable-websites-book-a-call' ||
    location.pathname === '/fast-and-affordable-websites-book-a-call-en' ||
    location.pathname === '/reviews-program' ||
    location.pathname.includes('/email-builder') ||
    location.pathname.includes('/analytics') ||
    location.pathname === '/unsubscribe'
  ) {
    return null;
  }

  return <Footer />;
}

// NavMenu wrapper component that conditionally renders navigation
function ConditionalNavMenu() {
  const location = useLocation();

  // Hide navigation for onboarding, website-creation landing pages, website dashboard pages, and email builder
  if (
    location.pathname === '/onboarding' ||
    location.pathname === '/fast-and-affordable-websites-book-a-call' ||
    location.pathname === '/fast-and-affordable-websites-book-a-call-en' ||
    location.pathname.startsWith('/dashboard/website/') ||
    location.pathname.includes('/email-builder') ||
    location.pathname.includes('/analytics') ||
    location.pathname === '/unsubscribe'
  ) {
    return null;
  }

  return <NavMenu />;
}

// Protected Reviews Program Route Component
function ProtectedReviewsProgram() {
  return <ReviewsProgram />;
}

// Global scroll positions storage (outside component to persist between renders)
const scrollPositionsStorage = {
  positions: new Map(),

  save: (path, position) => {
    scrollPositionsStorage.positions.set(path, position);
    sessionStorage.setItem('scrollPositions', JSON.stringify(Array.from(scrollPositionsStorage.positions.entries())));
  },

  get: (path) => {
    const position = scrollPositionsStorage.positions.get(path);
    return position;
  },

  load: () => {
    const savedPositions = sessionStorage.getItem('scrollPositions');
    if (savedPositions) {
      const positions = new Map(JSON.parse(savedPositions));
      scrollPositionsStorage.positions = positions;
    }
  }
};

// Custom scroll management component
function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    // Load saved positions on mount
    scrollPositionsStorage.load();

    // Disable browser's automatic scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    let isNavigating = false;

    // Store scroll position before navigation
    const handleBeforeUnload = () => {
      const currentPath = window.location.pathname + window.location.search;
      scrollPositionsStorage.save(currentPath, window.scrollY);
    };

    // Handle browser navigation (back/forward) - just for logging
    const handlePopState = (event) => {
      console.log('🔙 Browser back/forward detected');
      isNavigating = true;

      setTimeout(() => {
        isNavigating = false;
      }, 150);
    };

    // Listen for scroll to save position
    const handleScroll = () => {
      if (!isNavigating) {
        const currentPath = location.pathname + location.search;
        scrollPositionsStorage.save(currentPath, window.scrollY);
      }
    };

    // Save current scroll position when leaving page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const currentPath = location.pathname + location.search;
        scrollPositionsStorage.save(currentPath, window.scrollY);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location]);

  useEffect(() => {
    // Handle route changes (this runs after navigation)
    const currentPath = location.pathname + location.search;

    // Always check for saved position first
    const savedPosition = scrollPositionsStorage.get(currentPath);

    // Immediately restore scroll position to prevent flash
    if (savedPosition !== undefined && savedPosition > 0) {
      // Set scroll position immediately
      window.scrollTo(0, savedPosition);
      // And again on next frame to ensure it sticks
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}

// Wrapper component to use hooks that need Router context
function AppContent() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Conditionally render NavMenu */}
      <ConditionalNavMenu />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/success" element={<Success />} />
          <Route path="/pre-checkout/:planId" element={<PreCheckout />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/:id" element={<TemplateDetail />} />
          <Route path="/fast-and-affordable-websites-book-a-call" element={<WebsiteCreation />} />
          <Route path="/fast-and-affordable-websites-book-a-call-en" element={<WebsiteCreationEN />} />
          <Route
            path="/reviews-program"
            element={
              <ProtectedRoute>
                <ProtectedReviewsProgram />
              </ProtectedRoute>
            }
          />
          <Route path="/projects/growthlabs" element={<SkTransferProject />} />
          <Route path="/projects/vayo" element={<VayoProject />} />
          <Route path="/projects/goldenservices" element={<GoldenServicesProject />} />
          <Route path="/projects/delliosgardenexperts" element={<DelliosGardenExpertsProject />} />
          <Route path="/projects/ankologistics" element={<AnkologisticsProject />} />
          <Route path="/projects/marianthikatsouda" element={<MarianthiKatsoudaProject />} />
          <Route path="/dashboard" element={
            <ProtectedRoute redirectAdminsToAdmin={true}>
              <WebsitesList />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/website/:websiteId" element={
            <ProtectedRoute redirectAdminsToAdmin={true}>
              <WebsiteDashboard />
            </ProtectedRoute>
          } />
          <Route path="/websites/:websiteId/email-builder" element={
            <ProtectedRoute redirectAdminsToAdmin={true}>
              <EmailBuilderPage />
            </ProtectedRoute>
          } />
          <Route path="/websites/:websiteId/campaigns/:campaignId/analytics" element={
            <ProtectedRoute redirectAdminsToAdmin={true}>
              <CampaignAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute redirectAdminsToAdmin={true}>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
          <Route path="/admin/email-builder" element={
            <AdminRoute>
              <AdminEmailBuilder />
            </AdminRoute>
          } />
          <Route path="/admin/campaigns" element={
            <AdminRoute>
              <AdminCampaigns />
            </AdminRoute>
          } />
          <Route path="/admin/campaigns/:campaignId/analytics" element={
            <AdminRoute>
              <AdminCampaignAnalytics />
            </AdminRoute>
          } />
          <Route path="/admin/contacts" element={
            <AdminRoute>
              <AdminContacts />
            </AdminRoute>
          } />
          <Route path="/admin/tags" element={
            <AdminRoute>
              <AdminTags />
            </AdminRoute>
          } />
          <Route path="/admin/templates" element={
            <AdminRoute>
              <AdminTemplates />
            </AdminRoute>
          } />
          <Route path="/upgrade-confirmation/:subscriptionId" element={
            <ProtectedRoute>
              <UpgradeConfirmation />
            </ProtectedRoute>
          } />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />
          <Route path="/onboarding-logo-success" element={
            <ProtectedRoute>
              <OnboardingLogoSuccess />
            </ProtectedRoute>
          } />
          <Route path="/cancel-subscription-feedback" element={
            <ProtectedRoute>
              <CancelSubscriptionFeedback />
            </ProtectedRoute>
          } />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/billing-subscription-policy" element={<BillingSubscriptionPolicy />} />
          <Route path="/acceptable-use-policy" element={<AcceptableUsePolicy />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {/* Conditionally render Footer */}
      <ConditionalFooter />
    </div>
  );
}

function App() {
  // Capture UTM parameters on initial load
  useEffect(() => {
    initializeUTMCapture();
  }, []);

  // Log when i18n is initialized and language is available
  useEffect(() => {
    console.log('App initialized with language:', i18n.language);

    // Add listener for language changes
    const handleLanguageChange = (lng: string) => {
      console.log('Language changed to:', lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <ScrollManager />
            <AppContent />
            <Toaster />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

export default App;