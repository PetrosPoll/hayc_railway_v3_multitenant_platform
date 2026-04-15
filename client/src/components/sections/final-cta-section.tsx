import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FinalCtaSection() {
  const { t } = useTranslation();

  return (
    <section
      className="w-full px-36 py-48 bg-black bg-cover bg-center bg-no-repeat flex flex-col justify-start items-center gap-24"
      style={{ backgroundImage: "url('/images/Final CTA.png')" }}
    >
      <h2 className="text-6xl font-semibold font-['Montserrat'] text-center" style={{ maxWidth: "863px" }}>
        <span className="text-[#ED4C14]">{t("home.finalCtaSection.titleHighlight")}</span>
        <span className="text-white"> {t("home.finalCtaSection.titleSuffix")}</span>
      </h2>
      <button
        className="h-11 px-5 py-3.5 bg-[#ED4C14] rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
        onClick={() => {
          window.location.href = "/auth";
        }}
      >
        <span className="text-center text-[#EFF6FF] text-base font-semibold font-['Montserrat'] leading-5">
          {t("home.finalCtaSection.button")}
        </span>
        <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
      </button>
    </section>
  );
}

