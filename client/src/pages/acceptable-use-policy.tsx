import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const PROHIBITED_LIST_KEYS = ["list1", "list2", "list3", "list4", "list5", "list6", "list7", "list8", "list9", "list10"] as const;

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

          <p className="text-sm text-white/50 mb-8">{t("legalPages.lastUpdated", { date: "May 2026" })}</p>

          <p className="text-white/80 mb-6">{t("legalPages.acceptable.intro")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.acceptable.s1")}</h2>
          <ul className="text-white/80">
            {PROHIBITED_LIST_KEYS.map((key) => (
              <li key={key}>{t(`legalPages.acceptable.${key}`)}</li>
            ))}
          </ul>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.acceptable.s2")}</h2>
          <p className="text-white/80">{t("legalPages.acceptable.p2")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.acceptable.s3")}</h2>
          <p className="text-white/80">{t("legalPages.acceptable.p3")}</p>
        </div>
      </div>
    </div>
  );
}
