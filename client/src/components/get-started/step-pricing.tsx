import React from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { PLANS, WIZARD_BILLING_PERIODS, type WizardValues } from "@/pages/get-started";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Calendar, Check, LayoutGrid, RefreshCcw } from "lucide-react";

const ICON_TODAY    = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779920606/card-tick_bowfis.svg";
const ICON_CALENDAR = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779349753/calendar_orange_yt37oa.svg";
const ICON_TICK     = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779920576/tick-circle_ezak9k.svg";
const ICON_INFO     = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779921150/info_circle_white_jtq4gy.svg";

const SETUP_FEE = 99;

const ADDON_PRICE_MAP: Record<string, number> = {
  "Booking Integration": 10,
  "HDP": 10,
};

const ADDON_I18N_KEY_MAP: Record<string, string> = {
  "Booking Integration": "bookingIntegration",
  "HDP": "hdp",
};

const ADDON_ICON: Record<string, React.ReactNode> = {
  "Booking Integration": <Calendar className="w-5 h-5 text-[#ED4C14]" />,
  "HDP": <LayoutGrid className="w-5 h-5 text-[#ED4C14]" />,
};

const ADDON_YEARLY_PRICE_MAP: Record<string, number> = {
  "Booking Integration": 120,
  "HDP": 120,
};

const PLAN_CONFIG: {
  id: (typeof PLANS)[number];
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyPricePerMonth: number;
  recommended: boolean;
}[] = [
  { id: "basic",     monthlyPrice: 34,  yearlyPrice: 326,  yearlyPricePerMonth: 27,  recommended: false },
  { id: "essential", monthlyPrice: 39,  yearlyPrice: 372,  yearlyPricePerMonth: 31,  recommended: true  },
  { id: "pro",       monthlyPrice: 200, yearlyPrice: 1920, yearlyPricePerMonth: 160, recommended: false },
];

interface StepPricingProps {
  form: UseFormReturn<WizardValues>;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export default function StepPricing({
  form,
  onBack,
  onSubmit,
  isSubmitting = false,
}: StepPricingProps) {
  const { t } = useTranslation();

  const selectedPlanId = form.watch("plan") ?? "essential";
  const billingPeriod  = form.watch("billingPeriod") ?? "monthly";
  const selectedAddons = form.watch("selectedAddons") ?? [];

  const isYearly     = billingPeriod === "yearly";
  const planConfig   = PLAN_CONFIG.find((p) => p.id === selectedPlanId) ?? PLAN_CONFIG[1];
  const basePrice    = isYearly ? planConfig.yearlyPricePerMonth : planConfig.monthlyPrice;
  const addonsTotal  = selectedAddons.reduce((sum, a) => sum + (ADDON_PRICE_MAP[a] ?? 0), 0);
  const monthlyTotal = basePrice + addonsTotal;

  const yearlyAddonsTotal = selectedAddons.reduce((sum, a) => sum + (ADDON_YEARLY_PRICE_MAP[a] ?? (ADDON_PRICE_MAP[a] ?? 0) * 12), 0);
  const billingTotal = isYearly ? planConfig.yearlyPrice + yearlyAddonsTotal : monthlyTotal;
  const payToday     = SETUP_FEE + billingTotal;

  const nextBillingDate = new Date();
  if (isYearly) {
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
  } else {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  }
  const nextBillingLabel = nextBillingDate.toLocaleDateString("en-GB", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const planLabel = t(`getStarted.summary.plans.${selectedPlanId}.label`);

  const getAddonLabel = (value: string): string => {
    const key = ADDON_I18N_KEY_MAP[value];
    return key ? t(`getStarted.recommendation.addons.${key}`) : value;
  };

  return (
    <div className="w-full min-h-screen bg-black px-4 md:px-16 py-12 md:py-7 flex flex-col justify-center items-center overflow-hidden">
      <div className="w-full flex flex-col md:flex-row justify-start items-start gap-6">

        {/* ─── LEFT — timeline (no card background, matches Figma) ─── */}
        <div className="w-full md:w-1/2 self-stretch py-6 md:pt-14 flex flex-col gap-12">
          <div className="text-white text-2xl md:text-4xl font-semibold font-brand">
            {t("getStarted.pricing.title")}
          </div>

          <div className="flex flex-col gap-6">
            {/* Timeline row */}
            <div className="pt-7 pb-6 border-b border-neutral-500 flex justify-start items-start gap-6">
              {/* Icon + line column — mirrors Figma's w-11 h-72 relative container */}
              <div className="relative flex-shrink-0" style={{ width: 44, height: 288 }}>
                {/* Circle 1 — Today */}
                <div className="absolute left-0 top-1 w-11 h-11 rounded-full bg-black outline outline-1 outline-offset-[-1px] outline-neutral-500 flex items-center justify-center">
                  <img src={ICON_TODAY} alt="" className="w-5 h-5" />
                </div>
                {/* Line 1 */}
                <div className="absolute left-[21px] top-[48px] w-px bg-neutral-500" style={{ height: 80 }} />
                {/* Circle 2 — Next billing date */}
                <div className="absolute left-0 top-[121px] w-11 h-11 rounded-full bg-black outline outline-1 outline-offset-[-1px] outline-neutral-500 flex items-center justify-center">
                  <img src={ICON_CALENDAR} alt="" className="w-5 h-5" />
                </div>
                {/* Line 2 */}
                <div className="absolute left-[21px] top-[165px] w-px bg-neutral-500" style={{ height: 80 }} />
                {/* Circle 3 — Always */}
                <div className="absolute left-0 top-[238px] w-11 h-11 rounded-full bg-black outline outline-1 outline-offset-[-1px] outline-neutral-500 flex items-center justify-center">
                  <img src={ICON_TICK} alt="" className="w-5 h-5" />
                </div>
              </div>

              {/* Text column — gap-16 matches Figma */}
              <div className="flex flex-col gap-16">
                <div className="flex flex-col gap-1">
                  <div className="text-white text-lg font-semibold font-brand">
                    {t("getStarted.pricing.todayLabel")}
                  </div>
                  <div className="text-white text-base font-normal font-brand leading-6">
                    {t("getStarted.pricing.todayDesc", { amount: payToday })}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-white text-lg font-semibold font-brand">
                    {nextBillingLabel}
                  </div>
                  <div className="text-white text-base font-normal font-brand leading-6">
                    {t(isYearly ? "getStarted.pricing.recurringDescYearly" : "getStarted.pricing.recurringDesc", { amount: billingTotal })}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-white text-lg font-semibold font-brand">
                    {t("getStarted.pricing.alwaysLabel")}
                  </div>
                  <div className="text-white text-base font-normal font-brand leading-6">
                    {t("getStarted.pricing.alwaysDesc")}
                  </div>
                </div>
              </div>
            </div>

            {/* Setup fee note */}
            <div className="text-white text-base font-normal font-brand leading-6">
              {t("getStarted.pricing.setupFeeNote", { amount: SETUP_FEE })}
            </div>
          </div>
        </div>

        {/* ─── RIGHT — plan selector + pricing (card, matches Figma) ─── */}
        <div className="w-full md:w-1/2 p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col gap-3">

          {/* Choose plan header + billing toggle */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="text-white text-lg font-medium font-brand">
                {t("getStarted.pricing.choosePlan")}
              </div>
              <FormField
                control={form.control}
                name="billingPeriod"
                render={({ field }) => {
                  const current = field.value ?? "monthly";
                  return (
                    <FormItem>
                      <FormControl>
                        {/* Figma: p-1 rounded-[10px] outline outline-1 outline-neutral-500 */}
                        <div className="p-1 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-neutral-500 flex">
                          {WIZARD_BILLING_PERIODS.map((period) => {
                            const isSel = current === period;
                            return (
                              <button
                                key={period}
                                type="button"
                                onClick={() => field.onChange(period)}
                                className={cn(
                                  "px-2.5 py-[5px] rounded-md text-sm font-bold font-brand transition-colors cursor-pointer border-0",
                                  isSel
                                    ? "bg-[#ED4C14] text-black w-20"
                                    : "bg-transparent text-white/50 hover:text-white/80",
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
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* Plan cards */}
            <div className="flex flex-col gap-3">
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-3">
                        {PLAN_CONFIG.map((plan) => {
                          const isSelected   = field.value === plan.id;
                          const displayPrice = billingPeriod === "yearly"
                            ? plan.yearlyPricePerMonth
                            : plan.monthlyPrice;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => field.onChange(plan.id)}
                              className={cn(
                                "w-full min-h-[64px] px-3.5 py-3 rounded-[10px]",
                                "outline outline-1 outline-offset-[-1px] outline-blue-50/20",
                                "inline-flex justify-start items-center gap-3",
                                "border-0 cursor-pointer transition-all",
                                isSelected
                                  ? "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.50)_0%,rgba(237,76,20,0)_77%)]"
                                  : "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.02)_0%,rgba(237,76,20,0.04)_50%,rgba(237,76,20,0.01)_100%)]",
                              )}
                            >
                              {/* Radio dot */}
                              {isSelected ? (
                                <div className="w-5 h-5 flex-shrink-0 bg-[#ED4C14] rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-black" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 flex-shrink-0 rounded-full border border-white" />
                              )}

                              <div className="flex-1 min-w-0 flex justify-between items-center gap-2">
                                <div className="flex flex-col gap-0.5 items-start min-w-0">
                                  <div className="flex items-baseline gap-1 flex-wrap">
                                    <span className="text-white text-lg font-medium font-brand whitespace-nowrap">
                                      {t(`getStarted.summary.plans.${plan.id}.label`)} -
                                    </span>
                                    <span className="text-white text-base font-normal font-brand leading-6 whitespace-nowrap">
                                      {displayPrice}€
                                    </span>
                                    <span className="text-white/80 text-sm font-normal font-brand leading-5 whitespace-nowrap">
                                      {t("getStarted.summary.perMonth")}
                                    </span>
                                  </div>
                                  <div className="text-white/50 text-sm font-normal font-brand tracking-tight">
                                    {t(`getStarted.summary.plans.${plan.id}.description`)}
                                  </div>
                                </div>
                                {plan.recommended && (
                                  <div className="px-2 py-[5px] bg-[#ED4C14] rounded-[5px] shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] outline outline-1 outline-offset-[-1px] outline-white/10 flex items-center flex-shrink-0">
                                    <span className="text-white text-xs md:text-sm font-medium font-brand">
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
              {/* Base model note */}
              <div className="text-center text-white/80 text-sm font-normal font-brand leading-5">
                {t("getStarted.pricing.baseModelNote")}
              </div>
            </div>
          </div>

          {/* ── Selected add-ons ── */}
          {selectedAddons.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-start items-center gap-6">
                <div className="text-white text-lg font-medium font-brand">
                  {t("getStarted.pricing.selectedAddons")}
                </div>
              </div>
              {/* Figma: inline-flex gap-3, each chip is flex-1 */}
              <div className="flex gap-3">
                {selectedAddons.map((addon) => (
                  <div
                    key={addon}
                    className="flex-1 px-2.5 py-1 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-[#ED4C14]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {ADDON_ICON[addon] ?? <div className="w-6 h-4 bg-[#ED4C14]" />}
                      </div>
                      <span className="text-white text-sm font-semibold font-brand tracking-tight">
                        {getAddonLabel(addon)}
                      </span>
                    </div>
                    <span className="text-white text-base font-normal font-brand leading-6">
                      +{isYearly ? (ADDON_YEARLY_PRICE_MAP[addon] ?? (ADDON_PRICE_MAP[addon] ?? 0) * 12) : (ADDON_PRICE_MAP[addon] ?? 0)}€/{isYearly ? "yr" : "mo"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pricing summary ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              <div className="flex justify-start items-center gap-6">
                <div className="text-white text-lg font-medium font-brand">
                  {t("getStarted.pricing.pricingSummary")}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Summary box — Figma: p-3.5 rounded-[10px] outline outline-1 outline-neutral-500 */}
                <div className="p-3.5 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-neutral-500 flex flex-col gap-3">
                  {/* Line items above divider */}
                  <div className="pb-2 border-b border-neutral-500 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm font-normal font-brand leading-5">
                        {t("getStarted.pricing.basePlanLine", { plan: planLabel })}
                      </span>
                      <span className="text-white text-sm font-normal font-brand leading-5 tabular-nums">
                        {isYearly ? `${planConfig.yearlyPrice}€/yr` : `${basePrice}€/mo`}
                      </span>
                    </div>
                    {addonsTotal > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm font-normal font-brand leading-5">
                          {t("getStarted.pricing.addonsLine")}
                        </span>
                        <span className="text-white text-sm font-normal font-brand leading-5 tabular-nums">
                          +{isYearly ? yearlyAddonsTotal : addonsTotal}€/{isYearly ? "yr" : "mo"}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm font-normal font-brand leading-5">
                        {t("getStarted.pricing.setupFeeLine")}
                      </span>
                      <span className="text-white text-sm font-normal font-brand leading-5 tabular-nums">
                        {SETUP_FEE}€
                      </span>
                    </div>
                  </div>
                  {/* Pay Today row */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-normal font-brand leading-5">
                        {t("getStarted.pricing.payTodayLine")}
                      </span>
                      <img src={ICON_INFO} alt="" className="w-4 h-4 flex-shrink-0 opacity-40" />
                    </div>
                    <span className="text-[#ED4C14] text-lg font-medium font-brand tabular-nums">
                      {payToday}€
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-center gap-3">
                  <img src={ICON_INFO} alt="" className="w-4 h-4 flex-shrink-0 opacity-40" />
                  <span className="text-white text-sm font-normal font-brand leading-5">
                    {t(isYearly ? "getStarted.pricing.payTodayNoteYearly" : "getStarted.pricing.payTodayNote")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <RefreshCcw className="w-4 h-4 text-white flex-shrink-0" />
                  <span className="text-white text-sm font-normal font-brand leading-5">
                    {t(isYearly ? "getStarted.pricing.subscriptionContinuesYearly" : "getStarted.pricing.subscriptionContinues", { amount: billingTotal })}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onBack}
                className="w-full h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-center items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
              >
                <span className="text-white text-base font-semibold font-brand leading-5">
                  {t("getStarted.navigation.back")}
                </span>
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="w-full h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-center items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-center text-white text-base font-semibold font-brand leading-5">
                  {isSubmitting
                    ? t("getStarted.summary.processing")
                    : t("getStarted.pricing.continueToPayment")}
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
    </div>
  );
}
