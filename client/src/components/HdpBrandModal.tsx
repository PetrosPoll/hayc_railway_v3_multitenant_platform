import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PickImageFromMediaDialog } from "@/components/ui/pick-image-from-media-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export type HdpFontFamily = "Inter" | "Roboto" | "Lato" | "Montserrat" | "Playfair Display" | "Poppins";
export type HdpBorderRadius = "0px" | "4px" | "8px" | "16px" | "9999px";

interface HdpBrandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  websiteId: string | number;
  previewUrl?: string;
}

interface HdpBrandFormState {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  primaryForeground: string;
  fontFamily: HdpFontFamily;
  borderRadius: HdpBorderRadius;
}

const FONT_FAMILIES: HdpFontFamily[] = ["Inter", "Roboto", "Lato", "Montserrat", "Playfair Display", "Poppins"];
const BORDER_RADII: Array<{ value: HdpBorderRadius; labelKey: string }> = [
  { value: "0px", labelKey: "digitalProductsManagement.brandModal.borderRadiusOptions.none" },
  { value: "4px", labelKey: "digitalProductsManagement.brandModal.borderRadiusOptions.small" },
  { value: "8px", labelKey: "digitalProductsManagement.brandModal.borderRadiusOptions.medium" },
  { value: "16px", labelKey: "digitalProductsManagement.brandModal.borderRadiusOptions.large" },
  { value: "9999px", labelKey: "digitalProductsManagement.brandModal.borderRadiusOptions.full" },
];

const DEFAULT_FORM: HdpBrandFormState = {
  brandName: "",
  logoUrl: "",
  primaryColor: "#182B53",
  primaryForeground: "#FFFFFF",
  fontFamily: "Inter",
  borderRadius: "8px",
};

function normalizeHexColor(input: string, fallback: string) {
  const v = (input ?? "").trim();
  if (!v) return fallback;
  if (v.startsWith("#")) return v;
  return `#${v}`;
}

function getLogoFromSiteConfig(siteConfig: any) {
  return (
    siteConfig?.navConfig?.logo ??
    siteConfig?.nav_config?.logo ??
    siteConfig?.nav?.logo ??
    ""
  );
}

function getFirstString(obj: any, keys: string[]) {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeFontFamily(input: any, fallback: HdpFontFamily): HdpFontFamily {
  if (typeof input !== "string") return fallback;

  const raw = input.trim();
  if (!raw) return fallback;

  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return fallback;

  for (const f of FONT_FAMILIES) {
    const fn = f.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (fn === normalized) return f;
  }

  return fallback;
}

function normalizeBorderRadius(input: any, fallback: HdpBorderRadius): HdpBorderRadius {
  if (input === null || input === undefined) return fallback;

  // Number -> px (except 9999 is special)
  if (typeof input === "number") {
    if (input === 9999) return "9999px";
    if ([0, 4, 8, 16].includes(input)) return `${input}px` as HdpBorderRadius;
    return fallback;
  }

  if (typeof input === "string") {
    const v = input.trim().toLowerCase();
    if (!v) return fallback;
    if (v === "none") return "0px";
    if (BORDER_RADII.some((x) => x.value === input)) return input as HdpBorderRadius;

    // "8px" or "8"
    const numeric = v.replace(/px$/, "");
    if (/^\d+$/.test(numeric)) {
      const n = Number(numeric);
      if (n === 9999) return "9999px";
      if ([0, 4, 8, 16].includes(n)) return `${n}px` as HdpBorderRadius;
    }
  }

  return fallback;
}

function pickBrandRoot(brandJson: any) {
  return (
    brandJson?.brand ??
    brandJson?.data ??
    brandJson?.theme ??
    brandJson?.styles ??
    brandJson ??
    {}
  );
}

export function HdpBrandModal({ open, onOpenChange, siteId, websiteId, previewUrl }: HdpBrandModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [form, setForm] = useState<HdpBrandFormState>(DEFAULT_FORM);

  const canSave = useMemo(() => open && !isLoading && !isSaving && !!siteId, [open, isLoading, isSaving, siteId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setForm(DEFAULT_FORM);

      try {
        const [brandRes, siteConfigRes] = await Promise.all([
          fetch(`/api/hdp/brand/${encodeURIComponent(siteId)}`, {
            credentials: "include",
          }),
          fetch(`/api/sites/${encodeURIComponent(siteId)}/config`, {
            credentials: "include",
          }),
        ]);

        if (!brandRes.ok) {
          throw new Error("Failed to fetch brand config");
        }

        const brandJson = await brandRes.json();
        const siteConfigJson = siteConfigRes.ok ? await siteConfigRes.json() : null;

        const logoFromConfig = siteConfigJson ? getLogoFromSiteConfig(siteConfigJson) : "";

        const brandRoot = pickBrandRoot(brandJson);

        // Also allow nested theme/typography objects if the backend returns them that way
        const themeRoot = brandJson?.theme ?? brandRoot?.theme ?? brandJson?.styles ?? brandRoot?.styles ?? brandJson ?? {};
        const typographyRoot =
          brandJson?.typography ?? brandRoot?.typography ?? brandJson?.fonts ?? brandRoot?.fonts ?? {};

        const logoUrl =
          getFirstString(brandRoot, ["logoUrl", "logo_url", "logo"]) ??
          getFirstString(themeRoot, ["logoUrl", "logo_url", "logo"]) ??
          "";

        const next: HdpBrandFormState = {
          brandName:
            getFirstString(brandRoot, ["brandName", "brand_name", "name"]) ??
            getFirstString(themeRoot, ["brandName", "brand_name", "name"]) ??
            "",
          logoUrl:
            (logoUrl ? logoUrl : typeof logoFromConfig === "string" ? logoFromConfig : ""),
          primaryColor: normalizeHexColor(
            getFirstString(brandRoot, ["primaryColor", "primary_color", "primarycolour", "mainColor", "main_color"]) ??
              getFirstString(themeRoot, ["primaryColor", "primary_color", "primarycolour", "mainColor", "main_color"]) ??
              DEFAULT_FORM.primaryColor,
            DEFAULT_FORM.primaryColor
          ),
          primaryForeground: normalizeHexColor(
            getFirstString(brandRoot, [
              "primaryForeground",
              "primary_foreground",
              "textOnPrimary",
              "text_on_primary",
              "primaryTextColor",
              "primary_text_color",
            ]) ??
              getFirstString(themeRoot, [
                "primaryForeground",
                "primary_foreground",
                "textOnPrimary",
                "text_on_primary",
                "primaryTextColor",
                "primary_text_color",
              ]) ??
              DEFAULT_FORM.primaryForeground,
            DEFAULT_FORM.primaryForeground
          ),
          fontFamily: normalizeFontFamily(
            getFirstString(brandRoot, ["fontFamily", "font_family", "font"]) ??
              getFirstString(typographyRoot, ["fontFamily", "font_family", "family"]) ??
              getFirstString(themeRoot, ["fontFamily", "font_family", "family"]) ??
              DEFAULT_FORM.fontFamily,
            DEFAULT_FORM.fontFamily
          ),
          borderRadius: normalizeBorderRadius(
            getFirstString(brandRoot, ["borderRadius", "border_radius", "borderRadiusPx", "radius"]) ??
              getFirstString(themeRoot, ["borderRadius", "border_radius", "radius"]) ??
              DEFAULT_FORM.borderRadius,
            DEFAULT_FORM.borderRadius
          ),
        };

        if (cancelled) return;
        setForm(next);
      } catch (_err) {
        if (cancelled) return;
        toast({
          title: t("digitalProductsManagement.brandModal.toasts.somethingWentWrong"),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, siteId, t, toast]);

  const handleSave = async () => {
    if (!siteId || !canSave) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/hdp/brand/${encodeURIComponent(siteId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: form.brandName,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          primaryForeground: form.primaryForeground,
          fontFamily: form.fontFamily,
          borderRadius: form.borderRadius,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update brand config");
      }

      toast({
        title: t("digitalProductsManagement.brandModal.toasts.lookAndFeelUpdated"),
      });
      onOpenChange(false);
    } catch (_err) {
      toast({
        title: t("digitalProductsManagement.brandModal.toasts.somethingWentWrong"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("digitalProductsManagement.brandModal.title")}</DialogTitle>
          <DialogDescription>
            {t("digitalProductsManagement.brandModal.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10" data-testid="hdp-brand-loading">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hdp-brand-name">{t("digitalProductsManagement.brandModal.fields.brandName")}</Label>
              <Input
                id="hdp-brand-name"
                value={form.brandName}
                onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
                placeholder={t("digitalProductsManagement.brandModal.placeholders.brandName")}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hdp-brand-logo-url">
                {t("digitalProductsManagement.brandModal.fields.logoUrl")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hdp-brand-logo-url"
                  value={form.logoUrl}
                  readOnly
                  placeholder="No image selected"
                  className="w-full bg-muted/50"
                  disabled={isSaving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setIsPickingImage(true)}
                >
                  Pick Image
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.brandModal.fields.primaryColor")}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: normalizeHexColor(e.target.value, prev.primaryColor) }))}
                  className="h-10 w-12 p-0 border border-input rounded-md bg-background"
                  disabled={isSaving}
                />
                <Input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: normalizeHexColor(e.target.value, prev.primaryColor) }))}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.brandModal.fields.textColorOnPrimary")}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryForeground}
                  onChange={(e) => setForm((prev) => ({ ...prev, primaryForeground: normalizeHexColor(e.target.value, prev.primaryForeground) }))}
                  className="h-10 w-12 p-0 border border-input rounded-md bg-background"
                  disabled={isSaving}
                />
                <Input
                  type="text"
                  value={form.primaryForeground}
                  onChange={(e) => setForm((prev) => ({ ...prev, primaryForeground: normalizeHexColor(e.target.value, prev.primaryForeground) }))}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.brandModal.fields.fontFamily")}</Label>
              <Select
                value={form.fontFamily}
                onValueChange={(val) => setForm((prev) => ({ ...prev, fontFamily: val as HdpFontFamily }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("digitalProductsManagement.brandModal.placeholders.selectFont")} />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font} value={font}>
                      <span style={{ fontFamily: font }}>{font}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("digitalProductsManagement.brandModal.fields.borderRadius")}</Label>
              <Select
                value={form.borderRadius}
                onValueChange={(val) => setForm((prev) => ({ ...prev, borderRadius: val as HdpBorderRadius }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("digitalProductsManagement.brandModal.placeholders.selectBorderRadius")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_RADII.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              disabled={isSaving || isLoading}
            >
              {t("digitalProductsManagement.brandModal.actions.preview")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isLoading}
          >
            {t("digitalProductsManagement.common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("digitalProductsManagement.common.saving")}
              </>
            ) : (
              t("digitalProductsManagement.common.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <PickImageFromMediaDialog
      open={isPickingImage}
      onClose={() => setIsPickingImage(false)}
      onSelect={(url) => {
        setForm((f) => ({ ...f, logoUrl: url }));
        setIsPickingImage(false);
      }}
      websiteId={websiteId}
      currentFieldUrl={form.logoUrl}
    />
    </>
  );
}

