import React from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import type { WizardValues } from "@/pages/get-started";
import {
  CHOOSE_DESIGN_OPTION_KEY,
  type ChooseDesignOptionId,
} from "@/lib/get-started-translations";
import { cn } from "@/lib/utils";

const DESIGN_IDS = Object.keys(
  CHOOSE_DESIGN_OPTION_KEY,
) as ChooseDesignOptionId[];

interface StepChooseDesignProps {
  form: UseFormReturn<WizardValues>;
  onNext: () => void;
  onBack: () => void;
}

export default function StepChooseDesign({
  form,
  onNext,
  onBack,
}: StepChooseDesignProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full min-h-screen bg-black flex flex-col justify-center items-center px-4 md:px-16 py-12 gap-6">
      {/* Header */}
      <div className="w-full flex flex-col items-center gap-3">
        <div className="w-full text-center text-white text-2xl md:text-4xl font-semibold font-['Montserrat']">
          {t("getStarted.chooseDesign.title")}
        </div>
        <div className="w-full text-center text-white text-base md:text-lg font-normal md:font-medium font-['Montserrat'] leading-5">
          {t("getStarted.chooseDesign.subtitle")}
        </div>
      </div>

      {/* Grid — 2 cols desktop, 1 col mobile */}
      <div className="w-full flex flex-col md:flex-row md:flex-wrap justify-start items-start gap-3 md:gap-6">
        {DESIGN_IDS.map((designId) => {
          const isSelected = form.watch("selectedDesign") === designId;
          const label = t(CHOOSE_DESIGN_OPTION_KEY[designId]);
          return (
            <button
              key={designId}
              type="button"
              onClick={() => form.setValue("selectedDesign", designId)}
              className={cn(
                "w-full md:w-[638px] h-44 md:h-72 rounded-[10px]",
                "bg-neutral-700/30 border-0 cursor-pointer transition-all",
                "outline outline-1 outline-offset-[-1px]",
                isSelected ? "outline-[#ED4C14]" : "outline-white/20"
              )}
              aria-label={label}
            />
          );
        })}

        <button
          type="button"
          onClick={() => {
            form.setValue("selectedDesign", "auto");
            onNext();
          }}
          className="w-full md:w-[638px] h-44 md:h-72 px-3.5 py-2 bg-[radial-gradient(ellipse_141.42%_151.02%_at_0%_0%,_rgba(237,76,20,0.21)_0%,_rgba(237,76,20,0.11)_67%)] rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/30 border-0 cursor-pointer inline-flex flex-col justify-center items-center gap-3 hover:outline-[#ED4C14] transition-all"
        >
          <svg
            className="w-7 h-7 md:w-12 md:h-12"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 4 L26 22 L44 24 L26 26 L24 44 L22 26 L4 24 L22 22 Z"
              fill="white"
              opacity="0.9"
            />
            <path
              d="M38 8 L39 14 L45 15 L39 16 L38 22 L37 16 L31 15 L37 14 Z"
              fill="white"
              opacity="0.7"
            />
          </svg>
          <div className="text-white text-lg font-medium font-['Montserrat']">
            {t("getStarted.chooseDesign.chooseForMe")}
          </div>
          <div className="text-white text-base font-normal font-['Montserrat'] leading-6">
            {t("getStarted.chooseDesign.chooseForMeSubtitle")}
          </div>
        </button>
      </div>

      <div className="w-full flex items-center justify-center gap-4 pt-2">
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
          disabled={!form.watch("selectedDesign")}
          className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
            {t("getStarted.navigation.next")}
          </span>
        </button>
      </div>
    </div>
  );
}
