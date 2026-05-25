import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CookiePolicy() {
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white font-brand">{t("legalPages.cookie.title")}</h1>

          <p className="text-sm text-white/50 mb-8">{t("legalPages.lastUpdated", { date: "November 2025" })}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.cookie.s1")}</h2>
          <p className="text-white/80">{t("legalPages.cookie.p1")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.cookie.s2")}</h2>
          <p className="text-white/80">{t("legalPages.cookie.p2")}</p>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.cookie.s3")}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-white/10">
                  <th className="border border-white/20 px-4 py-2 text-left text-white font-brand">{t("legalPages.cookie.colName")}</th>
                  <th className="border border-white/20 px-4 py-2 text-left text-white font-brand">{t("legalPages.cookie.colType")}</th>
                  <th className="border border-white/20 px-4 py-2 text-left text-white font-brand">{t("legalPages.cookie.colProvider")}</th>
                  <th className="border border-white/20 px-4 py-2 text-left text-white font-brand">{t("legalPages.cookie.colDuration")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-white/20 px-4 py-2 text-white/80">_ga</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">Analytics</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">Google</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">13 months</td>
                </tr>
                <tr>
                  <td className="border border-white/20 px-4 py-2 text-white/80">wp-settings-*</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">Preferences</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">hayc</td>
                  <td className="border border-white/20 px-4 py-2 text-white/80">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-4 text-white font-brand">{t("legalPages.cookie.s4")}</h2>
          <p className="text-white/80">{t("legalPages.cookie.p4")}</p>
        </div>
      </div>
    </div>
  );
}
