import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type HdpFontFamily = "Inter" | "Roboto" | "Lato" | "Montserrat" | "Playfair Display" | "Poppins";
export type HdpBorderRadius = "0px" | "4px" | "8px" | "16px" | "9999px";

interface HdpBrandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
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
const BORDER_RADII: Array<{ value: HdpBorderRadius; label: string }> = [
  { value: "0px", label: "None (0px)" },
  { value: "4px", label: "Small (4px)" },
  { value: "8px", label: "Medium (8px)" },
  { value: "16px", label: "Large (16px)" },
  { value: "9999px", label: "Full (9999px)" },
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

export function HdpBrandModal({ open, onOpenChange, siteId, previewUrl }: HdpBrandModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
          title: "Something went wrong, please try again",
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
  }, [open, siteId, toast]);

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
        title: "Look & feel updated",
      });
      onOpenChange(false);
    } catch (_err) {
      toast({
        title: "Something went wrong, please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Look &amp; Feel</DialogTitle>
          <DialogDescription>
            Update the branding (logo, colors, font, and border radius) for this site.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10" data-testid="hdp-brand-loading">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hdp-brand-name">Brand name</Label>
              <Input
                id="hdp-brand-name"
                value={form.brandName}
                onChange={(e) => setForm((prev) => ({ ...prev, brandName: e.target.value }))}
                placeholder="e.g. FC Barcelona"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hdp-brand-logo-url">Logo URL</Label>
              <Input
                id="hdp-brand-logo-url"
                value={form.logoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Primary color</Label>
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
              <Label>Text color on primary</Label>
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
              <Label>Font family</Label>
              <Select
                value={form.fontFamily}
                onValueChange={(val) => setForm((prev) => ({ ...prev, fontFamily: val as HdpFontFamily }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a font" />
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
              <Label>Border radius</Label>
              <Select
                value={form.borderRadius}
                onValueChange={(val) => setForm((prev) => ({ ...prev, borderRadius: val as HdpBorderRadius }))}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select border radius" />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_RADII.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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
              Preview
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isLoading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

