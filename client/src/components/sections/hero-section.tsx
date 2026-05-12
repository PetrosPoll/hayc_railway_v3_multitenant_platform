import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroReady } from "@/lib/hero-ready";

/** Static hero bottom cards; index matches hero clip: booking -> 0, LMS -> 1, resort -> 2 */
const HERO_BOTTOM_PREVIEW_IMAGES = [
  "/images/dream_yacht.png",
  "/images/career_courses.png",
  "/images/resort_hotel.png",
] as const;

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const GET_STARTED_DEFAULT_PATH = "/get-started";

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
  const [heroBottomPreviewMotionKey, setHeroBottomPreviewMotionKey] = useState(0);
  const prevHeroSlideForBottomPreviewRef = useRef(currentSlide);

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
        heroReady.signal();
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
      heroReady.signal();
    },
    [heroFullReadyMask],
  );

  const syncHeroReadyFromRefs = useCallback(() => {
    const syncStack = (
      refs: { current: (HTMLVideoElement | null)[] },
      maskRef: { current: number },
      setBuffered: (value: boolean) => void,
    ) => {
      let mask = 0;
      refs.current.forEach((v, i) => {
        if (i >= heroSlideCount) return;
        if (v && v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) mask |= 1 << i;
      });
      maskRef.current |= mask;
      if ((maskRef.current & heroFullReadyMask) === heroFullReadyMask) {
        setBuffered(true);
        heroReady.signal();
      }
    };
    syncStack(desktopVideoRefs, desktopReadyMaskRef, setDesktopVideosBuffered);
    syncStack(mobileVideoRefs, mobileReadyMaskRef, setMobileVideosBuffered);
  }, [heroFullReadyMask, heroSlideCount]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => syncHeroReadyFromRefs());
    const tm = window.setTimeout(syncHeroReadyFromRefs, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(tm);
    };
  }, [isMdUp, syncHeroReadyFromRefs]);

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
    <section className="relative overflow-hidden min-h-screen md:h-[115vh]">
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

      <div className="absolute inset-0 bg-black/50 z-10" />

      <div className="relative z-20 w-full flex flex-col items-center text-center px-4 pt-0 md:pt-[24vh] min-h-[calc(100vh-180px)] md:min-h-0 justify-center">
        <h1 className="text-4xl md:text-6xl font-semibold font-['Montserrat'] text-white max-w-4xl mb-4 md:mb-6 leading-tight">
          A <span className="text-[#ED4C14]">website</span> that works as hard as your business.
        </h1>

        <p className="text-base md:text-2xl font-normal md:font-medium font-['Montserrat'] text-white mb-6 md:mb-8 leading-5">
          {t("home.hero.subtitle")}
        </p>

        <Button
          className="h-11 px-5 py-3.5 bg-[#ED4C14] hover:opacity-80 text-[#EFF6FF] rounded-[10px] text-base font-semibold font-['Montserrat'] leading-5 border-0 group mb-3"
          onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
        >
          {t("home.hero.cta")}
          <ArrowRight className="ml-4 h-4 w-4 text-[#EFF6FF]" />
        </Button>

        <div className="flex flex-col items-center gap-1.5 mb-6">
          <p className="text-sm font-normal font-['Montserrat'] text-slate-100">Simple process. Strong results.</p>
          <p className="text-sm font-normal font-['Montserrat'] text-slate-100">30-day money-back guarantee</p>
        </div>

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

      <div
        className="hidden md:flex absolute bottom-0 left-0 w-full z-20 items-end justify-between overflow-hidden"
        style={{ height: "48vh", gap: "18px" }}
      >
        {(
          [
            {
              slotKey: "left" as const,
              clipIndex: (currentSlide + 2) % heroSlideCount,
              roundClass: "rounded-tr-[20px] rounded-tl-[4px]",
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
              roundClass: "rounded-tl-[20px] rounded-tr-[4px]",
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

      <div
        className="md:hidden absolute bottom-0 left-0 z-20 flex w-full items-end justify-center overflow-hidden"
        style={{ height: "200px" }}
      >
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
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/0 via-black/20 to-black" />
      </div>
    </section>
  );
}
