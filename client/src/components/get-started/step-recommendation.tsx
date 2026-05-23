import React from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import type { WizardValues } from "@/pages/get-started";
import { cn } from "@/lib/utils";

const GOAL_PAGE_MAP: Record<string, string[]> = {
  get_enquiries: ["Contact"],
  book_appointments: ["Booking"],
  sell_products: ["Products", "Pricing"],
  showcase_work: ["Gallery"],
  build_trust: ["Testimonials"],
  share_information: ["Blog"],
  something_else: [],
};

const BUSINESS_TYPE_PAGE_MAP: Record<string, string[]> = {
  local_business: ["Home", "About", "Services", "Contact"],
  service_business: ["Home", "About", "Services", "Contact"],
  personal_brand: ["Home", "About", "Blog", "Contact"],
  creative_business: ["Home", "About", "Gallery", "Contact"],
  online_store: ["Home", "Products", "Pricing", "Contact"],
  hospitality_travel: ["Home", "About", "Booking", "Contact", "Location"],
  health_wellness: ["Home", "About", "Services", "Booking", "Contact"],
  other: ["Home", "About", "Services", "Contact"],
};

const BUSINESS_TYPE_DISPLAY_MAP: Record<string, string> = {
  "Local Business": "local_business",
  "Service Business": "service_business",
  "Personal Brand": "personal_brand",
  "Creative Business": "creative_business",
  "Online Store": "online_store",
  "Hospitality/Travel": "hospitality_travel",
  "Health/Wellness": "health_wellness",
  "Other": "other",
};

const GOAL_DISPLAY_MAP: Record<string, string> = {
  "Get more enquiries": "get_enquiries",
  "Book more appointments": "book_appointments",
  "Sell products online": "sell_products",
  "Showcase my work": "showcase_work",
  "Build trust in my business": "build_trust",
  "Share information clearly": "share_information",
  "Something else": "something_else",
};

function computeSuggestedStructure(
  businessType: string | undefined,
  goals: string[] | undefined,
): string[] {
  const pages = new Set<string>();

  const btKey = BUSINESS_TYPE_DISPLAY_MAP[businessType ?? ""] ?? businessType ?? "";
  (BUSINESS_TYPE_PAGE_MAP[btKey] ?? ["Home", "About", "Services", "Contact"]).forEach(
    (p) => pages.add(p),
  );

  (goals ?? [])
    .filter((g) => g !== "something_else" && g !== "Something else")
    .forEach((goal) => {
      const goalKey = GOAL_DISPLAY_MAP[goal] ?? goal;
      (GOAL_PAGE_MAP[goalKey] ?? []).forEach((p) => pages.add(p));
    });

  return Array.from(pages);
}

const ALL_ADDONS = [
  { key: "bookingIntegration", value: "Booking Integration", label: "Booking Integration" },
  { key: "hdp", value: "HDP", label: "Hayc Digital Products" },
] as const;

const GOAL_ADDON_MAP: Record<string, string[]> = {
  get_enquiries: [],
  book_appointments: ["Booking Integration"],
  sell_products: ["HDP"],
  showcase_work: [],
  build_trust: [],
  share_information: [],
  something_else: [],
};

const BUSINESS_TYPE_ADDON_MAP: Record<string, string[]> = {
  local_business: ["Booking Integration"],
  service_business: ["Booking Integration"],
  personal_brand: [],
  creative_business: ["HDP"],
  online_store: ["HDP"],
  hospitality_travel: ["Booking Integration"],
  health_wellness: ["Booking Integration"],
  other: [],
};

const BUSINESS_TYPE_LABEL_MAP: Record<string, string> = {
  "Local Business": "local_business",
  "Service Business": "service_business",
  "Personal Brand": "personal_brand",
  "Creative Business": "creative_business",
  "Online Store": "online_store",
  "Hospitality/Travel": "hospitality_travel",
  "Health/Wellness": "health_wellness",
  "Other": "other",
};

const GOAL_LABEL_MAP: Record<string, string> = {
  "Get more enquiries": "get_enquiries",
  "Book more appointments": "book_appointments",
  "Sell products online": "sell_products",
  "Showcase my work": "showcase_work",
  "Build trust in my business": "build_trust",
  "Share information clearly": "share_information",
  "Something else": "something_else",
};

function computeSuggestedAddons(
  businessType: string | undefined,
  goals: string[] | undefined,
): string[] {
  const suggested = new Set<string>();

  const btKey = BUSINESS_TYPE_LABEL_MAP[businessType ?? ""] ?? businessType ?? "";
  (BUSINESS_TYPE_ADDON_MAP[btKey] ?? []).forEach((a) => suggested.add(a));

  const meaningfulGoals = (goals ?? []).filter(
    (g) => g !== "something_else" && g !== "Something else",
  );
  meaningfulGoals.forEach((goal) => {
    const goalKey = GOAL_LABEL_MAP[goal] ?? goal;
    (GOAL_ADDON_MAP[goalKey] ?? []).forEach((a) => suggested.add(a));
  });

  suggested.add("Booking Integration");

  return Array.from(suggested);
}

const ADDON_KEY_MAP: Record<string, string> = {
  "Booking Integration": "bookingIntegration",
  "HDP": "hdp",
};

interface StepRecommendationProps {
  form: UseFormReturn<WizardValues>;
  onNext: () => void;
  onBack: () => void;
}

function StructurePill({ label }: { label: string }) {
  return (
    <div className="px-2.5 py-1 bg-white/5 rounded-md border border-white/15 flex justify-start items-center cursor-default">
      <span className="text-white/70 text-base md:text-lg font-normal md:font-medium font-brand leading-6">
        {label}
      </span>
    </div>
  );
}

function Pill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-[39px] text-white text-lg font-medium font-brand border transition-colors cursor-pointer",
        selected
          ? "bg-[#ED4C14] border-[#ED4C14]"
          : "bg-transparent border-[#6a6a6a] hover:border-white/50",
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors",
          selected
            ? "bg-white border-white"
            : "bg-transparent border-white/50",
        )}
      >
        {selected && (
          <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
            <path
              d="M1 3.5L3 5.5L7 1"
              stroke="#ED4C14"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-white text-lg font-medium font-brand">
        {label}
      </span>
    </button>
  );
}

export default function StepRecommendation({
  form,
  onNext,
  onBack,
}: StepRecommendationProps) {
  const { t } = useTranslation();

  const businessType = form.watch("businessType");
  const goals = form.watch("goals");
  const suggestedStructure = computeSuggestedStructure(businessType, goals ?? []);

  const btKey = BUSINESS_TYPE_DISPLAY_MAP[businessType ?? ""] ?? businessType ?? "default";
  const titleConfig = {
    title: t(`getStarted.recommendation.businessTypes.${btKey}.title`, {
      defaultValue: t("getStarted.recommendation.businessTypes.default.title"),
    }),
    subtitle: t(`getStarted.recommendation.businessTypes.${btKey}.subtitle`, {
      defaultValue: t("getStarted.recommendation.businessTypes.default.subtitle"),
    }),
  };

  const getPageLabel = (page: string): string => {
    const result = t(`getStarted.websiteStructure.pages.${page}`);
    return result.startsWith("getStarted.") ? page : result;
  };

  const getAddonLabel = (value: string): string => {
    const key = ADDON_KEY_MAP[value];
    if (!key) return value;
    return t(`getStarted.recommendation.addons.${key}`);
  };

  const suggestedAddonValues = computeSuggestedAddons(businessType, goals ?? []);

  const rawSelectedAddons = form.watch("selectedAddons");
  const selectedAddons = rawSelectedAddons !== undefined
    ? rawSelectedAddons
    : suggestedAddonValues;

  const toggleAddon = (value: string) => {
    form.setValue("suggestedAddons", suggestedAddonValues);

    const current = form.getValues("selectedAddons");
    const base = current !== undefined ? current : suggestedAddonValues;
    const updated = base.includes(value)
      ? base.filter((v) => v !== value)
      : [...base, value];
    form.setValue("selectedAddons", updated);
  };

  const navButtons = (
    <>
      <button
        type="button"
        onClick={onBack}
        className="h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-start items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
      >
        <span className="text-white text-base font-semibold font-brand leading-5">
          {t("getStarted.navigation.back")}
        </span>
      </button>
      <button
        type="button"
        onClick={onNext}
        className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
      >
        <span className="text-white text-base font-semibold font-brand leading-5">
          {t("getStarted.navigation.continueSetup")}
        </span>
      </button>
    </>
  );

  return (
    <div className="w-full min-h-screen bg-black overflow-hidden px-4 md:px-0 box-border">
      <div className="flex flex-col md:flex-row w-full md:pl-16 md:items-center md:gap-12">
        <div className="flex-1 flex flex-col justify-start items-start gap-12 pt-16 md:pt-0 md:py-16 min-h-0 md:justify-center">
          <div className="flex flex-col gap-3">
            <div className="text-white text-sm md:text-base font-normal font-brand leading-5 md:leading-6">
              {t("getStarted.recommendation.eyebrow")}
            </div>
            <div className="text-white text-2xl md:text-4xl font-semibold font-brand md:font-semibold">
              {t("getStarted.recommendation.title")}
            </div>
            <div className="text-white text-lg font-medium font-brand">
              {t("getStarted.recommendation.subtitle")}
            </div>
          </div>

          <div className="w-full flex flex-col gap-8 md:gap-6">
            <div className="w-full pb-8 md:pb-6 border-b border-blue-50/40 flex flex-col gap-4 md:gap-3">
              <div className="text-white text-xl md:text-2xl font-medium font-brand leading-7">
                {t("getStarted.recommendation.structureTitle")}
              </div>
              <div className="flex flex-wrap gap-1 md:gap-3">
                {suggestedStructure.map((page) => (
                  <StructurePill
                    key={page}
                    label={getPageLabel(page)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 md:gap-3 pt-2 md:pt-0">
              <div className="flex flex-col gap-1">
                <div className="text-white text-xl md:text-2xl font-medium font-brand leading-7">
                  {t("getStarted.recommendation.addonsTitle")}
                </div>
                <div className="text-white/60 text-sm font-normal font-brand">
                  {t("getStarted.recommendation.addonsSubtitle")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {ALL_ADDONS.map((addon) => (
                  <Pill
                    key={addon.key}
                    label={getAddonLabel(addon.value)}
                    selected={selectedAddons.includes(addon.value)}
                    onClick={() => toggleAddon(addon.value)}
                  />
                ))}
              </div>
              <p className="text-white/40 text-xs font-normal font-brand leading-5">
                {t("getStarted.recommendation.addonsNote")}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">{navButtons}</div>
        </div>

        {/* Right panel — website preview + pages + addons */}
        <div className="flex-1 h-[323px] md:h-screen bg-[#111111] mt-12 md:mt-0 max-md:-mx-4 max-md:w-[calc(100%+2rem)] shrink-0 overflow-hidden">
          <div className="h-full w-full flex flex-col justify-center gap-6 py-8 md:py-16 px-4 md:px-10">

            {/* Dynamic title */}
            <div className="flex flex-col gap-2">
              <h2 className="text-white text-2xl md:text-3xl font-semibold font-brand leading-tight">
                {titleConfig.title}
              </h2>
              <p className="text-white/60 text-sm font-normal font-brand leading-6">
                {titleConfig.subtitle}
              </p>
            </div>

            {/* Eyebrow */}
            <span className="text-[#ED4C14] text-xs font-semibold tracking-[0.1em] font-brand uppercase">
              {t("getStarted.recommendation.panel.eyebrow")}
            </span>

            {/* Website wireframe mockup */}
            <div className="w-full rounded-[12px] bg-[#f5f0ea] overflow-hidden flex flex-col flex-shrink-0">
              {/* Fake browser bar */}
              <div className="w-full h-7 bg-[#e8e2da] flex items-center px-3 gap-1.5 flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#d4cdc6]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#d4cdc6]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#d4cdc6]" />
                <div className="flex-1 mx-3 h-3.5 rounded-full bg-[#d4cdc6]" />
              </div>

              {/* Fake navbar */}
              <div className="w-full px-4 py-2 bg-[#fefaf7] border-b border-[#e8e2da] flex items-center gap-3 flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-[#d4cdc6] flex-shrink-0" />
                <div className="flex-1 flex items-center gap-3 overflow-hidden">
                  {suggestedStructure.slice(0, 5).map((page) => (
                    <span
                      key={page}
                      className="text-[10px] font-medium font-brand text-[#333] whitespace-nowrap first:text-[#F07848] first:border-b first:border-[#F07848]"
                    >
                      {getPageLabel(page)}
                    </span>
                  ))}
                </div>
                <div className="h-5 px-2 rounded bg-[#1a1a1a] flex items-center flex-shrink-0">
                  <span className="text-white text-[8px] font-medium font-brand">
                    {t("getStarted.recommendation.panel.contactButton")}
                  </span>
                </div>
              </div>

              {/* Fake hero section */}
              <div className="w-full px-4 pt-4 pb-3 flex gap-3 bg-[#fefaf7]">
                <div className="flex-1 flex flex-col gap-2 justify-center">
                  <div className="w-4 h-0.5 bg-[#F07848]" />
                  <div className="h-2.5 w-3/4 rounded bg-[#d4cdc6]" />
                  <div className="h-1.5 w-full rounded bg-[#e8e2da]" />
                  <div className="h-1.5 w-5/6 rounded bg-[#e8e2da]" />
                  <div className="mt-1 h-5 w-20 rounded bg-[#1a1a1a] flex items-center justify-center">
                    <span className="text-white text-[7px] font-medium font-brand">{t("getStarted.recommendation.panel.bookButton")}</span>
                  </div>
                </div>
                <div className="w-20 h-16 rounded bg-[#e8e2da] flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                    <rect width="20" height="16" rx="2" fill="#d4cdc6"/>
                    <circle cx="7" cy="6" r="2.5" fill="#c4bdb6"/>
                    <path d="M0 13 L6 8 L10 11 L14 7 L20 13" stroke="#c4bdb6" strokeWidth="1.5" fill="none"/>
                  </svg>
                </div>
              </div>

              {/* Fake services row */}
              <div className="w-full px-4 pb-4 bg-[#fefaf7] flex flex-col gap-2">
                <div className="h-1.5 w-16 rounded bg-[#d4cdc6] mx-auto" />
                <div className="flex gap-2">
                  {[0,1,2].map((i) => (
                    <div key={i} className="flex-1 rounded bg-[#f0ebe4] p-2 flex flex-col gap-1.5 items-center">
                      <div className="w-5 h-5 rounded-full bg-[#d4cdc6]" />
                      <div className="h-1 w-full rounded bg-[#d4cdc6]" />
                      <div className="h-1 w-3/4 rounded bg-[#e8e2da]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom row — pages + addons cards */}
            <div className="flex gap-3 w-full">
              {/* Recommended Pages card */}
              <div className="flex-1 rounded-[10px] bg-[#1a1a1a] border border-white/10 p-3 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="12" rx="2" stroke="#ED4C14" strokeWidth="1.5"/>
                    <path d="M4 4h6M4 7h6M4 10h4" stroke="#ED4C14" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[#ED4C14] text-[9px] font-semibold tracking-[0.08em] font-brand uppercase">
                    {t("getStarted.recommendation.panel.pagesCard.title")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestedStructure.slice(0, 5).map((page) => (
                    <div key={page} className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5.5" stroke="#ED4C14" strokeWidth="1"/>
                        <path d="M3.5 6L5.5 8L8.5 4" stroke="#ED4C14" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-white text-[11px] font-medium font-brand">{getPageLabel(page)}</span>
                    </div>
                  ))}
                  {suggestedStructure.length > 5 && (
                    <span className="text-white/40 text-[10px] font-brand">
                      {t("getStarted.recommendation.panel.pagesCard.more", { count: suggestedStructure.length - 5 })}
                    </span>
                  )}
                </div>
              </div>

              {/* Included Add-ons card */}
              <div className="flex-1 rounded-[10px] bg-[#1a1a1a] border border-white/10 p-3 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L8.5 5.5H13L9.5 8L11 12.5L7 10L3 12.5L4.5 8L1 5.5H5.5L7 1Z" stroke="#ED4C14" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[#ED4C14] text-[9px] font-semibold tracking-[0.08em] font-brand uppercase">
                    {t("getStarted.recommendation.panel.addonsCard.title")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {selectedAddons.map((addon) => (
                    <div key={addon} className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5.5" stroke="#ED4C14" strokeWidth="1"/>
                        <path d="M3.5 6L5.5 8L8.5 4" stroke="#ED4C14" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-white text-[11px] font-medium font-brand">{getAddonLabel(addon)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-white/40 text-xs font-normal font-brand">
              {t("getStarted.recommendation.panel.footer")}
            </p>
          </div>
        </div>

        <div className="flex md:hidden items-center gap-4 w-full shrink-0 pt-8 pb-12">
          {navButtons}
        </div>
      </div>
    </div>
  );
}

