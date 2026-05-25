import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white font-brand">{t("legalPages.privacy.title")}</h1>

          <p className="text-sm text-white/50 mb-8">{t("legalPages.lastUpdated", { date: "November 2025" })}</p>

          <div className="mb-6">
            <p className="text-white/80"><strong className="text-white">{t("legalPages.dataController")}:</strong> Petros Pollakis, Sole Proprietor (hayc)</p>
            <p className="text-white/80"><strong className="text-white">{t("legalPages.email")}:</strong> support@hayc.gr</p>
            <p className="text-white/80"><strong className="text-white">{t("legalPages.address")}:</strong> Chlois 27, Marousi, Athens, 15126, Greece</p>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s1")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p1")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s2")}</h2>
          <ul className="text-white/80">
            <li>{t("legalPages.privacy.p2_1")}</li>
            <li>{t("legalPages.privacy.p2_2")}</li>
            <li>{t("legalPages.privacy.p2_3")}</li>
            <li>{t("legalPages.privacy.p2_4")}</li>
            <li>{t("legalPages.privacy.p2_5")}</li>
            <li>{t("legalPages.privacy.p2_6")}</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s3")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p3")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s4")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p4")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s5")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p5")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s6")}</h2>
          <ul className="text-white/80">
            <li>{t("legalPages.privacy.p6_1")}</li>
            <li>{t("legalPages.privacy.p6_2")}</li>
            <li>{t("legalPages.privacy.p6_3")}</li>
            <li>{t("legalPages.privacy.p6_4")}</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s7")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p7")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s8")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p8")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.privacy.s9")}</h2>
          <p className="text-white/80">{t("legalPages.privacy.p9")}</p>
        </div>
      </div>
    </div>
  );
}
