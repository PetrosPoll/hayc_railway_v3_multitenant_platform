import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Loader2, Mail, Zap } from "lucide-react";
import type { SiteFormConfig, WebsiteFormAutomation } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormattedTextarea } from "@/components/ui/formatted-textarea";
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
  en: "Hi {{name}},\n\nThank you for reaching out. We have received your message and will get back to you as soon as possible.\n\n— The {{siteLabel}} team",
  gr: "Γεια σου {{name}},\n\nΕυχαριστούμε που επικοινωνήσατε μαζί μας. Λάβαμε το μήνυμά σας και θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.\n\n— Η ομάδα {{siteLabel}}",
} as const;

function langKey(websiteLanguage?: string | null): "en" | "gr" {
  return websiteLanguage === "gr" || websiteLanguage === "el" ? "gr" : "en";
}

function extractLogoFromConfig(config: any): string {
  const candidates = [
    config?.navConfig?.logo,
    config?.nav_config?.logo,
    config?.nav?.logo,
    config?.header?.logo,
    config?.branding?.logo,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) return c.trim();
  }
  return "";
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

  const { data: siteConfig } = useQuery({
    queryKey: ["/api/websites", websiteId, "site-config"],
    queryFn: async () => {
      const res = await fetch(`/api/websites/${websiteId}/site-config`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const siteLogoUrl = useMemo(() => extractLogoFromConfig(siteConfig), [siteConfig]);

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
  const [logoUrl, setLogoUrl] = useState<string>("");

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
      setLogoUrl(existing.logoUrl || "");
    } else {
      setEnabled(true);
      setVisitorSubject(DEFAULT_SUBJECT[defaultsLang]);
      setVisitorBody(DEFAULT_BODY[defaultsLang]);
      setLogoUrl("");
    }
  }, [selectedFormId, automationsByFormId, defaultsLang]);

  const effectiveLogo = logoUrl.trim() || siteLogoUrl;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormId) throw new Error("No form selected");
      const res = await fetch(
        `/api/websites/${websiteId}/form-automations/${encodeURIComponent(selectedFormId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            visitorSubject,
            visitorBody,
            logoUrl: logoUrl.trim() || null,
          }),
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
              "No forms found for this site yet. Once forms are registered in site config, they will appear here."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="automations-panel">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {t("dashboard.automations") || "Automations"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.automationsDescription") ||
            "Connect a form to a confirmation email. When off, visitors get the default hayc email."}
        </p>
      </div>

      {/* Visual flow preview */}
      {selectedForm && (
        <div
          className="rounded-xl border bg-muted/20 p-4 md:p-6 overflow-x-auto"
          data-testid="automations-flow-preview"
        >
          <div className="flex items-center gap-3 md:gap-4 min-w-[520px] justify-center">
            <div className="flex-1 max-w-[220px] rounded-lg border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <FileText className="h-3.5 w-3.5" />
                {t("dashboard.automationsTrigger") || "Trigger"}
              </div>
              <div className="font-semibold text-sm truncate">{selectedForm.name}</div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {t("dashboard.automationsTriggerHint") || "When this form is submitted"}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 shrink-0 text-muted-foreground">
              <ArrowRight className="h-5 w-5" />
              <span className="text-[10px] uppercase tracking-wide">
                {enabled
                  ? t("dashboard.automationsThen") || "then"
                  : t("dashboard.automationsDefault") || "default"}
              </span>
            </div>

            <div
              className={`flex-1 max-w-[220px] rounded-lg border p-4 shadow-sm ${
                enabled ? "bg-background border-primary/40" : "bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Mail className="h-3.5 w-3.5" />
                {t("dashboard.automationsAction") || "Action"}
              </div>
              <div className="font-semibold text-sm">
                {enabled
                  ? t("dashboard.automationsSendCustom") || "Send custom email"
                  : t("dashboard.automationsSendDefault") || "Send default email"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {enabled ? visitorSubject || "—" : t("dashboard.automationsPlatformDefault") || "Platform template"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.automationsForms") || "Forms"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {forms.map((form) => {
              const existing = automationsByFormId.get(form.id);
              const isActive = selectedFormId === form.id;
              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => setSelectedFormId(form.id)}
                  className={`w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  data-testid={`automation-form-${form.id}`}
                >
                  <div className="font-medium truncate">{form.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs truncate ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                      {form.id}
                    </span>
                    {existing?.enabled ? (
                      <Badge variant={isActive ? "secondary" : "default"} className="text-[10px] h-5">
                        {t("dashboard.automationsOn") || "On"}
                      </Badge>
                    ) : existing ? (
                      <Badge variant="outline" className={`text-[10px] h-5 ${isActive ? "border-primary-foreground/40" : ""}`}>
                        {t("dashboard.automationsOff") || "Off"}
                      </Badge>
                    ) : null}
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
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Label htmlFor="automation-enabled">
                    {t("dashboard.automationsEnabled") || "Use custom confirmation email"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("dashboard.automationsEnabledHint") ||
                      "When off, visitors get the default platform confirmation (with submission details)."}
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
                <Label htmlFor="automation-logo">
                  {t("dashboard.automationsLogo") || "Email logo URL"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.automationsLogoHint") ||
                    "Leave empty to use your website logo. Hayc branding stays only as “Sent via Hayc” in the footer."}
                </p>
                <Input
                  id="automation-logo"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder={siteLogoUrl || "https://…"}
                  disabled={!enabled}
                  data-testid="automation-logo-input"
                />
                {effectiveLogo ? (
                  <div className="rounded-md border bg-muted/20 p-3 flex items-center justify-center">
                    <img
                      src={effectiveLogo}
                      alt="Logo preview"
                      className="max-h-12 max-w-[160px] object-contain"
                    />
                  </div>
                ) : null}
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
                  disabled={!enabled}
                  data-testid="automation-subject-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automation-body">
                  {t("dashboard.automationsBody") || "Email body"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.automationsBodyHint") ||
                    "This is the full email content. Use the toolbar for bold, italic, and underline."}
                </p>
                <FormattedTextarea
                  id="automation-body"
                  value={visitorBody}
                  onChange={(e) => setVisitorBody(e.target.value)}
                  rows={12}
                  maxLength={10000}
                  disabled={!enabled}
                  showPreview
                  data-testid="automation-body-input"
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    saveMutation.isPending ||
                    !visitorSubject.trim() ||
                    !visitorBody.trim()
                  }
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
