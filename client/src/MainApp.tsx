import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "@/main-app-fonts";
import { AuthProvider, useAuth } from "@/components/ui/authContext";
import { ProtectedRoute } from "@/components/ui/protected-route";
import { PublicOnlyRoute } from "@/components/ui/public-only-route";
import { AdminRoute } from "@/components/ui/admin-route";
import { CookieConsentProvider } from "@/components/ui/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { NavMenu } from "@/components/ui/nav-menu";
import { ImpersonationBanner } from "@/components/ui/impersonation-banner";
import { Footer } from "@/components/ui/footer";
import { queryClient } from "@/lib/queryClient";
import { impersonationRootStyle } from "@/lib/impersonation-layout";
import { PlatformAnalyticsTracker } from "@/components/PlatformAnalyticsTracker";

import GetStarted from "@/pages/get-started";
import GetStartedSuccess from "@/pages/get-started-success";
import GetStartedOnboarding from "@/pages/get-started-onboarding";
import GetStartedQuickQuestions from "@/pages/get-started-quick-questions";
import GetStartedWebsiteStructure from "@/pages/get-started-website-structure";
import GetStartedContentMedia from "@/pages/get-started-content-media";
import Contact from "@/pages/contact";
import About from "@/pages/about";
import Templates from "@/pages/templates";
import Pricing from "@/pages/pricing";
import TemplateDetail from "@/pages/template-detail";
import UpgradeConfirmation from "@/pages/upgrade-confirmation";
import Success from "@/pages/success";
import ReviewsProgram from "@/pages/reviews-program";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import WebsitesList from "@/pages/websites-list";
import WebsiteDashboard from "@/pages/website-dashboard";
import EmailBuilderPage from "@/pages/email-builder";
import CampaignAnalytics from "@/pages/campaign-analytics";
import NotFound from "@/pages/not-found";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import ResetPassword from "@/pages/reset-password";
import ForgotPassword from "@/pages/forgot-password";
import SkTransferProject from "@/pages/projects/sktransfer";
import VayoProject from "@/pages/projects/vayo";
import GoldenServicesProject from "@/pages/projects/goldenservices";
import DelliosGardenExpertsProject from "@/pages/projects/delliosgardenexperts";
import AnkologisticsProject from "@/pages/projects/ankologistics";
import MarianthiKatsoudaProject from "@/pages/projects/marianthikatsouda";
import CancelSubscriptionFeedback from "@/pages/cancel-subscription-feedback";
import Legal from "@/pages/legal";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import CookiePolicy from "@/pages/cookie-policy";
import BillingSubscriptionPolicy from "@/pages/billing-subscription-policy";
import AcceptableUsePolicy from "@/pages/acceptable-use-policy";
import AdminCampaigns from "@/pages/admin-campaigns";
import AdminCampaignAnalytics from "@/pages/admin-campaign-analytics";
import AdminContacts from "@/pages/admin-contacts";
import AdminTags from "@/pages/admin-tags";
import AdminTemplates from "@/pages/admin-templates";
import AdminEmailBuilder from "@/pages/admin-email-builder";
import UnsubscribePage from "@/pages/unsubscribe";

function ConditionalFooter() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    return null;
  }

  if (
    location.pathname === "/profile" ||
    location.pathname === "/get-started" ||
    location.pathname === "/get-started/onboarding" ||
    location.pathname === "/get-started/onboarding/quick-questions" ||
    location.pathname === "/get-started/onboarding/website-structure" ||
    location.pathname === "/get-started/onboarding/content-media" ||
    location.pathname === "/reviews-program" ||
    location.pathname.includes("/email-builder") ||
    location.pathname.includes("/analytics") ||
    location.pathname === "/unsubscribe"
  ) {
    return null;
  }

  return <Footer />;
}

function ConditionalNavMenu() {
  const location = useLocation();

  if (
    location.pathname === "/get-started" ||
    location.pathname === "/get-started/onboarding" ||
    location.pathname === "/get-started/onboarding/quick-questions" ||
    location.pathname === "/get-started/onboarding/website-structure" ||
    location.pathname === "/get-started/onboarding/content-media" ||
    location.pathname.startsWith("/dashboard/website/") ||
    location.pathname.includes("/email-builder") ||
    location.pathname.includes("/analytics") ||
    location.pathname === "/unsubscribe"
  ) {
    return null;
  }

  return <NavMenu />;
}

function ProtectedReviewsProgram() {
  return <ReviewsProgram />;
}

function MainAppContent() {
  const { impersonation } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden w-full"
      style={impersonationRootStyle(Boolean(impersonation?.active))}
    >
      <ImpersonationBanner />
      <ConditionalNavMenu />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<PublicOnlyRoute><Home /></PublicOnlyRoute>} />
          <Route path="/auth" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
          <Route path="/contact" element={<PublicOnlyRoute><Contact /></PublicOnlyRoute>} />
          <Route path="/about" element={<PublicOnlyRoute><About /></PublicOnlyRoute>} />
          <Route path="/success" element={<Success />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/get-started/success" element={<GetStartedSuccess />} />
          <Route
            path="/get-started/onboarding"
            element={
              <ProtectedRoute>
                <GetStartedOnboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/get-started/onboarding/quick-questions"
            element={
              <ProtectedRoute>
                <GetStartedQuickQuestions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/get-started/onboarding/website-structure"
            element={
              <ProtectedRoute>
                <GetStartedWebsiteStructure />
              </ProtectedRoute>
            }
          />
          <Route
            path="/get-started/onboarding/content-media"
            element={
              <ProtectedRoute>
                <GetStartedContentMedia />
              </ProtectedRoute>
            }
          />
          <Route path="/pre-checkout/:planId" element={<Navigate to="/get-started" replace />} />
          <Route path="/templates" element={<PublicOnlyRoute><Templates /></PublicOnlyRoute>} />
          <Route path="/pricing" element={<PublicOnlyRoute><Pricing /></PublicOnlyRoute>} />
          <Route path="/templates/:id" element={<PublicOnlyRoute><TemplateDetail /></PublicOnlyRoute>} />
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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute redirectAdminsToAdmin={true}>
                <WebsitesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/website/:websiteId"
            element={
              <ProtectedRoute redirectAdminsToAdmin={true}>
                <WebsiteDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/websites/:websiteId/email-builder"
            element={
              <ProtectedRoute redirectAdminsToAdmin={true}>
                <EmailBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/websites/:websiteId/campaigns/:campaignId/analytics"
            element={
              <ProtectedRoute redirectAdminsToAdmin={true}>
                <CampaignAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute redirectAdminsToAdmin={true}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/email-builder"
            element={
              <AdminRoute>
                <AdminEmailBuilder />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/campaigns"
            element={
              <AdminRoute>
                <AdminCampaigns />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/campaigns/:campaignId/analytics"
            element={
              <AdminRoute>
                <AdminCampaignAnalytics />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/contacts"
            element={
              <AdminRoute>
                <AdminContacts />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tags"
            element={
              <AdminRoute>
                <AdminTags />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/templates"
            element={
              <AdminRoute>
                <AdminTemplates />
              </AdminRoute>
            }
          />
          <Route
            path="/upgrade-confirmation/:subscriptionId"
            element={
              <ProtectedRoute>
                <UpgradeConfirmation />
              </ProtectedRoute>
            }
          />
          <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
          <Route path="/onboarding-logo-success" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/cancel-subscription-feedback"
            element={
              <ProtectedRoute>
                <CancelSubscriptionFeedback />
              </ProtectedRoute>
            }
          />
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
      <ConditionalFooter />
    </div>
  );
}

export default function MainApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CookieConsentProvider>
          <PlatformAnalyticsTracker />
          <MainAppContent />
          <Toaster />
        </CookieConsentProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
