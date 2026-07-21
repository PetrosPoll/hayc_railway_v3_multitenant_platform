import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { DemoBuyerCredentials } from "@/components/digital-products/CreateDemoBuyerDialog";

type Props = {
  credentials: DemoBuyerCredentials;
  websiteDomain?: string | null;
};

function websitePublicUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const clean = domain.replace(/\.pending-onboarding$/i, "").trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean.replace(/\/$/, "");
  return `https://${clean}`;
}

export function DemoBuyerCredentialsPanel({ credentials, websiteDomain }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null);
  const siteUrl = websitePublicUrl(websiteDomain);

  const copyValue = async (field: "email" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 1500);
    } catch {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: t("digitalProductsManagement.buyers.demoBuyer.copyFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="mb-6" data-testid="demo-buyer-credentials">
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-base font-semibold">
            {t("digitalProductsManagement.buyers.demoBuyer.panelTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {siteUrl
              ? t("digitalProductsManagement.buyers.demoBuyer.loginInstructions", { siteUrl })
              : t("digitalProductsManagement.buyers.demoBuyer.loginInstructionsNoUrl")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t("digitalProductsManagement.buyers.demoBuyer.emailLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input value={credentials.email} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("digitalProductsManagement.buyers.demoBuyer.copyEmail")}
                onClick={() => void copyValue("email", credentials.email)}
              >
                {copiedField === "email" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("digitalProductsManagement.buyers.demoBuyer.passwordLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input value={credentials.password} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("digitalProductsManagement.buyers.demoBuyer.copyPassword")}
                onClick={() => void copyValue("password", credentials.password)}
              >
                {copiedField === "password" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {siteUrl ? (
          <Button type="button" variant="secondary" size="sm" asChild>
            <a href={siteUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("digitalProductsManagement.buyers.demoBuyer.openWebsite")}
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
