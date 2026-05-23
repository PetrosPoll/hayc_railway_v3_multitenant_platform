import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import type { WizardValues } from "@/pages/get-started";
import { cn } from "@/lib/utils";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";

const WIZARD_BUSINESS_TYPE_TO_KEY: Record<string, string> = {
  "Local Business": "local_business",
  "Service Business": "service_business",
  "Personal Brand": "personal_brand",
  "Creative Business": "creative_business",
  "Online Store": "online_store",
  "Hospitality/Travel": "hospitality_travel",
  "Health/Wellness": "health_wellness",
  Other: "other",
};

const WIZARD_GOAL_TO_KEY: Record<string, string> = {
  "Get more enquiries": "get_enquiries",
  "Book more appointments": "book_appointments",
  "Sell products online": "sell_products",
  "Showcase my work": "showcase_work",
  "Build trust in my business": "build_trust",
  "Share information clearly": "share_information",
  "Something else": "something_else",
};

const BUSINESS_TYPE_TO_CATEGORY: Record<string, string[]> = {
  local_business: ["professional_services"],
  service_business: ["professional_services"],
  personal_brand: ["psychologist", "education_coaching"],
  creative_business: ["professional_services", "psychologist"],
  online_store: ["restaurants_food"],
  hospitality_travel: ["tourism_hospitality"],
  health_wellness: ["health_wellness", "psychologist"],
  other: ["professional_services"],
};

const GOAL_CATEGORY_BOOST: Record<string, string[]> = {
  book_appointments: ["health_wellness", "psychologist", "education_coaching"],
  sell_products: ["restaurants_food"],
  showcase_work: ["psychologist", "education_coaching"],
  build_trust: ["professional_services", "psychologist"],
};

function getRelevantTemplates(
  businessType: string | undefined,
  goals: string[] | undefined,
): typeof ENVATO_TEMPLATES {
  const businessKey =
    WIZARD_BUSINESS_TYPE_TO_KEY[businessType ?? ""] ??
    (businessType && BUSINESS_TYPE_TO_CATEGORY[businessType]
      ? businessType
      : "other");

  const categories: string[] = [];
  const primaryCategories =
    BUSINESS_TYPE_TO_CATEGORY[businessKey] ?? ["professional_services"];
  categories.push(...primaryCategories);

  (goals ?? []).forEach((goal) => {
    const goalKey = WIZARD_GOAL_TO_KEY[goal] ?? goal;
    const boost = GOAL_CATEGORY_BOOST[goalKey];
    if (boost) categories.push(...boost);
  });

  const uniqueCategories = Array.from(new Set(categories));

  let pool = ENVATO_TEMPLATES.filter((t) =>
    uniqueCategories.includes(t.category),
  );

  if (pool.length < 3) {
    const fallback = ENVATO_TEMPLATES.filter(
      (t) => t.category === "professional_services",
    );
    pool = [...pool, ...fallback];
  }

  return pool;
}

function pickRandom<T>(arr: T[], n: number, seed: number): T[] {
  const shuffled = [...arr].sort((a, b) => {
    const hashA = (arr.indexOf(a) * 2654435761 + seed) >>> 0;
    const hashB = (arr.indexOf(b) * 2654435761 + seed) >>> 0;
    return hashA - hashB;
  });
  return shuffled.slice(0, n);
}

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
  const businessType = form.watch("businessType");
  const goals = form.watch("goals");
  const selectedDesign = form.watch("selectedDesign");

  const seed = useMemo(
    () =>
      (businessType ?? "other")
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0),
    [businessType],
  );

  const suggestedTemplates = useMemo(() => {
    const pool = getRelevantTemplates(businessType, goals ?? []);
    return pickRandom(pool, 3, seed);
  }, [businessType, goals, seed]);

  return (
    <div className="w-full min-h-screen bg-black flex flex-col justify-center items-center px-4 md:px-16 py-12 gap-6">
      <div className="w-full flex flex-col items-center gap-3">
        <div className="w-full text-center text-white text-2xl md:text-4xl font-semibold font-['Montserrat']">
          {t("getStarted.chooseDesign.title")}
        </div>
        <div className="w-full text-center text-white text-base md:text-lg font-normal md:font-medium font-['Montserrat'] leading-5">
          {t("getStarted.chooseDesign.subtitle")}
        </div>
      </div>

      <div className="w-full flex flex-col md:flex-row md:flex-wrap md:justify-center justify-start items-stretch gap-3 md:gap-6">
        {suggestedTemplates.map((template) => {
          const isSelected = selectedDesign === String(template.id);
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => form.setValue("selectedDesign", String(template.id))}
              className={cn(
                "w-full md:w-[638px] h-44 md:h-72 rounded-[10px]",
                "border-0 cursor-pointer transition-all overflow-hidden relative",
                "outline outline-1 outline-offset-[-1px]",
                isSelected ? "outline-[#ED4C14]" : "outline-white/20",
              )}
              aria-label={template.name}
            >
              <img
                src={template.preview}
                alt={template.name}
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between">
                <span className="text-white text-base font-semibold font-['Montserrat']">
                  {template.name}
                </span>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-[#ED4C14] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                      <path
                        d="M1 4L4.5 7.5L11 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
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
          <svg className="w-7 h-7 md:w-12 md:h-12" viewBox="0 0 48 48" fill="none">
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
          disabled={!selectedDesign}
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
