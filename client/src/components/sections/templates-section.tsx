import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import type { Template } from "@shared/schema";

function shufflePreviewUrlsOnce(previews: string[]): string[] {
  const arr = [...previews];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function TemplatesSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleTemplateClick = (templateId: number) => {
    const template = ENVATO_TEMPLATES.find((templ) => templ.id === templateId) ?? null;
    setSelectedTemplate(template as Template | null);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateModalOpenChange = (open: boolean) => {
    setIsTemplateModalOpen(open);
    if (!open) setSelectedTemplate(null);
  };

  const previewToTemplateId = (previewSrc: string) =>
    ENVATO_TEMPLATES.find((templ) => templ.preview === previewSrc)?.id;

  /** One shuffle per marquee row over full ENVATO preview list (-50% loop needs two identical copies concatenated below). */
  const templatesMarqueeRow1Previews = useMemo(
    () => shufflePreviewUrlsOnce(ENVATO_TEMPLATES.map((tpl) => tpl.preview)),
    [],
  );

  const templatesMarqueeRow2Previews = useMemo(
    () => shufflePreviewUrlsOnce(ENVATO_TEMPLATES.map((tpl) => tpl.preview)),
    [],
  );

  return (
    <>
      <section className="w-full flex flex-col justify-start items-center gap-12 bg-black py-12 md:py-24">
        {/* Header */}
        <div className="hidden md:block w-full px-16">
          <div className="w-full max-w-7xl mx-auto flex justify-start items-center gap-48">
            <div className="flex-1">
              <span className="text-[#EFF6FF] text-5xl font-semibold font-['Montserrat'] leading-[70px]">{t("home.templatesSection.titlePrefix")} </span>
              <span className="text-[#ED4C14] text-5xl font-semibold font-['Montserrat'] leading-[70px]">{t("home.templatesSection.titleHighlight")}</span>
            </div>
            <div className="flex-1 flex flex-col justify-start items-start gap-6">
              <p className="text-[#EFF6FF] text-base font-normal font-['Montserrat'] leading-6">
                {t("home.templatesSection.description")}
              </p>
              <button
                className="h-11 px-5 py-3.5 bg-[#A0BAF3] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
                onClick={() => navigate("/templates")}
              >
                <span className="text-center text-blue-950 text-base font-semibold font-['Montserrat'] leading-5">
                  {t("nav.templates")}
                </span>
                <ArrowRight className="h-4 w-4 text-blue-950" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile layout — full-bleed carousels; copy keeps side padding */}
        <div className="md:hidden flex w-full flex-col items-stretch justify-start gap-12">
          <div className="flex w-full flex-col items-start justify-start gap-3 self-stretch px-4">
            <div className="self-stretch justify-start">
              <span className="text-white text-3xl font-semibold font-['Montserrat'] leading-10">Templates that already look </span>
              <span className="text-[#ED4C14] text-3xl font-semibold font-['Montserrat'] leading-10">like you.</span>
            </div>
            <div className="self-stretch flex flex-col justify-start items-start gap-6">
              <div className="self-stretch justify-start text-white text-base font-normal font-['Montserrat'] leading-5">
                {t("home.templatesSection.description")}
              </div>
              <button
                className="h-11 px-5 py-3.5 bg-[#A0BAF3] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
                onClick={() => navigate("/templates")}
              >
                <span className="text-center text-blue-950 text-base font-semibold font-['Montserrat'] leading-5">
                  {t("nav.templates")}
                </span>
                <ArrowRight className="h-4 w-4 text-blue-950" />
              </button>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-center gap-3">
            <div className="w-full h-60 relative overflow-hidden">
              <div className="absolute left-0 top-0 inline-flex justify-start items-center gap-6 animate-scroll-left" style={{ width: "max-content" }}>
                {[...templatesMarqueeRow1Previews, ...templatesMarqueeRow1Previews].map((src, i) => (
                  <img
                    key={`mobile-row1-${i}`}
                    className="w-96 h-60 rounded-[20px] object-cover flex-shrink-0 cursor-pointer"
                    src={src}
                    alt={t("home.templatesSection.carouselImageAlt")}
                    onClick={() => {
                      const id = previewToTemplateId(src);
                      if (id != null) handleTemplateClick(id);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="w-full h-60 relative overflow-hidden">
              <div className="absolute left-0 top-0 inline-flex justify-start items-center gap-6 animate-scroll-right" style={{ width: "max-content" }}>
                {[...templatesMarqueeRow2Previews, ...templatesMarqueeRow2Previews].map((src, i) => (
                  <img
                    key={`mobile-row2-${i}`}
                    className="w-96 h-60 rounded-[20px] object-cover flex-shrink-0 cursor-pointer"
                    src={src}
                    alt={t("home.templatesSection.carouselImageAlt")}
                    onClick={() => {
                      const id = previewToTemplateId(src);
                      if (id != null) handleTemplateClick(id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Carousel rows */}
        <div className="hidden md:flex w-full flex-col gap-20 overflow-hidden">
          {/* Row 1 — scrolls left */}
          <div className="relative h-96 overflow-hidden">
            <div className="absolute top-0 left-0 flex items-center gap-12 animate-scroll-left" style={{ width: "max-content" }}>
              {[...templatesMarqueeRow1Previews, ...templatesMarqueeRow1Previews].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={t("home.templatesSection.carouselImageAlt")}
                  className="w-[706px] h-96 rounded-[20px] object-cover flex-shrink-0 cursor-pointer"
                  onClick={() => {
                    const id = previewToTemplateId(src);
                    if (id != null) handleTemplateClick(id);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative h-96 overflow-hidden">
            <div className="absolute top-0 left-0 flex items-center gap-12 animate-scroll-right" style={{ width: "max-content" }}>
              {[...templatesMarqueeRow2Previews, ...templatesMarqueeRow2Previews].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={t("home.templatesSection.carouselImageAlt")}
                  className="w-[706px] h-96 rounded-[20px] object-cover flex-shrink-0 cursor-pointer"
                  onClick={() => {
                    const id = previewToTemplateId(src);
                    if (id != null) handleTemplateClick(id);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <TemplatePreviewModal
        template={selectedTemplate}
        open={isTemplateModalOpen}
        onOpenChange={handleTemplateModalOpenChange}
      />
    </>
  );
}
