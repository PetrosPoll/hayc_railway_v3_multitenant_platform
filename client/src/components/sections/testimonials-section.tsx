import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  useSyncExternalStore,
} from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Testimonial = {
  nameKey: string;
  titleKey: string;
  rating: number;
  textKey: string;
  avatar: string | null;
  projectUrl: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    nameKey: "home.testimonialsSection.items.0.name",
    titleKey: "home.testimonialsSection.items.0.title",
    rating: 4.8,
    textKey: "home.testimonialsSection.items.0.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.1.name",
    titleKey: "home.testimonialsSection.items.1.title",
    rating: 4.9,
    textKey: "home.testimonialsSection.items.1.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.2.name",
    titleKey: "home.testimonialsSection.items.2.title",
    rating: 4.7,
    textKey: "home.testimonialsSection.items.2.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.3.name",
    titleKey: "home.testimonialsSection.items.3.title",
    rating: 5,
    textKey: "home.testimonialsSection.items.3.text",
    avatar: null,
    projectUrl: "#",
  },
];

/** Layers behind active card for deck effect (1 = peek closest, STACK_BACK_LAYERS = furthest). */
const STACK_BACK_LAYERS = 3;
/** Frame 656px, card 572px → 84px gutter split across stacked layers (Figma deck). */
const DECK_FRAME_W = 656;
const DECK_CARD_W = 572;
const DECK_OFFSET_STEP_MD = (DECK_FRAME_W - DECK_CARD_W) / STACK_BACK_LAYERS;
/**
 * Mobile stack: horizontal offset per layer (no scale).
 * Keep deck tray `pr-*` ≥ `STACK_BACK_LAYERS * DECK_OFFSET_STEP_SM` (+ ~1rem) so back cards aren’t clipped.
 */
const DECK_OFFSET_STEP_SM = 22;
const DECK_TRANSITION_MS = 380;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function snapshotReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function serverSnapshotReducedMotion() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, snapshotReducedMotion, serverSnapshotReducedMotion);
}

function subscribeMdUp(onChange: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function snapshotMdUp() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function serverSnapshotMdUp() {
  return false;
}

function useMdUpBreakpoint() {
  return useSyncExternalStore(subscribeMdUp, snapshotMdUp, serverSnapshotMdUp);
}

function testimonialDeckIndex(activeIndex: number, slotBehind: number) {
  return (activeIndex + slotBehind) % TESTIMONIALS.length;
}

type TestimonialCardProps = {
  dataIndex: number;
  isFront: boolean;
  t: TFunction;
  altKeys: {
    avatar: string;
    fullStar: string;
    halfStar: string;
    seeProject: string;
    arrowDecor: string;
  };
  className?: string;
  style?: CSSProperties;
};

function TestimonialCard({
  dataIndex,
  isFront,
  t,
  altKeys,
  className,
  style,
}: TestimonialCardProps) {
  const item = TESTIMONIALS[dataIndex];
  return (
    <div
      className={cn(
        "flex h-[32rem] w-full shrink-0 flex-col justify-between gap-0 overflow-hidden rounded-[20px] bg-zinc-950 p-6 outline outline-1 outline-offset-[-1px] outline-zinc-800 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none md:h-96 md:max-w-[572px]",
        className,
      )}
      style={style}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 flex-col items-start gap-6 md:flex-row md:items-center md:justify-start">
          {item.avatar ? (
            <img
              src={item.avatar}
              alt={altKeys.avatar}
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-24 w-24 shrink-0 rounded-full bg-zinc-300" />
          )}
          <div className="flex min-w-0 w-44 flex-col justify-center gap-3">
            <div className="flex flex-col">
              <span className="text-[#ED4C14] font-['Montserrat'] text-xl font-medium leading-7 md:text-2xl">
                {t(item.nameKey)}
              </span>
              <span className="font-['Montserrat'] text-base font-normal leading-5 text-slate-50 md:text-lg md:font-medium">
                {t(item.titleKey)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-['Inter'] text-lg font-medium text-slate-100 md:font-['Montserrat'] md:text-slate-50">
                {item.rating}
              </span>
              <StarRating
                rating={item.rating}
                fullStarAlt={altKeys.fullStar}
                halfStarAlt={altKeys.halfStar}
              />
            </div>
          </div>
        </div>
        <p
          className={cn(
            "min-h-0 text-slate-50 font-['Montserrat'] text-base font-normal leading-5 md:leading-6",
            isFront
              ? "flex-1 overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin] md:flex-none md:overflow-visible md:[scrollbar-gutter:auto]"
              : "line-clamp-[7] overflow-hidden opacity-95 md:line-clamp-3",
          )}
        >
          {t(item.textKey)}
        </p>
      </div>
      {isFront ? (
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-4 self-start rounded-[10px] bg-indigo-300 px-5 py-3.5 transition-opacity hover:opacity-90 md:bg-[#A0BAF3]"
          onClick={() => {
            window.location.href = item.projectUrl;
          }}
        >
          <span className="font-['Montserrat'] text-base font-semibold leading-5 text-zinc-950 md:text-blue-950">{t(altKeys.seeProject)}</span>
          <ArrowRight className="size-4 shrink-0 text-zinc-950 md:text-blue-950" aria-hidden />
        </button>
      ) : (
        <div
          className="flex h-11 w-full max-w-[200px] min-w-[10rem] shrink-0 items-center justify-center self-start rounded-[10px] bg-zinc-800/50 md:w-[calc(40%+96px)]"
          aria-hidden
        />
      )}
    </div>
  );
}

function StarRating({ rating, fullStarAlt, halfStarAlt }: { rating: number; fullStarAlt: string; halfStarAlt: string }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<img key={i} src="/images/testimonials_full_star.svg" alt={fullStarAlt} className="w-4 h-4" />);
    } else if (i === Math.ceil(rating) && rating % 1 >= 0.4) {
      stars.push(<img key={i} src="/images/testimonials_half_star.svg" alt={halfStarAlt} className="w-4 h-4" />);
    }
  }
  return <div className="flex items-center gap-1.5">{stars}</div>;
}

export function TestimonialsSection() {
  const { t } = useTranslation();
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [deckExit, setDeckExit] = useState<{ fromIdx: number; dir: -1 | 1; nonce: number } | null>(null);
  const isMdUp = useMdUpBreakpoint();
  const prefersReducedMotion = usePrefersReducedMotion();
  const deckAnimatingRef = useRef(false);
  const exitNonceRef = useRef(0);
  const exitTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
      }
    },
    [],
  );

  const navigateDeck = useCallback(
    (step: -1 | 1) => {
      const next = (testimonialIndex + step + TESTIMONIALS.length) % TESTIMONIALS.length;
      if (prefersReducedMotion) {
        setTestimonialIndex(next);
        return;
      }
      if (deckAnimatingRef.current) return;
      const fromIdx = testimonialIndex;
      if (next === fromIdx) return;

      deckAnimatingRef.current = true;
      exitNonceRef.current += 1;
      const nonce = exitNonceRef.current;
      setDeckExit({ fromIdx, dir: step, nonce });
      setTestimonialIndex(next);

      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
      }
      exitTimeoutRef.current = window.setTimeout(() => {
        exitTimeoutRef.current = null;
        setDeckExit(null);
        deckAnimatingRef.current = false;
      }, DECK_TRANSITION_MS);
    },
    [prefersReducedMotion, testimonialIndex],
  );

  const deckAltKeys = {
    avatar: t("home.testimonialsSection.avatarAlt"),
    fullStar: t("home.testimonialsSection.fullStarAlt"),
    halfStar: t("home.testimonialsSection.halfStarAlt"),
    seeProject: "home.testimonialsSection.seeProject",
    arrowDecor: "home.testimonialsSection.arrowAlt",
  } as const;

  return (
    <section className="w-full px-4 md:px-16 py-12 md:py-24 bg-black">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start md:justify-between items-start gap-12">
        <div className="w-full md:w-auto flex flex-col justify-center items-start gap-6">
        <div className="flex flex-col justify-start items-start gap-3">
          <h2 className="text-3xl md:text-5xl font-semibold font-['Montserrat'] leading-10 md:leading-[70px]">
            <span className="text-[#ED4C14]">{t("home.testimonialsSection.titleHighlight")}</span>
            <span className="text-white"> {t("home.testimonialsSection.titleSuffix")}</span>
          </h2>
          <p className="text-white text-base font-normal font-['Montserrat'] leading-5 md:leading-6">
            {t("home.testimonialsSection.subtitle")}
          </p>
        </div>

        <div className="w-full md:w-[572px] flex flex-col gap-3">
          <div className="w-full p-6 bg-[#404040]/20 rounded-[20px] outline outline-1 outline-zinc-800 flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <img src="/images/testimonials_facebook.svg" alt={t("home.testimonialsSection.platforms.facebook.alt")} className="w-4 h-4" />
                <span className="text-blue-400 text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.facebook.name")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-lg font-medium font-['Montserrat']">5.0</span>
                <StarRating
                  rating={5}
                  fullStarAlt={t("home.testimonialsSection.fullStarAlt")}
                  halfStarAlt={t("home.testimonialsSection.halfStarAlt")}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.common.basedOn")}</span>
                <span className="text-white text-lg font-medium font-['Montserrat']">5</span>
                <span className="text-white text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.common.reviews")}</span>
              </div>
            </div>
            <img src="/images/testimonials_export.svg" alt={t("home.testimonialsSection.platforms.common.externalLinkAlt")} className="w-6 h-6 opacity-80" />
          </div>

          <div className="w-full p-6 bg-[#404040]/20 rounded-[20px] outline outline-1 outline-zinc-800 flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <img src="/images/testimonials_trustpilot.svg" alt={t("home.testimonialsSection.platforms.trustpilot.alt")} className="w-4 h-4" />
                <span className="text-green-400 text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.trustpilot.name")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-lg font-medium font-['Montserrat']">4.4</span>
                <StarRating
                  rating={4.4}
                  fullStarAlt={t("home.testimonialsSection.fullStarAlt")}
                  halfStarAlt={t("home.testimonialsSection.halfStarAlt")}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.common.basedOn")}</span>
                <span className="text-white text-lg font-medium font-['Montserrat']">5</span>
                <span className="text-white text-lg font-medium font-['Montserrat']">{t("home.testimonialsSection.platforms.common.reviews")}</span>
              </div>
            </div>
            <img src="/images/testimonials_export.svg" alt={t("home.testimonialsSection.platforms.common.externalLinkAlt")} className="w-6 h-6 opacity-80" />
          </div>
        </div>
        </div>

        <div className="flex w-full flex-col gap-6 md:w-[656px] md:max-w-none md:items-end">
        <div className="relative isolate min-h-[32rem] w-full pr-20 md:h-96 md:min-h-96 md:w-[656px] md:max-w-[656px] md:pr-0">
          {Array.from({ length: STACK_BACK_LAYERS }, (_, i) => STACK_BACK_LAYERS - i).map((slotBehind) => {
            const dx = isMdUp ? slotBehind * DECK_OFFSET_STEP_MD : slotBehind * DECK_OFFSET_STEP_SM;
            const opacity = isMdUp
              ? Math.max(0.52, 0.92 - slotBehind * 0.13)
              : Math.max(0.45, 0.9 - slotBehind * 0.14);
            const transform = `translateX(${dx}px)`;
            return (
              <TestimonialCard
                key={`deck-back-${slotBehind}`}
                dataIndex={testimonialDeckIndex(testimonialIndex, slotBehind)}
                isFront={false}
                t={t}
                altKeys={deckAltKeys}
                className="pointer-events-none absolute left-0 top-0 w-full origin-top-left shadow-none md:max-w-[572px]"
                style={{
                  zIndex: 5 + slotBehind * 10,
                  transform,
                  opacity,
                }}
              />
            );
          })}
          <TestimonialCard
            dataIndex={testimonialIndex}
            isFront
            t={t}
            altKeys={deckAltKeys}
            className="relative z-[50] shadow-[0_12px_40px_-25px_rgba(0,0,0,0.65)]"
          />
          {deckExit !== null ? (
            <div
              key={`deck-exit-${deckExit.nonce}`}
              className={cn(
                "pointer-events-none absolute left-0 top-0 z-[55] w-full max-w-none origin-top-left will-change-transform md:max-w-[572px]",
                deckExit.dir === 1 ? "animate-testimonial-deck-exit-left" : "animate-testimonial-deck-exit-right",
              )}
              aria-hidden
            >
              <TestimonialCard
                dataIndex={deckExit.fromIdx}
                isFront
                t={t}
                altKeys={deckAltKeys}
                className="shadow-[0_12px_40px_-25px_rgba(0,0,0,0.65)]"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-12 self-end">
          <button
            type="button"
            className="hover:opacity-70 transition-opacity"
            onClick={() => navigateDeck(-1)}
          >
            <img src="/images/testimonials_orange_arrow.svg" alt={t("home.testimonialsSection.previousAlt")} className="w-11 h-9 rotate-180" />
          </button>
          <button
            type="button"
            className="hover:opacity-70 transition-opacity"
            onClick={() => navigateDeck(1)}
          >
            <img src="/images/testimonials_orange_arrow.svg" alt={t("home.testimonialsSection.nextAlt")} className="w-11 h-9" />
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}

