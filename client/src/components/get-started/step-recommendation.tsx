import React from "react";
import { useTranslation } from "react-i18next";

const STRUCTURE_KEYS = [
  "home",
  "about",
  "services",
  "contact",
  "booking",
] as const;

const ADDON_KEYS = ["bookingIntegration", "basicSeo", "analytics"] as const;

interface StepRecommendationProps {
  onNext: () => void;
  onBack: () => void;
}

function Pill({ label }: { label: string }) {
  return (
    <div className="px-2.5 py-[5px] md:px-3.5 md:py-2 bg-gradient-to-br from-neutral-700/30 to-neutral-700/20 rounded-[39px] outline outline-1 outline-offset-[-1px] outline-white/30 flex justify-start items-center">
      <span className="text-white text-base md:text-lg font-normal md:font-medium font-['Montserrat'] leading-6">
        {label}
      </span>
    </div>
  );
}

export default function StepRecommendation({
  onNext,
  onBack,
}: StepRecommendationProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full min-h-screen bg-black overflow-hidden px-4 md:px-0 box-border">
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-center md:gap-12">
        {/* Left / top panel — class list matches step-goal.tsx exactly */}
        <div className="flex-1 flex flex-col justify-start items-start gap-12 pt-16 md:pt-0 md:py-16 min-h-screen md:min-h-0 md:justify-center">
          <div className="flex flex-col gap-3">
            <div className="text-white text-sm md:text-base font-normal font-['Montserrat'] leading-5 md:leading-6">
              {t("getStarted.recommendation.eyebrow")}
            </div>
            <div className="text-white text-2xl md:text-4xl font-semibold font-['Montserrat'] md:font-semibold">
              {t("getStarted.recommendation.title")}
            </div>
            <div className="text-white text-lg font-medium font-['Montserrat']">
              {t("getStarted.recommendation.subtitle")}
            </div>
          </div>

          <div className="w-full flex flex-col gap-8 md:gap-6">
            <div className="w-full pb-8 md:pb-6 border-b border-blue-50/40 flex flex-col gap-4 md:gap-3">
              <div className="text-white text-xl md:text-2xl font-medium font-['Montserrat'] leading-7">
                {t("getStarted.recommendation.structureTitle")}
              </div>
              <div className="flex flex-wrap gap-1 md:gap-3">
                {STRUCTURE_KEYS.map((key) => (
                  <Pill
                    key={key}
                    label={t(`getStarted.recommendation.structure.${key}`)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 md:gap-3 pt-2 md:pt-0">
              <div className="text-white text-xl md:text-2xl font-medium font-['Montserrat'] leading-7">
                {t("getStarted.recommendation.addonsTitle")}
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {ADDON_KEYS.map((key) => (
                  <Pill
                    key={key}
                    label={t(`getStarted.recommendation.addons.${key}`)}
                  />
                ))}
              </div>
            </div>
          </div>

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
              className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
                {t("getStarted.navigation.continueSetup")}
              </span>
            </button>
          </div>
        </div>

        {/* Right / bottom panel — outer class list matches step-goal.tsx exactly */}
        <div className="flex-1 h-[323px] md:h-screen bg-[#111111] mt-12 md:mt-0">
          <div className="h-full w-full min-h-0 flex flex-col justify-start md:justify-center gap-5 md:gap-3 overflow-y-auto box-border py-4 md:py-16 md:pl-6 md:pr-16">
            <div className="text-white text-2xl font-medium font-['Montserrat']">
              {t("getStarted.recommendation.templateHeading")}
            </div>
            <div className="flex flex-col gap-0 shrink-0">
              <div className="text-white text-lg font-bold font-['Montserrat']">
                {t("getStarted.recommendation.template.name")}
              </div>
              <div className="text-white text-base md:text-lg font-normal md:font-medium font-['Montserrat'] leading-5">
                {t("getStarted.recommendation.template.description")}
              </div>
            </div>
            <div className="w-full h-44 md:h-[596px] shrink-0 bg-neutral-700/30 rounded-[20px]" />
            <div className="text-white text-sm font-semibold font-['Montserrat'] tracking-tight md:text-lg md:font-medium shrink-0">
              {t("getStarted.recommendation.template.note")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
