import { useMemo, useState } from "react";
import type { Template } from "@shared/schema";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import { FinalCtaSection } from "@/components/sections/final-cta-section";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import {
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";

type EnvatoTemplate = (typeof ENVATO_TEMPLATES)[number];

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [industryOpen, setIndustryOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const industries = [
    { label: "Agriculture & Farming", value: "Agriculture" },
    { label: "Transportations & Logistics", value: "Transportation" },
    { label: "Education & Coaching", value: "education_coaching" },
    { label: "Health & Wellness", value: "health_wellness" },
    { label: "Professional Services", value: "professional_services" },
    { label: "Psychologists & Therapy", value: "psychologist" },
    { label: "Real Estate", value: "real_estate" },
    { label: "Restaurants & Food", value: "restaurants_food" },
    { label: "Tourism & Hospitality", value: "tourism_hospitality" },
  ];

  const filteredTemplates = useMemo(() => {
    return [...ENVATO_TEMPLATES].filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const orderedTemplates = useMemo(() => {
    if (selectedCategory) {
      return filteredTemplates;
    }

    const shuffled = [...filteredTemplates];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [filteredTemplates, selectedCategory]);

  const templatesPerPage = 9;
  const totalPages = Math.max(1, Math.ceil(orderedTemplates.length / templatesPerPage));
  const clampedCurrentPage = Math.min(currentPage, totalPages);
  const templates = useMemo(() => {
    const start = (clampedCurrentPage - 1) * templatesPerPage;
    return orderedTemplates.slice(start, start + templatesPerPage);
  }, [orderedTemplates, clampedCurrentPage]);

  const handleTemplateClick = (template: EnvatoTemplate) => {
    setSelectedTemplate(template as unknown as Template);
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  const goToFirst = () => setCurrentPage(1);
  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const goToLast = () => setCurrentPage(totalPages);

  const visiblePages = useMemo(() => {
    const maxButtons = Math.min(5, totalPages);
    const start = Math.max(1, Math.min(clampedCurrentPage - 2, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, idx) => start + idx);
  }, [clampedCurrentPage, totalPages]);
  const lastVisiblePage = visiblePages[visiblePages.length - 1] ?? 1;

  return (
    <div className="min-h-screen bg-black mt-[65px]">
      {/* Templates Page Header */}
      <section className="w-full px-16 pt-24 pb-12 bg-black flex flex-col justify-center items-center gap-6">
        <div className="flex flex-col justify-center items-center gap-12">
          {/* Title */}
          <div className="flex flex-col justify-start items-end gap-3">
            <h1 className="text-center text-6xl font-semibold font-['Montserrat']" style={{ maxWidth: "768px" }}>
              <span className="text-white">Find your </span>
              <span className="text-[#ED4C14]">starting point.</span>
            </h1>
            <p className="text-center text-white text-lg font-medium font-['Montserrat'] w-full">
              A curated set of templates you can choose from for your own business.
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/80 flex justify-start items-center gap-12">
            <Search className="w-6 h-6 text-white flex-shrink-0" />
            <input
              type="text"
              placeholder="Search your business topic"
              className="flex-1 bg-transparent text-white text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-white/50 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Templates Grid Section */}
      <section className="w-full px-16 py-24 bg-black flex flex-col justify-center items-center gap-12">
        {/* Industry filter dropdown */}
        <div className="w-full relative flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={() => setIndustryOpen((o) => !o)}
          >
            <span className="text-white text-lg font-medium font-['Montserrat']">
              {selectedIndustry ?? "Industry"}
            </span>
            <ChevronDown className={`w-6 h-6 text-white transition-transform ${industryOpen ? "rotate-180" : ""}`} />
          </button>

          {industryOpen && (
            <div className="absolute left-0 top-[33px] z-50 bg-gradient-to-br from-black/50 to-black/90 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/80 overflow-hidden">
              {industries.map((industry, i) => (
                <button
                  key={i}
                  type="button"
                  className={`w-full px-3.5 py-3 text-left text-white text-lg font-medium font-['Montserrat'] hover:bg-black/50 transition-colors ${
                    selectedIndustry === industry.label ? "bg-black/50" : ""
                  }`}
                  onClick={() => {
                    setSelectedIndustry(industry.label);
                    setSelectedCategory(industry.value);
                    setIndustryOpen(false);
                    setCurrentPage(1);
                  }}
                >
                  {industry.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Templates grid — use existing templates data */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col justify-start items-start gap-3 cursor-pointer group"
              onClick={() => handleTemplateClick(template)}
            >
              <div className="relative w-full">
                <img
                  src={template.preview}
                  alt={template.name}
                  className="w-full h-60 rounded-[10px] object-cover group-hover:opacity-80 transition-opacity"
                />
                <div className="absolute inset-0 rounded-[10px] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 outline outline-1 outline-white/30">
                    <Eye className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium font-['Montserrat']">Preview</span>
                  </div>
                </div>
              </div>
              <span className="text-white text-lg font-medium font-['Montserrat']">
                {template.name}
              </span>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-start items-center">
          <button
            type="button"
            className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
            onClick={goToFirst}
            disabled={clampedCurrentPage === 1}
          >
            <ChevronsLeft className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
            onClick={goToPrev}
            disabled={clampedCurrentPage === 1}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>

          {visiblePages.map((page) => (
            <button
              key={page}
              type="button"
              className={`w-10 p-2.5 rounded-lg flex justify-center items-center transition-colors ${
                clampedCurrentPage === page ? "bg-[#ED4C14]" : "hover:bg-white/10"
              }`}
              onClick={() => setCurrentPage(page)}
            >
              <span className="text-white text-lg font-medium font-['Montserrat']">{page}</span>
            </button>
          ))}

          {lastVisiblePage < totalPages - 1 && (
            <button type="button" className="w-10 p-2.5 rounded-lg flex justify-center items-center">
              <span className="text-white text-lg font-medium font-['Montserrat']">...</span>
            </button>
          )}
          {lastVisiblePage < totalPages && (
            <button
              type="button"
              className="w-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
              onClick={goToLast}
            >
              <span className="text-white text-lg font-medium font-['Montserrat']">{totalPages}</span>
            </button>
          )}

          <button
            type="button"
            className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
            onClick={goToNext}
            disabled={clampedCurrentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            className="w-10 h-10 p-2.5 rounded-lg flex justify-center items-center hover:bg-white/10 transition-colors"
            onClick={goToLast}
            disabled={clampedCurrentPage === totalPages}
          >
            <ChevronsRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </section>

      <TemplatePreviewModal
        template={selectedTemplate}
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
      />
      <div className="w-full">
        <FinalCtaSection />
      </div>
    </div>
  );
}