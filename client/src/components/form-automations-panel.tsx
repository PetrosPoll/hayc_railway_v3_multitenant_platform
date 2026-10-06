import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Zap } from "lucide-react";
import type { SiteFormConfig, WebsiteFormAutomation } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type FormAutomationsPanelProps = {
  websiteId: number;
  websiteLanguage?: string | null;
};

const DEFAULT_SUBJECT = {
  en: "We received your message — {{siteLabel}}",
  gr: "Λάβαμε το μήνυμά σας — {{siteLabel}}",
} as const;

const DEFAULT_BODY = {
  en: "Hi {{name}}, thank you for reaching out. We have received your message and will get back to you as soon as possible.",
  gr: "Γεια σου {{name}}, ευχαριστούμε που επικοινωνήσατε μαζί μας. Λάβαμε το μήνυμά σας και θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.",
} as const;

function langKey(websiteLanguage?: string | null): "en" | "gr" {
  return websiteLanguage === "gr" || websiteLanguage === "el" ? "gr" : "en";
}

export function FormAutomationsPanel({ websiteId, websiteLanguage }: FormAutomationsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const defaultsLang = langKey(websiteLanguage);

  const { data: formsData, isLoading: formsLoading } = useQuery<{ forms: SiteFormConfig[] }>({
    queryKey: ["/api/websites", websiteId, "forms"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/forms`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load forms");
      return res.json();
    },
  });

  const { data: automationsData, isLoading: automationsLoading } = useQuery<{
    automations: WebsiteFormAutomation[];
  }>({
    queryKey: ["/api/websites", websiteId, "form-automations"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/form-automations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load automations");
      return res.json();
    },
  });

  const forms = formsData?.forms ?? [];
  const automationsByFormId = useMemo(() => {
    const map = new Map<string, WebsiteFormAutomation>();
    for (const a of automationsData?.automations ?? []) {
      map.set(a.formId, a);
    }
    return map;
  }, [automationsData]);

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [visitorSubject, setVisitorSubject] = useState<string>(DEFAULT_SUBJECT[defaultsLang]);
  const [visitorBody, setVisitorBody] = useState<string>(DEFAULT_BODY[defaultsLang]);

  useEffect(() => {
    if (!selectedFormId && forms.length > 0) {
      setSelectedFormId(forms[0].id);
    }
  }, [forms, selectedFormId]);

  useEffect(() => {
    if (!selectedFormId) return;
    const existing = automationsByFormId.get(selectedFormId);
    if (existing) {
      setEnabled(existing.enabled);
      setVisitorSubject(existing.visitorSubject);
      setVisitorBody(existing.visitorBody);
    } else {
      setEnabled(true);
      setVisitorSubject(DEFAULT_SUBJECT[defaultsLang]);
      setVisitorBody(DEFAULT_BODY[defaultsLang]);
    }
  }, [selectedFormId, automationsByFormId, defaultsLang]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormId) throw new Error("No form selected");
      const res = await fetch(
        `/api/websites/${websiteId}/form-automations/${encodeURIComponent(selectedFormId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled, visitorSubject, visitorBody }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save automation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/websites", websiteId, "form-automations"],
      });
      toast({
        title: t("dashboard.automationsSaved") || "Automation saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? null;
  const isLoading = formsLoading || automationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="automations-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <Card data-testid="automations-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t("dashboard.automations") || "Automations"}
          </CardTitle>
          <CardDescription>
            {t("dashboard.automationsEmptyDescription") ||
              "Name a form in the Content Editor first. Once forms are registered in your site config, you can choose the auto-reply email for each one here."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="automations-panel">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {t("dashboard.automations") || "Automations"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.automationsDescription") ||
            "When someone submits a form, send them a custom confirmation email."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.automationsForms") || "Forms"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {forms.map((form) => {
              const hasAutomation = automationsByFormId.has(form.id);
              const isActive = selectedFormId === form.id;
              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => setSelectedFormId(form.id)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  data-testid={`automation-form-${form.id}`}
                >
                  <div className="font-medium truncate">{form.name}</div>
                  <div className={`text-xs truncate ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                    {form.id}
                    {hasAutomation ? ` · ${t("dashboard.automationsConfigured") || "configured"}` : ""}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {selectedForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selectedForm.name}</CardTitle>
              <CardDescription>
                {t("dashboard.automationsPlaceholdersHint", {
                  name: "{{name}}",
                  email: "{{email}}",
                  phone: "{{phone}}",
                  message: "{{message}}",
                  siteLabel: "{{siteLabel}}",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="automation-enabled">
                    {t("dashboard.automationsEnabled") || "Send confirmation email"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("dashboard.automationsEnabledHint") ||
                      "When off, visitors get the default platform confirmation."}
                  </p>
                </div>
                <Switch
                  id="automation-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  data-testid="automation-enabled-switch"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automation-subject">
                  {t("dashboard.automationsSubject") || "Email subject"}
                </Label>
                <Input
                  id="automation-subject"
                  value={visitorSubject}
                  onChange={(e) => setVisitorSubject(e.target.value)}
                  maxLength={200}
                  data-testid="automation-subject-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automation-body">
                  {t("dashboard.automationsBody") || "Email body"}
                </Label>
                <Textarea
                  id="automation-body"
                  value={visitorBody}
                  onChange={(e) => setVisitorBody(e.target.value)}
                  rows={8}
                  maxLength={5000}
                  data-testid="automation-body-input"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !visitorSubject.trim() || !visitorBody.trim()}
                  data-testid="automation-save-button"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t("dashboard.automationsSave") || "Save automation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
