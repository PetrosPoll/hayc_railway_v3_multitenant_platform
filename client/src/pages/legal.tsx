import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Shield, Cookie, CreditCard, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Legal() {
  const { t } = useTranslation();

  const legalPages = [
    {
      title: t("legalPages.hub.termsTitle"),
      description: t("legalPages.hub.termsDesc"),
      icon: FileText,
      path: "/terms-of-service"
    },
    {
      title: t("legalPages.hub.privacyTitle"),
      description: t("legalPages.hub.privacyDesc"),
      icon: Shield,
      path: "/privacy-policy"
    },
    {
      title: t("legalPages.hub.cookieTitle"),
      description: t("legalPages.hub.cookieDesc"),
      icon: Cookie,
      path: "/cookie-policy"
    },
    {
      title: t("legalPages.hub.billingTitle"),
      description: t("legalPages.hub.billingDesc"),
      icon: CreditCard,
      path: "/billing-subscription-policy"
    },
    {
      title: t("legalPages.hub.acceptableUseTitle"),
      description: t("legalPages.hub.acceptableUseDesc"),
      icon: Ban,
      path: "/acceptable-use-policy"
    }
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Link to="/">
          <button
            className="mb-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors font-brand"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("legalPages.backToHome")}
          </button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white font-brand">{t("legalPages.hub.title")}</h1>
          <p className="text-white/60 text-lg font-brand">
            {t("legalPages.hub.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {legalPages.map((page) => {
            const Icon = page.icon;
            return (
              <Link key={page.path} to={page.path} data-testid={`link-${page.path.slice(1)}`}>
                <div className="h-full bg-white/5 border border-white/10 rounded-lg p-5 sm:p-6 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg sm:text-xl font-semibold mb-1 text-white font-brand">{page.title}</h2>
                      <p className="text-sm text-white/60 font-brand">{page.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 sm:mt-12 p-5 sm:p-6 bg-white/5 border border-white/10 rounded-lg">
          <h2 className="text-xl font-semibold mb-2 text-white font-brand">{t("legalPages.questionsTitle")}</h2>
          <p className="text-white/60 mb-4 font-brand">
            {t("legalPages.questionsText")}
          </p>
          <p className="text-sm text-white/80">
            <strong className="text-white">{t("legalPages.email")}:</strong> support@hayc.gr<br />
            <strong className="text-white">{t("legalPages.address")}:</strong> Chlois 27, Marousi, Athens, 15126, Greece
          </p>
        </div>
      </div>
    </div>
  );
}
