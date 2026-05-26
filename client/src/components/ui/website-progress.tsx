import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, MessageSquare, FileText, Pencil } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/ui/authContext";
import { loadCloudinaryWidget } from "@/lib/load-cloudinary-widget";
import { OnboardingFormResponse, RolePermissions } from "@shared/schema";
import { formatOnboardingValue, getFieldLabel } from "@/lib/onboarding-formatters";
import { formatGsValue } from "@/lib/get-started-formatters";

type Stage = {
  id: number;
  stageNumber: number;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "waiting";
  completedAt?: string;
  waiting_info?: string;
};

type Website = {
  id: number;
  userId: number;
  domain: string;
  projectName?: string;
  currentStage: number;
  websiteLanguage?: string;
  stages: Stage[];
};

interface WebsiteChangeLog {
  id: number;
  changeDescription: string;
  adminId: number;
  createdAt: string;
  adminUsername: string;
}

interface WebsiteChanges {
  id: number;
  userId: number;
  domain: string;
  changesUsed: number;
  changesAllowed: number;
  monthYear: string;
  createdAt: string;
  updatedAt: string;
  changeLogs: WebsiteChangeLog[];
}

interface WebsiteProgressProps {
  websiteId: number;
}

export function WebsiteProgress({ websiteId }: WebsiteProgressProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOnboardingDialogOpen, setIsOnboardingDialogOpen] = useState(false);
  const [onboardingDialogView, setOnboardingDialogView] = useState<"onboarding" | "get-started">("onboarding");
  const [editingDomain, setEditingDomain] = useState(false);
  const [domainValue, setDomainValue] = useState("");
  
  // Get user permissions based on role
  const userPermissions = user?.role ? RolePermissions[user.role] : null;

  // Translation mapping for stages
  const getStageTranslation = (title: string, field: 'title' | 'description') => {
    const stageMap: Record<string, string> = {
      "Welcome & Project Setup": "welcome",
      "Layout Selection": "layout",
      "Content Collection & Organization": "content",
      "First Demo Preview": "preview",
      "Feedback & Refinements": "feedback",
      "Website Launch": "launch",
      "Planning & Design": "planning",
      "UI/UX Development": "uiux",
      "Backend Development": "backend",
      "Testing & Optimization": "testing",
      "Final Release & Delivery": "delivery",
      "Content Creation": "contentCreation",
      "SEO Optimization": "seo",
      "Security Implementation": "security",
      "Analytics Setup": "analytics",
      "Maintenance Setup": "maintenance"
    };

    const stageKey = stageMap[title];
    if (stageKey) {
      return t(`stages.${stageKey}.${field}`);
    }
    
    // Fallback to original text if no translation found
    return field === 'title' ? title : title;
  };

  const { data: website, isLoading } = useQuery<Website>({
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

  // Query for onboarding form response
  const { data: onboardingResponse, isLoading: isLoadingOnboarding } = useQuery<OnboardingFormResponse | null>({
    queryKey: ["/api/websites", websiteId, "onboarding-form"],
    queryFn: async () => {
      if (!websiteId) return null
      const response = await fetch(`/api/websites/${websiteId}/onboarding-form`)
      if (!response.ok) {
        if (response.status === 404) return null // No onboarding form found
        throw new Error('Failed to fetch onboarding form response')
      }
      return response.json()
    },
    enabled: !!websiteId && isOnboardingDialogOpen,
  });

  const { data: gsSubmissionResponse, isLoading: isLoadingGs } = useQuery({
    queryKey: ["/api/websites", websiteId, "get-started-submission"],
    queryFn: async () => {
      const res = await fetch(
        `/api/websites/${websiteId}/get-started-submission`,
        { credentials: "include" }
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!websiteId && isOnboardingDialogOpen,
  });

  const gsSubmission = gsSubmissionResponse?.submission ?? null;

  // Auto-switch to get-started tab when only a get-started submission exists
  useEffect(() => {
    if (!isLoadingOnboarding && !isLoadingGs && !onboardingResponse && gsSubmission) {
      setOnboardingDialogView("get-started");
    }
  }, [isLoadingOnboarding, isLoadingGs, onboardingResponse, gsSubmission]);

  const updateDomainMutation = useMutation({
    mutationFn: async (newDomain: string) => {
      const response = await fetch(`/api/admin/websites/${websiteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain: newDomain }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update domain");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("dashboard.success") || "Success",
        description: t("dashboard.domainUpdated") || "Domain updated successfully.",
      });
      setEditingDomain(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites", websiteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/websites"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "waiting":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="h-5 w-5 text-green-600" />;
      case "in-progress":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-website-progress" />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            {t("websiteProgress.noWebsites") || "Website not found"}
          </div>
        </div>
      </div>
    );
  }

  const completedStages = website.stages.filter(
    (stage) => stage.status === "completed",
  ).length;
  const progress = (completedStages / website.stages.length) * 100;

  return (
    <>
      <div className="space-y-6" data-testid="website-progress-container">
        {/* Header with progress bar and onboarding button */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {editingDomain ? (
                <div className="space-y-3 max-w-md">
                  <div>
                    <Label htmlFor="domain-edit">{t("dashboard.domain") || "Domain"}</Label>
                    <Input
                      id="domain-edit"
                      value={domainValue}
                      onChange={(e) => setDomainValue(e.target.value)}
                      placeholder="example.com"
                      data-testid="input-domain-edit"
                      className="text-xl font-bold"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (domainValue.trim()) {
                          updateDomainMutation.mutate(domainValue.trim());
                        }
                      }}
                      disabled={updateDomainMutation.isPending || !domainValue.trim()}
                      data-testid="button-save-domain"
                    >
                      {updateDomainMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("actions.saving") || "Saving..."}
                        </>
                      ) : (
                        t("actions.save") || "Save"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingDomain(false);
                        setDomainValue(website.domain);
                      }}
                      disabled={updateDomainMutation.isPending}
                      data-testid="button-cancel-domain-edit"
                    >
                      {t("actions.cancel") || "Cancel"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold" data-testid="website-domain">
                    {website.projectName || website.domain}
                  </h2>
                  {userPermissions?.canManageWebsites && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDomainValue(website.domain);
                        setEditingDomain(true);
                      }}
                      data-testid="button-edit-domain"
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {!editingDomain && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("websiteProgress.websiteDevelopment") || "Website Development Progress"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => { setOnboardingDialogView("onboarding"); setIsOnboardingDialogOpen(true); }}
              data-testid="button-view-onboarding"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t("websiteProgress.viewOnboardingForm") || "View Onboarding Form"}
            </Button>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-3 [&>div]:bg-[#c9ddf9]" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedStages} {t("websiteProgress.of") || "of"} {website.stages.length} {t("websiteProgress.stagesCompleted") || "stages completed"}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* All Stages List */}
        <Card>
          <CardContent className="p-6">
            <div className="relative flex flex-col space-y-8">
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200" />

              {website.stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-start gap-4 relative"
                  data-testid={`stage-${stage.stageNumber}`}
                >
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center shrink-0
                      ${
                        stage.status === "completed"
                          ? "bg-green-100 text-green-600"
                          : stage.status === "in-progress"
                            ? "bg-blue-100 text-blue-600"
                            : stage.status === "pending"
                              ? "bg-yellow-100 text-yellow-600"
                              : "bg-gray-100 text-gray-400"
                      }
                      z-10
                    `}
                  >
                    {stage.status === "completed" ? (
                      <Check className="h-6 w-6" />
                    ) : stage.status === "in-progress" ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span className="text-lg font-semibold">
                        {stage.stageNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 pt-2">
                    <h3
                      className={`font-medium text-base mb-1 
                      ${
                        stage.status === "completed"
                          ? "text-green-600"
                          : stage.status === "in-progress"
                            ? "text-blue-600"
                            : "text-gray-700"
                      }`}
                    >
                      {getStageTranslation(stage.title, 'title')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getStageTranslation(stage.title, 'description')}
                    </p>
                    {stage.status === "waiting" && stage.waiting_info && (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">
                          {t("websiteProgress.actionRequired") || "Action Required"}
                        </h4>
                        <p className="text-sm text-yellow-700 whitespace-pre-line">
                          {stage.waiting_info}
                        </p>
                        <Button
                          onClick={async () => {
                            try {
                              await loadCloudinaryWidget();
                            } catch {
                              toast({
                                title: t("websiteProgress.uploadServiceUnavailable") || "Upload Service Unavailable",
                                description: t("websiteProgress.uploadServiceDescription") || "Please refresh the page and try again.",
                                variant: "destructive",
                              });
                              return;
                            }
                            {
                              const accountEmail = user?.email || 'unknown-user';
                              const folderName = `Client Files/${accountEmail}/${website?.domain}/Website Progress`;

                              (window as any).cloudinary.openUploadWidget(
                                {
                                  cloudName: "dem12vqtl",
                                  uploadPreset: "hayc_dashboard_uploads_website_process",
                                  sources: ["local", "url", "camera"],
                                  multiple: true,
                                  maxFiles: 10,
                                  folder: folderName,
                                },
                                (error: any, result: any) => {
                                  if (!error && result.event === "success") {
                                    toast({
                                      title: t("websiteProgress.uploadSuccessful") || "Upload Successful",
                                      description: `${t("websiteProgress.file") || "File"} "${result.info.original_filename}" ${t("websiteProgress.uploadedSuccessfully") || "uploaded successfully"}`,
                                    });
                                    console.log("Upload successful:", result.info);
                                  } else if (error) {
                                    toast({
                                      title: t("websiteProgress.uploadError") || "Upload Error",
                                      description: t("websiteProgress.uploadErrorDescription") || "Failed to upload file. Please try again.",
                                      variant: "destructive",
                                    });
                                    console.error("Upload error:", error);
                                  }
                                }
                              );
                            }
                          }}
                          className="mt-2 text-white"
                          style={{ backgroundColor: '#182B53' }}
                          size="sm"
                          data-testid="button-upload-media"
                        >
                          {t("websiteProgress.uploadMedia") || "Upload Media"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Form Dialog */}
      <Dialog open={isOnboardingDialogOpen} onOpenChange={setIsOnboardingDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("websiteProgress.onboardingFormDialog.title") || "Onboarding Form Response"}</DialogTitle>
            <DialogDescription>
              {t("websiteProgress.onboardingFormDialog.description") || "View the information submitted in your onboarding form"}
            </DialogDescription>
          </DialogHeader>

          {/* Tab switcher — shown when both form types have data */}
          {(onboardingResponse || gsSubmission) && (
            <div className="flex gap-2 border-b pb-2">
              {onboardingResponse && (
                <button
                  onClick={() => setOnboardingDialogView("onboarding")}
                  className={`text-sm px-3 py-1 rounded-t font-medium transition-colors ${
                    onboardingDialogView === "onboarding"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Onboarding Form {onboardingResponse.id ? `#${onboardingResponse.id}` : ""}
                </button>
              )}
              {gsSubmission && (
                <button
                  onClick={() => setOnboardingDialogView("get-started")}
                  className={`text-sm px-3 py-1 rounded-t font-medium transition-colors ${
                    onboardingDialogView === "get-started"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Get-started Submission #{gsSubmission.id}
                </button>
              )}
            </div>
          )}

          {(isLoadingOnboarding || isLoadingGs) ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !onboardingResponse && !gsSubmission ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("websiteProgress.onboardingFormDialog.noData") || "No onboarding form data available for this website"}
            </div>
          ) : onboardingDialogView === "get-started" && gsSubmission ? (
            (() => {
              const s = gsSubmission;
              const Row = ({ label, field, value }: { label: string; field: string; value: unknown }) => {
                const display = formatGsValue(field, value, t);
                if (display === "—") return null;
                return (
                  <div className="border-b pb-3">
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">{label}</h4>
                    <p className="text-sm">{display}</p>
                  </div>
                );
              };
              return (
                <div className="space-y-4">
                  <Row label="Full Name" field="fullName" value={s.fullName} />
                  <Row label="Email" field="email" value={s.email} />
                  <Row label="Phone" field="contactPhone" value={s.contactPhone} />
                  <Row label="VAT Number" field="vatNumber" value={s.vatNumber} />
                  <Row label="City" field="city" value={s.city} />
                  <Row label="Street" field="street" value={s.street ? `${s.street} ${s.streetNumber ?? ""}`.trim() : null} />
                  <Row label="Postal Code" field="postalCode" value={s.postalCode} />
                  <Row label="Selected Plan" field="selectedPlan" value={s.selectedPlan} />
                  <Row label="Billing Period" field="billingPeriod" value={s.billingPeriod} />
                  <Row label="Status" field="status" value={s.status} />
                  <Row label="Business Type" field="businessType" value={s.businessType} />
                  <Row label="Website Goals" field="websiteGoals" value={s.websiteGoals} />
                  <Row label="Design Direction" field="designDirection" value={s.designDirection} />
                  <Row label="Business Name" field="businessName" value={s.businessName} />
                  <Row label="Business Description" field="businessDescription" value={s.businessDescription} />
                  <Row label="Services" field="services" value={s.services} />
                  <Row label="Self Description" field="selfDescription" value={s.selfDescription} />
                  <Row label="Biggest Concerns" field="biggestConcerns" value={s.biggestConcerns} />
                  <Row label="Had Website Before" field="hadWebsiteBefore" value={s.hadWebsiteBefore} />
                  <Row label="Previous Platform" field="previousWebsitePlatform" value={s.previousWebsitePlatform} />
                  <Row label="Heard About Us" field="heardAboutUs" value={s.heardAboutUs} />
                  <Row label="Confirmed Pages" field="confirmedPages" value={s.confirmedPages} />
                  <Row label="Website Content" field="websiteContent" value={s.websiteContent} />
                  <Row label="Success Vision" field="successVision" value={s.successVision} />
                  <Row label="Submission ID" field="submissionId" value={s.submissionId} />
                  <Row label="Website Progress ID" field="websiteProgressId" value={s.websiteProgressId} />
                  <Row label="Created At" field="createdAt" value={s.createdAt ? new Date(s.createdAt).toLocaleString() : null} />
                </div>
              );
            })()
          ) : onboardingResponse ? (
            <div className="space-y-4">
              {/* Display Website Language first if available */}
              {website?.websiteLanguage && (
                <div className="border-b pb-3">
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">
                    {t("onboarding.websiteLanguage") || "Website Language"}
                  </h4>
                  <p className="text-sm">
                    {website.websiteLanguage === 'en'
                      ? (t("onboarding.english") || "English")
                      : (t("onboarding.greek") || "Greek")}
                  </p>
                </div>
              )}

              {/* Display onboarding form fields */}
              {Object.entries(onboardingResponse).map(([key, value]) => {
                if (key === 'id' || key === 'userId' || key === 'websiteProgressId' || key === 'createdAt' || key === 'businessLogoPublicId') return null;
                if (value === null || value === undefined || value === '' ||
                    (Array.isArray(value) && value.length === 0)) return null;
                const formattedValue = formatOnboardingValue(key, value, t);
                if (!formattedValue) return null;
                return (
                  <div key={key} className="border-b pb-3">
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      {getFieldLabel(key, t)}
                    </h4>
                    <p className="text-sm">{formattedValue}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setIsOnboardingDialogOpen(false)} data-testid="button-close-onboarding">
              {t("websiteProgress.onboardingFormDialog.close") || "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
