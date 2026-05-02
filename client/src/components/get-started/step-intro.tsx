import React from "react";
import { useTranslation } from "react-i18next";

interface StepIntroProps {
  onNext: () => void;
}

export default function StepIntro({ onNext }: StepIntroProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full min-h-screen bg-black overflow-hidden px-4 md:px-0 box-border">
      {/*
        Desktop: single row (flex-row), left content + right image side by side
        Mobile: single column (flex-col), content on top, image below
      */}
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-center md:gap-12">
        {/* Left / top panel — content */}
        <div className="flex-1 flex flex-col justify-start items-start gap-12 pt-16 md:pt-0 md:py-16 min-h-screen md:min-h-0 md:justify-center">
          {/* Headline + subtitle */}
          <div className="flex flex-col justify-start items-start gap-2">
            <div className="text-white text-3xl md:text-5xl font-semibold font-['Montserrat'] leading-10 md:leading-[70px]">
              {t("getStarted.intro.headlineLine1")}
              <br />
              {t("getStarted.intro.headlineLine2")}
            </div>
            <div className="text-white text-lg font-medium font-['Montserrat']">
              {t("getStarted.intro.subtextLine1")}
              <br />
              {t("getStarted.intro.subtextLine2")}
            </div>
          </div>

          {/* Secondary text + CTA */}
          <div className="w-full md:w-96 flex flex-col justify-start items-start gap-6">
            <div className="text-white text-lg font-medium font-['Montserrat']">
              {t("getStarted.intro.secondary")}
            </div>
            <button
              type="button"
              onClick={onNext}
              className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
                {t("getStarted.intro.cta")}
              </span>
            </button>
          </div>
        </div>

        {/* Right / bottom panel — image placeholder */}
        {/* Desktop: tall side panel. Mobile: shorter image area below content */}
        <div className="flex-1 h-[323px] md:h-screen bg-[#111111] mt-12 md:mt-0" />
      </div>
    </div>
  );
}
