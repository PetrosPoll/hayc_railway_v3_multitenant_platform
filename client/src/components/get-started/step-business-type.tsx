import React, { useState } from "react";
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const businessType = form.watch("businessType");
  const otherDetails = form.watch("businessTypeOtherDetails");
  const canContinue =
    !!businessType &&
    (businessType !== BUSINESS_TYPE_OTHER || !!otherDetails?.trim());

  return (
    <div className="w-full min-h-screen bg-black overflow-hidden px-4 md:px-0 box-border">
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-center md:gap-12">
        {/* Left / top panel */}
        <div className="flex-1 flex flex-col justify-between md:justify-center items-start gap-6 md:gap-12 pt-16 md:pt-0 md:py-16 min-h-screen md:min-h-0 pb-6 md:pb-0">
          {/* Top group: headline + options */}
          <div className="flex flex-col gap-4 w-full">
            {/* Headline block */}
            <div className="flex flex-col gap-3">
              <div className="text-white text-2xl md:text-4xl font-semibold font-brand md:font-semibold">
                {t("getStarted.businessType.titleLine1")}
                <br />
                {t("getStarted.businessType.titleLine2")}
              </div>
              <div className="text-white text-lg font-medium font-brand">
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
                    <div className="flex flex-col gap-3 md:flex-wrap md:flex-row">
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
                              "flex items-center px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
                              isSelected
                                ? "bg-[#ED4C14] border-[#ED4C14]"
                                : "bg-transparent border-[#6a6a6a] hover:border-white/50",
                            )}
                          >
                            <span className="text-white text-lg font-medium font-brand">
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
                        className="w-full px-4 py-3 rounded-lg bg-transparent outline outline-1 outline-offset-[-1px] outline-neutral-500 text-slate-100 text-sm font-normal font-brand leading-5 placeholder:text-slate-400 focus:outline-[#ED4C14] focus:ring-0 border-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onNext}
              disabled={!canContinue}
              className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-white text-base font-semibold font-brand leading-5">
                {t("getStarted.navigation.next")}
              </span>
            </button>
          </div>
        </div>

        {/* Right / bottom panel */}
        <div className="flex-1 h-[40vh] md:h-screen bg-[#111111] mt-0 max-md:-mx-4 max-md:w-[calc(100%+2rem)] overflow-hidden">
          <img
            src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779357729/step_one_image_b0damk.png"
            alt=""
            fetchpriority="high"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover object-center transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </div>
    </div>
  );
}


