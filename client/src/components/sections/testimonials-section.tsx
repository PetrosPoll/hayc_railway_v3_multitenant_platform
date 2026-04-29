import { useState } from "react";
import { useTranslation } from "react-i18next";

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
    rating: 4.4,
    textKey: "home.testimonialsSection.items.0.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.1.name",
    titleKey: "home.testimonialsSection.items.1.title",
    rating: 4.4,
    textKey: "home.testimonialsSection.items.1.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.2.name",
    titleKey: "home.testimonialsSection.items.2.title",
    rating: 4.4,
    textKey: "home.testimonialsSection.items.2.text",
    avatar: null,
    projectUrl: "#",
  },
  {
    nameKey: "home.testimonialsSection.items.3.name",
    titleKey: "home.testimonialsSection.items.3.title",
    rating: 4.4,
    textKey: "home.testimonialsSection.items.3.text",
    avatar: null,
    projectUrl: "#",
  },
];

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

        <div className="w-full md:w-[656px] flex flex-col items-start md:items-end gap-6">
        <div className="w-full md:w-[572px] p-6 bg-zinc-950 md:bg-zinc-950 rounded-[20px] outline outline-1 outline-zinc-800 flex flex-col justify-between items-start backdrop-blur-md md:backdrop-blur-none" style={{ minHeight: '384px' }}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {TESTIMONIALS[testimonialIndex].avatar ? (
                <img src={TESTIMONIALS[testimonialIndex].avatar!} alt={t("home.testimonialsSection.avatarAlt")} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 bg-zinc-300 rounded-full" />
              )}
              <div className="flex flex-col justify-center items-start gap-3">
                <div className="flex flex-col">
                  <span className="text-[#ED4C14] text-xl md:text-2xl font-medium font-['Montserrat'] leading-7">{t(TESTIMONIALS[testimonialIndex].nameKey)}</span>
                  <span className="text-slate-50 text-base font-normal md:font-medium font-['Montserrat'] leading-5">{t(TESTIMONIALS[testimonialIndex].titleKey)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-100 text-lg font-medium font-['Inter']">{TESTIMONIALS[testimonialIndex].rating}</span>
                  <StarRating
                    rating={TESTIMONIALS[testimonialIndex].rating}
                    fullStarAlt={t("home.testimonialsSection.fullStarAlt")}
                    halfStarAlt={t("home.testimonialsSection.halfStarAlt")}
                  />
                </div>
              </div>
            </div>
            <p className="text-slate-50 text-base font-normal font-['Montserrat'] leading-5">
              {t(TESTIMONIALS[testimonialIndex].textKey)}
            </p>
          </div>
          <button
            className="mt-6 h-11 px-5 py-3.5 bg-[#A0BAF3] md:bg-[#ED4C14] rounded-[10px] inline-flex items-center gap-4 hover:opacity-80 transition-opacity"
            onClick={() => {
              window.location.href = TESTIMONIALS[testimonialIndex].projectUrl;
            }}
          >
            <span className="text-zinc-950 md:text-[#EFF6FF] text-base font-semibold font-['Montserrat'] leading-5">{t("home.testimonialsSection.seeProject")}</span>
            <img src="/images/testimonials_white_arrow.svg" alt={t("home.testimonialsSection.arrowAlt")} className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-12 self-center md:self-end">
          <button
            type="button"
            className="hover:opacity-70 transition-opacity"
            onClick={() => setTestimonialIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
          >
            <img src="/images/testimonials_orange_arrow.svg" alt={t("home.testimonialsSection.previousAlt")} className="w-11 h-9 rotate-180" />
          </button>
          <button
            type="button"
            className="hover:opacity-70 transition-opacity"
            onClick={() => setTestimonialIndex((i) => (i + 1) % TESTIMONIALS.length)}
          >
            <img src="/images/testimonials_orange_arrow.svg" alt={t("home.testimonialsSection.nextAlt")} className="w-11 h-9" />
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}

