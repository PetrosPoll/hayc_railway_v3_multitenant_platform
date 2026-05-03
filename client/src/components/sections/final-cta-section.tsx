import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GET_STARTED_DEFAULT_PATH } from "@/lib/get-started-default-path";

export function FinalCtaSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="relative w-full overflow-hidden bg-black px-4 py-12 md:px-36 md:py-48 flex flex-col justify-start items-center">
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover md:hidden"
        src="/videos/cta_footer_mobile_ikmdp8.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      <video
        className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover md:block"
        src="/videos/CTA_before_footer_xqyu3r.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      <div className="relative z-10 w-96 h-80 px-4 inline-flex flex-col justify-center items-center gap-6 md:w-auto md:h-auto md:px-0 md:gap-24">
        <h2 className="self-stretch text-center text-4xl md:text-6xl font-semibold font-['Montserrat'] leading-tight md:leading-normal" style={{ maxWidth: "863px" }}>
          <span className="text-[#ED4C14]">{t("home.finalCtaSection.titleHighlight")}</span>
          <span className="text-slate-100"> {t("home.finalCtaSection.titleSuffix")}</span>
        </h2>
        <button
          className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
          onClick={() => {
            navigate(GET_STARTED_DEFAULT_PATH);
          }}
        >
          <span className="text-center text-[#EFF6FF] text-base font-semibold font-['Montserrat'] leading-5">
            {t("home.finalCtaSection.button")}
          </span>
          <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
        </button>
      </div>
    </section>
  );
}

