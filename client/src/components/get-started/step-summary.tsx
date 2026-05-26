import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import {
  PLANS,
  WIZARD_BILLING_PERIODS,
  type WizardValues,
} from "@/pages/get-started";
import { SUMMARY_SELECTED_DESIGN_I18N_KEY } from "@/lib/get-started-translations";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import {
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  FileText,
  LayoutGrid,
  Rocket,
} from "lucide-react";
import WalkthroughExplainer from "@/components/get-started/walkthrough-explainer";

const ADDON_I18N_KEY_MAP: Record<string, string> = {
  "Booking Integration": "bookingIntegration",
  "HDP": "hdp",
};

const PLAN_CONFIG: {
  id: (typeof PLANS)[number];
  monthlyPrice: number;
  yearlyPricePerMonth: number;
  recommended: boolean;
}[] = [
  { id: "essential", monthlyPrice: 39, yearlyPricePerMonth: 31, recommended: true },
  { id: "basic", monthlyPrice: 34, yearlyPricePerMonth: 27, recommended: false },
  { id: "pro", monthlyPrice: 200, yearlyPricePerMonth: 160, recommended: false },
];

interface StepSummaryProps {
  form: UseFormReturn<WizardValues>;
  onBack: () => void;
  onSubmit: () => void;
  /** When true, account fields are skipped (user came from session); pre-checkout will use the same session. */
  isLoggedIn?: boolean;
  isSubmitting?: boolean;
}

export default function StepSummary({
  form,
  onBack,
  onSubmit,
  isLoggedIn = false,
  isSubmitting = false,
}: StepSummaryProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const getPageLabel = (page: string): string => {
    const result = t(`getStarted.websiteStructure.pages.${page}`);
    return result.startsWith("getStarted.") ? page : result;
  };

  const getAddonLabel = (value: string): string => {
    const key = ADDON_I18N_KEY_MAP[value];
    return key ? t(`getStarted.recommendation.addons.${key}`) : value;
  };
  const selectedDesignId = form.watch("selectedDesign");
  const selectedPlanId = form.watch("plan");
  const selectedBillingPeriod = form.watch("billingPeriod") ?? "monthly";
  const fullName = form.watch("fullName");
  const email = form.watch("email");
  const password = form.watch("password") ?? "";
  const documentType = form.watch("documentType");
  const vatNumber = form.watch("vatNumber");
  const city = form.watch("city");
  const street = form.watch("street");
  const streetNumber = form.watch("streetNumber");
  const postalCode = form.watch("postalCode");
  const privacyAccepted = form.watch("privacyAccepted");

  const passwordRequirements = [
    { key: "length",    label: t("getStarted.summary.passwordRequirements.length"),    met: password.length >= 8 },
    { key: "uppercase", label: t("getStarted.summary.passwordRequirements.uppercase"), met: /[A-Z]/.test(password) },
    { key: "number",    label: t("getStarted.summary.passwordRequirements.number"),    met: /[0-9]/.test(password) },
    { key: "special",   label: t("getStarted.summary.passwordRequirements.special"),   met: /[^A-Za-z0-9]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every((r) => r.met);
  const showRequirements = password.length > 0;

  const getMissingFieldLabels = (): string[] => {
    if (isLoggedIn) {
      if (documentType === "invoice") {
        const missing: string[] = [];
        if (!vatNumber?.trim()) missing.push(t("getStarted.summary.placeholders.vatNumber"));
        if (!city?.trim()) missing.push(t("getStarted.summary.placeholders.city"));
        if (!street?.trim()) missing.push(t("getStarted.summary.placeholders.street"));
        if (!streetNumber?.trim()) missing.push(t("getStarted.summary.placeholders.streetNumber"));
        if (!postalCode?.trim()) missing.push(t("getStarted.summary.placeholders.postalCode"));
        return missing;
      }
      return [];
    }
    const missing: string[] = [];
    if (!fullName?.trim()) missing.push(t("getStarted.summary.placeholders.fullName"));
    if (!email?.trim()) missing.push(t("getStarted.summary.placeholders.email"));
    if (!allRequirementsMet) missing.push(t("getStarted.summary.placeholders.password"));
    if (!privacyAccepted) missing.push(t("getStarted.summary.privacyPolicyLink"));
    if (documentType === "invoice") {
      if (!vatNumber?.trim()) missing.push(t("getStarted.summary.placeholders.vatNumber"));
      if (!city?.trim()) missing.push(t("getStarted.summary.placeholders.city"));
      if (!street?.trim()) missing.push(t("getStarted.summary.placeholders.street"));
      if (!streetNumber?.trim()) missing.push(t("getStarted.summary.placeholders.streetNumber"));
      if (!postalCode?.trim()) missing.push(t("getStarted.summary.placeholders.postalCode"));
    }
    return missing;
  };

  const designLabel =
    selectedDesignId && SUMMARY_SELECTED_DESIGN_I18N_KEY[selectedDesignId]
      ? t(SUMMARY_SELECTED_DESIGN_I18N_KEY[selectedDesignId])
      : t("getStarted.summary.designLabels.unknown");

  const selectedTemplate =
    selectedDesignId && selectedDesignId !== "auto"
      ? ENVATO_TEMPLATES.find((t) => String(t.id) === selectedDesignId)
      : null;

  const planLabelForCta =
    selectedPlanId && PLANS.includes(selectedPlanId)
      ? t(`getStarted.summary.plans.${selectedPlanId}.label`)
      : t("getStarted.summary.plans.essential.label");

  return (
    <div className="w-full min-h-screen bg-black px-4 md:px-16 pt-16 pb-8 md:py-12 flex flex-col justify-center items-center gap-6 overflow-hidden">
      {/* Header */}
      <div className="w-full md:w-[638px] flex flex-col items-center gap-3">
        <div className="w-full text-center text-white text-2xl md:text-4xl font-semibold font-brand">
          {t("getStarted.summary.title")}
        </div>
        <div className="w-full text-center text-white text-sm md:text-lg font-medium font-brand">
          {isLoggedIn
            ? t("getStarted.summary.subtitleLoggedIn")
            : t("getStarted.summary.subtitle")}
        </div>
      </div>

      {/* Two column cards — desktop: equal height (stretch to tallest) */}
      <div className="w-full flex flex-col md:flex-row justify-start items-start gap-6">
        {/* LEFT CARD — summary */}
        <div className="w-full md:flex-1 md:min-h-0 p-4 md:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col gap-6">
          {/* Selected design row */}
          <div className="flex justify-start items-start gap-3">
            <div className="flex-1 flex flex-col gap-2 md:gap-3">
              <div className="text-white text-base md:text-2xl font-medium font-brand">
                {t("getStarted.summary.selectedDesign")}
              </div>
              {selectedDesignId === "auto" ? (
                <div className="flex flex-col gap-1">
                  <div className="text-white text-sm md:text-lg font-medium font-brand">
                    {t("getStarted.summary.designLabels.auto")}
                  </div>
                  <div className="text-white/60 text-xs md:text-sm font-normal font-brand">
                    {t("getStarted.summary.designLabels.autoSubtitle")}
                  </div>
                </div>
              ) : (
                <div className="text-white text-sm md:text-lg font-medium font-brand">
                  {selectedTemplate ? selectedTemplate.name : designLabel}
                </div>
              )}
            </div>
            {selectedDesignId === "auto" ? (
              <div className="w-20 h-14 md:flex-1 md:h-32 bg-[radial-gradient(ellipse_141.42%_151.02%_at_0%_0%,_rgba(237,76,20,0.21)_0%,_rgba(237,76,20,0.11)_67%)] rounded-[10px] flex items-center justify-center">
                <svg className="w-8 h-8 opacity-60" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4 L26 22 L44 24 L26 26 L24 44 L22 26 L4 24 L22 22 Z" fill="white" opacity="0.9"/>
                  <path d="M38 8 L39 14 L45 15 L39 16 L38 22 L37 16 L31 15 L37 14 Z" fill="white" opacity="0.7"/>
                </svg>
              </div>
            ) : selectedTemplate ? (
              <img
                src={selectedTemplate.preview}
                alt={selectedTemplate.name}
                className="w-20 h-14 md:flex-1 md:h-32 rounded-[10px] object-cover object-top"
              />
            ) : (
              <div className="w-20 h-14 md:flex-1 md:h-32 bg-neutral-700/30 rounded-[10px]" />
            )}
          </div>

          {/* Walkthrough section */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-4">
              <div className="text-white text-lg font-medium font-brand">
                {t("getStarted.summary.walkthroughTitle")}
              </div>
              <WalkthroughExplainer />
            </div>

            <div className="w-full p-3.5 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-neutral-500 flex flex-col gap-3">
              <div className="w-full pb-2.5 border-b border-neutral-500 flex items-center gap-3">
                <Rocket className="w-4 h-4 md:w-5 md:h-5 text-[#ED4C14] flex-shrink-0" />
                <span className="text-white text-sm md:text-lg font-bold font-brand">
                  {t("getStarted.summary.whatsIncluded")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-white flex-shrink-0" />
                <span className="text-white text-xs md:text-lg font-medium font-brand">
                  {(form.watch("suggestedStructure") ?? []).length > 0
                    ? (form.watch("suggestedStructure") ?? []).map(getPageLabel).join(", ")
                    : t("getStarted.summary.pagesIncluded")}
                </span>
              </div>
              {(form.watch("selectedAddons") ?? []).length > 0 && (
                <div className="flex items-start gap-3">
                  <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-white flex-shrink-0 mt-0.5" />
                  <span className="text-white text-xs md:text-lg font-medium font-brand">
                    {(form.watch("selectedAddons") ?? [])
                      .map(getAddonLabel)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-white text-xs md:text-base font-normal font-brand leading-6">
            {t("getStarted.summary.customizeLater")}
          </div>
        </div>

        {/* RIGHT CARD — account + plan */}
        <div className="w-full md:flex-1 md:min-h-0 p-4 md:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col gap-8 md:gap-24">
          <div className="flex flex-col gap-6">
            <div className="text-white text-base md:text-2xl font-medium font-brand">
              {isLoggedIn
                ? t("getStarted.summary.createAccountLoggedIn")
                : t("getStarted.summary.createAccount")}
            </div>
            {isLoggedIn ? (
              <div className="flex flex-col gap-3">
                <p className="text-white/80 text-sm font-normal font-brand leading-6">
                  {t("getStarted.summary.signedInAsPrefix")}{" "}
                  <span className="text-[#ED4C14] font-medium">
                    {form.watch("email") || "—"}
                  </span>
                </p>

                {/* Document type */}
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-white/80 text-sm font-medium font-brand mb-2">
                        {t("getStarted.summary.documentType.label")}
                      </div>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          {(["receipt", "invoice"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => field.onChange(type)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer bg-transparent text-left",
                                field.value === type ? "border-[#ED4C14]" : "border-neutral-500",
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center",
                                field.value === type ? "border-[#ED4C14]" : "border-white",
                              )}>
                                {field.value === type && (
                                  <div className="w-2 h-2 rounded-full bg-[#ED4C14]" />
                                )}
                              </div>
                              <span className="text-white text-sm font-brand">
                                {t(`getStarted.summary.documentType.${type}`)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Invoice fields — conditional */}
                {form.watch("documentType") === "invoice" && (
                  <div className="flex flex-col gap-3">
                    <FormField
                      control={form.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <input
                              {...field}
                              value={field.value ?? ""}
                              placeholder={t("getStarted.summary.placeholders.vatNumber")}
                              className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      {(["city", "street", "streetNumber", "postalCode"] as const).map((fieldName) => (
                        <FormField
                          key={fieldName}
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder={t(`getStarted.summary.placeholders.${fieldName}`)}
                                  className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          {...field}
                          value={field.value ?? ""}
                          placeholder={t("getStarted.summary.placeholders.fullName")}
                          className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="email"
                          placeholder={t("getStarted.summary.placeholders.email")}
                          className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          {...field}
                          value={field.value ?? ""}
                          type="tel"
                          placeholder={t("getStarted.summary.placeholders.phoneOptional")}
                          className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <div className="text-white/80 text-sm font-medium font-brand mb-2">
                        {t("getStarted.summary.documentType.label")}
                      </div>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          {(["receipt", "invoice"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => field.onChange(type)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer bg-transparent text-left",
                                field.value === type ? "border-[#ED4C14]" : "border-neutral-500",
                              )}
                            >
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center",
                                  field.value === type ? "border-[#ED4C14]" : "border-white",
                                )}
                              >
                                {field.value === type && (
                                  <div className="w-2 h-2 rounded-full bg-[#ED4C14]" />
                                )}
                              </div>
                              <span className="text-white text-sm font-brand">
                                {t(`getStarted.summary.documentType.${type}`)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch("documentType") === "invoice" && (
                  <div className="flex flex-col gap-3">
                    <FormField
                      control={form.control}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <input
                              {...field}
                              value={field.value ?? ""}
                              placeholder={t("getStarted.summary.placeholders.vatNumber")}
                              className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      {(["city", "street", "streetNumber", "postalCode"] as const).map((fieldName) => (
                        <FormField
                          key={fieldName}
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder={t(`getStarted.summary.placeholders.${fieldName}`)}
                                  className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <input
                            {...field}
                            value={field.value ?? ""}
                            type={showPassword ? "text" : "password"}
                            placeholder={t("getStarted.summary.placeholders.password")}
                            className="w-full px-4 py-3 pr-12 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors border-0 bg-transparent cursor-pointer p-1"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                {showRequirements && (
                  <div className="flex flex-col gap-1.5 px-1">
                    {passwordRequirements.map((req) => (
                      <div key={req.key} className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                            req.met ? "bg-[#37c24c]" : "bg-neutral-700",
                          )}
                        >
                          {req.met && (
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path
                                d="M1 3L3 5L7 1"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-normal font-brand transition-colors",
                            req.met ? "text-[#37c24c]" : "text-white/50",
                          )}
                        >
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="privacyAccepted"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={cn(
                            "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5",
                            field.value ? "bg-[#ED4C14] border-[#ED4C14]" : "bg-transparent border-neutral-500",
                          )}
                        >
                          {field.value && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <span className="text-white/70 text-xs font-normal font-brand leading-5">
                          {t("getStarted.summary.privacyAcceptance")}{" "}
                          <a
                            href="/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ED4C14] underline"
                          >
                            {t("getStarted.summary.privacyPolicyLink")}
                          </a>
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newsletterOptIn"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={cn(
                            "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5",
                            field.value ? "bg-[#ED4C14] border-[#ED4C14]" : "bg-transparent border-neutral-500",
                          )}
                        >
                          {field.value && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <span className="text-white/70 text-xs font-normal font-brand leading-5">
                          {t("getStarted.summary.newsletterOptIn")}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="text-white text-base md:text-2xl font-medium font-brand">
              {t("getStarted.summary.choosePlan")}
            </div>
            <div className="flex flex-col gap-3">
              <FormField
                control={form.control}
                name="billingPeriod"
                render={({ field }) => {
                  const current = field.value ?? "monthly";
                  return (
                    <FormItem className="w-full">
                      <div className="text-white text-sm font-medium font-brand mb-2">
                        {t("getStarted.summary.billing.label")}
                      </div>
                      <FormControl>
                        <div className="flex flex-row flex-wrap gap-2">
                          {WIZARD_BILLING_PERIODS.map((period) => {
                            const isSel = current === period;
                            return (
                              <button
                                key={period}
                                type="button"
                                onClick={() => field.onChange(period)}
                                className={cn(
                                  "px-3.5 py-2 rounded-[10px] outline outline-1 outline-offset-[-1px]",
                                  "text-white text-sm font-semibold font-brand",
                                  "transition-colors cursor-pointer border-0",
                                  "bg-gradient-to-br from-neutral-700/30 to-neutral-700/20",
                                  isSel
                                    ? "outline-[#ED4C14]"
                                    : "outline-white/30",
                                )}
                              >
                                {t(
                                  period === "monthly"
                                    ? "getStarted.summary.billing.monthly"
                                    : "getStarted.summary.billing.yearly",
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      {current === "yearly" && (
                        <p className="mt-2 text-white/60 text-xs font-normal font-brand leading-snug">
                          {t("getStarted.summary.billing.yearlyExplanation")}
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-3">
                        {PLAN_CONFIG.map((plan) => {
                          const isSelected = field.value === plan.id;
                          const displayPrice =
                            selectedBillingPeriod === "yearly"
                              ? plan.yearlyPricePerMonth
                              : plan.monthlyPrice;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => field.onChange(plan.id)}
                              className={cn(
                                "w-full h-16 px-3.5 py-2.5 rounded-[10px]",
                                "outline outline-1 outline-offset-[-1px] outline-blue-50/20",
                                "inline-flex justify-start items-center gap-3",
                                "border-0 cursor-pointer transition-all",
                                isSelected
                                  ? "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.50)_0%,rgba(237,76,20,0)_77%)]"
                                  : "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.02)_0%,rgba(237,76,20,0.04)_50%,rgba(237,76,20,0.01)_100%)]",
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center",
                                  isSelected
                                    ? "bg-white"
                                    : "border border-white",
                                )}
                              >
                                {isSelected && (
                                  <Check
                                    className="w-3 h-3 text-[#182B53]"
                                    strokeWidth={3}
                                  />
                                )}
                              </div>

                              <div className="flex-1 flex justify-between items-center">
                                <div className="flex flex-col gap-1 items-start">
                                  <div className="flex items-end gap-1.5">
                                    <span className="text-white text-sm md:text-lg font-medium font-brand">
                                      {t(
                                        `getStarted.summary.plans.${plan.id}.label`,
                                      )}{" "}
                                      -
                                    </span>
                                    <span className="text-white text-sm md:text-base font-normal font-brand leading-6">
                                      {displayPrice}€
                                    </span>
                                    <span className="hidden md:inline text-white/80 text-sm font-normal font-brand leading-5">
                                      {selectedBillingPeriod === "yearly"
                                        ? t(
                                            "getStarted.summary.perMonthAnnual",
                                          )
                                        : t("getStarted.summary.perMonth")}
                                    </span>
                                  </div>
                                  <div className="text-white/50 text-xs md:text-sm font-normal font-brand tracking-tight">
                                    {t(
                                      `getStarted.summary.plans.${plan.id}.description`,
                                    )}
                                  </div>
                                </div>
                                {plan.recommended && (
                                  <div className="px-2 py-[5px] bg-[#ED4C14] rounded-[5px] outline outline-1 outline-offset-[-1px] outline-white/10 flex items-center">
                                    <span className="text-white text-sm font-medium font-brand">
                                      {t("getStarted.summary.recommended")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="text-white/80 text-xs md:text-sm font-normal font-brand leading-5 text-center">
                {t("getStarted.summary.setupFee")}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onBack}
                className="w-full h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-center items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
              >
                <span className="text-white text-sm md:text-base font-semibold font-brand leading-5">
                  {t("getStarted.navigation.back")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const missing = getMissingFieldLabels();
                  if (missing.length > 0) {
                    setMissingFields(missing);
                  } else {
                    onSubmit();
                  }
                }}
                disabled={isSubmitting}
                className="w-full h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-center items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-white text-sm md:text-base font-semibold font-brand leading-5">
                  {isSubmitting
                    ? t("getStarted.summary.processing")
                    : t("getStarted.summary.continueWith", {
                        plan: planLabelForCta,
                      })}
                </span>
              </button>

              <div className="flex justify-center items-center gap-6">
                <div className="w-9 h-6 bg-zinc-900 rounded border border-neutral-500 flex items-center justify-center">
                  <span className="text-white/60 text-xs font-brand">
                    {t("getStarted.summary.visa")}
                  </span>
                </div>
                <div className="w-9 h-6 bg-zinc-900 rounded border border-neutral-500 flex items-center justify-center">
                  <span className="text-white/60 text-xs font-brand">
                    {t("getStarted.summary.payLabel")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-white/60" />
                  <span className="text-white/80 text-xs font-normal font-brand">
                    {t("getStarted.summary.cancelAnytime")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={missingFields.length > 0} onOpenChange={(open) => { if (!open) setMissingFields([]); }}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-sm rounded-2xl sm:rounded-lg">
          <DialogHeader className="pr-8 sm:pr-4">
            <DialogTitle className="flex items-center gap-2 text-white font-brand">
              <AlertCircle className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
              {t("getStarted.summary.missingFieldsTitle", "Please fill in the required fields")}
            </DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-2 mt-2">
            {missingFields.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm font-brand text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ED4C14] flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMissingFields([])}
            className="mt-4 w-full h-10 bg-[#ED4C14] rounded-[10px] text-white text-sm font-semibold font-brand border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
          >
            {t("getStarted.summary.missingFieldsDismiss", "Got it")}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

