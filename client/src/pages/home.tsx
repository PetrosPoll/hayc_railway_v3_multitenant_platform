import { useNavigate } from "react-router-dom";
import { type User, type Subscription } from "@shared/schema";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
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
import { HowWeWorkSection } from "@/components/sections/how-we-work-section";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import type { Template } from "@shared/schema";
import { GET_STARTED_DEFAULT_PATH } from "@/lib/get-started-default-path";

// Selected templates to display on home page carousel
// You can change these IDs to display different templates
const SELECTED_TEMPLATE_IDS = [1, 5, 10, 15, 20, 25, 30, 35];

/** Static hero bottom cards; index matches hero clip: booking → 0, LMS → 1, resort → 2 */
const HERO_BOTTOM_PREVIEW_IMAGES = [
  "/images/dream_yacht.png",
  "/images/career_courses.png",
  "/images/resort_hotel.png",
] as const;

function shufflePreviewUrlsOnce(previews: string[]): string[] {
  const arr = [...previews];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

  /** One shuffle per marquee row over full ENVATO preview list (-50% loop needs two identical copies concatenated below). */
  const templatesMarqueeRow1Previews = useMemo(() => shufflePreviewUrlsOnce(ENVATO_TEMPLATES.map((t) => t.preview)), []);

  const templatesMarqueeRow2Previews = useMemo(() => shufflePreviewUrlsOnce(ENVATO_TEMPLATES.map((t) => t.preview)), []);

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

  const heroDesktopVideos = [
    "/videos/booking_p5ifxx.mp4",
    "/videos/LMS_rykuy0.mp4",
    "/videos/Luxury_resort_pbrj1p.mp4",
  ] as const;
  const heroMobileVideos = [
    "/videos/booking_mobile_vnztu8.mp4",
    "/videos/LMS_-_mobile_smautk.mp4",
    "/videos/Luxury_resort_mobile_rhantd.mp4",
  ] as const;

  const heroSlideCount = heroDesktopVideos.length;
  const heroFullReadyMask = (1 << heroSlideCount) - 1;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true,
  );
  const [desktopVideosBuffered, setDesktopVideosBuffered] = useState(false);
  const [mobileVideosBuffered, setMobileVideosBuffered] = useState(false);
  const mobileVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const desktopVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const desktopReadyMaskRef = useRef(0);
  const mobileReadyMaskRef = useRef(0);
  const prevIsMdUpRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsMdUp(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const markHeroClipReady = useCallback(
    (which: "desktop" | "mobile", index: number) => {
      const maskRef = which === "desktop" ? desktopReadyMaskRef : mobileReadyMaskRef;
      const setBuffered =
        which === "desktop" ? setDesktopVideosBuffered : setMobileVideosBuffered;
      maskRef.current |= 1 << index;
      if ((maskRef.current & heroFullReadyMask) === heroFullReadyMask) {
        setBuffered(true);
      }
    },
    [heroFullReadyMask],
  );

  const tolerateHeroClipError = useCallback(
    (which: "desktop" | "mobile") => {
      const maskRef = which === "desktop" ? desktopReadyMaskRef : mobileReadyMaskRef;
      const setBuffered =
        which === "desktop" ? setDesktopVideosBuffered : setMobileVideosBuffered;
      maskRef.current = heroFullReadyMask;
      setBuffered(true);
    },
    [heroFullReadyMask],
  );

  const syncHeroReadyFromRefs = useCallback(() => {
    const syncStack = (
      refs: React.MutableRefObject<(HTMLVideoElement | null)[]>,
      maskRef: React.MutableRefObject<number>,
      setBuffered: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      let mask = 0;
      refs.current.forEach((v, i) => {
        if (i >= heroSlideCount) return;
        if (v?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) mask |= 1 << i;
      });
      maskRef.current |= mask;
      if ((maskRef.current & heroFullReadyMask) === heroFullReadyMask) {
        setBuffered(true);
      }
    };
    syncStack(desktopVideoRefs, desktopReadyMaskRef, setDesktopVideosBuffered);
    syncStack(mobileVideoRefs, mobileReadyMaskRef, setMobileVideosBuffered);
  }, [heroFullReadyMask, heroSlideCount]);

  useLayoutEffect(() => {
    syncHeroReadyFromRefs();
  }, [syncHeroReadyFromRefs]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => syncHeroReadyFromRefs());
    const t = window.setTimeout(syncHeroReadyFromRefs, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [isMdUp, syncHeroReadyFromRefs]);

  /** On breakpoint change: reset readiness for newly active stack & apply new preload via load(). */
  useEffect(() => {
    if (prevIsMdUpRef.current === undefined) {
      prevIsMdUpRef.current = isMdUp;
      return;
    }
    if (prevIsMdUpRef.current === isMdUp) return;
    prevIsMdUpRef.current = isMdUp;

    if (isMdUp) {
      desktopReadyMaskRef.current = 0;
      setDesktopVideosBuffered(false);
    } else {
      mobileReadyMaskRef.current = 0;
      setMobileVideosBuffered(false);
    }

    requestAnimationFrame(() => {
      desktopVideoRefs.current.forEach((v) => {
        if (v) void v.load();
      });
      mobileVideoRefs.current.forEach((v) => {
        if (v) void v.load();
      });
      syncHeroReadyFromRefs();
    });
  }, [isMdUp, syncHeroReadyFromRefs]);

  useEffect(() => {
    mobileVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (!isMdUp) {
        if (i === currentSlide) {
          v.currentTime = 0;
          void v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      } else {
        v.pause();
      }
    });
    desktopVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (isMdUp) {
        if (i === currentSlide) {
          v.currentTime = 0;
          void v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      } else {
        v.pause();
      }
    });
  }, [currentSlide, isMdUp]);

  const [heroBottomPreviewMotionKey, setHeroBottomPreviewMotionKey] = useState(0);
  const prevHeroSlideForBottomPreviewRef = useRef(currentSlide);

  useEffect(() => {
    if (prevHeroSlideForBottomPreviewRef.current !== currentSlide) {
      setHeroBottomPreviewMotionKey((k) => k + 1);
      prevHeroSlideForBottomPreviewRef.current = currentSlide;
    }
  }, [currentSlide]);

  const handleHeroVideoEnded = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlideCount);
  }, [heroSlideCount]);

  return (
    <div className="min-h-screen bg-background  mt-md-[65px]">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-screen md:h-[115vh]">

        {/* Background video rotation (both stacks mount so preload is not skipped by display:none) */}
        <div className="absolute inset-0 overflow-hidden bg-black">
          <div
            className={`absolute inset-0 transition-opacity duration-500 ease-out ${
              !isMdUp
                ? "pointer-events-none -z-[1] opacity-0"
                : desktopVideosBuffered
                  ? "z-0 opacity-100"
                  : "z-0 opacity-0"
            }`}
          >
            {heroDesktopVideos.map((src, i) => (
              <video
                key={src}
                ref={(el) => {
                  desktopVideoRefs.current[i] = el;
                }}
                className={`absolute inset-0 h-full w-full transform-gpu object-cover transition-opacity duration-700 ease-in-out ${
                  i === currentSlide ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none"
                }`}
                src={src}
                muted
                playsInline
                preload={isMdUp ? "auto" : "metadata"}
                disablePictureInPicture
                disableRemotePlayback
                onCanPlayThrough={() => markHeroClipReady("desktop", i)}
                onError={() => tolerateHeroClipError("desktop")}
                onEnded={handleHeroVideoEnded}
              />
            ))}
          </div>
          <div
            className={`absolute inset-0 transition-opacity duration-500 ease-out ${
              isMdUp
                ? "pointer-events-none -z-[1] opacity-0"
                : mobileVideosBuffered
                  ? "z-0 opacity-100"
                  : "z-0 opacity-0"
            }`}
          >
            {heroMobileVideos.map((src, i) => (
              <video
                key={src}
                ref={(el) => {
                  mobileVideoRefs.current[i] = el;
                }}
                className={`absolute inset-0 h-full w-full transform-gpu object-cover transition-opacity duration-700 ease-in-out ${
                  i === currentSlide ? "opacity-100 z-[1]" : "opacity-0 z-0 pointer-events-none"
                }`}
                src={src}
                muted
                playsInline
                preload={!isMdUp ? "auto" : "metadata"}
                disablePictureInPicture
                disableRemotePlayback
                onCanPlayThrough={() => markHeroClipReady("mobile", i)}
                onError={() => tolerateHeroClipError("mobile")}
                onEnded={handleHeroVideoEnded}
              />
            ))}
          </div>
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50 z-10" />

        {/* Main content */}
        <div className="relative z-20 w-full flex flex-col items-center text-center px-4 pt-0 md:pt-[12vh] min-h-[calc(100vh-180px)] md:min-h-0 justify-center">

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
            onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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
            {Array.from({ length: heroSlideCount }, (_, i) => (
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

        {/* Desktop version — images permuted with hero slide (same rhythm as videos) */}
        <div
          className="hidden md:flex absolute bottom-0 left-0 w-full z-20 items-end justify-between overflow-hidden"
          style={{ height: "48vh", gap: "18px" }}
        >
          {(
            [
              {
                slotKey: "left" as const,
                clipIndex: (currentSlide + 2) % heroSlideCount,
                roundClass:
                  "rounded-tr-[20px] rounded-tl-[4px]",
                widthPct: "31%",
                heightPct: "75%",
                motionClass:
                  heroBottomPreviewMotionKey > 0
                    ? "hero-preview-desk-slot-left"
                    : "",
              },
              {
                slotKey: "center" as const,
                clipIndex: currentSlide,
                roundClass: "rounded-t-[20px]",
                widthPct: "38%",
                heightPct: "92%",
                motionClass:
                  heroBottomPreviewMotionKey > 0
                    ? "hero-preview-desk-slot-center"
                    : "",
              },
              {
                slotKey: "right" as const,
                clipIndex: (currentSlide + 1) % heroSlideCount,
                roundClass:
                  "rounded-tl-[20px] rounded-tr-[4px]",
                widthPct: "31%",
                heightPct: "75%",
                motionClass:
                  heroBottomPreviewMotionKey > 0
                    ? "hero-preview-desk-slot-right"
                    : "",
              },
            ] as const
          ).map(
            ({
              slotKey,
              clipIndex,
              roundClass,
              widthPct,
              heightPct,
              motionClass,
            }) => (
              <div
                key={`${slotKey}-${currentSlide}`}
                className={`relative flex-shrink-0 overflow-hidden self-end bg-black ${roundClass} ${motionClass}`}
                style={{
                  width: widthPct,
                  height: heightPct,
                }}
              >
                <img
                  src={HERO_BOTTOM_PREVIEW_IMAGES[clipIndex]}
                  alt="Template preview"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              </div>
            ),
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/0 via-black/20 to-black" />
        </div>

        {/* Mobile version — layered layout; assets rotate with hero slide */}
        <div
          className="md:hidden absolute bottom-0 left-0 z-20 flex w-full items-end justify-center overflow-hidden"
          style={{ height: "200px" }}
        >
          {/* Left card — just a sliver peeking in */}
          <img
            key={`m-left-${currentSlide}`}
            src={HERO_BOTTOM_PREVIEW_IMAGES[(currentSlide + 2) % heroSlideCount]}
            alt="Template preview"
            className="flex-shrink-0 rounded-[10px] object-cover object-top"
            style={{
              width: "230px",
              height: "144px",
              marginRight: "-100px",
              zIndex: 1,
            }}
          />
          {/* Center card — dominant */}
          <img
            key={`m-center-${currentSlide}`}
            src={HERO_BOTTOM_PREVIEW_IMAGES[currentSlide]}
            alt="Template preview"
            className="flex-shrink-0 rounded-t-[10px] object-cover object-top"
            style={{
              width: "300px",
              height: "187px",
              zIndex: 2,
              position: "relative",
            }}
          />
          {/* Right card — just a sliver peeking in */}
          <img
            key={`m-right-${currentSlide}`}
            src={HERO_BOTTOM_PREVIEW_IMAGES[(currentSlide + 1) % heroSlideCount]}
            alt="Template preview"
            className="flex-shrink-0 rounded-[10px] object-cover object-top"
            style={{
              width: "230px",
              height: "144px",
              marginLeft: "-100px",
              zIndex: 1,
            }}
          />
          {/* Gradient fade to black */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/0 via-black/20 to-black" />
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
            onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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
            onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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
            onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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
            onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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

      {/* How We Work Section */}
      {/* <HowWeWorkSection /> */}

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
                onClick={() => navigate('/templates')}
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
                onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
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
                {[...templatesMarqueeRow1Previews, ...templatesMarqueeRow1Previews].map((src, i) => (
                  <img key={`mobile-row1-${i}`} className="w-96 h-60 rounded-[20px] object-cover flex-shrink-0" src={src} alt={t("home.templatesSection.carouselImageAlt")} />
                ))}
              </div>
            </div>
            <div className="w-full h-60 relative overflow-hidden">
              <div className="absolute left-0 top-0 inline-flex justify-start items-center gap-6 animate-scroll-right" style={{ width: 'max-content' }}>
                {[...templatesMarqueeRow2Previews, ...templatesMarqueeRow2Previews].map((src, i) => (
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
              {[...templatesMarqueeRow1Previews, ...templatesMarqueeRow1Previews].map((src, i) => (
                <img key={i} src={src} alt={t("home.templatesSection.carouselImageAlt")} className="w-[706px] h-96 rounded-[20px] object-cover flex-shrink-0" />
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative h-96 overflow-hidden">
            <div className="absolute top-0 left-0 flex items-center gap-12 animate-scroll-right" style={{ width: 'max-content' }}>
              {[...templatesMarqueeRow2Previews, ...templatesMarqueeRow2Previews].map((src, i) => (
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
                      {/* <img
                        src="/images/addons_section.png"
                        alt={t(cat.titleKey)}
                        className="md:hidden w-full h-[320px] rounded-[20px] object-cover mt-3"
                        style={{ height: '320px' }}
                      /> */}
                      <div className="md:hidden w-full h-[320px] bg-neutral-700/30 rounded-[20px] mt-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>

          {/* Right side image space */}
          <div className="hidden md:flex w-[793px] h-[799px] flex-shrink-0 relative z-10">
            {/* <img
              src="/images/addons_section.png"
              alt="Add-ons illustration"
              className="w-full h-full object-cover rounded-tl-[20px] rounded-bl-[20px]"
            /> */}
                      <div className="w-full w-[793px] h-[799px] bg-neutral-700/30 rounded-[20px] md:rounded-tl-[20px] md:rounded-bl-[20px] md:rounded-tr-none md:rounded-br-none" />

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