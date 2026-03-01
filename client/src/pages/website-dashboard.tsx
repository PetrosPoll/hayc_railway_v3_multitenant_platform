import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WebsiteProgress } from "@/components/ui/website-progress";
import { WebsiteAnalytics } from "@/components/ui/website-analytics";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Loader2,
  ArrowLeft,
  Settings,
  CreditCard,
  Download,
  ChevronRight,
  Receipt,
  FileText,
  X,
  TrendingUp,
  Plus,
  Pencil,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Lightbulb,
  BarChart,
  Mail,
  Users,
  User as UserIcon,
  LogOut,
  Eye,
  Monitor,
  Activity,
  Lock,
  Upload,
  Image as ImageIcon,
  Trash2,
  Tag,
  Copy,
  Package,
  CalendarDays,
  FileEdit,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Subscription } from "@shared/schema";
import { AVAILABLE_ADDONS } from "@/lib/addons";
import { BOOKING_APP_BASE_URL } from "@/lib/utils";
import { Tips } from "@/components/ui/tips";
import { ContentEditor } from "@/components/content-editor";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { UpgradeToYearlyDialog } from "@/components/UpgradeToYearlyDialog";
import { LegacyUpgradeDialog } from "@/components/LegacyUpgradeDialog";
import { UpgradeRequestDialog } from "@/components/UpgradeRequestDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import individual newsletter components
import { ContactsList } from "@/components/ContactsList";
import { TagsManagement } from "@/components/TagsManagement";
import { CampaignsList } from "@/components/CampaignsList";

type Website = {
  id: number;
  userId: number;
  domain: string;
  currentStage: number;
  userEmail: string;
  media?: Array<{ url: string, publicId: string, name: string }>;
  bookingEnabled?: boolean;
  siteId?: string | null;
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

type SidebarMenuContentProps = {
  menuItems: Array<{
    id: string;
    label: string;
    icon: any;
  }>;
  activeSection: string;
  setActiveSection: (section: string) => void;
  setBillingView: (view: any) => void;
  setNewsletterView: (view: any) => void;
  handleLogout: () => void;
  handleOpenBooking?: () => void;
  isBookingLoading?: boolean;
  navigate: (path: string) => void;
  t: (key: string) => string;
};

function SidebarMenuContent({
  menuItems,
  activeSection,
  setActiveSection,
  setBillingView,
  setNewsletterView,
  handleLogout,
  handleOpenBooking,
  isBookingLoading,
  navigate,
  t,
}: SidebarMenuContentProps) {
  const { setOpenMobile } = useSidebar();

  const handleMenuClick = (callback?: () => void) => {
    setOpenMobile(false);
    callback?.();
  };

  return (
    <SidebarMenu>
      {menuItems.map((item, index) => {
        if (item.id === "separator") {
          return (
            <div
              key={`separator-${index}`}
              className="py-2"
              data-testid="menu-separator"
            >
              <Separator className="my-2" />
              <div className="mt-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("dashboard.explore") || "Explore"}
              </div>
            </div>
          );
        }

        if (item.id === "profile-separator") {
          return (
            <div
              key={`profile-separator-${index}`}
              className="py-2"
              data-testid="menu-profile-separator"
            >
              <Separator className="my-2" />
              <div className="mt-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("dashboard.profile") || "Profile"}
              </div>
            </div>
          );
        }

        if (item.id === "logout") {
          const Icon = item.icon;
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={() => handleMenuClick(handleLogout)}
                data-testid={`menu-${item.id}`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }

        if (item.id === "my-websites") {
          const Icon = item.icon;
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={() => handleMenuClick(() => navigate("/dashboard"))}
                data-testid={`menu-${item.id}`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }

        if (item.id === "booking" && handleOpenBooking) {
          const Icon = item.icon;
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                onClick={() => handleMenuClick(handleOpenBooking)}
                disabled={isBookingLoading}
                data-testid="menu-booking"
              >
                {isBookingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  Icon && <Icon className="h-4 w-4" />
                )}
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }

        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={isActive}
              onClick={() => {
                handleMenuClick(() => {
                  setActiveSection(item.id);
                  if (item.id === "billing") {
                    setBillingView("overview");
                  } else if (item.id === "newsletter") {
                    setNewsletterView("overview");
                  }
                });
              }}
              data-testid={`menu-${item.id}`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export default function WebsiteDashboard() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize activeSection from URL params or default to "progress"
  const [activeSection, setActiveSection] = useState(() => {
    return searchParams.get("tab") || "progress";
  });

  // Track the last updated tab to avoid race conditions
  const lastTabRef = useRef(searchParams.get("tab") || "progress");

  const [billingView, setBillingView] = useState<
    | "overview"
    | "subscriptions"
    | "subscription-detail"
    | "payment-info"
    | "invoices"
  >("overview");
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [editingBilling, setEditingBilling] = useState(false);
  const [vatValue, setVatValue] = useState("");
  const [cityValue, setCityValue] = useState("");
  const [streetValue, setStreetValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [postalCodeValue, setPostalCodeValue] = useState("");
  const [newsletterView, setNewsletterView] = useState<
    | "overview"
    | "groups"
    | "contacts"
    | "builder"
    | "templates"
    | "campaigns"
  >(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["overview", "groups", "contacts", "builder", "templates", "campaigns"].includes(viewParam)) {
      return viewParam as "overview" | "groups" | "contacts" | "builder" | "templates" | "campaigns";
    }
    return "overview";
  });
  const [newsletterTab, setNewsletterTab] = useState<
    "groups" | "subscribers"
  >("groups");
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);

  // Media section state
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  // Content editor dialog state
  const [contentEditorOpen, setContentEditorOpen] = useState(false);

  // Booking redirect loading state
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // Invoice filter state - default to current month and year
  const [selectedInvoiceYear, setSelectedInvoiceYear] = useState<number>(() => {
    const now = new Date();
    return now.getFullYear();
  });
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() + 1;
  });

  // Update URL when activeSection changes (only when user actively changes tabs)
  useEffect(() => {
    if (activeSection !== lastTabRef.current) {
      const newParams = new URLSearchParams(window.location.search);
      newParams.set("tab", activeSection);
      setSearchParams(newParams);
      lastTabRef.current = activeSection;
    }
  }, [activeSection, setSearchParams]);

  // Fetch email templates at the top level
  const { data: emailTemplates, isLoading: templatesLoading } = useQuery<any[]>(
    {
      queryKey: ["/api/email-templates", websiteId],
      queryFn: async () => {
        const response = await fetch(`/api/email-templates/${websiteId}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch templates");
        }
        return response.json();
      },
      enabled: !!websiteId && newsletterView === "templates",
    },
  );

  // Fetch website-specific invoices at the top level
  const { data: websiteInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/websites", websiteId, "invoices"],
    queryFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/invoices`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }
      return response.json();
    },
    enabled: !!websiteId && activeSection === "billing",
  });

  const handleOpenBooking = async () => {
    if (!websiteId) return;
    setIsBookingLoading(true);
    try {
      const resp = await fetch(`/api/booking/sso-token?websiteId=${websiteId}`, {
        credentials: "include",
      });
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
      setIsBookingLoading(false);
      toast({
        title: t("dashboard.bookingError") || "Could not open Booking",
        description: t("dashboard.bookingErrorDescription") || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        queryClient.setQueryData(["/api/user"], null);
        toast({
          title: t("dashboard.success") || "Success",
          description: t("dashboard.loggedOut") || "Logged out successfully",
        });
        // Use full page redirect to ensure clean logout
        window.location.href = "/auth";
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const purchaseAddOnMutation = useMutation({
    mutationFn: async (addOnId: string) => {
      const response = await fetch(`/api/add-ons/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addOnId,
          websiteProgressId: Number(websiteId),
          billingPeriod: "monthly",
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        const error: any = new Error(errorData.message || "Failed to purchase add-on");
        error.code = errorData.error;
        error.details = errorData.details;
        throw error;
      }
      return response.json();
    },
    onSuccess: (data) => {
      setConfirmDialogOpen(false);
      setSelectedAddOn(null);
      toast({
        title: t("dashboard.success") || "Success",
        description:
          t("dashboard.addonPurchaseSuccess") ||
          "Add-on purchased successfully!",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/subscriptions", websiteId],
      });
    },
    onError: (error: any) => {
      // Keep dialog open on error so user can retry
      let errorMessage = error.message || t("dashboard.failedToPurchaseAddOn") || "Failed to purchase add-on";
      let actionMessage = "";

      // Provide specific guidance based on error code
      if (error.code === "authentication_required" || error.code === "payment_incomplete") {
        actionMessage = " Please update your payment method in billing settings.";
      } else if (error.code === "card_declined") {
        actionMessage = " Your card was declined. Please use a different payment method.";
      }

      toast({
        title: t("dashboard.error") || "Payment Error",
        description: errorMessage + actionMessage,
        variant: "destructive",
      });
    },
  });

  const [subscriptionToCancel, setSubscriptionToCancel] = useState<number | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [subscriptionToUpgrade, setSubscriptionToUpgrade] = useState<any>(null);
  const [upgradeRequestDialogOpen, setUpgradeRequestDialogOpen] = useState(false);
  const [upgradeRequestFeature, setUpgradeRequestFeature] = useState<string>("");

  // Add-on confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState<{ id: string, name: string, description: string, price: number } | null>(null);

  // Fetch payment method details - MUST be after confirmDialogOpen is declared
  const { data: paymentMethod, isLoading: paymentMethodLoading } = useQuery({
    queryKey: ["/api/payment-method"],
    enabled: confirmDialogOpen,
  });

  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("dashboard.subscriptionCancelled") || "Subscription Cancelled",
        description: t("dashboard.subscriptionCancelledDesc") || "Your subscription has been cancelled successfully.",
      });
      setSubscriptionToCancel(null);
      window.location.reload();
    },
    onError: () => {
      toast({
        title: t("dashboard.error") || "Error",
        description: t("dashboard.failedToCancelSubscription") || "Failed to cancel subscription",
        variant: "destructive",
      });
      setSubscriptionToCancel(null);
    },
  });

  const updateBillingMutation = useMutation({
    mutationFn: async ({ subscriptionId, vatNumber, city, street, number, postalCode }: { subscriptionId: number; vatNumber: string; city: string; street: string; number: string; postalCode: string }) => {
      const response = await fetch("/api/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ subscriptionId, vatNumber, city, street, number, postalCode }),
      });
      if (!response.ok) {
        throw new Error("Failed to update billing information");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", websiteId] });
      toast({
        title: t("dashboard.success") || "Success",
        description: t("dashboard.billingUpdated") || "Billing information updated successfully",
      });
      setEditingBilling(false);
    },
    onError: () => {
      toast({
        title: t("dashboard.error") || "Error",
        description: t("dashboard.billingUpdateFailed") || "Failed to update billing information",
        variant: "destructive",
      });
    },
  });

  const handleUpgradeSubscription = (subscriptionId: number) => {
    const subscription = subscriptions?.find(sub => sub.id === subscriptionId);
    if (subscription) {
      setSubscriptionToUpgrade(subscription);
      setUpgradeDialogOpen(true);
    }
  };

  const handleCancelSubscription = (subscriptionId: number) => {
    setSubscriptionToCancel(subscriptionId);
  };

  const handleConfirmCancel = () => {
    if (subscriptionToCancel) {
      cancelMutation.mutate(subscriptionToCancel);
    }
  };

  const { data: website, isLoading: websiteLoading } = useQuery<Website>({
    queryKey: ["/api/admin/websites", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch website");
      }
      return response.json();
    },
    enabled: !!websiteId,
  });

  // Fetch media files from Cloudinary folder
  const { data: mediaData, isLoading: mediaLoading } = useQuery<{ media: Array<{ url: string, publicId: string, name: string, previewUrl?: string, format?: string | null }> }>({
    queryKey: ["/api/websites", websiteId, "media"],
    queryFn: async () => {
      const response = await fetch(`/api/websites/${websiteId}/media`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch media");
      }
      return response.json();
    },
    enabled: !!websiteId && activeSection === "media",
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<
    Subscription[]
  >({
    queryKey: ["/api/subscriptions", websiteId],
    queryFn: async () => {
      const response = await fetch(
        `/api/subscriptions?websiteProgressId=${websiteId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions");
      }
      return response.json();
    },
    enabled: !!websiteId,
  });

  // Get the plan subscription (not addon) for tier and usage checks
  const planSubscription = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return null;

    // Filter for "plan" type subscriptions first
    const planSubs = subscriptions.filter(sub => sub.productType === "plan");

    // Prioritize active subscriptions first
    const activePlanSub = planSubs.find(sub => sub.status === "active");
    if (activePlanSub) return activePlanSub;

    // Fall back to first plan subscription if no active one
    return planSubs.length > 0 ? planSubs[0] : subscriptions[0];
  }, [subscriptions]);

  const { data: userData } = useQuery<any>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const response = await fetch("/api/user", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
  });

  // Load user's language preference from database when user data is loaded
  useEffect(() => {
    if (userData?.user?.language) {
      const userLanguage = userData.user.language;
      // Only update if different from current language
      if (i18n.language !== userLanguage) {
        i18n.changeLanguage(userLanguage);
        localStorage.setItem("language", userLanguage);
      }
    }
  }, [userData]);

  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/create-billing-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to create billing portal session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to open payment management. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle add-on purchase success/cancel messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addonPurchase = params.get("addon_purchase");

    if (addonPurchase === "success") {
      toast({
        title: t("dashboard.success") || "Success",
        description:
          t("dashboard.addonPurchaseSuccess") ||
          "Add-on purchased successfully!",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/subscriptions", websiteId],
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (addonPurchase === "cancelled") {
      toast({
        title: t("dashboard.cancelled") || "Cancelled",
        description:
          t("dashboard.addonPurchaseCancelled") ||
          "Add-on purchase was cancelled.",
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast, t, queryClient, websiteId]);

  const { data: changesData } = useQuery<any>({
    queryKey: ["/api/website-changes", websiteId],
    staleTime: 0,
    gcTime: 0,
    enabled: !!websiteId,
  });

  // App settings (newsletter + tips visibility)
  const { data: appSettings } = useQuery<{ newsletterEnabled: boolean; tipsVisibleInUserDashboard?: boolean }>(
    { queryKey: ["/api/settings"] },
  );
  const newsletterSettings = appSettings;
  const tipsVisibleInUserDashboard = appSettings?.tipsVisibleInUserDashboard ?? true;

  // When tips are hidden in user dashboard, switch away from tips section if currently on it
  useEffect(() => {
    if (!tipsVisibleInUserDashboard && activeSection === "tips") {
      setActiveSection("progress");
    }
  }, [tipsVisibleInUserDashboard, activeSection]);

  // Newsletter section is now handled locally, no redirect needed

  const [changeSubject, setChangeSubject] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [changeFiles, setChangeFiles] = useState<Array<{ name: string; url: string; publicId: string }>>([]);

  // Cloudinary file upload handler for change requests (with signed uploads)
  const handleChangeFileUpload = async () => {
    if (typeof window !== 'undefined' && (window as any).cloudinary) {
      try {
        const accountEmail = userData?.user?.email || 'unknown-user';
        const folderName = `Website Media/${accountEmail}/${website?.domain}/Change Requests`;

        // Get initial config from backend
        const configResponse = await fetch("/api/cloudinary/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paramsToSign: { folder: folderName } }),
        });

        if (!configResponse.ok) {
          throw new Error("Failed to get upload configuration");
        }

        const { apiKey, cloudName } = await configResponse.json();

        (window as any).cloudinary.openUploadWidget(
          {
            cloudName: cloudName,
            apiKey: apiKey,
            uploadSignature: async (callback: any, paramsToSign: any) => {
              try {
                const signatureResponse = await fetch("/api/cloudinary/signature", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ paramsToSign }),
                });

                if (!signatureResponse.ok) {
                  throw new Error("Failed to get upload signature");
                }

                const { signature, timestamp } = await signatureResponse.json();
                callback({ signature, timestamp });
              } catch (error) {
                console.error("Signature error:", error);
              }
            },
            sources: ["local", "url"],
            multiple: true,
            folder: folderName,
            resourceType: "auto",
            maxFileSize: 10000000, // 10MB
            maxFiles: 5,
          },
          (error: any, result: any) => {
            if (!error && result.event === "success") {
              const newFile = {
                name: result.info.original_filename,
                url: result.info.secure_url,
                publicId: result.info.public_id
              };

              setChangeFiles(prev => [...prev, newFile]);
              toast({
                title: t("dashboard.uploadSuccess") || "Upload Successful",
                description: `${result.info.original_filename} ${t("dashboard.uploadedSuccessfully") || "uploaded successfully"}`,
              });
            } else if (error) {
              console.error("Cloudinary widget error:", error);
              toast({
                title: t("dashboard.uploadError") || "Upload Error",
                description: t("dashboard.uploadErrorDesc") || "Failed to upload file. Please try again.",
                variant: "destructive",
              });
            }
          }
        );
      } catch (error) {
        console.error("Upload configuration error:", error);
        toast({
          title: t("dashboard.uploadError") || "Upload Error",
          description: t("dashboard.uploadErrorDesc") || "Failed to initialize upload. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: t("dashboard.uploadUnavailable") || "Upload Service Unavailable",
        description: t("dashboard.uploadUnavailableDesc") || "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const removeChangeFile = (publicId: string) => {
    setChangeFiles(prev => prev.filter(file => file.publicId !== publicId));
  };

  // Media mutations at component level
  const addMediaMutation = useMutation({
    mutationFn: async (mediaData: { url: string; publicId: string; name: string }) => {
      const response = await fetch(`/api/websites/${websiteId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mediaData),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to add media");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites", websiteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "media"] });
      toast({
        title: t("dashboard.success") || "Success",
        description: "Media uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (publicId: string) => {
      const response = await fetch(`/api/websites/${websiteId}/media/${encodeURIComponent(publicId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete media");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites", websiteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/websites", websiteId, "media"] });
      setDeleteMediaId(null);
      toast({
        title: t("dashboard.success") || "Success",
        description: "Media deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete media",
        variant: "destructive",
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/email-templates/${templateId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates", websiteId] });
      toast({
        title: t("dashboard.success") || "Success",
        description: t("dashboard.templateDuplicated") || "Template duplicated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate template",
        variant: "destructive",
      });
    },
  });

  const submitChangeRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/website-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          domain: website?.domain,
          subject: changeSubject,
          message: changeMessage,
          files: changeFiles.length > 0 ? changeFiles : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit change request");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title:
          t("dashboard.changeRequestSubmitted") || "Change Request Submitted",
        description:
          t("dashboard.changeRequestSubmittedDescription") ||
          "Your change request has been submitted successfully.",
      });
      setChangeSubject("");
      setChangeMessage("");
      setChangeFiles([]);
      queryClient.invalidateQueries({
        queryKey: ["/api/website-changes", websiteId],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const menuItems = React.useMemo(() => {
    const base = [
      { id: "progress", label: t("dashboard.progress") || "Website", icon: Settings },
      { id: "changes", label: t("dashboard.changes") || "Changes", icon: FileText },
      { id: "media", label: t("dashboard.media") || "Media", icon: ImageIcon },
      ...(website?.siteId ? [{ id: "content", label: "Content", icon: FileEdit }] : []),
      { id: "billing", label: t("dashboard.billing") || "Billing", icon: CreditCard },
      { id: "analytics", label: t("dashboard.analytics") || "Analytics", icon: BarChart },
      { id: "newsletter", label: t("dashboard.newsletter") || "Newsletter", icon: Mail },
    ];
    const bookingItem = {
      id: "booking",
      label: t("dashboard.booking") || "Booking",
      icon: CalendarDays,
    };
    const after = [
      { id: "separator", label: "", icon: null },
      { id: "discover", label: t("dashboard.discover") || "Discover", icon: Sparkles },
      ...(tipsVisibleInUserDashboard ? [{ id: "tips", label: t("dashboard.tips") || "Tips", icon: Lightbulb }] : []),
    ];
    return website?.bookingEnabled
      ? [...base, bookingItem, ...after]
      : [...base, ...after];
  }, [t, website?.bookingEnabled, tipsVisibleInUserDashboard, website?.siteId]);

  if (websiteLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-16 flex items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin"
          data-testid="loader-website-dashboard"
        />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="min-h-[calc(100vh-4rem)] pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2
            className="text-2xl font-semibold mb-4"
            data-testid="heading-website-not-found"
          >
            Website not found
          </h2>
          <Button
            onClick={() => navigate("/dashboard")}
            data-testid="button-back-to-websites"
          >
            Back to Websites
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string = "EUR") => {
    return (amount / 100).toLocaleString("el-GR", {
      style: "currency",
      currency: currency,
    });
  };

  // Helper function to get standard price based on tier and billing period (returns cents)
  const getStandardPrice = (tier: string | null, billingPeriod: string, productType?: string, originalPrice?: number): number => {
    if (productType === 'addon') {
      // Use the original price from the subscription data if available
      return originalPrice || 1000; // Fallback to €10 if not provided
    }

    const tierLower = tier?.toLowerCase();
    const isYearly = billingPeriod === 'yearly';

    if (tierLower === 'basic') {
      return isYearly ? 32600 : 3400; // €326 or €34 in cents
    } else if (tierLower === 'essential') {
      return isYearly ? 37200 : 3900; // €372 or €39 in cents
    } else if (tierLower === 'pro') {
      return isYearly ? 240000 : 20000; // €2400 or €200 in cents
    }

    return 0;
  };

  const renderBreadcrumbs = () => {
    return (
      <>
        <Breadcrumb className="mb-6" data-testid="breadcrumb-navigation">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => navigate("/dashboard")}
                className="cursor-pointer"
                data-testid="breadcrumb-home"
              >
                {t("dashboard.myWebsites") || "My Websites"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-website">
                {website.projectName || website.domain}
              </BreadcrumbPage>
            </BreadcrumbItem>
            {activeSection === "changes" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-changes">
                    {t("dashboard.changes") || "Changes"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {activeSection === "billing" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {billingView === "overview" ? (
                    <BreadcrumbPage data-testid="breadcrumb-billing">
                      {t("dashboard.billing") || "Billing"}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => setBillingView("overview")}
                      className="cursor-pointer"
                      data-testid="breadcrumb-billing-link"
                    >
                      {t("dashboard.billing") || "Billing"}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {billingView === "subscriptions" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-subscriptions">
                    {t("dashboard.subscriptions") || "Subscriptions"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {billingView === "subscription-detail" && selectedSubscription && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    onClick={() => setBillingView("subscriptions")}
                    className="cursor-pointer"
                    data-testid="breadcrumb-subscriptions-link"
                  >
                    {t("dashboard.subscriptions") || "Subscriptions"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-subscription-detail">
                    {selectedSubscription.tier}{" "}
                    {t("dashboard.subscription") || "Subscription"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {billingView === "invoices" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-invoices">
                    {t("dashboard.invoices") || "Invoices"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {billingView === "payment-info" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-payment-info">
                    {t("dashboard.paymentInformation") || "Payment Information"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {activeSection === "analytics" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-analytics">
                    {t("dashboard.analytics") || "Analytics"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {activeSection === "newsletter" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {newsletterView === "overview" ? (
                    <BreadcrumbPage data-testid="breadcrumb-newsletter">
                      {t("dashboard.newsletter") || "Newsletter"}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => setNewsletterView("overview")}
                      className="cursor-pointer"
                      data-testid="breadcrumb-newsletter-link"
                    >
                      {t("dashboard.newsletter") || "Newsletter"}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </>
            )}
            {newsletterView === "groups" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-newsletter-tags">
                    {t("dashboard.tags") || "Tags"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {newsletterView === "contacts" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-newsletter-contacts">
                    {t("dashboard.contacts") || "Contacts"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {newsletterView === "builder" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-newsletter-builder">
                    {t("dashboard.emailBuilder") || "Email Builder"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {newsletterView === "templates" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-newsletter-templates">
                    {t("dashboard.emailTemplates") || "Email Templates"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </>
    );
  };

  const renderBillingOverview = () => {
    return (
      <div className="space-y-4 space-x-4" data-testid="billing-overview">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.billing") || "Billing"}
        </h2>

        {/* Payment Information Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setBillingView("payment-info")}
          data-testid="card-payment-info"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.paymentInformation") || "Payment Information"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.managePaymentInfo") ||
                      "Manage and edit your billing information"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Subscriptions Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setBillingView("subscriptions")}
          data-testid="card-subscriptions"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.subscriptions") || "Subscriptions"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.manageSubscriptions") ||
                      "Manage your subscription plans"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Invoices Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setBillingView("invoices")}
          data-testid="card-invoices"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.invoices") || "Invoices"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.viewInvoices") || "View your invoices"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  };

  const renderSubscriptionsList = () => {
    return (
      <div data-testid="subscriptions-list">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.subscriptions") || "Subscriptions"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.manageSubscriptionsDesc") ||
            "Manage the subscriptions tied to your account."}
        </p>

        {subscriptionsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              data-testid="loader-subscriptions"
            />
          </div>
        ) : !subscriptions || subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center" data-testid="text-no-subscriptions">
                <p className="text-muted-foreground mb-4">
                  {t("dashboard.noSubscriptions") ||
                    "No subscriptions for this website yet"}
                </p>
                <Button
                  onClick={() => navigate("/")}
                  data-testid="button-add-subscription"
                >
                  {t("dashboard.addSubscription") || "Add Subscription"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t("dashboard.activeSubscriptions") || "Active Subscriptions"}
            </h3>
            {subscriptions.map((subscription: any) => (
              <Card
                key={subscription.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedSubscription(subscription);
                  setBillingView("subscription-detail");
                }}
                data-testid={`card-subscription-${subscription.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3
                          className="text-base font-semibold capitalize"
                          data-testid={`tier-${subscription.id}`}
                        >
                          {subscription.productType === "addon" &&
                            subscription.productId
                            ? AVAILABLE_ADDONS.find(
                              (a) => a.id === subscription.productId,
                            )?.name || subscription.productId
                            : subscription.plan?.name || subscription.tier}
                        </h3>
                        <Badge
                          variant={
                            subscription.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            subscription.status === "active"
                              ? "bg-green-500"
                              : ""
                          }
                          data-testid={`status-${subscription.id}`}
                        >
                          {subscription.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {subscription.status === "active" &&
                          subscription.nextBillingDate ? (
                          <>
                            Renews on {formatDate(subscription.nextBillingDate)}{" "}
                            for{" "}
                            {(() => {
                              // Debug logging for scheduled subscriptions
                              if (subscription.stripeSubscriptionId?.startsWith('sub_sched_')) {
                                console.log('🎨 [FRONTEND] Scheduled subscription pricing data:', {
                                  subscriptionId: subscription.id,
                                  stripeSubscriptionId: subscription.stripeSubscriptionId,
                                  productType: subscription.productType,
                                  price: subscription.price,
                                  nextBillingAmount: subscription.nextBillingAmount,
                                  discountedPrice: subscription.discountedPrice,
                                  tier: subscription.tier,
                                  billingPeriod: subscription.billingPeriod
                                });
                              }

                              const actualPrice = subscription.nextBillingAmount || subscription.price;
                              const standardPrice = getStandardPrice(
                                subscription.tier,
                                subscription.billingPeriod || "monthly",
                                subscription.productType,
                                subscription.price
                              );
                              const isDiscounted = actualPrice < standardPrice;

                              // More debug logging
                              if (subscription.stripeSubscriptionId?.startsWith('sub_sched_')) {
                                console.log('🎨 [FRONTEND] Price comparison:', {
                                  actualPrice,
                                  standardPrice,
                                  isDiscounted,
                                  willShowDiscount: isDiscounted
                                });
                              }

                              if (isDiscounted) {
                                return (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="line-through text-gray-400">
                                      {formatCurrency(standardPrice, subscription.currency || "EUR")}
                                    </span>
                                    <span className="text-green-600 font-semibold">
                                      {formatCurrency(actualPrice, subscription.currency || "EUR")}
                                    </span>
                                  </span>
                                );
                              } else {
                                return formatCurrency(actualPrice, subscription.currency || "EUR");
                              }
                            })()}{" "}
                            {subscription.billingPeriod || "monthly"}
                          </>
                        ) : subscription.status === "cancelled" &&
                          subscription.accessUntil ? (
                          <>
                            Access expires on{" "}
                            {formatDate(subscription.accessUntil)}
                            {(subscription.nextBillingAmount || subscription.price) && (
                              <>
                                {" • "}
                                {(() => {
                                  const actualPrice = subscription.nextBillingAmount || subscription.price;
                                  const standardPrice = getStandardPrice(
                                    subscription.tier,
                                    subscription.billingPeriod || "monthly",
                                    subscription.productType,
                                    subscription.price
                                  );
                                  const isDiscounted = actualPrice < standardPrice;

                                  if (isDiscounted) {
                                    return (
                                      <span className="inline-flex items-center gap-2">
                                        <span className="line-through text-gray-400">
                                          {formatCurrency(standardPrice, subscription.currency || "EUR")}
                                        </span>
                                        <span className="text-green-600 font-semibold">
                                          {formatCurrency(actualPrice, subscription.currency || "EUR")}
                                        </span>
                                      </span>
                                    );
                                  } else {
                                    return formatCurrency(actualPrice, subscription.currency || "EUR");
                                  }
                                })()}{" "}
                                {subscription.billingPeriod || "monthly"}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {t("dashboard.activeSubscriptionsStartedOn") || "Started on"} {formatDate(subscription.createdAt)}
                            {(subscription.nextBillingAmount || subscription.price) && (
                              <>
                                {" • "}
                                {(() => {
                                  const actualPrice = subscription.nextBillingAmount || subscription.price;
                                  const standardPrice = getStandardPrice(
                                    subscription.tier,
                                    subscription.billingPeriod || "monthly",
                                    subscription.productType,
                                    subscription.price
                                  );
                                  const isDiscounted = actualPrice < standardPrice;

                                  if (isDiscounted) {
                                    return (
                                      <span className="inline-flex items-center gap-2">
                                        <span className="line-through text-gray-400">
                                          {formatCurrency(standardPrice, subscription.currency || "EUR")}
                                        </span>
                                        <span className="text-green-600 font-semibold">
                                          {formatCurrency(actualPrice, subscription.currency || "EUR")}
                                        </span>
                                      </span>
                                    );
                                  } else {
                                    return formatCurrency(actualPrice, subscription.currency || "EUR");
                                  }
                                })()}{" "}
                                {t(`dashboard.billingPeriods.${subscription.billingPeriod || "monthly"}`)}
                              </>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSubscriptionDetail = () => {
    if (!selectedSubscription) return null;

    return (
      <div data-testid="subscription-detail">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold capitalize">
            {selectedSubscription.productType === "addon" &&
              selectedSubscription.productId
              ? AVAILABLE_ADDONS.find(
                (a) => a.id === selectedSubscription.productId,
              )?.name || selectedSubscription.productId
              : selectedSubscription.plan?.name ||
              selectedSubscription.tier}{" "}
            {t("dashboard.subscription") || "Subscription"}
          </h2>
          <Badge
            variant={
              selectedSubscription.status === "active" ? "default" : "secondary"
            }
            className={
              selectedSubscription.status === "active" ? "bg-green-500" : ""
            }
          >
            {selectedSubscription.status}
          </Badge>
        </div>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.manageSubscriptionBilling") ||
            "Manage your website subscription and billing information."}
        </p>

        {/* Subscription Plan */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.subscriptionPlan") || "Subscription Plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-semibold capitalize">
                  {selectedSubscription.productType === "addon" &&
                    selectedSubscription.productId
                    ? AVAILABLE_ADDONS.find(
                      (a) => a.id === selectedSubscription.productId,
                    )?.name || selectedSubscription.productId
                    : (selectedSubscription.plan?.name ||
                      selectedSubscription.tier) + " Plan"}
                </p>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const actualPrice = selectedSubscription.nextBillingAmount || selectedSubscription.price;
                    const standardPrice = getStandardPrice(
                      selectedSubscription.tier,
                      selectedSubscription.billingPeriod || "monthly",
                      selectedSubscription.productType,
                      selectedSubscription.price
                    );
                    const isDiscounted = actualPrice < standardPrice;

                    if (isDiscounted) {
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="line-through text-gray-400">
                            {formatCurrency(standardPrice, selectedSubscription.currency)} / {t(`dashboard.billingPeriods.${selectedSubscription.billingPeriod || "month"}`)}
                          </span>
                          <span className="text-green-600 font-semibold">
                            {formatCurrency(actualPrice, selectedSubscription.currency)} / {t(`dashboard.billingPeriods.${selectedSubscription.billingPeriod || "month"}`)}
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <span>
                          {formatCurrency(actualPrice, selectedSubscription.currency)} / {t(`dashboard.billingPeriods.${selectedSubscription.billingPeriod || "month"}`)}
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {t("dashboard.renewAutomatically")} (
                {t(`dashboard.billingPeriods.${selectedSubscription.billingPeriod || "monthly"}`)})
              </span>

            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {selectedSubscription.status === "active" &&
                selectedSubscription.billingPeriod === "monthly" &&
                (selectedSubscription.productType !== "addon" || 
                  AVAILABLE_ADDONS.find(a => a.id === (selectedSubscription.productId || selectedSubscription.tier) && 'yearlyPrice' in a)) && (
                  <Button
                    variant="outline"
                    className="w-full upgrade-subscription"
                    data-testid="button-upgrade-yearly"
                    onClick={() => handleUpgradeSubscription(selectedSubscription.id)}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t("dashboard.upgradeToYearly") || "Upgrade to Yearly"}
                  </Button>
                )}
              {selectedSubscription.status === "active" ? (
                <Button
                  variant="link"
                  className="text-destructive p-0 h-auto cancel-subscription"
                  data-testid="button-cancel-subscription"
                  onClick={() => handleCancelSubscription(selectedSubscription.id)}
                >
                  {t("dashboard.cancelSubscription") || "CANCEL SUBSCRIPTION"}
                </Button>
              ) : (
                selectedSubscription.status === "cancelled" && (
                  <Button
                    variant="default"
                    className="w-full"
                    data-testid="button-resume-subscription"
                  >
                    {t("dashboard.resume") || "Resume Subscription"}
                  </Button>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Website Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.websiteProject") || "Website Project"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-2">
              <span className="font-medium">
                {website.projectName || website.domain}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.payment") || "Payment"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-3 border-b">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm">
                  **** **** **** {selectedSubscription.paymentMethod || "****"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-view-payment"
                onClick={() => setBillingView("payment-info")}
              >
                {t("dashboard.view") || "VIEW"}
              </Button>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <span className="text-sm text-muted-foreground">
                {t("dashboard.nextPayment") || "Next Payment"}
              </span>
              <span
                className="text-sm font-medium"
                data-testid={`next-payment-${selectedSubscription.id}`}
              >
                {formatCurrency(
                  (selectedSubscription as any).nextBillingAmount !== undefined && (selectedSubscription as any).nextBillingAmount !== null
                    ? (selectedSubscription as any).nextBillingAmount
                    : selectedSubscription.price,
                  selectedSubscription.currency || "EUR",
                )}
              </span>
            </div>
            {(selectedSubscription as any).nextBillingAmount === 0 && (
              <div className="py-3 border-b">
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <span className="text-blue-600 dark:text-blue-400 text-xs mt-0.5">ℹ️</span>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t("dashboard.promotionalOffer")}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">
                {t("dashboard.paymentDue") || "Payment Due"}
              </span>
              <span
                className="text-sm font-medium"
                data-testid={`payment-due-${selectedSubscription.id}`}
              >
                {selectedSubscription.nextBillingDate
                  ? formatDate(selectedSubscription.nextBillingDate)
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  };

  const renderPaymentInfo = () => {
    return (
      <div data-testid="payment-info">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.paymentInformation") || "Payment Information"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.updatePaymentMethod") ||
            "Manage your payment methods and billing details."}
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.paymentMethod") || "Payment Method"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions &&
              subscriptions.length > 0 &&
              subscriptions.some((sub) => sub.status === "active") ? (
              <>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {t("dashboard.cardOnFile") || "Card on file"}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("dashboard.managedByStripe") || "Managed by Stripe"}
                  </span>
                </div>
                <div className="pt-4">
                  <Button
                    onClick={() => updatePaymentMutation.mutate()}
                    disabled={updatePaymentMutation.isPending}
                    data-testid="button-update-payment"
                    className="w-full"
                  >
                    {updatePaymentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("dashboard.opening") || "Opening..."}
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t("dashboard.updatePaymentMethod") ||
                          "Update Payment Method"}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {t("dashboard.stripeSecure") ||
                      "You'll be redirected to Stripe's secure portal"}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  {t("dashboard.noActiveSubscription") ||
                    "No active subscription found"}
                </p>
                <Button onClick={() => navigate("/")} variant="outline">
                  {t("dashboard.subscribe") || "Subscribe Now"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Information */}
        {(() => {
          const activeSubscription = subscriptions?.find((sub) => sub.status === "active" && sub.productType === "plan");
          if (!activeSubscription) return null;
          return (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t("dashboard.billingInformation") || "Billing Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.documentType") || "Document Type"}
                  </span>
                  <span className="text-sm font-medium capitalize">
                    {activeSubscription.invoiceType === "invoice"
                      ? t("dashboard.invoice")
                      : t("dashboard.receipt")}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.subscribedSince") || "Subscribed Since"}
                  </span>
                  <span
                    className="text-sm font-medium"
                    data-testid={`created-${activeSubscription.id}`}
                  >
                    {formatDate(activeSubscription.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.vatNumber") || "VAT Number"}
                  </span>
                  {editingBilling ? (
                    <Input
                      value={vatValue}
                      onChange={(e) => setVatValue(e.target.value)}
                      className="w-40 h-8"
                      placeholder="Enter VAT"
                      disabled={updateBillingMutation.isPending}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {activeSubscription.vatNumber || (
                        <span className="text-muted-foreground">
                          {activeSubscription.invoiceType === "receipt"
                            ? t("dashboard.notRequiredForReceipts")
                            : t("dashboard.notProvided")}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.city") || "City"}
                  </span>
                  {editingBilling ? (
                    <Input
                      value={cityValue}
                      onChange={(e) => setCityValue(e.target.value)}
                      className="w-40 h-8"
                      placeholder="Enter city"
                      disabled={updateBillingMutation.isPending}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {activeSubscription.city || (
                        <span className="text-muted-foreground">
                          {t("dashboard.notProvided") || "Not provided"}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.street") || "Street"}
                  </span>
                  {editingBilling ? (
                    <Input
                      value={streetValue}
                      onChange={(e) => setStreetValue(e.target.value)}
                      className="w-40 h-8"
                      placeholder="Enter street"
                      disabled={updateBillingMutation.isPending}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {activeSubscription.street || (
                        <span className="text-muted-foreground">
                          {t("dashboard.notProvided") || "Not provided"}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.number") || "Number"}
                  </span>
                  {editingBilling ? (
                    <Input
                      value={numberValue}
                      onChange={(e) => setNumberValue(e.target.value)}
                      className="w-40 h-8"
                      placeholder="Enter number"
                      disabled={updateBillingMutation.isPending}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {activeSubscription.number || (
                        <span className="text-muted-foreground">
                          {t("dashboard.notProvided") || "Not provided"}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.postalCode") || "Postal Code"}
                  </span>
                  {editingBilling ? (
                    <Input
                      value={postalCodeValue}
                      onChange={(e) => setPostalCodeValue(e.target.value)}
                      className="w-40 h-8"
                      placeholder="Enter postal code"
                      disabled={updateBillingMutation.isPending}
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {activeSubscription.postalCode || (
                        <span className="text-muted-foreground">
                          {t("dashboard.notProvided") || "Not provided"}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {editingBilling ? (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateBillingMutation.mutate({
                          subscriptionId: activeSubscription.id,
                          vatNumber: vatValue,
                          city: cityValue,
                          street: streetValue,
                          number: numberValue,
                          postalCode: postalCodeValue
                        });
                      }}
                      disabled={updateBillingMutation.isPending}
                    >
                      {updateBillingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingBilling(false)}
                      disabled={updateBillingMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVatValue(activeSubscription.vatNumber || "");
                        setCityValue(activeSubscription.city || "");
                        setStreetValue(activeSubscription.street || "");
                        setNumberValue(activeSubscription.number || "");
                        setPostalCodeValue(activeSubscription.postalCode || "");
                        setEditingBilling(true);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t("dashboard.edit") || "Edit"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.billingHistory") || "Billing History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.viewInvoicesMessage") ||
                "View your past invoices and billing history in the Invoices section."}
            </p>
            <Button
              variant="outline"
              onClick={() => setBillingView("invoices")}
              className="mt-4"
              data-testid="button-view-invoices"
            >
              {t("dashboard.viewInvoices") || "View Invoices"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderInvoices = () => {
    // Get both new website invoices and legacy subscription transactions
    const allNewInvoices = (websiteInvoices as any[]) || [];
    const allTransactions =
      subscriptions?.flatMap((sub: any) =>
        (sub.transactions || []).map((t: any) => ({
          ...t,
          subscriptionTier: sub.tier,
          subscriptionPlan: sub.plan,
        })),
      ) || [];

    // Filter invoices by selected month and year
    const newInvoices = allNewInvoices.filter((invoice: any) => {
      const invoiceDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date(invoice.createdAt);
      return invoiceDate.getFullYear() === selectedInvoiceYear && invoiceDate.getMonth() + 1 === selectedInvoiceMonth;
    });

    const hasNewInvoices = allNewInvoices.length > 0;
    const hasTransactions = allTransactions.length > 0;

    if (invoicesLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    return (
      <div data-testid="invoices-view">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.invoices") || "Invoices"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.viewDownloadInvoices") ||
            "View and download your invoices."}
        </p>

        {!hasNewInvoices && !hasTransactions ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center" data-testid="text-no-transactions">
                <p className="text-muted-foreground">
                  {t("dashboard.noTransactions") || "No transactions yet"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* New Website Invoices Section */}
            {hasNewInvoices && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">
                    {t("dashboard.invoicesPerWebsite.title")}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedInvoiceYear.toString()}
                      onValueChange={(value) => setSelectedInvoiceYear(parseInt(value))}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedInvoiceMonth.toString()}
                      onValueChange={(value) => setSelectedInvoiceMonth(parseInt(value))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = i + 1;
                          const monthDate = new Date(selectedInvoiceYear, month - 1, 1);
                          const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });
                          return (
                            <SelectItem key={month} value={month.toString()}>
                              {monthName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newInvoices.length === 0 ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center" data-testid="text-no-invoices-month">
                        <p className="text-muted-foreground">
                          {t("dashboard.noInvoicesForMonth") || "No invoices found for this month"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {newInvoices.map((invoice: any) => (
                      <Card
                        key={`invoice-${invoice.id}`}
                        data-testid={`invoice-${invoice.id}`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">
                                {invoice.title}
                              </h4>

                              {invoice.invoiceNumber && (
                                <p className="text-sm text-muted-foreground">
                                  {invoice.invoiceNumber}
                                </p>
                              )}

                              <p className="text-sm text-muted-foreground mt-1">
                                {invoice.issueDate
                                  ? formatDate(invoice.issueDate)
                                  : formatDate(invoice.createdAt)}

                                {invoice.description && (
                                  <span>
                                    {" "}
                                    {t("dashboard.invoicesPerWebsite.descriptionSeparator")}{" "}
                                    {invoice.description}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-4">
                              {invoice.amount && (
                                <span className="text-lg font-semibold">
                                  {formatCurrency(
                                    invoice.amount,
                                    invoice.currency || "EUR",
                                  )}
                                </span>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!invoice.pdfUrl}
                                onClick={() => window.open(invoice.pdfUrl, "_blank")}
                                data-testid={`pdf-invoice-${invoice.id}`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {t("dashboard.invoicesPerWebsite.download")}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Legacy Subscription Transactions Section */}
            {/* {hasTransactions && (
              <div>
                {hasNewInvoices && (
                  <h3 className="text-lg font-semibold mb-3">Subscription Transactions</h3>
                )}
                <div className="space-y-3">
                  {allTransactions.map((transaction: any) => (
                    <Card
                      key={`transaction-${transaction.id}`}
                      data-testid={`transaction-${transaction.id}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold capitalize">
                              {transaction.subscriptionPlan?.name ||
                                transaction.subscriptionTier}{" "}
                              Plan
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(transaction.createdAt)} •{" "}
                              {transaction.status}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold">
                              {formatCurrency(
                                transaction.amount,
                                transaction.currency || "EUR",
                              )}
                            </span>
                            {transaction.pdfUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(transaction.pdfUrl, "_blank")
                                }
                                data-testid={`pdf-${transaction.id}`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {t("dashboard.download") || "Download"}
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {t("dashboard.noPdf") || "No PDF"}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )} */}
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    // Check if this is a basic tier subscription
    const isBasicTier = planSubscription?.tier === "basic";
    const disabled = planSubscription?.status !== "active";

    // Basic Tier: Show upsell page
    if (isBasicTier) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-[#182B53]">
            {t("dashboard.analytics")}
          </h2>

          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center px-4 text-center max-w-2xl mx-auto">

                <div className="rounded-full bg-blue-100 p-4 mb-6">
                  <BarChart className="h-12 w-12 text-blue-600" />
                </div>

                <h3 className="text-2xl font-bold mb-3">
                  {t("dashboard.analyticsUpsell.unlockTitle")}
                </h3>

                <p className="text-muted-foreground text-lg mb-6">
                  {t("dashboard.analyticsUpsell.unlockDescription")}
                </p>

                <div className="grid md:grid-cols-2 gap-4 w-full mb-8">

                  <div className="text-left p-4 border rounded-lg">
                    <Eye className="h-6 w-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold mb-1">
                      {t("dashboard.analyticsUpsell.visitorInsightsTitle")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.analyticsUpsell.visitorInsightsDescription")}
                    </p>
                  </div>

                  <div className="text-left p-4 border rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold mb-1">
                      {t("dashboard.analyticsUpsell.trafficSourcesTitle")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.analyticsUpsell.trafficSourcesDescription")}
                    </p>
                  </div>

                  <div className="text-left p-4 border rounded-lg">
                    <Monitor className="h-6 w-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold mb-1">
                      {t("dashboard.analyticsUpsell.deviceBreakdownTitle")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.analyticsUpsell.deviceBreakdownDescription")}
                    </p>
                  </div>

                  <div className="text-left p-4 border rounded-lg">
                    <Activity className="h-6 w-6 text-blue-600 mb-2" />
                    <h4 className="font-semibold mb-1">
                      {t("dashboard.analyticsUpsell.performanceMetricsTitle")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.analyticsUpsell.performanceMetricsDescription")}
                    </p>
                  </div>

                </div>

                <Button
                  size="lg"
                  onClick={() => {
                    setUpgradeRequestFeature("Analytics");
                    setUpgradeRequestDialogOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-upgrade-analytics"
                >
                  {t("dashboard.analyticsUpsell.requestUpgrade")}
                </Button>

              </div>
            </CardContent>
          </Card>
        </div>
      );
    }


    // Essential/Pro tier: Show analytics
    return (
      <div className="space-y-6">
        <WebsiteAnalytics websiteId={parseInt(websiteId!)} />

        {/* Essential tier: Show locked advanced analytics placeholder */}
        {planSubscription?.tier === "essential" && (
          <Card className="border-2 border-dashed border-muted-foreground/30">
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center px-4 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  Unlock advanced analytics features with our Pro plan. Get deeper insights, custom reports, and more.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUpgradeRequestFeature("Advanced Analytics");
                    setUpgradeRequestDialogOpen(true);
                  }}
                  data-testid="button-upgrade-pro-analytics"
                >
                  Request Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pro tier: Show coming soon for advanced features */}
        {planSubscription?.tier === "pro" && (
          <Card className={`border-2 border-dashed border-blue-300 bg-blue-50/30 ${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center px-4 text-center">
                <div className="rounded-full bg-blue-100 p-3 mb-4">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
                <p className="text-muted-foreground max-w-md">
                  Advanced analytics features are coming soon! We're working on bringing you even more powerful insights and reporting tools.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderNewsletter = () => {
    // Show loading state while fetching settings
    const disabled = planSubscription?.status !== "active";
    if (newsletterSettings === undefined) {
      return (
        <div
          data-testid="newsletter-view"
          className="flex justify-center py-12"
        >
          <Loader2
            className="h-8 w-8 animate-spin"
            data-testid="loader-newsletter-settings"
          />
        </div>
      );
    }

    // Show "Coming Soon" if newsletter is disabled by admin
    if (!newsletterSettings?.newsletterEnabled) {
      return (
        <div data-testid="newsletter-view">
          <h2 className="text-2xl font-bold mb-6">
            {t("dashboard.newsletter") || "Newsletter"}
          </h2>
          <Card>
            <CardContent className="py-16">
              <div className="text-center max-w-md mx-auto">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-muted rounded-full">
                    <Mail className="h-12 w-12 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  {t("dashboard.comingSoon") || "Coming Soon"}
                </h3>
                <p className="text-muted-foreground">
                  {t("dashboard.newsletterComingSoon") ||
                    "Newsletter feature is currently under development. Manage your subscribers and send beautiful newsletters soon!"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Newsletter is enabled - show options cards
    const isBasicTier = planSubscription?.emailUsage?.limit === 0;

    // Basic Tier: Show ONLY upsell card, don't render newsletter content
    if (isBasicTier) {
      return (
        <div data-testid="newsletter-view" className="space-y-4">
          <h2 className="text-2xl font-bold mb-6">
            {t("dashboard.newsletter") || "Newsletter"}
          </h2>
          <Card className="max-w-2xl mx-auto" data-testid="card-basic-tier-upsell">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center text-xl">
                {t("dashboard.upgradeToUnlockNewsletter") || "Upgrade to Unlock Newsletter"}
              </CardTitle>
              <CardDescription className="text-center">
                {t("dashboard.basicTierNoNewsletter") || "Your Basic plan doesn't include newsletter features. Upgrade to Essential to send up to 3,000 emails per month, or Pro for 10,000 emails."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-semibold">Essential Plan</p>
                    <p className="text-sm text-muted-foreground">3,000 emails/month</p>
                  </div>
                  <Button
                    onClick={() => {
                      setUpgradeRequestFeature("Newsletter");
                      setUpgradeRequestDialogOpen(true);
                    }}
                    data-testid="button-upgrade-essential"
                  >
                    {t("dashboard.requestUpgrade") || "Request Upgrade"}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-semibold">Pro Plan</p>
                    <p className="text-sm text-muted-foreground">10,000 emails/month</p>
                  </div>
                  <Button
                    onClick={() => {
                      setUpgradeRequestFeature("Newsletter");
                      setUpgradeRequestDialogOpen(true);
                    }}
                    data-testid="button-upgrade-pro"
                  >
                    {t("dashboard.requestUpgrade") || "Request Upgrade"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div data-testid="newsletter-view" className="space-y-4">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.newsletter") || "Newsletter"}
        </h2>

        {/* Email Usage Indicator */}
        {planSubscription?.emailUsage && (
          <Card data-testid="card-email-usage">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("dashboard.emailUsage") || "Email Usage This Month"}
              </CardTitle>
              <CardDescription>
                {planSubscription.emailUsage.used.toLocaleString()} {t("dashboard.emailsSentOf") || "of"} {planSubscription.emailUsage.limit.toLocaleString()} {t("dashboard.emailsSent") || "emails sent"}
                <span className="ml-2 text-xs">
                  • {t("dashboard.emailNewsletterResets") || "Resets"} {(() => {
                    const now = new Date();
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    return nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                  })()}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${planSubscription.emailUsage.limit === 0
                      ? "bg-muted-foreground"
                      : planSubscription.emailUsage.used / planSubscription.emailUsage.limit >= 0.9
                        ? "bg-destructive"
                        : planSubscription.emailUsage.used / planSubscription.emailUsage.limit >= 0.75
                          ? "bg-orange-500"
                          : "bg-primary"
                      }`}
                    style={{
                      width: planSubscription.emailUsage.limit === 0
                        ? "0%"
                        : `${Math.min(100, (planSubscription.emailUsage.used / planSubscription.emailUsage.limit) * 100)}%`,
                    }}
                    data-testid="progress-email-usage"
                  />
                </div>
                {planSubscription.emailUsage.limit === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.upgradeForEmails") || "Upgrade to Essential or Pro to send newsletter emails"}
                  </p>
                ) : planSubscription.emailUsage.used >= planSubscription.emailUsage.limit ? (
                  <p className="text-sm text-destructive font-medium">
                    {t("dashboard.emailLimitReached") || "Monthly email limit reached. Upgrade for more emails."}
                  </p>
                ) : planSubscription.emailUsage.used / planSubscription.emailUsage.limit >= 0.9 ? (
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                    {t("dashboard.emailLimitWarning") || "You're running low on emails. Consider upgrading."}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {planSubscription.emailUsage.remaining.toLocaleString()} {t("dashboard.emailsRemaining") || "emails remaining."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Builder Card */}
        <Card
          className={`cursor-pointer hover:border-primary transition-colors ${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}
          onClick={() => {
            setNewsletterView("builder");
            navigate(`/websites/${websiteId}/email-builder`);
          }}
          data-testid="card-email-builder"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.emailBuilder") || "Email Builder"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.emailBuilderDescription") ||
                      "Design and create beautiful email templates with our visual editor"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Tags Card */}
        <Card
          className={`cursor-pointer hover:border-primary transition-colors`}
          onClick={() => setNewsletterView("groups")}
          data-testid="card-tags"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.tags") || "Tags"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.tagsDescription") ||
                      "Organize subscribers with tags for targeted campaigns"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Contacts Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setNewsletterView("contacts")}
          data-testid="card-contacts"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.contacts") || "Contacts"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.contactsDescription") ||
                      "Manage your subscriber list and contact information"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Email Templates Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setNewsletterView("templates")}
          data-testid="card-templates"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.emailTemplates") || "Email Templates"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.emailTemplatesDescription") ||
                      "View and manage your saved email templates"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>

        {/* Campaigns Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setNewsletterView("campaigns")}
          data-testid="card-campaigns"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("dashboard.campaigns.title") || "Campaigns"}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.campaignsDescription") ||
                      "Create and manage email campaigns for your subscribers"}
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  };

  const renderEmailBuilder = () => {
    return (
      <div data-testid="newsletter-builder-view">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {t("dashboard.emailBuilder") || "Email Builder"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t("dashboard.createEmailTemplatesDesc") ||
                "Create and design beautiful email templates for your newsletters."}
            </p>
          </div>
          <Button
            onClick={() => navigate(`/websites/${websiteId}/email-builder`)}
            data-testid="button-open-builder"
          >
            <Pencil className="h-4 w-4 mr-2" />
            {t("dashboard.openBuilder") || "Open Builder"}
          </Button>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-muted rounded-md">
                  <Pencil className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("dashboard.visualEmailEditor") || "Visual Email Editor"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {t("dashboard.emailBuilderDescription") ||
                  "Design professional email templates with our drag-and-drop editor. Create beautiful newsletters without any coding required."}
              </p>
              <Button
                onClick={() => navigate(`/websites/${websiteId}/email-builder`)}
                size="lg"
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t("dashboard.startBuilding") || "Start Building"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTemplatesView = () => {
    const disabled = planSubscription?.status !== "active";
    return (
      <div data-testid="newsletter-templates-view">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              {t("dashboard.emailTemplates") || "Email Templates"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t("dashboard.viewManageTemplates") ||
                "View and manage your saved email templates"}
            </p>
          </div>
          <Button
            onClick={() => navigate(`/websites/${websiteId}/email-builder`)}
            data-testid="button-create-new-template"
            className={`${disabled ? 'pointer-events-none opacity-50 grayscale' : ''}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("dashboard.createNewTemplate") || "Create New Template"}
          </Button>
        </div>

        {templatesLoading ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              data-testid="loader-templates"
            />
          </div>
        ) : !emailTemplates || emailTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-muted rounded-md">
                    <Mail className="h-12 w-12 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {t("dashboard.noTemplatesYet") || "No templates saved yet"}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {t("dashboard.createFirstTemplate") ||
                    "Create your first email template using the email builder"}
                </p>
                <Button
                  onClick={() =>
                    navigate(`/websites/${websiteId}/email-builder`)
                  }
                  size="lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("dashboard.createTemplate") || "Create Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {emailTemplates.map((template) => (
              <Card
                key={template.id}
                className="hover:border-primary transition-colors flex flex-col"
                data-testid={`template-card-${template.id}`}
              >
                <CardHeader className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold mb-1">
                        {template.name}
                      </CardTitle>
                      {template.category && (
                        <Badge variant="outline" className="mb-2">
                          {template.category}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Last updated:{" "}
                        {new Date(
                          template.updatedAt || template.createdAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <TooltipProvider>
                    <div className="flex gap-2 justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              sessionStorage.setItem(
                                "loadTemplateId",
                                template.id.toString(),
                              );
                              navigate(`/websites/${websiteId}/email-builder`);
                            }}
                            className={disabled ? 'pointer-events-none opacity-50 grayscale' : ''}
                            data-testid={`button-edit-${template.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("dashboard.edit") || "Edit"}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const previewWindow = window.open("", "_blank");
                              if (previewWindow) {
                                previewWindow.document.write(template.html);
                                previewWindow.document.close();
                              }
                            }}
                            data-testid={`button-preview-${template.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("dashboard.preview") || "Preview"}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const blob = new Blob([template.html], {
                                type: "text/html",
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${template.name}.html`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              toast({
                                title: t("dashboard.success") || "Success",
                                description:
                                  t("dashboard.templateExported") ||
                                  "Template exported successfully",
                              });
                            }}
                            data-testid={`button-download-${template.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("dashboard.download") || "Download"}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => duplicateTemplateMutation.mutate(template.id)}
                            disabled={duplicateTemplateMutation.isPending}
                            data-testid={`button-duplicate-${template.id}`}
                          >
                            {duplicateTemplateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("dashboard.duplicate") || "Duplicate"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMediaSection = () => {
    const mediaFiles = mediaData?.media || [];

    const handleUploadClick = async () => {
      if (!window.cloudinary) {
        toast({
          title: "Error",
          description: "Upload widget not ready. Please refresh the page and try again.",
          variant: "destructive",
        });
        console.error("Cloudinary widget script not loaded");
        return;
      }

      // Get Cloudinary configuration from server
      let cloudinaryConfig = { apiKey: "", cloudName: "" };
      try {
        const configResponse = await fetch("/api/cloudinary/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paramsToSign: { folder: `Website Media/${userData?.user?.email}/${website?.domain}` } }),
          credentials: "include",
        });

        if (!configResponse.ok) {
          throw new Error("Failed to get configuration");
        }

        const configData = await configResponse.json();
        cloudinaryConfig.apiKey = configData.apiKey;
        cloudinaryConfig.cloudName = configData.cloudName;
      } catch (error) {
        console.error("Failed to get configuration:", error);
        toast({
          title: "Error",
          description: "Failed to initialize upload. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: cloudinaryConfig.cloudName,
          apiKey: cloudinaryConfig.apiKey,
          uploadSignature: async (callback: any, paramsToSign: any) => {
            try {
              const response = await fetch("/api/cloudinary/signature", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
                credentials: "include",
              });

              if (!response.ok) {
                throw new Error("Failed to get upload signature");
              }

              const data = await response.json();
              callback({ signature: data.signature, timestamp: data.timestamp });
            } catch (error) {
              console.error("Signature generation error:", error);
              toast({
                title: "Error",
                description: "Failed to prepare upload. Please try again.",
                variant: "destructive",
              });
            }
          },
          folder: `Website Media/${userData?.user?.email}/${website?.domain}`,
          sources: ["local", "url", "camera"],
          multiple: true,
          maxFileSize: 52428800, // 50MB
          resourceType: "auto",
          clientAllowedFormats: [
            "image",
            "video",
            "pdf",
            "doc",
            "docx",
            "xls",
            "xlsx",
            "csv",
            "txt",
            "rtf",
            "odt",
            "ods",
            "ppt",
            "pptx",
            "zip",
            "rar",
          ],
        },
        (error: any, result: any) => {
          if (error) {
            console.error("Upload error:", error);
            toast({
              title: "Error",
              description: "Upload failed. Please try again.",
              variant: "destructive",
            });
            return;
          }

          if (result.event === "success") {
            addMediaMutation.mutate({
              url: result.info.secure_url,
              publicId: result.info.public_id,
              name: result.info.original_filename || "Untitled",
            });
          }
        }
      );

      if (!widget) {
        toast({
          title: "Error",
          description: "Failed to initialize upload widget. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      widget.open();
    };

    return (
      <div data-testid="media-section">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.media") || "Media"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.mediaDescription") || "Media"}
        </p>

        <div className="mb-6">
          <Button
            onClick={handleUploadClick}
            data-testid="button-upload-media"
            disabled={planSubscription?.status !== "active"}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t("dashboard.uploadMedia") || "Upload Media"}
          </Button>
        </div>

        {mediaLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-media" />
          </div>
        ) : mediaFiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {t("dashboard.noMediaFiles") || "No media files uploaded yet. Click the button above to upload your first file."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaFiles.map((file) => {
              const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
              const cloudinaryFormat = file.format?.toLowerCase() || '';
              
              // Check if it's an image - use format from Cloudinary or file extension
              const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
              const isImage = imageFormats.includes(fileExtension) || imageFormats.includes(cloudinaryFormat);
              
              // Check if it's a video
              const videoFormats = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v', 'flv'];
              const isVideo = videoFormats.includes(fileExtension) || videoFormats.includes(cloudinaryFormat);
              
              // Check if it's a document
              const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'odt', 'ods', 'ppt', 'pptx'].includes(fileExtension);
              
              // Check if it's an archive
              const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension);

              return (
              <Card key={file.publicId} data-testid={`media-card-${file.publicId}`}>
                <CardContent className="p-4">
                  <div
                    className="aspect-video bg-muted rounded-md mb-3 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center"
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    {isImage ? (
                      <img
                        src={file.previewUrl || file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback if image fails to load - show file icon
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'w-full h-full flex items-center justify-center';
                            fallbackDiv.innerHTML = `
                              <div class="text-center p-4">
                                <svg class="h-12 w-12 mx-auto text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <p class="text-xs text-muted-foreground truncate px-2">${file.name}</p>
                              </div>
                            `;
                            parent.appendChild(fallbackDiv);
                          }
                        }}
                      />
                    ) : isVideo ? (
                      <video
                        src={file.url}
                        className="w-full h-full object-cover"
                        controls={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center p-4">
                          {isDocument ? (
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          ) : isArchive ? (
                            <Download className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          ) : (
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          )}
                          <p className="text-xs text-muted-foreground truncate px-2">{file.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate mb-3">{file.name}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(file.url, '_blank')}
                      data-testid={`button-view-${file.publicId}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {/* <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          const response = await fetch(file.url);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = file.name || 'download';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Download failed:', error);
                          toast({
                            title: "Error",
                            description: "Failed to download file",
                            variant: "destructive",
                          });
                        }
                      }}
                      data-testid={`button-download-${file.publicId}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button> */}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setDeleteMediaId(file.publicId)}
                    data-testid={`button-delete-${file.publicId}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}

        <AlertDialog open={deleteMediaId !== null} onOpenChange={(open) => !open && setDeleteMediaId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Media File?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the file from your website media library. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMediaMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => deleteMediaId && deleteMediaMutation.mutate(deleteMediaId)}
                disabled={deleteMediaMutation.isPending}
              >
                {deleteMediaMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  const renderChangesSection = () => {
    // Check if "Website Launch" stage is completed
    const websiteLaunchStage = website?.stages?.find(
      (stage: any) => stage.title === "Website Launch"
    );
    const isWebsiteLaunchCompleted = websiteLaunchStage?.status === "completed";

    const currentWebsiteChanges = changesData?.changes?.find(
      (change: any) => change.domain === website?.domain,
    );
    const changesUsed = currentWebsiteChanges?.changesUsed || 0;
    const changesAllowed = currentWebsiteChanges?.changesAllowed || 0;
    const changeLogs = currentWebsiteChanges?.changeLogs || [];
    const isUnlimited = changesAllowed === -1;
    
    // If website launch is NOT completed, allow unlimited changes (no limit applied)
    // If website launch IS completed, apply the normal limit logic
    const canSubmit = !isWebsiteLaunchCompleted 
      ? true // Unlimited changes before launch
      : (isUnlimited || changesUsed < changesAllowed); // Apply limit after launch

    return (
      <div data-testid="changes-section">
        <h2 className="text-2xl font-bold mb-6">
          {t("dashboard.changes") || "Changes"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.changesDescription") ||
            "Request changes to your website and track their status."}
        </p>

        {!isWebsiteLaunchCompleted && (
          <Card className="mb-6">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {t("dashboard.preLaunchChanges") || "Pre-Launch Changes"}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {t("dashboard.unlimitedChangesBeforeLaunch") ||
                      "You have unlimited change requests available before your website is launched. Limits will apply after the Website Launch stage is completed."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Card - Only show after launch */}
        {isWebsiteLaunchCompleted && (
          <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>{t("dashboard.changesUsage") || "Changes Usage"}</span>
              {isUnlimited ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  {t("dashboard.unlimited") || "Unlimited"}
                </Badge>
              ) : changesUsed >= changesAllowed ? (
                <Badge variant="destructive">
                  {t("dashboard.limitReached") || "Limit Reached"}
                </Badge>
              ) : changesUsed >= changesAllowed * 0.8 ? (
                <Badge
                  variant="secondary"
                  className="bg-yellow-50 text-yellow-700 border-yellow-200"
                >
                  {t("dashboard.nearlyFull") || "Nearly Full"}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold mb-2">
              <span>{changesUsed}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">
                {isUnlimited ? "∞" : changesAllowed}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {isUnlimited
                ? t("dashboard.unlimitedChanges") ||
                "You have unlimited changes available"
                : `${changesAllowed - changesUsed} ${t("dashboard.changesRemaining") || "changes remaining"}`}
            </p>
          </CardContent>
        </Card>
        )}

        {/* Request Form - Always visible */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("dashboard.requestChange") || "Request a Change"}
            </CardTitle>
            <CardDescription>
              {t("dashboard.requestChangeDescription") ||
                "Describe the changes you'd like to make to your website"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="change-subject">
                  {t("dashboard.subject") || "Subject"}
                </Label>
                <Input
                  id="change-subject"
                  placeholder={
                    t("dashboard.subjectPlaceholder") ||
                    "Brief description of the change"
                  }
                  value={changeSubject}
                  onChange={(e) => setChangeSubject(e.target.value)}
                  disabled={!canSubmit || submitChangeRequestMutation.isPending}
                  data-testid="input-change-subject"
                />
              </div>
              <div>
                <Label htmlFor="change-message">
                  {t("dashboard.message") || "Message"}
                </Label>
                <Textarea
                  id="change-message"
                  placeholder={
                    t("dashboard.messagePlaceholder") ||
                    "Detailed description of what you'd like to change"
                  }
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  disabled={!canSubmit || submitChangeRequestMutation.isPending}
                  rows={5}
                  data-testid="textarea-change-message"
                />
              </div>

              {/* File Upload Section */}
              <div>
                <Label>{t("dashboard.attachFiles") || "Attach Files (Optional)"}</Label>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleChangeFileUpload}
                    disabled={!canSubmit || submitChangeRequestMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-files"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("dashboard.uploadFiles") || "Upload Files"}
                  </Button>
                  {changeFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {changeFiles.map((file) => (
                        <div
                          key={file.publicId}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-md border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChangeFile(file.publicId)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isWebsiteLaunchCompleted && !canSubmit && !isUnlimited && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-yellow-700" />
                  <p className="text-sm text-yellow-700">
                    {t("dashboard.changesLimitReached") ||
                      "You've reached your monthly change limit. Please upgrade your plan for more changes."}
                  </p>
                </div>
              )}
              <Button
                onClick={() => submitChangeRequestMutation.mutate()}
                disabled={
                  !canSubmit ||
                  !changeSubject ||
                  !changeMessage ||
                  submitChangeRequestMutation.isPending
                }
                className="w-full"
                data-testid="button-submit-change"
              >
                {submitChangeRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("dashboard.submitting") || "Submitting..."}
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t("dashboard.submitRequest") || "Submit Request"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change History */}
        {changeLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("dashboard.changeHistory") || "Change History"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-4 border rounded-md"
                    data-testid={`change-log-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{log.changeDescription}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(log.createdAt)}
                        </p>

                        {/* Display attached files if any */}
                        {log.files && log.files.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">
                              {t("dashboard.attachments") || "Attachments"}:
                            </p>
                            {log.files.map((file: any, index: number) => (
                              <a
                                key={file.publicId || index}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <FileText className="h-3 w-3" />
                                {file.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderDiscoverSection = () => {
    return (
      <div data-testid="section-discover">
        <h2 className="text-2xl font-bold mb-2">
          {t("dashboard.discover") || "Discover"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("dashboard.addOnsDesc") ||
            "Enhance your website with premium features"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {AVAILABLE_ADDONS.map((addon) => {
            const isPurchased = subscriptions?.some(
              (sub) =>
                sub.productType === "addon" &&
                sub.productId === addon.id &&
                sub.status === "active" &&
                sub.websiteProgressId === parseInt(websiteId || "0"),
            );

            return (
              <Card key={addon.id} data-testid={`addon-card-${addon.id}`} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 border-2 border-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/5">
                      {addon.image ? (
                        <img
                          src={addon.image}
                          alt={addon.name}
                          className="w-8 h-8"
                        />
                      ) : (
                        <Package className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-bold">{addon.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col pt-2">
                  <p className="text-sm text-muted-foreground flex-1">
                    {addon.description}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold">{addon.price}€</span>
                      <span className="text-muted-foreground text-sm">/month</span>
                    </div>
                    <Button
                      onClick={() => {
                        if (!isPurchased) {
                          setSelectedAddOn(addon);
                          setConfirmDialogOpen(true);
                        }
                      }}
                      disabled={isPurchased}
                      variant={isPurchased ? "secondary" : "default"}
                      data-testid={`button-purchase-${addon.id}`}
                    >
                      {isPurchased ? (
                        t("dashboard.alreadyPurchased") || "Already Purchased"
                      ) : (
                        t("dashboard.purchase") || "Purchase"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTipsSection = () => {
    return (
      <div data-testid="section-tips">
        <Tips />
      </div>
    );
  };


  const renderGroupsView = () => {
    return (
      <div data-testid="newsletter-tags-view">
        <TagsManagement websiteProgressId={Number(websiteId)} planSubscription={planSubscription} />
      </div>
    );
  };

  const renderContactsView = () => {
    return (
      <div data-testid="newsletter-contacts-view">
        <ContactsList websiteProgressId={Number(websiteId)} planSubscription={planSubscription} />
      </div>
    );
  };

  const renderCampaignsView = () => {
    return (
      <div data-testid="newsletter-campaigns-view">
        <CampaignsList websiteProgressId={Number(websiteId)} planSubscription={planSubscription} />
      </div>
    );
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenuContent
                  menuItems={menuItems}
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                  setBillingView={setBillingView}
                  setNewsletterView={setNewsletterView}
                  handleLogout={handleLogout}
                  handleOpenBooking={handleOpenBooking}
                  isBookingLoading={isBookingLoading}
                  navigate={navigate}
                  t={t}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3" data-testid="banner-feedback">
              <p className="text-xs text-blue-900 dark:text-blue-100 mb-3">
                <strong className="font-semibold">🚀 {t("dashboard.noticeForNewPlatformFeedbackTitle")}</strong>{" "}
                {t("dashboard.noticeForNewPlatformFeedback")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackDialogOpen(true)}
                className="w-full border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs"
                data-testid="button-open-feedback"
              >
                <MessageSquare className="h-3 w-3 mr-2" />
                {t("dashboard.shareFeedback")}
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {isBookingLoading && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
            data-testid="booking-loading-overlay"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {t("dashboard.bookingOpening") || "Opening Booking..."}
            </p>
          </div>
        )}

        <SidebarInset>
          <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger />
            </header>
            <div className="flex-1 p-4 md:p-6">
              {renderBreadcrumbs()}

              {activeSection === "progress" && (
                <div data-testid="section-progress">
                  <WebsiteProgress websiteId={Number(websiteId)} />
                </div>
              )}

              {activeSection === "changes" && (
                <div data-testid="section-changes">{renderChangesSection()}</div>
              )}

              {activeSection === "media" && (
                <div data-testid="section-media">{renderMediaSection()}</div>
              )}

              {activeSection === "content" && website?.siteId && (
                <div data-testid="section-content" className="flex flex-col items-center justify-center h-[60vh] gap-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-semibold">{t("dashboard.contentEditor")}</h2>
                    <p className="text-muted-foreground max-w-md">
                      {t("dashboard.contentEditorDescription")}
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={() => setContentEditorOpen(true)}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("dashboard.openContentEditor")}
                  </Button>
                  <ContentEditor 
                    websiteId={Number(websiteId)} 
                    siteId={website.siteId}
                    open={contentEditorOpen}
                    onOpenChange={setContentEditorOpen}
                  />
                </div>
              )}

              {activeSection === "billing" && (
                <div data-testid="section-billing">
                  {billingView === "overview" && renderBillingOverview()}
                  {billingView === "subscriptions" && renderSubscriptionsList()}
                  {billingView === "subscription-detail" &&
                    renderSubscriptionDetail()}
                  {billingView === "payment-info" && renderPaymentInfo()}
                  {billingView === "invoices" && renderInvoices()}
                </div>
              )}

              {activeSection === "analytics" && (
                <div data-testid="section-analytics">{renderAnalytics()}</div>
              )}

              {activeSection === "newsletter" && (
                <div data-testid="section-newsletter">
                  {newsletterView === "overview" && renderNewsletter()}
                  {newsletterView === "groups" && renderGroupsView()}
                  {newsletterView === "contacts" && renderContactsView()}
                  {newsletterView === "builder" && renderEmailBuilder()}
                  {newsletterView === "templates" && renderTemplatesView()}
                  {newsletterView === "campaigns" && renderCampaignsView()}
                </div>
              )}

              {activeSection === "discover" && renderDiscoverSection()}

              {activeSection === "tips" && tipsVisibleInUserDashboard && renderTipsSection()}

              {/* {activeSection === "account" && renderAccountSettings()} */}
            </div>
          </div>
        </SidebarInset>
      </div>

      {/* Cancel Subscription Confirmation Dialog */}
      <AlertDialog
        open={subscriptionToCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) {
            setSubscriptionToCancel(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dashboard.areSureCancel") || "Are you sure you want to cancel?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.actionCannotBeUndone") || "This action cannot be undone. Your subscription will remain active until the end of the current billing period."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              {t("dashboard.noKeepSubscription") || "No, Keep Subscription"}
            </AlertDialogCancel>
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("dashboard.cancelling") || "Cancelling..."}
                </>
              ) : (
                t("dashboard.yesCancelSubscription") || "Yes, Cancel Subscription"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade to Yearly Dialog - Shows legacy or standard based on subscription */}
      {subscriptionToUpgrade && (
        subscriptionToUpgrade.isLegacy ? (
          <LegacyUpgradeDialog
            open={upgradeDialogOpen}
            onOpenChange={setUpgradeDialogOpen}
            subscriptionId={subscriptionToUpgrade.id}
          />
        ) : (
          <UpgradeToYearlyDialog
            open={upgradeDialogOpen}
            onOpenChange={setUpgradeDialogOpen}
            subscriptionId={subscriptionToUpgrade.id}
            tier={subscriptionToUpgrade.tier}
            currentPeriodEnd={subscriptionToUpgrade.currentPeriodEnd ? new Date(subscriptionToUpgrade.currentPeriodEnd) : undefined}
            vatNumber={subscriptionToUpgrade.vatNumber}
            invoiceType={subscriptionToUpgrade.invoiceType}
          />
        )
      )}

      {/* Tier Upgrade Request Dialog */}
      <UpgradeRequestDialog
        open={upgradeRequestDialogOpen}
        onOpenChange={setUpgradeRequestDialogOpen}
        currentTier={planSubscription?.tier ?? "basic"}
        feature={upgradeRequestFeature}
        websiteId={websiteId ? parseInt(websiteId) : undefined}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
      />

      {/* Add-on Purchase Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => {
        if (!purchaseAddOnMutation.isPending) {
          setConfirmDialogOpen(open);
          if (!open) setSelectedAddOn(null);
        }
      }}>
        <DialogContent data-testid="dialog-addon-confirm">
          <DialogHeader>
            <DialogTitle>
              {t("dashboard.confirmPurchase") || "Confirm Add-on Purchase"}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.reviewPurchaseDetails") || "Review the details of your purchase below"}
            </DialogDescription>
          </DialogHeader>

          {selectedAddOn && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-lg mb-1">{selectedAddOn.name}</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedAddOn.description}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">€{selectedAddOn.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm font-medium mb-2">
                  {t("dashboard.paymentMethod") || "Payment Method"}
                </p>
                {paymentMethodLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{t("dashboard.loading") || "Loading..."}</span>
                  </div>
                ) : paymentMethod?.hasPaymentMethod && paymentMethod.card ? (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="capitalize">{paymentMethod.card.brand}</span>
                    <span className="text-muted-foreground">•••• {paymentMethod.card.last4}</span>
                  </div>
                ) : (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 -mx-4 -mb-4 mt-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-700 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">
                          No Payment Method
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Please add a payment method in your billing settings before purchasing add-ons.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                setSelectedAddOn(null);
              }}
              disabled={purchaseAddOnMutation.isPending}
              data-testid="button-cancel-addon"
            >
              {t("dashboard.cancel") || "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (selectedAddOn) {
                  purchaseAddOnMutation.mutate(selectedAddOn.id);
                }
              }}
              disabled={purchaseAddOnMutation.isPending || paymentMethodLoading || !paymentMethod?.hasPaymentMethod}
              data-testid="button-confirm-addon"
            >
              {purchaseAddOnMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("dashboard.processing") || "Processing..."}
                </>
              ) : (
                t("dashboard.confirmPurchase") || "Confirm Purchase"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
