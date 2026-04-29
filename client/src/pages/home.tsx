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
import { LottieAnimation } from "@/components/ui/lottie-animation";
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
      <section className="relative overflow-hidden md:h-[115vh]">

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
        <div className="relative z-20 w-full flex flex-col items-center text-center px-4 pt-28 md:pt-[12vh]">

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-semibold font-['Montserrat'] text-white max-w-4xl mb-4 md:mb-6 leading-tight">
            A <span className="text-[#ED4C14]">website</span> that works as hard as your business.
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-2xl font-normal md:font-medium font-['Montserrat'] text-white mb-6 md:mb-8 leading-5">
            {t("home.hero.subtitle")}
          </p>

          {/* Avatar circles */}
          <div className="hidden md:flex mb-4">
            <div className="w-8 h-8 rounded-full bg-[#ED4C14] border-2 border-white flex items-center justify-center text-white text-xs font-bold -mr-2 z-10">O</div>
            <div className="w-8 h-8 rounded-full bg-[#182B53] border-2 border-white flex items-center justify-center text-white text-xs font-bold">N</div>
          </div>

          {/* CTA Button */}
          <Button
            className="h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] hover:opacity-80 text-[#0C275F] md:text-[#EFF6FF] rounded-[10px] text-base font-semibold font-['Montserrat'] leading-5 border-0 group mb-3"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {t("home.hero.cta")}
            <ArrowRight className="ml-4 h-4 w-4" />
          </Button>

          {/* Social proof */}
          <div className="flex flex-col items-center gap-1.5 mb-6">
            <p className="text-sm font-normal font-['Montserrat'] text-slate-100">Simple process. Strong results.</p>
            <p className="text-sm font-normal font-['Montserrat'] text-slate-100">30-day money-back guarantee</p>
          </div>

          {/* Slide indicators */}
          <div className="hidden md:flex gap-2 mt-2">
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
        {/* Desktop version */}
        <div className="hidden md:block absolute bottom-0 left-0 w-full z-20 overflow-hidden" style={{ height: '42vh' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/30 to-black z-10 pointer-events-none" />
          <div className="absolute bottom-0 w-full flex items-end overflow-hidden" style={{ gap: '20px', left: '-3%', width: '106%' }}>
            <img src="/images/Rectangle 104.png" alt="Template preview" className="rounded-t-[20px] flex-shrink-0" style={{ width: '31%' }} />
            <img src="/images/Rectangle 113.png" alt="Template preview" className="rounded-t-[20px] flex-shrink-0" style={{ width: '38%' }} />
            <img src="/images/Rectangle 114.png" alt="Template preview" className="rounded-t-[20px] flex-shrink-0" style={{ width: '31%' }} />
          </div>
        </div>

        {/* Mobile previews */}
        <div className="md:hidden relative w-full flex justify-center items-end gap-3 mt-4">
          <img src="/images/Rectangle 104.png" alt="Template preview" className="rounded-[10px] object-cover flex-shrink-0" style={{ width: '43%', height: '144px' }} />
          <img src="/images/Rectangle 113.png" alt="Template preview" className="rounded-[10px] object-cover flex-shrink-0" style={{ width: '55%', height: '187px' }} />
          <img src="/images/Rectangle 114.png" alt="Template preview" className="rounded-[10px] object-cover flex-shrink-0" style={{ width: '43%', height: '144px' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black pointer-events-none" />
        </div>

      </section>

      {/* Why Us - Section 1 */}
      <section className="w-full bg-black px-4 md:px-16 py-12 md:py-0">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-center gap-12 md:min-h-[491px]">
          {/* Left content */}
          <div className="w-full md:flex-col flex flex-col justify-start items-start gap-12 md:w-[452px] md:flex-shrink-0">
          <h2 className="text-3xl md:text-5xl font-semibold font-['Montserrat'] leading-10 md:leading-[70px]">
            <span className="text-white">Built for </span>
            <span className="text-[#ED4C14]">founders </span>
            <span className="text-white">who want it done right, without doing it all.</span>
          </h2>
          <button
            className="h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] hover:opacity-80 text-blue-950 md:text-[#EFF6FF] rounded-[10px] inline-flex justify-start items-center gap-4 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
          </div>

          {/* Right image */}
          <div className="w-full md:flex-1 self-stretch flex items-center justify-center">
            <LottieAnimation
              desktopSrc="/animations/why-us-1.json"
              mobileSrc="/animations/why-us-1-mobile.json"
              className="w-full max-w-[600px]"
            />
          </div>
        </div>
      </section>

      {/* Why Us - Section 2 */}
      <section className="w-full bg-black px-4 md:px-16 py-12 md:py-0">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-center gap-12 md:min-h-[491px]">
          {/* Left content */}
          <div className="w-full flex flex-col justify-start items-start gap-12 md:w-[384px] md:flex-shrink-0">
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl md:text-4xl font-semibold font-['Inter'] w-full md:w-72">
              <span className="text-[#ED4C14]">{t("home.whyUs.section2.titleHighlight")}</span>
              <span className="text-slate-100">{t("home.whyUs.section2.titleSuffix")}</span>
            </h2>
            <p className="w-full md:w-80 text-slate-100 text-base font-normal font-['Inter'] leading-5 md:leading-6">
              {t("home.whyUs.section2.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] hover:opacity-80 text-blue-950 md:text-white rounded-[10px] inline-flex justify-start items-center gap-4 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
          </div>

          {/* Right image */}
          <div className="w-full md:flex-1 self-stretch flex items-center justify-center">
            <LottieAnimation
              desktopSrc="/animations/why-us-2.json"
              mobileSrc="/animations/why-us-2-mobile.json"
              className="w-full max-w-[600px]"
            />
          </div>
        </div>
      </section>

      {/* Why Us - Section 3 */}
      <section className="w-full bg-black px-4 md:px-16 py-12 md:py-0">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-center gap-12 md:min-h-[491px]">
          {/* Left content */}
          <div className="w-full flex flex-col justify-start items-start gap-12 md:w-[384px] md:flex-shrink-0">
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl md:text-4xl font-semibold font-['Inter'] w-full md:w-72">
              <span className="text-[#ED4C14]">{t("home.whyUs.section3.titleHighlight")}</span>
              <span className="text-[#EFF6FF]">{t("home.whyUs.section3.titleSuffix")}</span>
            </h2>
            <p className="w-full md:w-80 text-[#EFF6FF] text-base font-normal font-['Inter'] leading-5 md:leading-6">
              {t("home.whyUs.section3.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] hover:opacity-80 text-blue-950 md:text-white rounded-[10px] inline-flex justify-start items-center gap-4 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
          </div>

          {/* Right image */}
          <div className="w-full md:flex-1 self-stretch flex items-center justify-center">
            <LottieAnimation
              desktopSrc="/animations/why-us-3.json"
              mobileSrc="/animations/why-us-3-mobile.json"
              className="w-full max-w-[600px]"
            />
          </div>
        </div>
      </section>

      {/* Why Us - Section 4 */}
      <section className="w-full bg-black px-4 md:px-16 py-12 md:py-0">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-center gap-12 md:min-h-[491px]">
          {/* Left content */}
          <div className="w-full flex flex-col justify-start items-start gap-12 md:w-[384px] md:flex-shrink-0">
          <div className="flex flex-col justify-start items-start gap-3">
            <h2 className="text-4xl md:text-4xl font-semibold font-['Inter'] w-full md:w-80">
              <span className="text-[#ED4C14]">{t("home.whyUs.section4.titleHighlight")}</span>
              <span className="text-[#EFF6FF]">{t("home.whyUs.section4.titleSuffix")}</span>
            </h2>
            <p className="w-full md:w-80 text-[#EFF6FF] text-base font-normal font-['Inter'] leading-5 md:leading-6">
              {t("home.whyUs.section4.description")}
            </p>
          </div>
          <button
            className="h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] hover:opacity-80 text-blue-950 md:text-white rounded-[10px] inline-flex justify-start items-center gap-4 transition-opacity"
            onClick={() => {
              const pricingSection = document.querySelector('main');
              pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="text-base font-semibold font-['Montserrat'] leading-5">
              {t("home.hero.cta")}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
          </div>

          {/* Right image */}
          <div className="w-full md:flex-1 self-stretch flex items-center justify-center">
            <LottieAnimation
              desktopSrc="/animations/why-us-4.json"
              mobileSrc="/animations/why-us-4-mobile.json"
              className="w-full max-w-[600px]"
            />
          </div>
        </div>
      </section>

      {/* Templates Section */}
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
                onClick={() => window.location.href = '/templates'}
              >
                <span className="text-center text-blue-950 text-base font-semibold font-['Montserrat'] leading-5">
                  {t("nav.templates")}
                </span>
                <ArrowRight className="h-4 w-4 text-blue-950" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden w-full max-w-96 px-4 inline-flex flex-col justify-start items-center gap-12">
          <div className="self-stretch flex flex-col justify-start items-start gap-3">
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
                onClick={() => window.location.href = '/templates'}
              >
                <span className="text-center justify-center text-blue-950 text-base font-semibold font-['Montserrat'] leading-5">
                  {t("home.hero.cta")}
                </span>
                <ArrowRight className="w-4 h-4 text-blue-950" />
              </button>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-center gap-3">
            <div className="w-full h-60 relative overflow-hidden">
              <div className="absolute left-0 top-0 inline-flex justify-start items-center gap-6 animate-scroll-left" style={{ width: 'max-content' }}>
                {[...Array(3)].flatMap(() => [
                  '/images/Rectangle 103.png',
                  '/images/Rectangle 104.png',
                  '/images/Rectangle 113.png',
                  '/images/Rectangle 114.png',
                ]).map((src, i) => (
                  <img key={`mobile-row1-${i}`} className="w-96 h-60 rounded-[20px] object-cover flex-shrink-0" src={src} alt={t("home.templatesSection.carouselImageAlt")} />
                ))}
              </div>
            </div>
            <div className="w-full h-60 relative overflow-hidden">
              <div className="absolute left-0 top-0 inline-flex justify-start items-center gap-6 animate-scroll-right" style={{ width: 'max-content' }}>
                {[...Array(3)].flatMap(() => [
                  '/images/Rectangle 114.png',
                  '/images/Rectangle 113.png',
                  '/images/Rectangle 104.png',
                  '/images/Rectangle 103.png',
                ]).map((src, i) => (
                  <img key={`mobile-row2-${i}`} className="w-96 h-60 rounded-[20px] object-cover flex-shrink-0" src={src} alt={t("home.templatesSection.carouselImageAlt")} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Carousel rows */}
        <div className="hidden md:flex w-full flex-col gap-20 overflow-hidden">
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
      <section className="w-full px-4 md:px-16 py-12 md:py-24 bg-black overflow-hidden relative">
        {/* <div className="hidden md:flex absolute right-[340px] top-1/2 -translate-y-1/2 w-[400px] h-[400px] items-center justify-center pointer-events-none z-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24.24 23.468"
            className="w-56 h-56"
            fill="none"
          >
            <path
              d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
              fill="#ED4C14"
              opacity="0.35"
            />
          </svg>
        </div> */}

        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-start md:items-center gap-12 md:gap-24">
          {/* Left content */}
          <div className="w-full md:flex-1 flex flex-col justify-start items-start gap-12 relative z-10 md:max-w-2xl">
          <div className="flex flex-col justify-start items-start gap-6">
            <h2 className="text-3xl md:text-5xl font-semibold font-['Inter'] leading-10 md:leading-normal">
              <span className="text-white">Your </span>
              <span className="text-[#ED4C14]">website<br /></span>
              <span className="text-white">can </span>
              <span className="text-[#ED4C14]">grow</span>
              <span className="text-white"> with you.</span>
            </h2>
            <p className="text-white text-base font-normal font-['Montserrat'] leading-5 md:leading-6 max-w-full md:max-w-lg">
              {t("home.addonsSection.description")}
            </p>
          </div>

          {/* Accordion */}
          <div className="w-full md:w-[473px] flex flex-col gap-3">
            {addonCategories.map((cat, i) => {
              const isOpen = openAddon === i;
              return (
                <div
                  key={i}
                  className="w-full md:w-auto py-3 border-b border-black/30 md:border-none flex flex-col gap-6"
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setOpenAddon(i)}
                  >
                    {isOpen && (
                      <ArrowRight className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
                    )}
                    <span className={`font-['Montserrat'] font-medium ${
                      isOpen
                        ? 'text-2xl text-white'
                        : 'text-xl md:text-2xl text-white/50 leading-7'
                    }`}>
                      {t(cat.titleKey)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-3">
                      <div className="pl-8">
                        <p className="text-white text-base font-normal font-['Montserrat'] leading-5">
                          {t(cat.descriptionKey)}
                        </p>
                      </div>
                      <div className="pl-8 flex flex-col md:flex-row items-start md:items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold font-['Montserrat'] tracking-tight">{t("home.addonsSection.addonsLabel")}</span>
                        <div className="flex flex-col md:flex-row gap-1 md:gap-2.5">
                          {cat.addonKeys.map((addonKey, j) => (
                            <span key={j} className="text-indigo-300 text-sm font-medium font-['Montserrat']">
                              {t(addonKey)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <img
                        src="/images/addons_section.png"
                        alt={t(cat.titleKey)}
                        className="md:hidden w-full rounded-[20px] object-cover mt-3"
                        style={{ height: '320px' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>

          {/* Right side image space */}
          <div className="hidden md:flex w-[793px] h-[799px] flex-shrink-0 relative z-10">
            <img
              src="/images/addons_section.png"
              alt="Add-ons illustration"
              className="w-full h-full object-cover rounded-tl-[20px] rounded-bl-[20px]"
            />
          </div>
        </div>
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