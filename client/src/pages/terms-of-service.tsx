import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TermsOfService() {
  const { t } = useTranslation();
  const [bgLoaded, setBgLoaded] = useState(false);

  return (
    <div className="min-h-screen bg-black relative">
      <img
        src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/templates_main_desktop.png"
        srcSet="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/templates_main_mobile.png 767w, https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/templates_main_desktop.png 768w"
        sizes="(max-width: 767px) 100vw, 100vw"
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 z-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-300 ${bgLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setBgLoaded(true)}
      />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        <Link to="/">
          <button
            className="mb-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors font-brand"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("legalPages.backToHome")}
          </button>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-lg p-5 sm:p-8 backdrop-blur-sm prose prose-invert max-w-none">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white font-brand">{t("legalPages.terms.title")}</h1>

          <p className="text-sm text-white/50 mb-8">{t("legalPages.lastUpdated", { date: "November 2025" })}</p>

          <div className="mb-6">
            <p className="text-white/80"><strong className="text-white">{t("legalPages.operator")}:</strong> Petros Pollakis (Sole Proprietor)</p>
            <p className="text-white/80"><strong className="text-white">{t("legalPages.address")}:</strong> Chlois 27, Marousi, Athens, 15126, Greece</p>
            <p className="text-white/80"><strong className="text-white">{t("legalPages.vatNumber")}:</strong> 161537871</p>
            <p className="text-white/80"><strong className="text-white">{t("legalPages.email")}:</strong> support@hayc.gr</p>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s1")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p1")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s2")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p2")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s3")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p3")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s4")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p4")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s5")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p5intro")}</p>
          <ul className="text-white/80">
            <li>Basic: 1</li>
            <li>Essential: 2</li>
            <li>Pro: 5</li>
          </ul>
          <p className="text-white/80">{t("legalPages.terms.p5note")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s6")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p6")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s7")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p7")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s8")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p8")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s9")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p9")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s10")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p10")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s11")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p11")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s12")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p12")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s13")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p13")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s14")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p14")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s15")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p15")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s16")}</h2>
          <p className="text-white/80">{t("legalPages.terms.p16")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.terms.s17")}</h2>
          <p className="text-white/80">support@hayc.gr<br />
          Chlois 27, Marousi, Athens, 15126, Greece</p>
        </div>
      </div>
    </div>
  );
}
