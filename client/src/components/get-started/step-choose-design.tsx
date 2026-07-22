import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import type { WizardValues } from "@/pages/get-started";
import type { Template } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
} from "lucide-react";

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

const BROWSER_INDUSTRIES = [
  { key: "agriculture", value: "Agriculture" },
  { key: "transportation", value: "Transportation" },
  { key: "educationCoaching", value: "education_coaching" },
  { key: "healthWellness", value: "health_wellness" },
  { key: "professionalServices", value: "professional_services" },
  { key: "psychologist", value: "psychologist" },
  { key: "realEstate", value: "real_estate" },
  { key: "restaurantsFood", value: "restaurants_food" },
  { key: "tourismHospitality", value: "tourism_hospitality" },
];

const TEMPLATES_PER_PAGE = 9;

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

interface TemplateCardProps {
  template: (typeof ENVATO_TEMPLATES)[number];
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

function TemplateCard({ template, isSelected, onSelect, onPreview }: TemplateCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[10px] border-0 cursor-pointer transition-all overflow-hidden relative flex flex-col items-start gap-3 bg-transparent p-0 text-left group"
      aria-label={template.name}
    >
      <div className="relative w-full">
        <img
          src={template.preview}
          alt={template.name}
          className={cn(
            "w-full h-48 md:h-56 rounded-[10px] object-cover object-top transition-all",
            "outline outline-1 outline-offset-[-1px]",
            isSelected
              ? "outline-[#ED4C14]"
              : "outline-white/20 group-hover:outline-white/50",
          )}
        />
        {isSelected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#ED4C14] flex items-center justify-center flex-shrink-0">
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
        <div className="absolute inset-0 rounded-[10px] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
          <div
            role="button"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 outline outline-1 outline-white/30 cursor-pointer hover:bg-black/80 transition-colors"
          >
            <Eye className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium font-brand">{t("templates.page.preview")}</span>
          </div>
        </div>
      </div>
      <span className="text-white text-base font-semibold font-brand px-1">
        {template.name}
      </span>
    </button>
  );
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

  const [showBrowser, setShowBrowser] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<(typeof ENVATO_TEMPLATES)[number] | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Fixed 6 suggested templates based on business type + goals
  const suggestedTemplates = useMemo(() => {
    const pool = getRelevantTemplates(businessType, goals ?? []);
    return pickRandom(pool, 6, seed);
  }, [businessType, goals, seed]);

  // Full browser — all templates, filtered by category
  const filteredTemplates = useMemo(() => {
    return ENVATO_TEMPLATES.filter((t) => {
      return !selectedCategory || t.category === selectedCategory;
    });
  }, [selectedCategory]);

  const orderedTemplates = useMemo(() => {
    if (selectedCategory) return filteredTemplates;
    const shuffled = [...filteredTemplates];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [filteredTemplates, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(orderedTemplates.length / TEMPLATES_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);

  const pagedTemplates = useMemo(() => {
    const start = (clampedPage - 1) * TEMPLATES_PER_PAGE;
    return orderedTemplates.slice(start, start + TEMPLATES_PER_PAGE);
  }, [orderedTemplates, clampedPage]);

  const visiblePages = useMemo(() => {
    const maxButtons = Math.min(5, totalPages);
    const start = Math.max(1, Math.min(clampedPage - 2, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, idx) => start + idx);
  }, [clampedPage, totalPages]);
  const lastVisiblePage = visiblePages[visiblePages.length - 1] ?? 1;

  const handleCategorySelect = (industryKey: string, categoryValue: string) => {
    setSelectedIndustry(industryKey);
    setSelectedCategory(categoryValue);
    setIndustryOpen(false);
    setCurrentPage(1);
  };

  const clearCategory = () => {
    setSelectedIndustry(null);
    setSelectedCategory(null);
    setIndustryOpen(false);
    setCurrentPage(1);
  };

  return (
    <div className="w-full min-h-screen bg-black flex flex-col items-center px-4 md:px-16 pt-24 pb-12 md:py-12 gap-6">
      {/* Header */}
      <div className="w-full flex flex-col items-center gap-3">
        <div className="w-full text-center text-white text-2xl md:text-4xl font-semibold font-brand">
          {t("getStarted.chooseDesign.title")}
        </div>
        <div className="w-full text-center text-white text-base md:text-lg font-normal md:font-medium font-brand leading-5">
          {t("getStarted.chooseDesign.subtitle")}
        </div>
      </div>

      {/* Choose for me — aligned right */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={() => {
            form.setValue("selectedDesign", "auto");
            onNext();
          }}
          className="h-10 px-4 py-2 rounded-[10px] inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48" fill="none">
            <path d="M24 4 L26 22 L44 24 L26 26 L24 44 L22 26 L4 24 L22 22 Z" fill="white" opacity="0.9" />
            <path d="M38 8 L39 14 L45 15 L39 16 L38 22 L37 16 L31 15 L37 14 Z" fill="white" opacity="0.7" />
          </svg>
          <span className="text-white text-sm font-medium font-brand">
            {t("getStarted.chooseDesign.chooseForMe")}
          </span>
        </button>
      </div>

      {/* Suggested templates (6) */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {suggestedTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedDesign === String(template.id)}
            onSelect={() => form.setValue("selectedDesign", String(template.id))}
            onPreview={() => { setPreviewTemplate(template); setIsPreviewOpen(true); }}
          />
        ))}
      </div>

      {/* Show me more button */}
      {!showBrowser && (
        <button
          type="button"
          onClick={() => setShowBrowser(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-white/30 bg-transparent hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="text-white text-base font-medium font-brand">
            {t("getStarted.chooseDesign.showMore")}
          </span>
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Full template browser */}
      {showBrowser && (
        <div className="w-full flex flex-col gap-6">
          {/* Divider */}
          <div className="w-full flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/50 text-sm font-medium font-brand whitespace-nowrap">
              {t("getStarted.chooseDesign.browseAll")}
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Category filter */}
          <div className="w-full relative inline-flex justify-start items-center gap-3">
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-[10px] transition-colors",
                "bg-[#ED4C14] hover:bg-[#d44310]",
              )}
              onClick={() => setIndustryOpen((o) => !o)}
            >
              <span className="text-white text-base font-medium font-brand">
                {selectedIndustry
                  ? t(`templates.page.industries.${selectedIndustry}`)
                  : t("templates.page.industry")}
              </span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-white transition-transform",
                  industryOpen && "rotate-180",
                )}
              />
            </button>
            {selectedIndustry && (
              <button
                type="button"
                onClick={clearCategory}
                className="text-white/50 text-sm font-medium font-brand hover:text-white transition-colors"
              >
                ✕ {t("getStarted.chooseDesign.clearFilter")}
              </button>
            )}

            {industryOpen && (
              <div className="absolute left-0 top-[33px] z-50 w-full max-w-[280px] bg-gradient-to-br from-black/80 to-black/95 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/30 overflow-hidden shadow-xl">
                {BROWSER_INDUSTRIES.map((industry) => (
                  <button
                    key={industry.key}
                    type="button"
                    className={cn(
                      "w-full p-3 text-left text-white text-sm font-medium font-brand hover:bg-white/10 transition-colors",
                      selectedIndustry === industry.key && "bg-white/10",
                    )}
                    onClick={() => handleCategorySelect(industry.key, industry.value)}
                  >
                    {t(`templates.page.industries.${industry.key}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Templates grid */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {pagedTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedDesign === String(template.id)}
                onSelect={() => form.setValue("selectedDesign", String(template.id))}
                onPreview={() => { setPreviewTemplate(template); setIsPreviewOpen(true); }}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="w-full inline-flex justify-center items-center">
            <button
              type="button"
              className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={() => setCurrentPage(1)}
              disabled={clampedPage === 1}
            >
              <ChevronsLeft className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>

            {visiblePages.map((page) => (
              <button
                key={page}
                type="button"
                className={cn(
                  "w-10 p-2.5 rounded-lg flex justify-center items-center transition-colors",
                  clampedPage === page ? "bg-[#ED4C14]" : "hover:bg-white/10",
                )}
                onClick={() => setCurrentPage(page)}
              >
                <span className="text-white text-base font-medium font-brand">{page}</span>
              </button>
            ))}

            {lastVisiblePage < totalPages - 1 && (
              <button type="button" className="w-10 p-2.5 rounded-lg flex justify-center items-center">
                <span className="text-white text-base font-medium font-brand">…</span>
              </button>
            )}
            {lastVisiblePage < totalPages && (
              <button
                type="button"
                className="w-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
                onClick={() => setCurrentPage(totalPages)}
              >
                <span className="text-white text-base font-medium font-brand">{totalPages}</span>
              </button>
            )}

            <button
              type="button"
              className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors disabled:opacity-30"
              onClick={() => setCurrentPage(totalPages)}
              disabled={clampedPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      <TemplatePreviewModal
        template={previewTemplate as unknown as Template | null}
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) setPreviewTemplate(null);
        }}
      />

      {/* Navigation */}
      <div className="w-full flex items-center justify-between gap-4 pt-2">
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
          disabled={!selectedDesign}
          className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-white text-base font-semibold font-brand leading-5">
            {t("getStarted.navigation.next")}
          </span>
        </button>
      </div>
    </div>
  );
}
