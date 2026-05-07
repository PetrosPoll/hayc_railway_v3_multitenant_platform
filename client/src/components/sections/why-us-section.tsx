import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const WHY_US_SECTION_VIDEOS = [
  {
    desktop: "/videos/1st_section_jwhobw.mp4",
    mobile: "/videos/1st_section_mobile_o5zkhe.mp4",
  },
  {
    desktop: "/videos/2nd_section_cusaq2.mp4",
    mobile: "/videos/2nd_section_mobile_fg7hzr.mp4",
  },
  {
    desktop: "/videos/3rd_section_ywh42w.mp4",
    mobile: "/videos/3rd_section_mobile_nx7tqp.mp4",
  },
  {
    desktop: "/videos/4th_section_pmfk58.mp4",
    mobile: "/videos/4th_section_mobile_okrksl.mp4",
  },
] as const;

export function WhyUsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const GET_STARTED_DEFAULT_PATH = "/get-started";
  const [activeWhyUs, setActiveWhyUs] = useState(0);
  const whyUsSectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const whyUsVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const whyUsSectionWrapperRef = useRef<HTMLDivElement | null>(null);
  const whyUsInnerRowRef = useRef<HTMLDivElement | null>(null);
  const [whyUsPanelMode, setWhyUsPanelMode] = useState<"top" | "fixed" | "bottom">("top");
  const [whyUsPanelLeft, setWhyUsPanelLeft] = useState(0);
  const [whyUsPanelWidth, setWhyUsPanelWidth] = useState(0);

  useEffect(() => {
    const video = whyUsVideoRefs.current[activeWhyUs];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [activeWhyUs]);

  useEffect(() => {
    const handleScroll = () => {
      const wrapper = whyUsSectionWrapperRef.current;
      if (!wrapper) return;
      const innerRow = whyUsInnerRowRef.current;

      const wrapperRect = wrapper.getBoundingClientRect();
      const rowRect = innerRow?.getBoundingClientRect() ?? wrapperRect;
      const leftPanelWidth = 452;
      const newLeft = rowRect.left + leftPanelWidth;
      const newWidth = rowRect.width - leftPanelWidth;
      setWhyUsPanelLeft(newLeft);
      setWhyUsPanelWidth(newWidth);

      const rect = wrapperRect;
      if (rect.top > 0) {
        setWhyUsPanelMode("top");
      } else if (rect.bottom < window.innerHeight) {
        setWhyUsPanelMode("bottom");
      } else {
        setWhyUsPanelMode("fixed");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const WHY_US_SECTIONS = [
    {
      titleHighlight: "Built for founders ",
      titleSuffix: "who want it done right, without doing it all.",
      description: null,
      highlightColor: "#ED4C14",
      suffixColor: "#FFFFFF",
      descColor: "#EFF6FF",
    },
    {
      titleHighlight: t("home.whyUs.section2.titleHighlight"),
      titleSuffix: t("home.whyUs.section2.titleSuffix"),
      description: t("home.whyUs.section2.description"),
      highlightColor: "#ED4C14",
      suffixColor: "#EFF6FF",
      descColor: "#EFF6FF",
    },
    {
      titleHighlight: t("home.whyUs.section3.titleHighlight"),
      titleSuffix: t("home.whyUs.section3.titleSuffix"),
      description: t("home.whyUs.section3.description"),
      highlightColor: "#ED4C14",
      suffixColor: "#EFF6FF",
      descColor: "#EFF6FF",
    },
    {
      titleHighlight: t("home.whyUs.section4.titleHighlight"),
      titleSuffix: t("home.whyUs.section4.titleSuffix"),
      description: t("home.whyUs.section4.description"),
      highlightColor: "#ED4C14",
      suffixColor: "#EFF6FF",
      descColor: "#EFF6FF",
    },
  ] as const;

  return (
    <div className="w-full bg-black overflow-visible">
      <div
        ref={whyUsSectionWrapperRef}
        className="hidden md:block w-full bg-black relative"
      >
        <div ref={whyUsInnerRowRef} className="relative flex gap-0 max-w-screen-xl mx-auto px-4">
          <div
            className={`h-screen flex items-center justify-center z-10 
               pointer-events-none
               ${whyUsPanelMode === "fixed" ? "fixed top-0" : "absolute"}`}
            style={{
              width: `${whyUsPanelWidth}px`,
              left: whyUsPanelMode === "fixed" ? `${whyUsPanelLeft}px` : `452px`,
              top:
                whyUsPanelMode === "top"
                  ? 0
                  : whyUsPanelMode === "bottom"
                    ? `${whyUsSectionWrapperRef.current
                        ? whyUsSectionWrapperRef.current.getBoundingClientRect().height - window.innerHeight
                        : 0}px`
                    : 0,
            }}
          >
            <div className="relative w-full max-w-[600px] h-[500px]">
              {WHY_US_SECTION_VIDEOS.map((video, i) => (
                <video
                  key={i}
                  ref={(el) => {
                    whyUsVideoRefs.current[i] = el;
                  }}
                  className={`absolute inset-0 h-full w-full object-contain
                     transition-opacity duration-700 ease-in-out
                     ${i === activeWhyUs ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  src={video.desktop}
                  autoPlay
                  loop={false}
                  muted
                  playsInline
                  preload="auto"
                  onEnded={
                    i === activeWhyUs
                      ? () => setActiveWhyUs((prev) => (prev + 1) % WHY_US_SECTION_VIDEOS.length)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          <div className="w-[452px]">
            {WHY_US_SECTIONS.map((section, i) => (
              <div
                key={i}
                ref={(el) => {
                  whyUsSectionRefs.current[i] = el;
                }}
                className="min-h-screen flex flex-col justify-center 
                   items-start gap-12 py-24"
              >
                <h2 className="text-5xl font-semibold font-['Montserrat'] 
                       leading-[70px]">
                  <span style={{ color: section.highlightColor }}>
                    {section.titleHighlight}
                  </span>
                  <span style={{ color: section.suffixColor }}>
                    {section.titleSuffix}
                  </span>
                </h2>
                {section.description && (
                  <p
                    className="w-80 text-base font-normal font-['Montserrat'] 
                       leading-6"
                    style={{ color: section.descColor }}
                  >
                    {section.description}
                  </p>
                )}
                <button
                  className="h-11 px-5 py-3.5 bg-[#ED4C14] hover:opacity-80 
                     text-[#EFF6FF] rounded-[10px] inline-flex 
                     justify-start items-center gap-4 transition-opacity"
                  onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
                >
                  <span className="text-base font-semibold font-['Montserrat'] 
                           leading-5">
                    {t("home.hero.cta")}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden">
        {WHY_US_SECTIONS.map((section, i) => (
          <div
            key={i}
            className="flex flex-col justify-start items-start gap-12 py-12"
          >
            <h2 className="text-3xl font-semibold font-['Montserrat'] leading-10">
              <span style={{ color: section.highlightColor }}>
                {section.titleHighlight}
              </span>
              <span style={{ color: section.suffixColor }}>
                {section.titleSuffix}
              </span>
            </h2>
            {section.description && (
              <p
                className="text-base font-normal font-['Montserrat'] leading-5"
                style={{ color: section.descColor }}
              >
                {section.description}
              </p>
            )}
            <button
              className="h-11 px-5 py-3.5 bg-[#ED4C14] hover:opacity-80 
                           text-[#EFF6FF] rounded-[10px] inline-flex 
                           justify-start items-center gap-4 transition-opacity"
              onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
            >
              <span className="text-base font-semibold font-['Montserrat'] leading-5">
                {t("home.hero.cta")}
              </span>
              <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
            </button>
            <div className="w-full">
              <video
                className="h-auto w-full"
                src={WHY_US_SECTION_VIDEOS[i].mobile}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
