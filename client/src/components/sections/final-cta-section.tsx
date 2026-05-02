import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function FinalCtaSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section
      className="w-full px-4 md:px-36 py-12 md:py-48 bg-black bg-cover bg-center bg-no-repeat flex flex-col justify-start items-center"
      style={{ backgroundImage: "url('/images/Final CTA.png')" }}
    >
      <div className="w-96 h-80 px-4 inline-flex flex-col justify-center items-center gap-6 md:w-auto md:h-auto md:px-0 md:gap-24">
        <h2 className="self-stretch text-center text-4xl md:text-6xl font-semibold font-['Montserrat'] leading-tight md:leading-normal" style={{ maxWidth: "863px" }}>
          <span className="text-[#ED4C14]">{t("home.finalCtaSection.titleHighlight")}</span>
          <span className="text-slate-100"> {t("home.finalCtaSection.titleSuffix")}</span>
        </h2>
        <button
          className="h-11 px-5 py-3.5 bg-gradient-to-b from-blue-600 to-blue-950 rounded-[10px] inline-flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
          onClick={() => {
            navigate("/auth");
          }}
        >
          <span className="text-center text-white text-base font-semibold font-['Montserrat'] leading-5">
            {t("home.finalCtaSection.button")}
          </span>
          <ArrowRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </section>
  );
}

