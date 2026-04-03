import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Server, Wrench } from "lucide-react";
import { subscriptionPlans } from "@shared/schema";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { usePricing } from "@/hooks/use-pricing";

export type SubscriptionPlansSectionProps = {
  /** Use <main id="plans"> for home (deep links / hero scroll). Use false inside modals. */
  asMain?: boolean;
  /** Home page shows guarantee cards below the grid; omit in compact contexts (e.g. modal). */
  showGuarantees?: boolean;
  className?: string;
};

export function SubscriptionPlansSection({
  asMain = true,
  showGuarantees = true,
  className = "",
}: SubscriptionPlansSectionProps) {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);
  const { data: prices, isLoading: pricesLoading } = usePricing();

  const inner = (
    <>
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold tracking-tight">
          {t("home.plans.title")}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("home.plans.subtitle")}
        </p>

        <div className="mt-8 inline-flex items-center rounded-full border p-1 bg-muted">
          <button
            type="button"
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 rounded-full text-sm ${
              !isYearly ? "bg-background shadow-sm" : ""
            }`}
          >
            {t("home.plans.monthly")}
          </button>
          <button
            type="button"
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 rounded-full text-sm ${
              isYearly ? "bg-background shadow-sm" : ""
            }`}
          >
            {t("home.plans.yearly")}{" "}
            <span className="text-green-500 text-xs ml-1">
              {t("home.plans.saveLabel")}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-3 p-4 bg-blue-50 border mb-8 border-blue-200 rounded-lg">
        <p className="text-blue-800 font-medium text-center flex items-center justify-center flex-wrap gap-x-6 gap-y-2">
          {t("pricing.allPlansInclude")}

          <span className="flex items-center gap-2">
            {t("pricing.zeroTransactionFee")}
          </span>

          <span className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t("pricing.hosting")}
          </span>

          <span className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t("pricing.maintenance")}
          </span>
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(subscriptionPlans).map(([id, plan]) => (
          <SubscriptionCard
            key={id}
            plan={plan}
            isYearly={isYearly}
            dynamicPrices={prices}
            pricesLoading={pricesLoading}
          />
        ))}
      </div>

      {showGuarantees ? (
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-8">
            {t("home.guarantees.title")}
          </h3>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-green-800 mb-2">
                {t("home.guarantees.performance.title")}
              </h4>
              <p className="text-green-700">
                {t("home.guarantees.performance.description")}
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-orange-500 rounded-full mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-orange-800 mb-2">
                {t("home.guarantees.moneyBack.title")}
              </h4>
              <p className="text-orange-700">
                {t("home.guarantees.moneyBack.description")}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h4 className="font-semibold text-blue-800 mb-2">
                {t("home.guarantees.uptime.title")}
              </h4>
              <p className="text-blue-700">
                {t("home.guarantees.uptime.description")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (asMain) {
    return (
      <main
        id="plans"
        className={`container mx-auto px-4 py-24 ${className}`.trim()}
      >
        {inner}
      </main>
    );
  }

  return <div className={className}>{inner}</div>;
}
