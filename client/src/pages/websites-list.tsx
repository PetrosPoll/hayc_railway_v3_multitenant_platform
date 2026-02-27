import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Plus, ExternalLink, Gift, Star, CreditCard, BarChart3, Mail, AlertCircle, CalendarDays } from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { BOOKING_APP_BASE_URL } from "@/lib/utils";

type Website = {
  id: number;
  userId: number;
  domain: string;
  projectName?: string | null;
  currentStage: number;
  userEmail: string;
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  selectedTemplateId: number | null;
  onboardingStatus: string | null;
  bookingEnabled?: boolean;
  stages: Array<{
    id: number;
    websiteProgressId: number;
    stageNumber: number;
    title: string;
    description: string;
    status: string;
    completedAt: string | null;
  }>;
};

type UserResponse = {
  user: any;
  subscriptions: any[];
  permissions: any;
};

export default function WebsitesList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: websites, isLoading, refetch } = useQuery<Website[]>({
    queryKey: ["/api/admin/websites"],
    queryFn: async () => {
      const response = await fetch("/api/admin/websites", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch websites");
      }
      const data = await response.json();

      // Extract websites array from response object
      return Array.isArray(data?.websites) ? data.websites : [];
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Refetch websites when navigating to dashboard route
  useEffect(() => {
    if (location.pathname === "/dashboard") {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
    }
  }, [location.pathname, queryClient]);

  const { data: userData, isLoading: isLoadingUser } = useQuery<UserResponse>({
    queryKey: ["/api/user"],
  });

  const sortedWebsites = React.useMemo(() => {
    // Add extra defensive checks
    if (!websites || !Array.isArray(websites)) return [];

    // Filter to only show websites with onboardingStatus of 'draft' or 'completed'
    // Also include pending onboarding websites (domain ends with .pending-onboarding) - these don't have onboardingStatus yet
    // Also include legacy websites (null onboardingStatus with real domain) - created before onboarding form system
    const filteredWebsites = websites.filter((website) => {
      // Pending onboarding websites (new subscriptions) - identified by domain ending with .pending-onboarding
      // This is the only reliable indicator of a new pending onboarding website
      const isPendingOnboarding = website.domain.endsWith('.pending-onboarding');
      
      // Only show if:
      // 1. It's a pending onboarding website (domain ends with .pending-onboarding), OR
      // 2. It has explicit onboardingStatus of 'draft' or 'completed', OR
      // 3. It's a legacy website (null onboardingStatus with a real domain - not .pending-onboarding)
      if (isPendingOnboarding) {
        return true;
      }
      
      // Show draft or completed onboarding forms
      if (website.onboardingStatus === 'draft' || website.onboardingStatus === 'completed') {
        return true;
      }
      
      // Legacy websites: null onboardingStatus with a real domain (created before onboarding form system)
      if (website.onboardingStatus === null && !website.domain.endsWith('.pending-onboarding')) {
        return true;
      }
      
      return false;
    });

    // Only active ones first, keep the rest as is
    return [...filteredWebsites].sort((a, b) => {
      const aActive = a.subscriptionStatus?.toLowerCase() === "active";
      const bActive = b.subscriptionStatus?.toLowerCase() === "active";

      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [websites]);

  if (isLoading || isLoadingUser) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-websites" />
      </div>
    );
  }

  const hasActiveSubscriptions = userData?.subscriptions?.some(
    (sub) => sub.status === "active" || sub.status === "trialing"
  ) || false;

  const completedStages = (website: Website) => {
    return website.stages.filter((stage) => stage.status === "completed").length;
  };

  const totalStages = (website: Website) => {
    return website.stages.length;
  };

  const getProgressPercentage = (website: Website) => {
    const total = totalStages(website);
    if (total === 0) return 0;
    return Math.round((completedStages(website) / total) * 100);
  };

  const getSubscriptionStatusBadge = (status: string | null) => {
    if (!status) {
      return {
        variant: "secondary" as const,
        label: "No Subscription"
      };
    }

    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          label: "Active"
        };
      case "canceled":
      case "cancelled":
        return {
          variant: "destructive" as const,
          label: "Cancelled"
        };
      case "past_due":
        return {
          variant: "destructive" as const,
          label: "Past Due"
        };
      case "unpaid":
        return {
          variant: "destructive" as const,
          label: "Unpaid"
        };
      case "incomplete":
      case "incomplete_expired":
        return {
          variant: "secondary" as const,
          label: "Incomplete"
        };
      case "trialing":
        return {
          variant: "outline" as const,
          label: "Trial"
        };
      case "paused":
        return {
          variant: "secondary" as const,
          label: "Paused"
        };
      default:
        return {
          variant: "secondary" as const,
          label: status
        };
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-20 pb-12">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold" data-testid="heading-my-websites">
                {t("dashboard.myWebsites") || "My Websites"}
              </h1>
              <p className="text-muted-foreground mt-2" data-testid="text-websites-description">
                {t("dashboard.websitesDescription") || "Manage your website projects"}
              </p>
            </div>
            <Button
              onClick={() => navigate("/#plans")}
              className="flex items-center gap-2"
              data-testid="button-create-website"
            >
              <Plus className="h-4 w-4" />
              {t("dashboard.createNewWebsite") || "Create New Website"}
            </Button>
          </div>

          {!sortedWebsites || sortedWebsites.length === 0 ? (
            <Card className="p-12" data-testid="card-empty-state">
              <div className="text-center">
                {hasActiveSubscriptions ? (
                  <>
                    <h2 className="text-xl font-semibold mb-2" data-testid="heading-no-websites">
                      {t("dashboard.noWebsites")}
                    </h2>
                    <p className="text-muted-foreground mb-6" data-testid="text-no-websites-message">
                      {t("dashboard.noWebsitesMessage")}
                    </p>
                    <Button
                      onClick={() => navigate("/onboarding")}
                      className="flex items-center gap-2 mx-auto"
                      data-testid="button-complete-onboarding"
                    >
                      <Plus className="h-4 w-4" />
                      {t("dashboard.completeOnboarding")}
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold mb-2" data-testid="heading-no-subscriptions">
                      {t("dashboard.noSubscriptions") || "No Active Subscriptions"}
                    </h2>
                    <p className="text-muted-foreground mb-6" data-testid="text-no-subscriptions-message">
                      {t("dashboard.noSubscriptionsMessage") || "You need to subscribe to a plan before we can create your website."}
                    </p>
                    <Button
                      onClick={() => navigate("/")}
                      className="flex items-center gap-2 mx-auto"
                      data-testid="button-view-plans"
                    >
                      <Plus className="h-4 w-4" />
                      {t("dashboard.viewPlans") || "View Plans"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-12 gap-6">
              {/* Left Column - Website Projects (9 columns) */}
              <div className="col-span-12 lg:col-span-9 space-y-4">
                {sortedWebsites.map((website) => {
                  const isPendingOnboarding = website.currentStage === 0 || website.domain.endsWith('.pending-onboarding');
                  // Only show draft if onboardingStatus is explicitly 'draft'
                  // Websites without onboardingStatus (null/undefined) will show normal view
                  const isDraft = website.onboardingStatus === 'draft';

                  return (
                    <Card
                      key={website.id}
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${
                        isPendingOnboarding 
                          ? 'border-2 border-blue-300 bg-blue-50' 
                          : isDraft 
                          ? 'border-2 border-orange-300 bg-orange-50' 
                          : ''
                      }`}
                      onClick={() => !isPendingOnboarding && !isDraft && navigate(`/dashboard/website/${website.id}`)}
                      data-testid={`card-website-${website.id}`}
                    >
                      <CardContent className="p-6">
                        {isPendingOnboarding ? (
                          // Pending Onboarding View
                          <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                            {/* <div className="bg-blue-100 rounded-full p-4">
                              <Plus className="h-8 w-8 text-blue-600" />
                            </div> */}
                            <div>
                              <h3 className="text-xl font-semibold mb-2" data-testid={`text-pending-${website.id}`}>
                                {t("dashboard.newSubscription") || "New Subscription Ready"}
                              </h3>
                              <p className="text-muted-foreground mb-1">
                                {t("dashboard.completeOnboardingMessage") || "Complete the onboarding form to set up your website"}
                              </p>
                              {/* {website.subscriptionTier && (
                                <Badge className="mt-2" data-testid={`badge-tier-${website.id}`}>
                                  {website.subscriptionTier.charAt(0).toUpperCase() + website.subscriptionTier.slice(1)} Plan
                                </Badge>
                              )} */}
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate("/onboarding");
                              }}
                              className="mt-4"
                              data-testid={`button-complete-onboarding-${website.id}`}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {t("dashboard.completeOnboarding") || "Complete Onboarding"}
                            </Button>
                          </div>
                        ) : isDraft ? (
                          // Draft Onboarding View
                          <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                            <div className="bg-orange-100 rounded-full p-4">
                              <AlertCircle className="h-8 w-8 text-orange-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold mb-2" data-testid={`text-draft-${website.id}`}>
                                {t("dashboard.draftOnboarding") || "Draft Onboarding"}
                              </h3>
                              <p className="text-muted-foreground mb-1">
                                {t("dashboard.continueOnboardingMessage") || "You have a saved draft. Continue where you left off to complete your website setup."}
                              </p>
                              {website.subscriptionTier && (
                                <Badge className="mt-2" variant="outline" data-testid={`badge-tier-draft-${website.id}`}>
                                  {website.subscriptionTier.charAt(0).toUpperCase() + website.subscriptionTier.slice(1)} Plan
                                </Badge>
                              )}
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/onboarding?websiteProgressId=${website.id}`);
                              }}
                              className="mt-4"
                              data-testid={`button-continue-onboarding-${website.id}`}
                            >
                              {t("dashboard.continueOnboarding") || "Continue Onboarding"}
                            </Button>
                          </div>
                        ) : (
                          // Normal Website View
                          <div className="flex flex-col sm:flex-row gap-6">
                            {/* Left - Image Preview */}
                            <div className="w-full sm:w-48 shrink-0">
                              <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg border border-slate-200 overflow-hidden relative">
                                {/* Browser Chrome */}
                                <div className="absolute top-0 left-0 right-0 h-6 bg-slate-200 flex items-center px-2 gap-1 z-10">
                                  <div className="flex gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                  </div>
                                </div>

                                {/* Template Preview Image or Placeholder */}
                                {(() => {
                                  const template = ENVATO_TEMPLATES.find(t => t.id === website.selectedTemplateId);
                                  return template ? (
                                    <img
                                      src={template.preview}
                                      alt={template.name}
                                      className="w-full h-full object-cover pt-6"
                                    />
                                  ) : null;
                                })()}

                                {/* Fallback Placeholder Content */}
                                {!website.selectedTemplateId || !ENVATO_TEMPLATES.find(t => t.id === website.selectedTemplateId) ? (
                                  <div className="mt-6 p-3 flex flex-col gap-2">
                                    <div className="h-2 bg-slate-300 rounded w-3/4"></div>
                                    <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                                    <div className="h-8 bg-slate-300 rounded mt-2"></div>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      <div className="h-6 bg-slate-200 rounded"></div>
                                      <div className="h-6 bg-slate-200 rounded"></div>
                                    </div>
                                  </div>
                                ) : null}

                                {/* Website Icon Overlay */}
                                <div className="absolute bottom-2 right-2 bg-white rounded-full p-1.5 shadow-md z-10">
                                  <ExternalLink className="h-4 w-4 text-slate-600" />
                                </div>
                              </div>
                            </div>

                            {/* Right - Website Info */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <h3 className="text-xl font-semibold" data-testid={`text-domain-${website.id}`}>
                                    {website.projectName || website.domain}
                                  </h3>
                                  <Badge
                                    variant={getSubscriptionStatusBadge(website.subscriptionStatus).variant}
                                    data-testid={`badge-subscription-${website.id}`}
                                  >
                                    {getSubscriptionStatusBadge(website.subscriptionStatus).label}
                                  </Badge>
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-sm mb-2">
                                      <span className="text-muted-foreground">
                                        {t("dashboard.progress") || "Progress"}
                                      </span>
                                      <span className="font-medium" data-testid={`text-progress-${website.id}`}>
                                        {getProgressPercentage(website)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-primary rounded-full h-2 transition-all"
                                        style={{ width: `${getProgressPercentage(website)}%` }}
                                        data-testid={`progress-bar-${website.id}`}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                    <p data-testid={`text-stage-${website.id}`}>
                                      {t("dashboard.stage") || "Stage"} {website.currentStage} of{" "}
                                      {totalStages(website)}
                                    </p>
                                    <p data-testid={`text-completed-stages-${website.id}`}>
                                      {completedStages(website)} {t("dashboard.completed") || "completed"}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/website/${website.id}`);
                                  }}
                                  data-testid={`button-view-details-${website.id}`}
                                >
                                  {t("dashboard.websiteViewDetails") || "Website"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/website/${website.id}?tab=billing`);
                                  }}
                                  data-testid={`button-billing-${website.id}`}
                                >
                                  {t("dashboard.billing") || "Billing"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/website/${website.id}?tab=analytics`);
                                  }}
                                  data-testid={`button-analytics-${website.id}`}
                                >
                                  {t("dashboard.analytics") || "Analytics"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/website/${website.id}?tab=newsletter`);
                                  }}
                                  data-testid={`button-newsletter-${website.id}`}
                                >
                                  {t("dashboard.newsletter") || "Newsletter"}
                                </Button>
                              {website.bookingEnabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const resp = await fetch(
                                        `/api/booking/sso-token?websiteId=${website.id}`,
                                        { credentials: "include" }
                                      );
                                      const data = await resp.json();
                                      if (!resp.ok) throw new Error(data.error || "Failed to get SSO token");
                                      const base = BOOKING_APP_BASE_URL.replace(/\/$/, "");
                                      let targetUrl: string;
                                      if (data.redirectUrl && typeof data.redirectUrl === "string") {
                                        const u = data.redirectUrl.trim();
                                        if (u.startsWith("http://") || u.startsWith("https://")) {
                                          targetUrl = u;
                                        } else if (u.startsWith("/")) {
                                          const afterSlash = u.slice(1);
                                          const firstSegment = afterSlash.split("/")[0] ?? "";
                                          if (firstSegment.includes(".")) {
                                            targetUrl = `https://${afterSlash}`;
                                          } else {
                                            targetUrl = `${base}${u}`;
                                          }
                                        } else {
                                          targetUrl = u.includes(".") ? `https://${u}` : `${base}/${u}`;
                                        }
                                      } else if (data.token) {
                                        targetUrl = `${base}/sso?token=${encodeURIComponent(data.token)}`;
                                      } else {
                                        throw new Error("No redirect URL or token in response");
                                      }
                                      window.location.replace(targetUrl);
                                    } catch (err) {
                                      console.error("Booking SSO error:", err);
                                      alert(t("dashboard.bookingError") || "Could not open Booking. Please try again.");
                                    }
                                  }}
                                  data-testid={`button-booking-${website.id}`}
                                >
                                  {t("dashboard.booking") || "Booking"}
                                </Button>
                              )}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Right Column - Vertical Promo Banner (3 columns) */}
              <div className="col-span-12 lg:col-span-3">
                <Card
                  className="border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-green-50 cursor-pointer hover:shadow-lg transition-all sticky top-24 h-fit"
                  onClick={() => navigate("/reviews-program")}
                  data-testid="promo-reviews-banner"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="bg-white rounded-full p-4 shadow-md">
                        <Gift className="h-10 w-10 text-blue-600" />
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          🎁 {t("reviewsProgram.promoTitle") || "Get Your Next Month FREE!"}
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {t("reviewsProgram.promoDescription") || "Leave 3 reviews on Facebook, Trustpilot, and G2 to unlock a free month"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <div className="bg-blue-600 rounded-full p-2">
                          <Star className="h-5 w-5 text-white fill-white" />
                        </div>
                        <div className="bg-green-600 rounded-full p-2">
                          <Star className="h-5 w-5 text-white fill-white" />
                        </div>
                        <div className="bg-orange-600 rounded-full p-2">
                          <Star className="h-5 w-5 text-white fill-white" />
                        </div>
                      </div>

                      <Button
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/reviews-program");
                        }}
                      >
                        {t("reviewsProgram.claimOffer") || "Claim Offer"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
