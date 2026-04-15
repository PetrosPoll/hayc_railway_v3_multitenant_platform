import { useNavigate } from "react-router-dom";
import { type User, type Subscription } from "@shared/schema";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import "../i18n";

import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";
import type { Template } from "@shared/schema";

// Selected templates to display on home page carousel
// You can change these IDs to display different templates
const SELECTED_TEMPLATE_IDS = [1, 5, 10, 15, 20, 25, 30, 35];

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedAddOns, setExpandedAddOns] = useState<{ [key: string]: boolean }>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [openAddon, setOpenAddon] = useState<number>(0);

  const addonCategories = [
    {
      titleKey: "home.addonsSection.categories.businessTools.title",
      descriptionKey: "home.addonsSection.categories.businessTools.description",
      addonKeys: [
        "home.addonsSection.categories.businessTools.addons.bookingSystem",
        "home.addonsSection.categories.businessTools.addons.transportBooking",
        "home.addonsSection.categories.businessTools.addons.donationSystem",
      ],
    },
    {
      titleKey: "home.addonsSection.categories.digitalPayments.title",
      descriptionKey: "home.addonsSection.categories.digitalPayments.description",
      addonKeys: ["home.addonsSection.categories.digitalPayments.addons.onlinePayments"],
    },
    {
      titleKey: "home.addonsSection.categories.engagementData.title",
      descriptionKey: "home.addonsSection.categories.engagementData.description",
      addonKeys: ["home.addonsSection.categories.engagementData.addons.analyticsDashboard"],
    },
    {
      titleKey: "home.addonsSection.categories.educationContent.title",
      descriptionKey: "home.addonsSection.categories.educationContent.description",
      addonKeys: ["home.addonsSection.categories.educationContent.addons.lms"],
    },
    {
      titleKey: "home.addonsSection.categories.specializedSolutions.title",
      descriptionKey: "home.addonsSection.categories.specializedSolutions.description",
      addonKeys: ["home.addonsSection.categories.specializedSolutions.addons.customIntegration"],
    },
  ];

  // Example query for user data
  const { data } = useQuery<{ user: User | null }>({
    queryKey: ["/api/user"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: subscriptionList } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !!data?.user,
  });

  const hasActiveAddon = useMemo(() => {
    const list = Array.isArray(subscriptionList) ? subscriptionList : [];
    return (addonId: string) =>
      list.some(
        (sub) =>
          sub.productType === "addon" &&
          sub.productId === addonId &&
          sub.status === "active",
      );
  }, [subscriptionList]);

  // Filter templates to display only selected ones
  const selectedTemplates = useMemo(() => {
    return ENVATO_TEMPLATES.filter(template => 
      SELECTED_TEMPLATE_IDS.includes(template.id)
    );
  }, []);

  const toggleAddOnExpansion = (addonId: string) => {
    setExpandedAddOns(prev => ({
      ...prev,
      [addonId]: !prev[addonId]
    }));
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateModalOpenChange = (open: boolean) => {
    setIsTemplateModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  // Embla carousel with AutoScroll plugin for the "Website Templates" section
  // --------------------------------------------------------------------------
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    AutoScroll({ playOnInit: true }) as any,
  ]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;

    const pluginMap = emblaApi.plugins();
    const autoScrollApi = pluginMap?.autoScroll;

    if (!autoScrollApi) return;

    setIsPlaying((autoScrollApi as any).isPlaying());

    emblaApi
      .on("autoScroll:play" as any, () => setIsPlaying(true))
      .on("autoScroll:stop" as any, () => setIsPlaying(false))
      .on("reInit", () => {
        setIsPlaying((autoScrollApi as any).isPlaying());
      });
  }, [emblaApi]);

  // NEW: Pause/Resume AutoScroll on hover
  // -------------------------------------
  const handleMouseEnter = useCallback(() => {
    if (!emblaApi) return;
    const autoScrollApi = emblaApi.plugins()?.autoScroll;
    (autoScrollApi as any)?.stop();
  }, [emblaApi]);

  const handleMouseLeave = useCallback(() => {
    if (!emblaApi) return;
    const autoScrollApi = emblaApi.plugins()?.autoScroll;
    (autoScrollApi as any)?.play();
  }, [emblaApi]);

  const slides = [
    "/images/hero_bg_image_hayc1.png",
    "/images/hero_bg_image_hayc2.png",
    "/images/hero_bg_image_hayc3.png",
  ];
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div className="min-h-screen bg-background  mt-md-[65px]">
      {/* Hero Section */}
      <section className="relative overflow-hidden" style={{ height: '115vh' }}>

        {/* Background slideshow */}
        <div
          className="absolute inset-0 flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((src, i) => (
            <div
              key={i}
              className="relative min-w-full h-full bg-cover bg-center flex-shrink-0"
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50 z-10" />

        {/* Main content */}
        <div className="relative z-20 h-full flex flex-col items-center text-center px-4" style={{ paddingTop: '12vh' }}>

          {/* Headline */}
          <h1 className="text-6xl font-semibold font-['Montserrat'] text-white max-w-4xl mb-4 leading-tight">
            {t("home.hero.titlePrefix")}{" "}
            <span className="text-[#ED4C14]">{t("home.hero.titleHighlight")}</span>{" "}
            {t("home.hero.titleBeforeBreak")}
            <br />
            {t("home.hero.titleAfterBreak")}
          </h1>

          {/* Subtitle */}
          <p className="text-2xl font-medium font-['Montserrat'] text-white mb-6">
            {t("home.hero.subtitle")}
          </p>

          {/* Avatar circles */}
          <div className="flex mb-3">
            <div className="w-8 h-8 rounded-full bg-[#ED4C14] border-2 border-white flex items-center justify-center text-white text-xs font-bold -mr-2 z-10">O</div>
            <div className="w-8 h-8 rounded-full bg-[#182B53] border-2 border-white flex items-center justify-center text-white text-xs font-bold">N</div>
          </div>

          {/* CTA Button */}
          <Button
            className="h-11 px-5 py-3.5 bg-[#ED4C14] hover:opacity-80 text-[#EFF6FF] rounded-[10px] text-base font-semibold font-['Montserrat'] leading-5 border-0 group mb-2"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {t("home.hero.cta")}
            <ArrowRight className="ml-4 h-4 w-4" />
          </Button>

          {/* Social proof */}
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-normal font-['Inter'] text-slate-100">{t("home.hero.socialProof.line1")}</p>
            <p className="text-sm font-normal font-['Inter'] text-slate-100">{t("home.hero.socialProof.line2")}</p>
          </div>

          {/* Slide indicators */}
          <div className="flex gap-2 mt-6">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentSlide ? "bg-white w-6" : "bg-white/40 w-2"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom template previews */}
        <div className="absolute bottom-0 left-0 w-full z-20 overflow-hidden h-[42vh]">
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black z-10 pointer-events-none" />

          <div className="absolute inset-x-0 bottom-0 h-full z-20">
            {/* Left image touches viewport edge */}
            <div className="absolute left-0 bottom-0 w-[32%] md:w-[30%] lg:w-[28%] z-20">
              <img
                src="/images/Rectangle 104.png"
                alt={t("home.hero.templatePreviewAlt.left")}
                className="block w-full h-auto"
              />
            </div>

            {/* Right image touches viewport edge */}
            <div className="absolute right-0 bottom-0 w-[32%] md:w-[30%] lg:w-[28%] z-20">
              <img
                src="/images/Rectangle 114.png"
                alt={t("home.hero.templatePreviewAlt.right")}
                className="block w-full h-auto"
              />
            </div>

            {/* Middle image is slightly higher */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[7%] w-[43%] md:w-[39%] lg:w-[36%] z-30">
              <img
                src="/images/Rectangle 113.png"
                alt={t("home.hero.templatePreviewAlt.center")}
                className="block w-full h-auto"
              />
            </div>
          </div>
        </div>

      </section>

      {/* Why Us - Section 1 */}
      <section className="w-full bg-black px-16 flex justify-start items-center" style={{ minHeight: '891px' }}>
        {/* Left content */}
        <div className="flex flex-col justify-start items-start gap-12" style={{ width: '452px', flexShrink: 0 }}>
          <h2 className="text-5xl font-semibold font-['Montserrat'] leading-[70px]">
            <span className="text-white">{t("home.whyUs.section1.titlePrefix")} </span>
            <span className="text-[#ED4C14]">{t("home.whyUs.section1.titleHighlight")} </span>
            <span className="text-white">{t("home.whyUs.section1.titleSuffix")}</span>
          </h2>
          <button
            className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-center text-[#EFF6FF] text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
          </button>
        </div>

        {/* Right image */}
        <div className="flex-1 flex justify-end items-center">
          <img
            src="/images/why_us_1.png"
            alt={t("home.whyUs.section1.imageAlt")}
            className="h-full object-contain"
            style={{ maxHeight: '891px' }}
          />
        </div>
      </section>

      {/* Why Us - Section 2 */}
      <section className="w-full bg-black px-16 flex justify-start items-center gap-12" style={{ minHeight: '891px' }}>
        {/* Left content */}
        <div className="flex flex-col justify-start items-start gap-12" style={{ width: '384px', flexShrink: 0 }}>
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl font-semibold font-['Inter']" style={{ width: '288px' }}>
              <span className="text-[#ED4C14]">{t("home.whyUs.section2.titleHighlight")}</span>
              <span className="text-slate-100">{t("home.whyUs.section2.titleSuffix")}</span>
            </h2>
            <p className="text-slate-100 text-base font-normal font-['Inter']" style={{ width: '320px' }}>
              {t("home.whyUs.section2.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-center text-white text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Right image */}
        <div className="flex-1 self-stretch flex items-center justify-center">
          <img
            src="/images/why_us_2.png"
            alt={t("home.whyUs.section2.imageAlt")}
            className="h-full object-contain"
            style={{ maxHeight: '891px' }}
          />
        </div>
      </section>

      {/* Why Us - Section 3 */}
      <section className="w-full bg-black px-16 flex justify-start items-center gap-12" style={{ minHeight: '891px' }}>
        {/* Left content */}
        <div className="flex flex-col justify-start items-start gap-12" style={{ width: '384px', flexShrink: 0 }}>
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl font-semibold font-['Inter']" style={{ width: '288px' }}>
              <span className="text-[#ED4C14]">{t("home.whyUs.section3.titleHighlight")}</span>
              <span className="text-[#EFF6FF]">{t("home.whyUs.section3.titleSuffix")}</span>
            </h2>
            <p className="text-[#EFF6FF] text-base font-normal font-['Inter']" style={{ width: '320px' }}>
              {t("home.whyUs.section3.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-center text-white text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Right image */}
        <div className="flex-1 self-stretch flex items-center justify-center">
          <img
            src="/images/why_us_3.png"
            alt={t("home.whyUs.section3.imageAlt")}
            className="h-full object-contain"
            style={{ maxHeight: '891px' }}
          />
        </div>
      </section>

      {/* Why Us - Section 4 */}
      <section className="w-full bg-black px-16 flex justify-start items-center gap-12" style={{ minHeight: '891px' }}>
        {/* Left content */}
        <div className="flex flex-col justify-start items-start gap-12" style={{ width: '452px', flexShrink: 0 }}>
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl font-semibold font-['Inter']" style={{ width: '320px' }}>
              <span className="text-[#ED4C14]">{t("home.whyUs.section4.titleHighlight")}</span>
              <span className="text-[#EFF6FF]">{t("home.whyUs.section4.titleSuffix")}</span>
            </h2>
            <p className="text-[#EFF6FF] text-base font-normal font-['Inter']" style={{ width: '320px' }}>
              {t("home.whyUs.section4.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-center text-white text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Right image */}
        <div className="flex-1 self-stretch flex items-center justify-center">
          <img
            src="/images/why_us_4.png"
            alt={t("home.whyUs.section4.imageAlt")}
            className="h-full object-contain"
            style={{ maxHeight: '891px' }}
          />
        </div>
      </section>

      {/* Templates Section */}
      <section className="w-full py-24 flex flex-col justify-start items-center gap-12 bg-black">
        {/* Header */}
        <div className="w-full px-16 flex justify-start items-center gap-48">
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
              onClick={() => window.location.href = '/templates'}
            >
              <span className="text-center text-blue-950 text-base font-semibold font-['Montserrat'] leading-5">
                {t("nav.templates")}
              </span>
              <ArrowRight className="h-4 w-4 text-blue-950" />
            </button>
          </div>
        </div>

        {/* Carousel rows */}
        <div className="w-full flex flex-col gap-20 overflow-hidden">
          {/* Row 1 — scrolls left */}
          <div className="relative h-96 overflow-hidden">
            <div className="absolute top-0 left-0 flex items-center gap-12 animate-scroll-left" style={{ width: 'max-content' }}>
              {[...Array(2)].flatMap(() => [
                '/images/Rectangle 103.png',
                '/images/Rectangle 104.png',
                '/images/Rectangle 113.png',
                '/images/Rectangle 114.png',
              ]).map((src, i) => (
                <img key={i} src={src} alt={t("home.templatesSection.carouselImageAlt")} className="w-[706px] h-96 rounded-[20px] object-cover flex-shrink-0" />
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative h-96 overflow-hidden">
            <div className="absolute top-0 left-0 flex items-center gap-12 animate-scroll-right" style={{ width: 'max-content' }}>
              {[...Array(2)].flatMap(() => [
                '/images/Rectangle 114.png',
                '/images/Rectangle 113.png',
                '/images/Rectangle 104.png',
                '/images/Rectangle 103.png',
              ]).map((src, i) => (
                <img key={i} src={src} alt={t("home.templatesSection.carouselImageAlt")} className="w-[706px] h-96 rounded-[20px] object-cover flex-shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="w-full pl-16 py-24 bg-black flex justify-start items-center gap-24 overflow-hidden relative">
        {/* Left content */}
        <div className="flex-1 flex flex-col justify-start items-start gap-12 relative z-10">
          <div className="flex flex-col justify-start items-start gap-6">
            <h2 className="text-5xl font-semibold font-['Inter']">
              <span className="text-white">{t("home.addonsSection.titlePrefix")} </span>
              <span className="text-[#ED4C14]">{t("home.addonsSection.titleWebsite")}<br /></span>
              <span className="text-white">{t("home.addonsSection.titleMiddle")} </span>
              <span className="text-[#ED4C14]">{t("home.addonsSection.titleHighlight")}</span>
              <span className="text-white">{t("home.addonsSection.titleSuffix")}</span>
            </h2>
            <p className="text-white text-base font-normal font-['Montserrat'] leading-6 max-w-lg">
              {t("home.addonsSection.description")}
            </p>
          </div>

          <div className="relative w-[520px]">
            {/* Rotated border element below text */}
            <div className="absolute left-0 top-2 w-[420px] h-[260px] pointer-events-none opacity-30">
              <div className="w-full h-full border-2 border-[#ED4C14] origin-top-left rotate-[32.53deg]" />
            </div>

            {/* Accordion */}
            <div className="relative z-10 w-[473px] flex flex-col gap-3">
              {addonCategories.map((cat, i) => (
                <div key={i} className="flex flex-col gap-6">
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left"
                    onClick={() => setOpenAddon(i)}
                  >
                    {openAddon === i && (
                      <ArrowRight className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
                    )}
                    <span className={`text-2xl font-medium font-['Montserrat'] ${openAddon === i ? 'text-white pl-0' : 'text-white/50 pl-8'}`}>
                      {t(cat.titleKey)}
                    </span>
                  </button>
                  {openAddon === i && (
                    <div className="flex flex-col gap-3">
                      <div className="pl-8">
                        <p className="text-white text-base font-normal font-['Montserrat'] leading-6">
                          {t(cat.descriptionKey)}
                        </p>
                      </div>
                      <div className="pl-8 flex items-center gap-2.5 flex-wrap">
                        <span className="text-white text-sm font-semibold font-['Montserrat'] tracking-tight">{t("home.addonsSection.addonsLabel")}</span>
                        {cat.addonKeys.map((addonKey, j) => (
                          <span key={j} className="text-indigo-300 text-sm font-medium font-['Montserrat']">
                            {t(addonKey)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side image space */}
        <div className="w-[793px] h-[799px] flex-shrink-0 relative z-10 rounded-tl-[20px] rounded-bl-[20px] bg-white/10 border border-zinc-700" />
      </section>

      <TestimonialsSection />
      <FaqSection />
      <FinalCtaSection />

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        template={selectedTemplate}
        open={isTemplateModalOpen}
        onOpenChange={handleTemplateModalOpenChange}
      />

    </div>
  );
}