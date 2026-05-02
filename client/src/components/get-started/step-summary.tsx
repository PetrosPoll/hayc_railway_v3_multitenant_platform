import React from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { PLANS, type WizardValues } from "@/pages/get-started";
import { SUMMARY_SELECTED_DESIGN_I18N_KEY } from "@/lib/get-started-translations";
import {
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  Check,
  FileText,
  LayoutGrid,
  Rocket,
  SearchCheck,
} from "lucide-react";

const PLAN_CONFIG: {
  id: (typeof PLANS)[number];
  price: string;
  recommended: boolean;
}[] = [
  { id: "essential", price: "39€", recommended: true },
  { id: "basic", price: "34€", recommended: false },
  { id: "pro", price: "200€", recommended: false },
];

interface StepSummaryProps {
  form: UseFormReturn<WizardValues>;
  onBack: () => void;
  onSubmit: () => void;
}

export default function StepSummary({
  form,
  onBack: _onBack,
  onSubmit,
}: StepSummaryProps) {
  const { t } = useTranslation();
  const selectedDesignId = form.watch("selectedDesign");
  const selectedPlanId = form.watch("plan");

  const designLabel =
    selectedDesignId && SUMMARY_SELECTED_DESIGN_I18N_KEY[selectedDesignId]
      ? t(SUMMARY_SELECTED_DESIGN_I18N_KEY[selectedDesignId])
      : t("getStarted.summary.designLabels.unknown");

  const planLabelForCta =
    selectedPlanId && PLANS.includes(selectedPlanId)
      ? t(`getStarted.summary.plans.${selectedPlanId}.label`)
      : t("getStarted.summary.plans.essential.label");

  return (
    <div className="w-full min-h-screen bg-black px-4 md:px-16 py-8 md:py-12 flex flex-col justify-center items-center gap-6 overflow-hidden">
      {/* Header */}
      <div className="w-full md:w-[638px] flex flex-col items-center gap-3">
        <div className="w-full text-center text-white text-2xl md:text-4xl font-semibold font-['Montserrat']">
          {t("getStarted.summary.title")}
        </div>
        <div className="w-full text-center text-white text-sm md:text-lg font-medium font-['Montserrat']">
          {t("getStarted.summary.subtitle")}
        </div>
      </div>

      {/* Two column cards — desktop: equal height (stretch to tallest) */}
      <div className="w-full flex flex-col md:flex-row justify-start items-stretch gap-6">
        {/* LEFT CARD — summary */}
        <div className="w-full md:flex-1 md:min-h-0 p-4 md:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col gap-6">
          {/* Selected design row */}
          <div className="flex justify-start items-start gap-3">
            <div className="flex-1 flex flex-col gap-2 md:gap-3">
              <div className="text-white text-base md:text-2xl font-medium font-['Montserrat']">
                {t("getStarted.summary.selectedDesign")}
              </div>
              <div className="text-white text-sm md:text-lg font-medium font-['Montserrat']">
                {designLabel}
              </div>
            </div>
            <div className="w-20 h-14 md:flex-1 md:h-32 bg-neutral-700/30 rounded-[10px]" />
          </div>

          {/* Walkthrough section */}
          <div className="flex flex-col gap-3">
            <div className="hidden md:block text-white text-lg font-medium font-['Montserrat']">
              {t("getStarted.summary.walkthroughTitle")}
            </div>
            <div className="hidden md:block w-full h-72 bg-neutral-700/30 rounded-[10px]" />

            <div className="w-full p-3.5 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-neutral-500 flex flex-col gap-3">
              <div className="w-full pb-2.5 border-b border-neutral-500 flex items-center gap-3">
                <Rocket className="w-4 h-4 md:w-5 md:h-5 text-[#ED4C14] flex-shrink-0" />
                <span className="text-white text-sm md:text-lg font-bold font-['Montserrat']">
                  {t("getStarted.summary.readyIn15Days")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-white flex-shrink-0" />
                <span className="text-white text-xs md:text-lg font-medium font-['Montserrat']">
                  {t("getStarted.summary.pagesIncluded")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-white flex-shrink-0" />
                <span className="text-white text-xs md:text-lg font-medium font-['Montserrat']">
                  {t("getStarted.summary.bookingIntegration")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <SearchCheck className="w-4 h-4 md:w-5 md:h-5 text-white flex-shrink-0" />
                <span className="text-white text-xs md:text-lg font-medium font-['Montserrat']">
                  {t("getStarted.summary.basicSeoSetup")}
                </span>
              </div>
            </div>
          </div>

          <div className="text-white text-xs md:text-base font-normal font-['Montserrat'] leading-6">
            {t("getStarted.summary.customizeLater")}
          </div>
        </div>

        {/* RIGHT CARD — account + plan */}
        <div className="w-full md:flex-1 md:min-h-0 p-4 md:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col gap-8 md:gap-24">
          <div className="flex flex-col gap-6">
            <div className="text-white text-base md:text-2xl font-medium font-['Montserrat']">
              {t("getStarted.summary.createAccount")}
            </div>
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
                        className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
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
                        placeholder={t(
                          "getStarted.summary.placeholders.email",
                        )}
                        className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        {...field}
                        value={field.value ?? ""}
                        placeholder={t(
                          "getStarted.summary.placeholders.subject",
                        )}
                        className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="text-white text-base md:text-2xl font-medium font-['Montserrat']">
              {t("getStarted.summary.choosePlan")}
            </div>
            <div className="flex flex-col gap-3">
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-3">
                        {PLAN_CONFIG.map((plan) => {
                          const isSelected = field.value === plan.id;
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
                                    <span className="text-white text-sm md:text-lg font-medium font-['Montserrat']">
                                      {t(
                                        `getStarted.summary.plans.${plan.id}.label`,
                                      )}{" "}
                                      -
                                    </span>
                                    <span className="text-white text-sm md:text-base font-normal font-['Montserrat'] leading-6">
                                      {plan.price}
                                    </span>
                                    <span className="hidden md:inline text-white/80 text-sm font-normal font-['Montserrat'] leading-5">
                                      {t("getStarted.summary.perMonth")}
                                    </span>
                                  </div>
                                  <div className="text-white/50 text-xs md:text-sm font-normal font-['Montserrat'] tracking-tight">
                                    {t(
                                      `getStarted.summary.plans.${plan.id}.description`,
                                    )}
                                  </div>
                                </div>
                                {plan.recommended && (
                                  <div className="px-2 py-[5px] bg-[#ED4C14] rounded-[5px] outline outline-1 outline-offset-[-1px] outline-white/10 flex items-center">
                                    <span className="text-white text-sm font-medium font-['Montserrat']">
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
              <div className="text-white/80 text-xs md:text-sm font-normal font-['Montserrat'] leading-5 text-center">
                {t("getStarted.summary.setupFee")}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onSubmit}
                className="w-full h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-center items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
              >
                <span className="text-white text-sm md:text-base font-semibold font-['Montserrat'] leading-5">
                  {t("getStarted.summary.continueWith", {
                    plan: planLabelForCta,
                  })}
                </span>
              </button>

              <div className="flex justify-center items-center gap-6">
                <div className="w-9 h-6 bg-zinc-900 rounded border border-neutral-500 flex items-center justify-center">
                  <span className="text-white/60 text-xs font-['Montserrat']">
                    {t("getStarted.summary.visa")}
                  </span>
                </div>
                <div className="w-9 h-6 bg-zinc-900 rounded border border-neutral-500 flex items-center justify-center">
                  <span className="text-white/60 text-xs font-['Montserrat']">
                    {t("getStarted.summary.payLabel")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-white/60" />
                  <span className="text-white/80 text-xs font-normal font-['Montserrat']">
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
