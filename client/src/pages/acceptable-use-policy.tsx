import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AcceptableUsePolicy() {
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white font-brand">{t("legalPages.acceptable.title")}</h1>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.acceptable.s1")}</h2>
          <ul className="text-white/80">
            <li>{t("legalPages.acceptable.list1")}</li>
            <li>{t("legalPages.acceptable.list2")}</li>
            <li>{t("legalPages.acceptable.list3")}</li>
            <li>{t("legalPages.acceptable.list4")}</li>
            <li>{t("legalPages.acceptable.list5")}</li>
            <li>{t("legalPages.acceptable.list6")}</li>
            <li>{t("legalPages.acceptable.list7")}</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.acceptable.s2")}</h2>
          <p className="text-white/80">{t("legalPages.acceptable.p2")}</p>
        </div>
      </div>
    </div>
  );
}
