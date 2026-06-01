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
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-stretch md:gap-6">
        {/* Left / top panel — content (narrower on desktop so video column gets more space) */}
        <div className="flex flex-col justify-start items-start gap-12 pt-16 md:pt-0 md:py-16 w-full md:w-[34%] md:max-w-[500px] md:shrink-0 md:justify-center">
          {/* Headline + subtitle */}
          <div className="flex flex-col justify-start items-start gap-2">
            <div className="text-white text-3xl md:text-5xl font-semibold font-brand leading-10 md:leading-[70px]">
              {t("getStarted.intro.headlineLine1")}
              <br />
              {t("getStarted.intro.headlineLine2")}
            </div>
            <div className="text-white text-lg font-medium font-brand">
              {t("getStarted.intro.subtextLine1")}
              <br />
              {t("getStarted.intro.subtextLine2")}
            </div>
          </div>

          {/* Secondary text + CTA */}
          <div className="w-full md:w-96 flex flex-col justify-start items-start gap-6">
            <div className="text-white text-lg font-medium font-brand">
              {t("getStarted.intro.secondary")}
            </div>
            <button
              type="button"
              onClick={onNext}
              className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
            >
              <span className="text-white text-base font-semibold font-brand leading-5">
                {t("getStarted.intro.cta")}
              </span>
            </button>
          </div>
        </div>

        {/* Right / bottom panel — logo animation (wider column on desktop) */}
        <div className="w-full md:flex-1 md:min-w-0 h-[min(50vh,420px)] md:h-screen mt-12 md:mt-0 overflow-hidden bg-black">
          <video
            src="https://d8zdlelupx224.cloudfront.net/Logo_Animation_1_g2fcoo.mp4"
            className="h-full w-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

