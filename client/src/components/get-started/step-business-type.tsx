import React from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import {
  BUSINESS_TYPE_OTHER,
  BUSINESS_TYPES,
  type WizardValues,
} from "@/pages/get-started";
import { BUSINESS_TYPE_I18N_KEY } from "@/lib/get-started-translations";
import {
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface StepBusinessTypeProps {
  form: UseFormReturn<WizardValues>;
  onNext: () => void;
  onBack: () => void;
}

export default function StepBusinessType({
  form,
  onNext,
  onBack,
}: StepBusinessTypeProps) {
  const { t } = useTranslation();
  const businessType = form.watch("businessType");
  const otherDetails = form.watch("businessTypeOtherDetails");
  const canContinue =
    !!businessType &&
    (businessType !== BUSINESS_TYPE_OTHER || !!otherDetails?.trim());

  return (
    <div className="w-full min-h-screen bg-black overflow-hidden px-4 md:px-0 box-border">
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-center md:gap-12">
        {/* Left / top panel */}
        <div className="flex-1 flex flex-col justify-start items-start gap-12 pt-16 md:pt-0 md:py-16 min-h-screen md:min-h-0 md:justify-center">
          {/* Headline block */}
          <div className="flex flex-col gap-3">
            <div className="text-white text-2xl md:text-4xl font-semibold font-['Montserrat'] md:font-semibold">
              {t("getStarted.businessType.titleLine1")}
              <br />
              {t("getStarted.businessType.titleLine2")}
            </div>
            <div className="text-white text-lg font-medium font-['Montserrat']">
              {t("getStarted.businessType.subtitle")}
            </div>
          </div>

          {/* Options — react-hook-form controlled */}
          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <div className="flex flex-col md:flex-wrap md:flex-row gap-3">
                    {BUSINESS_TYPES.map((type) => {
                      const isSelected = field.value === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            if (type === BUSINESS_TYPE_OTHER) {
                              if (field.value !== BUSINESS_TYPE_OTHER) {
                                form.setValue("businessTypeOtherDetails", "");
                              }
                              field.onChange(BUSINESS_TYPE_OTHER);
                            } else {
                              form.setValue("businessTypeOtherDetails", "");
                              field.onChange(type);
                            }
                          }}
                          className={cn(
                            "px-3.5 py-2 rounded-[10px] outline outline-1 outline-offset-[-1px]",
                            "flex justify-start items-center gap-3",
                            "transition-colors cursor-pointer border-0",
                            "bg-gradient-to-br from-neutral-700/30 to-neutral-700/20",
                            isSelected
                              ? "outline-[#ED4C14]"
                              : "outline-white/30"
                          )}
                        >
                          {/* Radio circle */}
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0",
                              isSelected ? "border-[#ED4C14]" : "border-white"
                            )}
                          >
                            {isSelected && (
                              <div className="w-2.5 h-2.5 rounded-full bg-[#ED4C14]" />
                            )}
                          </div>
                          <span className="text-white text-lg font-medium font-['Montserrat']">
                            {t(BUSINESS_TYPE_I18N_KEY[type])}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {businessType === BUSINESS_TYPE_OTHER && (
            <FormField
              control={form.control}
              name="businessTypeOtherDetails"
              render={({ field }) => (
                <FormItem className="w-full max-w-xl">
                  <FormControl>
                    <input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={t(
                        "getStarted.businessType.otherPlaceholder",
                      )}
                      className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-start items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
            >
              <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
                {t("getStarted.navigation.back")}
              </span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!canContinue}
              className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
                {t("getStarted.navigation.next")}
              </span>
            </button>
          </div>
        </div>

        {/* Right / bottom panel */}
        <div className="flex-1 h-[323px] md:h-screen bg-[#111111] mt-12 md:mt-0" />
      </div>
    </div>
  );
}
