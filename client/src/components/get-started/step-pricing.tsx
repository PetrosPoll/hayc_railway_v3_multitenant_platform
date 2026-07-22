import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { PLANS, WIZARD_BILLING_PERIODS, type WizardValues } from "@/pages/get-started";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Calendar, Check, LayoutGrid, RefreshCcw } from "lucide-react";
import { usePricing, getPrice, getAddonPrice } from "@/hooks/use-pricing";
import {
  ALL_GET_STARTED_ADDONS,
  dedupeAddonsByStripeId,
  enforceSingleBookingAddon,
  GET_STARTED_ADDON_I18N_KEY_MAP,
  GET_STARTED_ADDON_ID_MAP,
  isBookingAddonValue,
} from "@/lib/get-started-addons";

const ICON_TODAY    = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779920606/card-tick_bowfis.svg";
const ICON_CALENDAR = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779349753/calendar_orange_yt37oa.svg";
const ICON_TICK     = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779920576/tick-circle_ezak9k.svg";
const ICON_INFO     = "https://res.cloudinary.com/dem12vqtl/image/upload/v1779921150/info_circle_white_jtq4gy.svg";

const SETUP_FEE = 120;

const ADDON_MONTHLY_FALLBACK: Record<string, number> = {
  booking: 15,
  lms: 15,
};
const ADDON_YEARLY_FALLBACK: Record<string, number> = {
  booking: 180,
  lms: 180,
};
const PLAN_FALLBACKS = {
  basic:     { monthly: 44,  yearly: 440  },
  essential: { monthly: 49,  yearly: 490  },
  pro:       { monthly: 200, yearly: 1920 },
} as const;

const ADDON_ICON: Record<string, React.ReactNode> = {
  booking: <Calendar className="w-5 h-5 text-[#ED4C14]" />,
  lms: <LayoutGrid className="w-5 h-5 text-[#ED4C14]" />,
};

const PLAN_CONFIG: { id: (typeof PLANS)[number]; recommended: boolean }[] = [
  { id: "basic",     recommended: false },
  { id: "essential", recommended: true  },
  { id: "pro",       recommended: false },
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
  const selectedAddons = enforceSingleBookingAddon(form.watch("selectedAddons") ?? []);

  const toggleAddon = (value: string) => {
    const base = enforceSingleBookingAddon(form.getValues("selectedAddons") ?? []);
    let updated: string[];
    if (isBookingAddonValue(value)) {
      const withoutBooking = base.filter((v) => !isBookingAddonValue(v));
      updated = base.includes(value) ? withoutBooking : [...withoutBooking, value];
    } else {
      updated = base.includes(value)
        ? base.filter((v) => v !== value)
        : [...base, value];
    }
    form.setValue("selectedAddons", enforceSingleBookingAddon(updated));
  };

  const { data: stripePrices } = usePricing();

  const { data: speedDevData } = useQuery<{ unitAmount: number | null; priceId: string | null }>({
    queryKey: ["/api/speed-dev-price"],
    staleTime: 15 * 60 * 1000,
  });
  const speedUpDevChecked = form.watch("speedUpDev") ?? false;

  const planMonthly = (id: string): number =>
    getPrice(stripePrices, id as "basic" | "essential" | "pro", "monthly")?.unitAmount
      ?? PLAN_FALLBACKS[id as keyof typeof PLAN_FALLBACKS]?.monthly ?? 0;

  const planYearly = (id: string): number =>
    getPrice(stripePrices, id as "basic" | "essential" | "pro", "yearly")?.unitAmount
      ?? PLAN_FALLBACKS[id as keyof typeof PLAN_FALLBACKS]?.yearly ?? 0;

  const planYearlyPerMonth = (id: string): number => Math.round(planYearly(id) / 12);

  const addonMonthly = (name: string): number => {
    const stripeId = GET_STARTED_ADDON_ID_MAP[name] ?? name;
    return (
      getAddonPrice(stripePrices, stripeId, "monthly")?.unitAmount
      ?? ADDON_MONTHLY_FALLBACK[stripeId]
      ?? 0
    );
  };

  const addonYearly = (name: string): number => {
    const stripeId = GET_STARTED_ADDON_ID_MAP[name] ?? name;
    return (
      getAddonPrice(stripePrices, stripeId, "yearly")?.unitAmount
      ?? ADDON_YEARLY_FALLBACK[stripeId]
      ?? addonMonthly(name) * 12
    );
  };

  const isYearly     = billingPeriod === "yearly";
  const basePrice    = isYearly ? planYearlyPerMonth(selectedPlanId) : planMonthly(selectedPlanId);
  const billableAddons = dedupeAddonsByStripeId(selectedAddons);
  const addonsTotal  = billableAddons.reduce((sum, a) => sum + addonMonthly(a), 0);
  const monthlyTotal = basePrice + addonsTotal;

  const yearlyAddonsTotal = billableAddons.reduce((sum, a) => sum + addonYearly(a), 0);
  const billingTotal = isYearly ? planYearly(selectedPlanId) + yearlyAddonsTotal : monthlyTotal;
  const speedDevFee  = speedUpDevChecked && speedDevData?.unitAmount ? speedDevData.unitAmount : 0;
  const payToday     = SETUP_FEE + billingTotal + speedDevFee;

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
    const key = GET_STARTED_ADDON_I18N_KEY_MAP[value];
    return key ? t(`getStarted.recommendation.addons.${key}`) : value;
  };

  const pricedAddonIds = new Set<string>();
  const addonRows = ALL_GET_STARTED_ADDONS.map(({ value: addon }) => {
    const stripeId = GET_STARTED_ADDON_ID_MAP[addon];
    const selected = selectedAddons.includes(addon);
    let priceLabel: string;
    if (selected) {
      if (stripeId && pricedAddonIds.has(stripeId)) {
        priceLabel = t("getStarted.pricing.addonIncluded");
      } else {
        if (stripeId) pricedAddonIds.add(stripeId);
        const amount = isYearly ? addonYearly(addon) : addonMonthly(addon);
        priceLabel = `${amount}€/${isYearly ? "yr" : "mo"}`;
      }
    } else {
      const amount = isYearly ? addonYearly(addon) : addonMonthly(addon);
      priceLabel = `${amount}€/${isYearly ? "yr" : "mo"}`;
    }
    return { addon, stripeId, priceLabel, selected };
  });

  return (
    <div className="w-full min-h-screen bg-black px-4 md:px-16 py-12 md:py-7 flex flex-col justify-center items-center overflow-hidden">
      <div className="w-full flex flex-col md:flex-row justify-start items-start gap-6">

        {/* ─── LEFT — presentational pricing card ─── */}
        <div className="w-full md:w-1/2 self-stretch px-4 py-4 md:px-9 md:py-6 bg-orange-50 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-stone-300 flex flex-col justify-center items-start">
          <div className="w-full p-4 md:p-6 bg-stone-50 rounded-[20px] shadow-[0px_0px_12px_0px_rgba(224,219,212,1.00)] outline outline-1 outline-offset-[-1px] outline-orange-50 flex flex-col justify-start items-start gap-8 md:gap-12">
            <div className="text-black text-2xl md:text-4xl font-semibold font-brand">
              {t("getStarted.pricing.title")}
            </div>

            <div className="w-full flex flex-col gap-6">
              {/* Timeline rows */}
              <div className="w-full pb-6 border-b border-stone-300 flex flex-col">
                {/* Row 1 — Today */}
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 flex-shrink-0 bg-stone-200 rounded-full outline outline-1 outline-offset-[-1px] outline-stone-300 flex items-center justify-center">
                    <img src={ICON_TODAY} alt="" className="w-5 h-5 brightness-0" />
                  </div>
                  <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center gap-0.5 md:gap-2">
                    <span className="text-[#ED4C14] text-base md:text-lg font-medium font-brand">
                      {t("getStarted.pricing.todayLabel")}
                    </span>
                    <span className="text-black text-sm md:text-lg font-medium font-brand md:text-right">
                      {t("getStarted.pricing.todayDesc", { amount: payToday })}
                    </span>
                  </div>
                </div>
                {/* Connector line 1 */}
                <div className="ml-[22px] w-px h-8 md:h-12 bg-stone-300" />
                {/* Row 2 — Next billing */}
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 flex-shrink-0 bg-stone-200 rounded-full outline outline-1 outline-offset-[-1px] outline-stone-300 flex items-center justify-center">
                    <img src={ICON_CALENDAR} alt="" className="w-5 h-5 brightness-0" />
                  </div>
                  <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center gap-0.5 md:gap-2">
                    <span className="text-[#ED4C14] text-base md:text-lg font-medium font-brand">
                      {nextBillingLabel}
                    </span>
                    <span className="text-black text-sm md:text-lg font-medium font-brand md:text-right">
                      {t(isYearly ? "getStarted.pricing.recurringDescYearly" : "getStarted.pricing.recurringDesc", { amount: billingTotal })}
                    </span>
                  </div>
                </div>
                {/* Connector line 2 */}
                <div className="ml-[22px] w-px h-8 md:h-12 bg-stone-300" />
                {/* Row 3 — Always */}
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 flex-shrink-0 bg-stone-200 rounded-full outline outline-1 outline-offset-[-1px] outline-stone-300 flex items-center justify-center">
                    <img src={ICON_TICK} alt="" className="w-5 h-5 brightness-0" />
                  </div>
                  <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center gap-0.5 md:gap-2">
                    <span className="text-[#ED4C14] text-base md:text-lg font-medium font-brand">
                      {t("getStarted.pricing.alwaysLabel")}
                    </span>
                    <span className="text-black text-sm md:text-lg font-medium font-brand md:text-right">
                      {t("getStarted.pricing.alwaysDesc")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Setup fee note */}
              <div className="text-black text-base font-normal font-brand leading-6">
                {t("getStarted.pricing.setupFeeNote", { amount: SETUP_FEE })}
              </div>
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
                          const displayPrice = isYearly
                            ? planYearlyPerMonth(plan.id)
                            : planMonthly(plan.id);
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

          {/* ── Add-ons (toggleable) ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-white text-lg font-medium font-brand">
                {t("getStarted.pricing.selectedAddons")}
              </div>
              <p className="text-white/50 text-sm font-normal font-brand">
                {t("getStarted.pricing.addonsToggleHint")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {addonRows.map(({ addon, stripeId, priceLabel, selected }) => (
                <button
                  key={addon}
                  type="button"
                  onClick={() => toggleAddon(addon)}
                  className={cn(
                    "w-full px-2.5 py-2 rounded-lg outline outline-1 outline-offset-[-1px] flex justify-between items-center gap-3 text-left border-0 cursor-pointer transition-colors",
                    selected
                      ? "outline-[#ED4C14]/60 bg-[#ED4C14]/10"
                      : "outline-neutral-500 hover:outline-white/40 bg-transparent",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors",
                        selected
                          ? "bg-white border-white"
                          : "bg-transparent border-white/50",
                      )}
                    >
                      {selected ? (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path
                            d="M1 3.5L3 5.5L7 1"
                            stroke="#ED4C14"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#ED4C14]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(stripeId && ADDON_ICON[stripeId]) ?? <div className="w-6 h-4 bg-[#ED4C14]" />}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold font-brand tracking-tight truncate",
                        selected ? "text-white" : "text-white/70",
                      )}
                    >
                      {getAddonLabel(addon)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-base font-normal font-brand leading-6 whitespace-nowrap flex-shrink-0",
                      selected ? "text-white" : "text-white/50",
                    )}
                  >
                    {priceLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Delivery Speed ── */}
          {speedDevData?.unitAmount != null && (
            <div className="flex flex-col gap-3">
              <div className="text-white text-lg font-medium font-brand">
                {t("getStarted.pricing.deliverySpeedTitle")}
              </div>
              <button
                type="button"
                onClick={() => form.setValue("speedUpDev", !speedUpDevChecked)}
                className={cn(
                  "w-full px-3.5 py-3 rounded-[10px] text-left",
                  "outline outline-1 outline-offset-[-1px] outline-blue-50/20",
                  "inline-flex items-center gap-3",
                  "border-0 cursor-pointer transition-all",
                  speedUpDevChecked
                    ? "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.50)_0%,rgba(237,76,20,0)_77%)]"
                    : "bg-[radial-gradient(ellipse_141.42%_177.70%_at_100%_100%,rgba(237,76,20,0.02)_0%,rgba(237,76,20,0.04)_50%,rgba(237,76,20,0.01)_100%)]",
                )}
              >
                {speedUpDevChecked ? (
                  <div className="w-5 h-5 flex-shrink-0 bg-[#ED4C14] rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-5 h-5 flex-shrink-0 rounded-full border border-white" />
                )}
                <div className="flex-1 flex justify-between items-center gap-2 min-w-0">
                  <span className="text-white text-sm font-normal font-brand leading-5">
                    {t("getStarted.pricing.speedUpDev")}
                  </span>
                  <span className="text-white text-base font-normal font-brand leading-6 whitespace-nowrap flex-shrink-0">
                    {speedDevData.unitAmount}€
                  </span>
                </div>
              </button>
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
                        {isYearly ? `${planYearly(selectedPlanId)}€/yr` : `${basePrice}€/mo`}
                      </span>
                    </div>
                    {addonsTotal > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm font-normal font-brand leading-5">
                          {t("getStarted.pricing.addonsLine")}
                        </span>
                        <span className="text-white text-sm font-normal font-brand leading-5 tabular-nums">
                          {isYearly ? yearlyAddonsTotal : addonsTotal}€/{isYearly ? "yr" : "mo"}
                        </span>
                      </div>
                    )}
                    {speedDevFee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm font-normal font-brand leading-5">
                          {t("getStarted.pricing.speedDevLine")}
                        </span>
                        <span className="text-white text-sm font-normal font-brand leading-5 tabular-nums">
                          {speedDevFee}€
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
