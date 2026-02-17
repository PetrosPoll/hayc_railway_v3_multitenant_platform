import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Shield,
  Download,
  ChevronRight,
  ChevronDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Tag,
  Pencil,
  User as UserIcon
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { subscriptions, UserRole, RolePermissions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useCallback, useState } from "react";
import React from "react";
import { EmailTester } from "@/components/ui/email-tester";
import { SubscriptionCalendar } from "@/components/ui/subscription-calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminWebsiteProgress as AdminWebsiteProgressComponent } from "@/components/ui/admin-website-progress";
import { TipsManagement } from "@/components/ui/tips-management";
import { AdminWebsiteChanges } from "@/components/ui/admin-website-changes";
import { UserMigrationManager } from "@/components/ui/user-migration-manager";
import { AdminWebsiteInvoices } from "@/components/ui/admin-website-invoices";
import { Switch } from "@/components/ui/switch";
import { RoleManagement } from "@/components/ui/role-management";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Function to format date to DD-MM-YYYY HH:MM
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

// TEMPORARY: Mock website data for invoice demonstration - REMOVE WHEN DONE
interface Website {
  id: number;
  userId: number;
  domain: string;
  projectName: string;
  stages: string[];
  subscriptionStatus: string;
  subscriptionTier: string;
  email: string;
  pdfUrl: string | null;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Transaction {
  id: number;
  subscriptionId: number;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
}

interface Subscription {
  id: number;
  userId: number;
  tier: string;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
  username: string;
  email: string;
  invoiceType: string;
  vatNumber: string | null;
  cancellationReason: string | null;
  nextBillingDate?: string;
  price?: number;
  transactions?: Transaction[];
}

declare global {
  interface Window {
    cloudinary: any;
  }
}

// User Details View Component
function UserDetailsView({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/users", userId, "subscriptions"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/subscriptions`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user subscriptions");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{data.user.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{data.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{data.user.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-medium">{data.user.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Email Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Newsletter Email Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {data.subscriptions.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No subscriptions found for this user
            </div>
          ) : (
            <div className="space-y-4">
              {data.subscriptions.map((subscription: any) => (
                <div
                  key={subscription.id}
                  className="border rounded-lg p-4"
                  data-testid={`subscription-${subscription.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg capitalize">{subscription.tier} Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        Status: <span className={subscription.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}>{subscription.status}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Subscription ID</p>
                      <p className="font-medium">{subscription.id}</p>
                    </div>
                  </div>

                  {/* Email Usage Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email Usage</span>
                      <span className="font-medium">
                        {subscription.emailUsage.used.toLocaleString()} / {subscription.emailUsage.limit.toLocaleString()} emails
                      </span>
                    </div>
                    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${subscription.emailUsage.limit === 0
                          ? "bg-muted-foreground"
                          : subscription.emailUsage.used / subscription.emailUsage.limit >= 0.9
                            ? "bg-destructive"
                            : subscription.emailUsage.used / subscription.emailUsage.limit >= 0.75
                              ? "bg-orange-500"
                              : "bg-primary"
                          }`}
                        style={{
                          width: subscription.emailUsage.limit === 0
                            ? "0%"
                            : `${Math.min(100, (subscription.emailUsage.used / subscription.emailUsage.limit) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {subscription.emailUsage.remaining.toLocaleString()} remaining
                      </span>
                      <span>
                        Resets: {(() => {
                          const now = new Date();
                          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                          return nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Additional subscription info */}
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span className="font-medium">
                        {new Date(subscription.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {subscription.websiteProgressId && (
                      <div>
                        <span className="text-muted-foreground">Website ID:</span>{" "}
                        <span className="font-medium">{subscription.websiteProgressId}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use URL as the single source of truth for active tab
  const activeTab = searchParams.get("tab") || "users";

  // Handler to update the tab in the URL
  const handleTabChange = (newTab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", newTab);
    setSearchParams(newParams);
  };

  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    number | null
  >(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] =
    useState<Subscription | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [verifyingUserId, setVerifyingUserId] = useState<number | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [userToVerify, setUserToVerify] = useState<User | null>(null);
  const [couponInfo, setCouponInfo] = useState<{
    name: string;
    duration: string;
    percentOff: number;
  } | null>(null);
  const [userCouponStatus, setUserCouponStatus] = useState<{
    hasCoupon: boolean;
    hasActiveSubscription: boolean;
    couponName?: string;
  } | null>(null);

  // Verify review mutation
  const verifyReviewMutation = useMutation({
    mutationFn: async (userId: number) => {
      setVerifyingUserId(userId);
      const response = await fetch(`/api/admin/users/${userId}/verify-review`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify review");
      }
      return response.json();
    },
    onSuccess: () => {
      setVerifyingUserId(null);
      toast({
        title: "Success",
        description: "Review verified and coupon applied successfully",
      });
    },
    onError: (error: any) => {
      setVerifyingUserId(null);

      // Check if the error is about coupon already applied
      if (error.message.includes("already has this coupon applied")) {
        toast({
          title: "Already Applied",
          description:
            "This user already has the 100% discount coupon applied to their subscription",
          variant: "default",
        });
      } else if (error.message.includes("usage limit")) {
        toast({
          title: "Coupon Exhausted",
          description:
            "The discount coupon has reached its usage limit. Please create a new coupon in Stripe or increase the redemption limit.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to verify review",
          variant: "destructive",
        });
      }
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({
      subscriptionId,
      reason,
    }: {
      subscriptionId: number;
      reason: string;
    }) => {
      const response = await fetch(
        `/api/admin/subscriptions/${subscriptionId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/all-subscriptions"],
      });
      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });
      setShowCancelConfirm(false);
      setShowCancelDialog(false);
      setSubscriptionToCancel(null);
      setCancellationReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Fetch current user data to check admin status
  const { data: userData, isLoading: userLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/user"],
  });

  // Get user permissions from API response (includes custom roles)
  const userPermissions = (userData as any)?.permissions || null;

  // Fetch all users for admin
  const { data: adminData, isLoading: usersLoading } = useQuery<{
    users: User[];
  }>({
    queryKey: ["/api/admin/users"],
    enabled: userPermissions?.canViewUsers || false,
  });

  // Fetch all subscriptions and their transactions
  const { data: subscriptionsData, isLoading: subscriptionsLoading } =
    useQuery<{ subscriptions: Subscription[] }>({
      queryKey: ["/api/admin/subscriptions"],
      enabled: userPermissions?.canViewSubscriptions || false,
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

  // Fetch all subscriptions (including cancelled) and their transactions
  const { data: allSubscriptionsData, isLoading: allSubscriptionsLoading } =
    useQuery<{ subscriptions: Subscription[] }>({
      queryKey: ["/api/admin/all-subscriptions"],
      enabled: userPermissions?.canViewSubscriptions || false,
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

  // Fetch available roles
  const { data: rolesData } = useQuery<any[]>({
    queryKey: ["/api/admin/roles"],
    enabled: userData?.user.role === UserRole.ADMINISTRATOR,
  });

  // Fetch all websites
  const { data: websitesData } = useQuery<{ websites: Website[] }>({
    queryKey: ["/api/admin/websites"],
    enabled: userPermissions?.canViewSubscriptions || false,
    queryFn: async () => {
      const response = await fetch("/api/admin/websites", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch websites");
      }
      const data = await response.json();

      // TEMPORARY: Add mock data to response for demonstration - REMOVE WHEN DONE
      return {
        websites: [...(data.websites || [])]
      };
    },
  });

  // Mutation for updating user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error("Failed to update role");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating PDF
  const updatePdf = useMutation({
    mutationFn: async ({
      id,
      pdfUrl,
      type,
    }: {
      id: number;
      pdfUrl: string;
      type: "subscription" | "transaction" | "website";
    }) => {
      let endpoint;
      if (type === "subscription") {
        endpoint = `/api/admin/subscriptions/${id}/pdf`;
      } else if (type === "transaction") {
        endpoint = `/api/admin/transactions/${id}/pdf`;
      } else {
        endpoint = `/api/admin/websites/${id}/pdf`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to update PDF");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
      toast({
        title: "Success",
        description: "PDF uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update PDF",
        variant: "destructive",
      });
    },
  });

  // Add this mutation after the existing mutations
  const syncSubscriptions = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync-subscriptions", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to sync subscriptions");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/all-subscriptions"],
      });
      toast({
        title: "Success",
        description: "Active subscriptions synced successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync subscriptions",
        variant: "destructive",
      });
    },
  });

  // Separate mutation for syncing all subscriptions (preserves cancelled ones)
  const syncAllSubscriptions = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync-all-subscriptions", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to sync all subscriptions");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/all-subscriptions"],
      });
      toast({
        title: "Success",
        description: "All subscriptions synced successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync all subscriptions",
        variant: "destructive",
      });
    },
  });

  // Add mutation for clearing cancelled subscriptions
  const clearNonActiveSubscriptions = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/clear-non-active-subscriptions", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to clear non-active subscriptions");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/all-subscriptions"],
      });
      toast({
        title: "Success",
        description: data.message || "Non-active subscriptions cleared successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear non-active subscriptions",
        variant: "destructive",
      });
    },
  });

  // Mutation for syncing scheduled subscriptions
  const syncScheduledSubscriptions = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync-scheduled-subscriptions", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to sync scheduled subscriptions");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/all-subscriptions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/subscriptions"],
      });
      toast({
        title: "Success",
        description: "Scheduled subscriptions synced successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sync scheduled subscriptions",
        variant: "destructive",
      });
    },
  });

  // Newsletter settings query and mutation
  const { data: settingsData } = useQuery<{ newsletterEnabled: boolean }>({
    queryKey: ["/api/settings"],
  });

  const updateNewsletterSettings = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/settings/newsletter", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error("Failed to update newsletter settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Newsletter visibility updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update newsletter settings",
        variant: "destructive",
      });
    },
  });

  const handleRoleToggle = (user: User) => {
    const newRole =
      user.role === UserRole.ADMINISTRATOR
        ? UserRole.SUBSCRIBER
        : UserRole.ADMINISTRATOR;

    updateRole.mutate({ userId: user.id, role: newRole });
  };

  const initializeCloudinaryWidget = useCallback(
    (id: number, type: "subscription" | "transaction" | "website") => {
      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: "dem12vqtl",
          uploadPreset: "hayc_prese",
          folder: type === "subscription" ? "subscriptions" : type === "transaction" ? "transactions" : "websites",
          multiple: false,
          maxFiles: 1,
          resourceType: "raw",
        },
        (error: any, result: any) => {
          if (!error && result && result.event === "success") {
            console.log("Upload success:", result.info);
            updatePdf.mutate({
              id,
              pdfUrl: result.info.secure_url,
              type,
            });
          } else if (error) {
            console.error("Upload error:", error);
            toast({
              title: "Error",
              description: "Failed to upload PDF",
              variant: "destructive",
            });
          }
        },
      );

      return widget;
    },
    [updatePdf, toast],
  );

  const handleUploadClick = (
    id: number,
    type: "subscription" | "transaction" | "website",
  ) => {
    const widget = initializeCloudinaryWidget(id, type);
    widget.open();
  };

  const handleCancelSubscription = (subscription: Subscription) => {
    setSubscriptionToCancel(subscription);
    setShowCancelDialog(true);
  };

  const handleCancelReasonSubmit = () => {
    if (!cancellationReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for cancellation",
        variant: "destructive",
      });
      return;
    }
    setShowCancelDialog(false);
    setShowCancelConfirm(true);
  };

  const handleConfirmCancellation = () => {
    if (subscriptionToCancel) {
      cancelSubscriptionMutation.mutate({
        subscriptionId: subscriptionToCancel.id,
        reason: cancellationReason,
      });
    }
  };

  const handleVerifyReviewClick = async (user: User) => {
    setUserToVerify(user);

    // Fetch coupon information from Stripe
    try {
      const [couponResponse, statusResponse] = await Promise.all([
        fetch("/api/admin/coupon-info/H0KCP9s8"),
        fetch(`/api/admin/users/${user.id}/coupon-status/H0KCP9s8`),
      ]);

      if (couponResponse.ok) {
        const couponData = await couponResponse.json();
        setCouponInfo(couponData);
      } else {
        // Fallback info if API call fails
        setCouponInfo({
          name: "100% Discount",
          duration: "3 months",
          percentOff: 100,
        });
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setUserCouponStatus(statusData);
      } else {
        setUserCouponStatus({ hasCoupon: false, hasActiveSubscription: false });
      }
    } catch (error) {
      // Fallback info if API call fails
      setCouponInfo({
        name: "100% Discount",
        duration: "3 months",
        percentOff: 100,
      });
      setUserCouponStatus({ hasCoupon: false, hasActiveSubscription: false });
    }

    setShowVerifyDialog(true);
  };

  const handleConfirmVerifyReview = () => {
    if (userToVerify) {
      verifyReviewMutation.mutate(userToVerify.id);
      setShowVerifyDialog(false);
      setUserToVerify(null);
      setCouponInfo(null);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const sortedSubscriptions = subscriptionsData?.subscriptions
    .slice()
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "username":
          aValue = a.username.toLowerCase();
          bValue = b.username.toLowerCase();
          break;
        case "email":
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case "tier":
          aValue = a.tier.toLowerCase();
          bValue = b.tier.toLowerCase();
          break;
        case "status":
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case "invoiceType":
          aValue = a.invoiceType.toLowerCase();
          bValue = b.invoiceType.toLowerCase();
          break;
        case "vatNumber":
          aValue = (a.vatNumber || "").toLowerCase();
          bValue = (b.vatNumber || "").toLowerCase();
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "nextBillingDate":
          aValue = a.nextBillingDate ? new Date(a.nextBillingDate).getTime() : 0;
          bValue = b.nextBillingDate ? new Date(b.nextBillingDate).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

  const sortedAllSubscriptions = allSubscriptionsData?.subscriptions
    .slice()
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "username":
          aValue = a.username.toLowerCase();
          bValue = b.username.toLowerCase();
          break;
        case "email":
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case "tier":
          aValue = a.tier.toLowerCase();
          bValue = b.tier.toLowerCase();
          break;
        case "status":
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case "invoiceType":
          aValue = a.invoiceType.toLowerCase();
          bValue = b.invoiceType.toLowerCase();
          break;
        case "vatNumber":
          aValue = (a.vatNumber || "").toLowerCase();
          bValue = (b.vatNumber || "").toLowerCase();
          break;
        case "createdAt":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "cancellationReason":
          aValue = (a.cancellationReason || "").toLowerCase();
          bValue = (b.cancellationReason || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

  if (
    userLoading ||
    usersLoading ||
    subscriptionsLoading ||
    allSubscriptionsLoading
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const toggleSubscriptionExpand = (subscriptionId: number) => {
    setExpandedSubscriptionId(
      expandedSubscriptionId === subscriptionId ? null : subscriptionId,
    );
  };

  return (
    <div className="container mx-auto mt-[70px] py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Admin Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-row gap-6">
            <nav className="w-52 shrink-0 border-r border-border pr-4" aria-label="Admin sections">
              <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-0.5">
                {userPermissions?.canViewUsers && (
                  <TabsTrigger value="users" className="w-full justify-start rounded-md px-3 py-2.5">
                    Users
                  </TabsTrigger>
                )}
                {userPermissions?.canViewSubscriptions && (
                  <>
                    <TabsTrigger value="subscriptions" className="w-full justify-start rounded-md px-3 py-2.5">
                      Active Subscriptions
                    </TabsTrigger>
                    <TabsTrigger value="all-subscriptions" className="w-full justify-start rounded-md px-3 py-2.5">
                      All Subscriptions
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="w-full justify-start rounded-md px-3 py-2.5">
                      Invoices
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="w-full justify-start rounded-md px-3 py-2.5">
                      Calendar
                    </TabsTrigger>
                  </>
                )}
                {userPermissions?.canManageSettings && (
                  <TabsTrigger value="email-testing" className="w-full justify-start rounded-md px-3 py-2.5">
                    Email Testing
                  </TabsTrigger>
                )}
                {userPermissions?.canViewWebsites && (
                  <>
                    <TabsTrigger value="website-progress" className="w-full justify-start rounded-md px-3 py-2.5">
                      Website Progress
                    </TabsTrigger>
                    <TabsTrigger value="website-changes" className="w-full justify-start rounded-md px-3 py-2.5">
                      Website Changes
                    </TabsTrigger>
                  </>
                )}
                {userPermissions?.canViewTips && (
                  <TabsTrigger value="tips" className="w-full justify-start rounded-md px-3 py-2.5">
                    Tips Management
                  </TabsTrigger>
                )}
                {userData?.user.role === UserRole.ADMINISTRATOR && (
                  <>
                    <TabsTrigger value="roles" className="w-full justify-start rounded-md px-3 py-2.5">
                      Roles
                    </TabsTrigger>
                    <TabsTrigger value="user-migration" className="w-full justify-start rounded-md px-3 py-2.5">
                      User Migration
                    </TabsTrigger>
                    <TabsTrigger value="system-settings" className="w-full justify-start rounded-md px-3 py-2.5">
                      System Settings
                    </TabsTrigger>
                    <TabsTrigger value="newsletter" className="w-full justify-start rounded-md px-3 py-2.5">
                      Newsletter
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </nav>
            <div className="flex-1 min-w-0">
            <TabsContent value="newsletter" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">Newsletter Management</h2>
                {/* Email Builder Card */}
                <Card
                  className={`cursor-pointer mb-4 hover:border-primary transition-colors`}
                  onClick={() => {
                    navigate(`/admin/email-builder`);
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
                            Email Builder
                          </CardTitle>
                          <CardDescription>
                            Design and create beautiful email templates with our visual editor
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>

                {/* Tags Card */}
                <Card
                  className={`cursor-pointer mb-4 hover:border-primary transition-colors`}
                  onClick={() => navigate(`/admin/tags`)}
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
                            Tags
                          </CardTitle>
                          <CardDescription>
                            Organize subscribers with tags for targeted campaigns
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>

                {/* Contacts Card */}
                <Card
                  className="cursor-pointer mb-4 hover:border-primary transition-colors"
                  onClick={() => navigate(`/admin/contacts`)}
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
                            Contacts
                          </CardTitle>
                          <CardDescription>
                            Manage your subscriber list and contact information
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>

                {/* Email Templates Card */}
                <Card
                  className="cursor-pointer mb-4 hover:border-primary transition-colors"
                  onClick={() => navigate(`/admin/templates`)}
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
                            Email Templates
                          </CardTitle>
                          <CardDescription>
                            View and manage your saved email templates
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
                  onClick={() => navigate(`/admin/campaigns`)}
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
                            Campaigns
                          </CardTitle>
                          <CardDescription>
                            Create and manage email campaigns for your subscribers
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>
              </section>
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">User Management</h2>
                  {userData?.user.role === UserRole.ADMINISTRATOR && (
                    <StaffUserCreationDialog />
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminData?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const params = new URLSearchParams();
                                params.set("tab", "user-details");
                                params.set("userId", user.id.toString());
                                setSearchParams(params);
                              }}
                              data-testid={`button-view-user-${user.id}`}
                            >
                              View Details
                            </Button>
                            {userPermissions?.canManageUsers && (
                              <>
                                <Select
                                  value={user.role}
                                  onValueChange={(newRole) => updateRole.mutate({ userId: user.id, role: newRole })}
                                  disabled={user.id === userData?.user.id}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rolesData?.map((role) => (
                                      <SelectItem key={role.name} value={role.name}>
                                        {role.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleVerifyReviewClick(user)}
                                  disabled={
                                    verifyingUserId === user.id ||
                                    user.id === userData?.user.id
                                  }
                                  className="bg-green-50 hover:bg-green-100 text-green-700"
                                >
                                  {verifyingUserId === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Next Month 100% Discount"
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setUserToDelete(user);
                                    setShowDeleteConfirm(true);
                                  }}
                                  disabled={user.id === userData?.user.id}
                                >
                                  Delete User
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </TabsContent>
            <TabsContent value="subscriptions" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Subscription Management
                </h2>
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => syncSubscriptions.mutate()}
                    disabled={syncSubscriptions.isPending}
                  >
                    {syncSubscriptions.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync Subscriptions"
                    )}
                  </Button>
                </div>

                {/* Check if subscriptions list is empty */}
                {subscriptionsData?.subscriptions.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No subscriptions available.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("id")}
                            className="h-auto p-0 font-semibold"
                          >
                            ID {getSortIcon("id")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("username")}
                            className="h-auto p-0 font-semibold"
                          >
                            User {getSortIcon("username")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("email")}
                            className="h-auto p-0 font-semibold"
                          >
                            Email {getSortIcon("email")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("tier")}
                            className="h-auto p-0 font-semibold"
                          >
                            Tier {getSortIcon("tier")}
                          </Button>
                        </TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("status")}
                            className="h-auto p-0 font-semibold"
                          >
                            Status {getSortIcon("status")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("invoiceType")}
                            className="h-auto p-0 font-semibold"
                          >
                            Document Type {getSortIcon("invoiceType")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("vatNumber")}
                            className="h-auto p-0 font-semibold"
                          >
                            VAT Number {getSortIcon("vatNumber")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("createdAt")}
                            className="h-auto p-0 font-semibold"
                          >
                            Purchased at {getSortIcon("createdAt")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("nextBillingDate")}
                            className="h-auto p-0 font-semibold"
                          >
                            Next Invoice {getSortIcon("nextBillingDate")}
                          </Button>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSubscriptions?.map((subscription) => {
                        const isExpanded = expandedSubscriptionId === subscription.id;
                        return [
                          <TableRow key={subscription.id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleSubscriptionExpand(subscription.id)
                                }
                              >
                                {expandedSubscriptionId === subscription.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>{subscription.id}</TableCell>
                            <TableCell>{subscription.username}</TableCell>
                            <TableCell>{subscription.email}</TableCell>
                            <TableCell>{subscription.tier}</TableCell>
                            <TableCell>
                              {subscription.price
                                ? `€${(subscription.price / 100).toFixed(2)}`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-white text-xs font-semibold px-3 py-1 rounded-full 
                                  ${subscription.status === "active" ? "bg-green-500" : "bg-gray-400"}`}
                              >
                                {subscription.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${subscription.invoiceType === "invoice"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                                  }`}
                              >
                                {subscription.invoiceType === "invoice"
                                  ? "Invoice"
                                  : "Receipt"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {subscription.invoiceType === "invoice" ? (
                                subscription.vatNumber || (
                                  <span className="text-muted-foreground text-sm">
                                    Not provided
                                  </span>
                                )
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatDate(subscription.createdAt)}
                            </TableCell>
                            <TableCell>
                              {subscription.nextBillingDate ? (
                                <span className="text-sm">
                                  {formatDate(subscription.nextBillingDate)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Not available
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {subscription.status === "active" && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    handleCancelSubscription(subscription)
                                  }
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>,

                          isExpanded && (
                            <TableRow key={`${subscription.id}-expanded`}>
                              <TableCell colSpan={9}>
                                <div className="p-4 bg-muted/50 rounded-lg">
                                  <h3 className="text-sm font-semibold mb-2">
                                    Transactions
                                  </h3>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Currency</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>PDF</TableHead>
                                        <TableHead>Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {subscription.transactions
                                        ?.slice()
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map((transaction) => (
                                          <TableRow key={transaction.id}>
                                            <TableCell>
                                              {transaction.id}
                                            </TableCell>
                                            <TableCell>
                                              {(
                                                transaction.amount / 100
                                              ).toLocaleString("el-GR", {
                                                style: "currency",
                                                currency: "EUR",
                                              })}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.currency}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.status}
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(
                                                transaction.createdAt,
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.pdfUrl ? (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    transaction.pdfUrl && window.open(
                                                      transaction.pdfUrl,
                                                      "_blank",
                                                    )
                                                  }
                                                >
                                                  <Download className="h-4 w-4 mr-2" />
                                                  View PDF
                                                </Button>
                                              ) : (
                                                "No PDF"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() =>
                                                  handleUploadClick(
                                                    transaction.id,
                                                    "transaction",
                                                  )
                                                }
                                              >
                                                Upload PDF
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ),
                                        )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        ];
                      })}
                    </TableBody>
                  </Table>
                )}
              </section>
            </TabsContent>
            <TabsContent value="email-testing" className="mt-0">
              <div className="max-w-md mx-auto">
                <EmailTester />
              </div>
            </TabsContent>
            <TabsContent value="all-subscriptions" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  All Subscriptions (Including Cancelled)
                </h2>
                <div className="flex justify-end mb-4 space-x-4">
                  <Button
                    onClick={() => syncAllSubscriptions.mutate()}
                    disabled={syncAllSubscriptions.isPending}
                  >
                    {syncAllSubscriptions.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync All Subscriptions"
                    )}
                  </Button>
                  <Button
                    onClick={() => syncScheduledSubscriptions.mutate()}
                    disabled={syncScheduledSubscriptions.isPending}
                    variant="secondary"
                  >
                    {syncScheduledSubscriptions.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync Scheduled Subscriptions"
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => clearNonActiveSubscriptions.mutate()}
                    disabled={clearNonActiveSubscriptions.isPending}
                  >
                    {clearNonActiveSubscriptions.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      "Clear Non-Active Subscriptions"
                    )}
                  </Button>
                </div>

                {/* Check if all subscriptions list is empty */}
                {allSubscriptionsData?.subscriptions.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No subscriptions available.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("id")}
                            className="h-auto p-0 font-semibold"
                          >
                            ID {getSortIcon("id")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("username")}
                            className="h-auto p-0 font-semibold"
                          >
                            User {getSortIcon("username")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("email")}
                            className="h-auto p-0 font-semibold"
                          >
                            Email {getSortIcon("email")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("tier")}
                            className="h-auto p-0 font-semibold"
                          >
                            Tier {getSortIcon("tier")}
                          </Button>
                        </TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("status")}
                            className="h-auto p-0 font-semibold"
                          >
                            Status {getSortIcon("status")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("invoiceType")}
                            className="h-auto p-0 font-semibold"
                          >
                            Document Type {getSortIcon("invoiceType")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("vatNumber")}
                            className="h-auto p-0 font-semibold"
                          >
                            VAT Number {getSortIcon("vatNumber")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("createdAt")}
                            className="h-auto p-0 font-semibold"
                          >
                            Purchased at {getSortIcon("createdAt")}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort("cancellationReason")}
                            className="h-auto p-0 font-semibold"
                          >
                            Cancellation Reason{" "}
                            {getSortIcon("cancellationReason")}
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAllSubscriptions?.map((subscription) => {
                        const isExpanded = expandedSubscriptionId === subscription.id;
                        return [
                          <TableRow key={subscription.id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleSubscriptionExpand(subscription.id)
                                }
                              >
                                {expandedSubscriptionId === subscription.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>{subscription.id}</TableCell>
                            <TableCell>{subscription.username}</TableCell>
                            <TableCell>{subscription.email}</TableCell>
                            <TableCell>{subscription.tier}</TableCell>
                            <TableCell>
                              <span
                                className={`text-white text-xs font-semibold px-3 py-1 rounded-full 
                                  ${subscription.status === "active"
                                    ? "bg-green-500"
                                    : subscription.status === "cancelled"
                                      ? "bg-red-500"
                                      : "bg-gray-400"
                                  }`}
                              >
                                {subscription.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${subscription.invoiceType === "invoice"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                                  }`}
                              >
                                {subscription.invoiceType === "invoice"
                                  ? "Invoice"
                                  : "Receipt"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {subscription?.vatNumber || (
                                <span className="text-muted-foreground text-sm">
                                  Not provided
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatDate(subscription.createdAt)}
                            </TableCell>
                            <TableCell>
                              {subscription.status === "cancelled" &&
                                subscription.cancellationReason ? (
                                <div className="max-w-xs">
                                  <span className="text-sm text-red-600 break-words">
                                    {subscription.cancellationReason}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  {subscription.status === "cancelled"
                                    ? "No reason provided"
                                    : "N/A"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>,

                          isExpanded && (
                            <TableRow key={`${subscription.id}-expanded`}>
                              <TableCell colSpan={10}>
                                <div className="p-4 bg-muted/50 rounded-lg">
                                  <h3 className="text-sm font-semibold mb-2">
                                    Transactions
                                  </h3>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Currency</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>PDF</TableHead>
                                        <TableHead>Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {subscription.transactions
                                        ?.slice()
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map((transaction) => (
                                          <TableRow key={transaction.id}>
                                            <TableCell>
                                              {transaction.id}
                                            </TableCell>
                                            <TableCell>
                                              {(
                                                transaction.amount / 100
                                              ).toLocaleString("el-GR", {
                                                style: "currency",
                                                currency: "EUR",
                                              })}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.currency}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.status}
                                            </TableCell>
                                            <TableCell>
                                              {formatDate(
                                                transaction.createdAt,
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {transaction.pdfUrl ? (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    transaction.pdfUrl && window.open(
                                                      transaction.pdfUrl,
                                                      "_blank",
                                                    )
                                                  }
                                                >
                                                  <Download className="h-4 w-4 mr-2" />
                                                  View PDF
                                                </Button>
                                              ) : (
                                                "No PDF"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() =>
                                                  handleUploadClick(
                                                    transaction.id,
                                                    "transaction",
                                                  )
                                                }
                                              >
                                                Upload PDF
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ),
                                        )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        ];
                      })}
                    </TableBody>
                  </Table>
                )}
              </section>
            </TabsContent>
            <TabsContent value="invoices" className="mt-0">
              <AdminWebsiteInvoices />
            </TabsContent>
            <TabsContent value="calendar" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Subscription Calendar
                </h2>
                <SubscriptionCalendar />
              </section>
            </TabsContent>
            <TabsContent value="website-progress" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Website Progress Management
                </h2>
                <div className="mt-4">
                  <AdminWebsiteProgressComponent />
                </div>
              </section>
            </TabsContent>
            <TabsContent value="website-changes" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Website Changes Management
                </h2>
                <AdminWebsiteChanges />
              </section>
            </TabsContent>
            <TabsContent value="tips" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">Tips Management</h2>
                <TipsManagement />
              </section>
            </TabsContent>
            <TabsContent value="roles" className="mt-0">
              <section>
                <RoleManagement />
              </section>
            </TabsContent>
            <TabsContent value="user-migration" className="mt-0">
              <section>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Temporary Feature - Scheduled for Removal
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>This User Migration & Password Reset section is scheduled to be removed on <strong>15/12/2025</strong>.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <h2 className="text-xl font-semibold mb-4">User Migration & Password Reset</h2>
                <UserMigrationManager />
              </section>
            </TabsContent>
            {/* System Settings */}
            <TabsContent value="system-settings" className="mt-0">
              <section>
                <h2 className="text-xl font-semibold mb-4">System Settings</h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Stripe Pricing Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Refresh subscription prices from Stripe. Prices are stored in the database and will persist across server restarts. Use this button when you update pricing in your Stripe dashboard.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const response = await fetch("/api/pricing/refresh", {
                              method: "POST",
                            });
                            const data = await response.json();

                            if (data.success) {
                              toast({
                                title: "Success",
                                description: data.message,
                              });
                            } else {
                              toast({
                                variant: "destructive",
                                title: "Error",
                                description: data.error || "Failed to refresh prices",
                              });
                            }
                          } catch (error) {
                            toast({
                              variant: "destructive",
                              title: "Error",
                              description: "Failed to refresh prices from Stripe",
                            });
                          }
                        }}
                        data-testid="button-refresh-stripe-prices"
                      >
                        Refresh Prices from Stripe
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            {/* User Details Tab */}
            <TabsContent value="user-details" className="mt-0">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">User Account Details</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("tab", "users");
                      setSearchParams(params);
                    }}
                  >
                    Back to Users
                  </Button>
                </div>
                {searchParams.get("userId") ? (
                  <UserDetailsView userId={parseInt(searchParams.get("userId")!)} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No user selected
                  </div>
                )}
              </section>
            </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this user (
              {userToDelete?.username}) with email {userToDelete?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user, cancel all their
              subscriptions, and remove all associated data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToDelete && deleteUserMutation.mutate(userToDelete.id)
              }
              className="bg-destructive text-destructive-foreground"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Cancellation Reason Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              You are about to cancel the subscription for{" "}
              {subscriptionToCancel?.username} ({subscriptionToCancel?.email}).
              Please provide a reason for the cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Cancellation Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why this subscription is being cancelled..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setSubscriptionToCancel(null);
                setCancellationReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelReasonSubmit}
              disabled={!cancellationReason.trim()}
            >
              Continue to Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure you want to cancel this subscription?
              <br />
              <br />
              <strong>User:</strong> {subscriptionToCancel?.username} (
              {subscriptionToCancel?.email})
              <br />
              <strong>Plan:</strong> {subscriptionToCancel?.tier}
              <br />
              <strong>Reason:</strong> {cancellationReason}
              <br />
              <br />
              This action cannot be undone. The user will lose access to their
              subscription immediately and will receive a cancellation email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowCancelConfirm(false);
                setShowCancelDialog(true);
              }}
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancellation}
              className="bg-destructive text-destructive-foreground"
            >
              {cancelSubscriptionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Yes, Cancel Subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verify Review Confirmation Dialog */}
      <AlertDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify Review - Apply Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              {userCouponStatus?.hasCoupon ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-yellow-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Coupon Already Applied
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            {userToVerify?.username} ({userToVerify?.email})
                            already has the coupon "
                            {userCouponStatus.couponName || "H0KCP9s8"}" applied
                            to their subscription.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  No further action is needed for this user.
                </>
              ) : !userCouponStatus?.hasActiveSubscription ? (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          No Active Subscription
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>
                            {userToVerify?.username} ({userToVerify?.email})
                            does not have an active subscription. A coupon can
                            only be applied to active subscriptions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  You are about to apply a discount coupon to{" "}
                  {userToVerify?.username}'s subscription ({userToVerify?.email}
                  ).
                  <br />
                  <br />
                  <strong>Coupon Details:</strong>
                  <br />• <strong>Discount:</strong> {couponInfo?.percentOff}%
                  off
                  <br />• <strong>Duration:</strong> {couponInfo?.duration}
                  <br />• <strong>Coupon ID:</strong> H0KCP9s8
                  <br />
                  <br />
                  This will apply the discount to their next billing cycle and
                  they will receive a confirmation email.
                  <br />
                  <br />
                  Are you sure you want to proceed?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowVerifyDialog(false);
                setUserToVerify(null);
                setCouponInfo(null);
                setUserCouponStatus(null);
              }}
            >
              {userCouponStatus?.hasCoupon ||
                !userCouponStatus?.hasActiveSubscription
                ? "Close"
                : "Cancel"}
            </AlertDialogCancel>
            {userCouponStatus?.hasCoupon ||
              !userCouponStatus?.hasActiveSubscription ? null : (
              <AlertDialogAction
                onClick={handleConfirmVerifyReview}
                className="bg-green-600 hover:bg-green-700"
              >
                Yes, Apply Coupon
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffUserCreationDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("moderator");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rolesData } = useQuery<{ id: number; name: string; displayName: string }[]>({
    queryKey: ["/api/admin/roles"],
  });

  // Filter to show all roles except subscriber (subscriber is not a staff role)
  const staffRoles = rolesData?.filter((r) => r.name !== "subscriber") || [];

  const createStaffMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password, role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create staff user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Staff user created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpen(false);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("moderator");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Staff User</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Staff User</DialogTitle>
            <DialogDescription>
              Create a new staff member (moderator or administrator). Staff users can access admin features but don't require a subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffRoles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createStaffMutation.mutate()}
              disabled={!username || !email || !password || createStaffMutation.isPending}
            >
              {createStaffMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Staff User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}