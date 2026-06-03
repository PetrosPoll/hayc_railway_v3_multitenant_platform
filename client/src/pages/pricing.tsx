import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";
import { usePricing, getPrice } from "@/hooks/use-pricing";

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bgLoaded, setBgLoaded] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");
  const [mobileComparisonPlan, setMobileComparisonPlan] = useState<"basic" | "essential" | "pro">("basic");

  const { data: stripePrices } = usePricing();

  const FALLBACK_PRICES = {
    basic:     { monthly: 34,  annualPerMonth: 27  },
    essential: { monthly: 39,  annualPerMonth: 31  },
    pro:       { monthly: 200, annualPerMonth: 160 },
  };

  const displayPrice = (tier: "basic" | "essential" | "pro", period: "monthly" | "annually") => {
    const stripePeriod = period === "annually" ? "yearly" : "monthly";
    const price = getPrice(stripePrices, tier, stripePeriod);
    if (price) {
      const amount = period === "annually" ? Math.round(price.unitAmount / 12) : price.unitAmount;
      return `${amount}€`;
    }
    const fb = FALLBACK_PRICES[tier];
    return `${period === "annually" ? fb.annualPerMonth : fb.monthly}€`;
  };

  const plans = [
    {
      tier: "basic" as const,
      name: t("pricing.plans.basic.name"),
      tagline: t("pricing.plans.basic.tagline"),
      features: [
        t("pricing.plans.basic.features.0"),
        t("pricing.plans.basic.features.1"),
        t("pricing.plans.basic.features.2"),
        t("pricing.plans.basic.features.3"),
        t("pricing.plans.basic.features.4"),
      ],
      highlighted: false,
    },
    {
      tier: "essential" as const,
      name: t("pricing.plans.essential.name"),
      tagline: t("pricing.plans.essential.tagline"),
      features: [
        t("pricing.plans.essential.features.0"),
        t("pricing.plans.essential.features.1"),
        t("pricing.plans.essential.features.2"),
        t("pricing.plans.essential.features.3"),
        t("pricing.plans.essential.features.4"),
        t("pricing.plans.essential.features.5"),
      ],
      highlighted: true,
    },
    {
      tier: "pro" as const,
      name: t("pricing.plans.pro.name"),
      tagline: t("pricing.plans.pro.tagline"),
      features: [
        t("pricing.plans.pro.features.0"),
        t("pricing.plans.pro.features.1"),
        t("pricing.plans.pro.features.2"),
        t("pricing.plans.pro.features.3"),
        t("pricing.plans.pro.features.4"),
        t("pricing.plans.pro.features.5"),
        t("pricing.plans.pro.features.6"),
        t("pricing.plans.pro.features.7"),
      ],
      highlighted: false,
    },
  ];

  const comparisonRows = [
    {
      feature: t("pricing.comparison.pages.feature"),
      description: t("pricing.comparison.pages.description"),
      basic: t("pricing.comparison.pages.basic"),
      essential: t("pricing.comparison.pages.essential"),
      pro: t("pricing.comparison.pages.pro"),
    },
    {
      feature: t("pricing.comparison.contentUpdates.feature"),
      description: t("pricing.comparison.contentUpdates.description"),
      basic: t("pricing.comparison.contentUpdates.basic"),
      essential: t("pricing.comparison.contentUpdates.essential"),
      pro: t("pricing.comparison.contentUpdates.pro"),
    },
    {
      feature: t("pricing.comparison.delivery.feature"),
      description: t("pricing.comparison.delivery.description"),
      basic: t("pricing.comparison.delivery.basic"),
      essential: t("pricing.comparison.delivery.essential"),
      pro: t("pricing.comparison.delivery.pro"),
    },
    {
      feature: t("pricing.comparison.seo.feature"),
      description: t("pricing.comparison.seo.description"),
      basic: t("pricing.comparison.seo.basic"),
      essential: t("pricing.comparison.seo.essential"),
      pro: t("pricing.comparison.seo.pro"),
    },
    {
      feature: t("pricing.comparison.emailMarketing.feature"),
      description: t("pricing.comparison.emailMarketing.description"),
      basic: t("pricing.comparison.emailMarketing.basic"),
      essential: t("pricing.comparison.emailMarketing.essential"),
      pro: t("pricing.comparison.emailMarketing.pro"),
    },
    {
      feature: t("pricing.comparison.analytics.feature"),
      description: t("pricing.comparison.analytics.description"),
      basic: t("pricing.comparison.analytics.basic"),
      essential: t("pricing.comparison.analytics.essential"),
      pro: t("pricing.comparison.analytics.pro"),
    },
    {
      feature: t("pricing.comparison.support.feature"),
      description: t("pricing.comparison.support.description"),
      basic: t("pricing.comparison.support.basic"),
      essential: t("pricing.comparison.support.essential"),
      pro: t("pricing.comparison.support.pro"),
    },
  ];

  const mobileComparisonPrice = displayPrice(mobileComparisonPlan, billing);

  return (
    <div className="w-full bg-black min-h-screen flex flex-col items-center gap-4">
      <div className="w-full relative lg:pt-[65px]">
        <img
          src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/pricing_main_desktop.png"
          srcSet="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/pricing_main_mobile.png 767w, https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/pricing_main_desktop.png 768w"
          sizes="(max-width: 767px) 100vw, 100vw"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className={`absolute inset-0 z-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-300 ${bgLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setBgLoaded(true)}
        />

        <div className="relative z-10 pt-[65px] lg:pt-0">
          <section className="relative w-full px-4 py-[50px] lg:px-16 lg:py-16 flex flex-col items-center gap-3">
            {/* Badge */}
        <div className="px-3 py-1.5 bg-gradient-to-br from-blue-50/0 to-blue-50/5 rounded-full outline outline-1 outline-offset-[-1px] outline-slate-100/50 flex justify-center items-center gap-2.5">
          <span className="text-center text-[#EFF6FF] text-sm font-normal font-brand leading-5">
            {t("pricing.badge")}
          </span>
        </div>

        {/* Headline */}
        <h2
          className="text-center text-[#EFF6FF] text-3xl leading-10 lg:text-5xl lg:leading-tight font-semibold font-brand"
          style={{ maxWidth: "766px" }}
        >
          {t("pricing.headline")}
        </h2>

        {/* Subtext */}
        <p className="text-center text-[#EFF6FF] text-base font-normal font-brand leading-5" style={{ maxWidth: "601px" }}>
          {t("pricing.subtitle")}
        </p>
          </section>

          <div className="relative w-full px-4 lg:px-16 flex flex-col items-center gap-12 pb-6">
      {/* Billing toggle */}
      <div className="p-1 bg-white/10 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/10 flex justify-start items-start">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`w-20 px-2.5 py-2 rounded-lg flex justify-center items-center gap-2.5 transition-all ${
            billing === "monthly"
              ? "bg-gradient-to-b from-orange-600 to-orange-900 shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)]"
              : ""
          }`}
        >
          <span
            className={`text-base font-semibold font-brand leading-5 ${
              billing === "monthly" ? "text-black" : "text-[#EFF6FF]"
            }`}
          >
            {t("pricing.billing.monthly")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBilling("annually")}
          className={`px-2.5 py-2 rounded-lg flex justify-center items-center gap-2.5 transition-all ${
            billing === "annually"
              ? "bg-gradient-to-b from-orange-600 to-orange-900 shadow-[inset_0px_0px_2px_1px_rgba(255,255,255,0.25)]"
              : ""
          }`}
        >
          <span
            className={`text-base font-semibold font-brand leading-5 ${
              billing === "annually" ? "text-black" : "text-[#EFF6FF]"
            }`}
          >
            {t("pricing.billing.annually")}
          </span>
        </button>
      </div>

      {/* Plans */}
      <div className="w-full flex flex-col gap-3">
        <div className="w-full flex flex-col lg:flex-row justify-start items-start gap-4 lg:h-[799px]">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`w-full lg:flex-1 lg:h-full p-6 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-blue-50/20 flex flex-col justify-between items-start overflow-hidden ${
                plan.highlighted
                  ? "bg-gradient-to-b from-orange-600/0 to-orange-600/50"
                  : "bg-gradient-to-bl from-neutral-700/5 to-neutral-700/20"
              }`}
            >
              {/* Top content */}
              <div className="w-full flex flex-col gap-10">
                <div className="w-full flex flex-col gap-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-white text-2xl font-medium font-brand">{plan.name}</span>
                    <span className="text-white text-sm font-semibold font-brand tracking-tight">
                      {plan.tagline}
                    </span>
                  </div>
                  <div className="w-full flex items-center gap-1.5">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-end gap-1.5">
                        <span className="text-white text-5xl font-semibold font-brand leading-[70px]">
                          {displayPrice(plan.tier, billing)}
                        </span>
                        <span className="text-white/80 text-sm font-normal font-brand leading-5 mb-3">
                          {t("pricing.perMonth")} · {t("pricing.vatIncluded")}
                        </span>
                      </div>
                      <span className="text-blue-400 text-sm font-normal font-brand leading-5">
                        {t("pricing.saveAnnually")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/25" />

                {/* Features */}
                <div className="flex flex-col gap-4">
                  <span className="text-white text-base font-normal font-brand leading-6">{t("pricing.whatYouGet")}</span>
                  <div className="flex flex-col gap-4">
                    {plan.features.map((feature, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <img src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/tick.svg" alt="check" loading="lazy" className="w-4 h-4 flex-shrink-0" />
                        <span className="text-white/80 text-sm font-normal font-brand leading-5">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="w-full mt-10 flex flex-col gap-3">
                <button
                  type="button"
                  className={`w-full px-3.5 py-3 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-white/10 flex justify-center items-center gap-2.5 overflow-hidden shadow-[inset_0px_0px_10px_2px_rgba(255,255,255,0.32)] hover:opacity-80 transition-opacity ${
                    plan.highlighted
                      ? "bg-[#ED4C14]"
                      : "bg-gradient-to-b from-white/20 to-white/5"
                  }`}
                  onClick={() =>
                    navigate(
                      `/get-started?plan=${plan.tier}&billing=${
                        billing === "monthly" ? "monthly" : "yearly"
                      }`,
                    )
                  }
                >
                  <span className="text-white text-base font-semibold font-brand leading-5">{t("pricing.getStarted")}</span>
                </button>
                <p className="text-center text-white/80 text-sm font-normal font-brand leading-5">
                  {t("pricing.setupFee")}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* All Plans Include bar */}
        <div className="w-full p-6 bg-gradient-to-bl from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-blue-50/20 flex flex-col lg:flex-row justify-start lg:justify-between items-start lg:items-center gap-3 overflow-hidden">
          <span className="text-white text-2xl font-medium font-brand">{t("pricing.allPlansInclude")}</span>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/card-tick.svg" alt="" loading="lazy" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-brand leading-6">
              {t("pricing.includes.transactions")}
            </span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/driver.svg" alt="" loading="lazy" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-brand leading-6">{t("pricing.includes.hosting")}</span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/wrench.svg" alt="" loading="lazy" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-brand leading-6">{t("pricing.includes.maintenance")}</span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/shield-tick.svg" alt="" loading="lazy" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-brand leading-6">{t("pricing.includes.security")}</span>
          </div>
        </div>
      </div>
        </div>
      </div>
      </div>

      <div className="relative w-full flex flex-col items-center px-4 lg:px-16 pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/pricing_compare_mobile.png')] lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] hidden w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/pricing_compare_desktop.png')] lg:block"
        />

        <div className="relative z-10 w-full flex flex-col items-center gap-12 pt-4">
          <div className="w-full flex flex-col items-center gap-4">
            <h2 className="text-center text-[#EFF6FF] text-2xl leading-8 lg:text-4xl lg:leading-tight font-semibold font-brand">
              {t("pricing.comparePlans")}
            </h2>

            <div className="w-full rounded-[20px] outline outline-1 outline-offset-[-1px] outline-white/30 overflow-hidden">
            {/* Mobile table */}
            <div className="w-full flex flex-col lg:hidden">
              <div className="p-5 flex justify-between items-end">
                <div className="flex justify-start items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("basic")}
                    className={`text-lg font-brand ${
                      mobileComparisonPlan === "basic" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    {t("pricing.plans.basic.name")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("essential")}
                    className={`text-lg font-brand ${
                      mobileComparisonPlan === "essential" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    {t("pricing.plans.essential.name")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("pro")}
                    className={`text-lg font-brand ${
                      mobileComparisonPlan === "pro" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    {t("pricing.plans.pro.name")}
                  </button>
                </div>
                <span className="text-white text-base font-normal font-brand leading-5">{mobileComparisonPrice}</span>
              </div>
              <div className="w-full flex justify-between items-start">
                <div className="flex-1 flex flex-col">
                  {comparisonRows.map((row, i) => (
                    <div key={i} className="h-36 px-3.5 py-6 border-t border-zinc-800 flex flex-col justify-center items-start">
                      <span className="text-white text-base font-bold font-brand leading-5">{row.feature}</span>
                      <span className="text-white text-sm font-normal font-brand leading-5">{row.description}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col">
                  {comparisonRows.map((row, i) => (
                    <div
                      key={i}
                      className="h-36 px-5 py-6 border-l border-t border-zinc-800 flex flex-col justify-center items-center gap-2.5"
                    >
                      <span className="text-center text-white text-base font-normal font-brand leading-5">
                        {row[mobileComparisonPlan]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:flex justify-start items-start">
              {/* Features column */}
              <div className="w-72 flex flex-col flex-shrink-0">
                <div className="p-5 border-r border-zinc-800 flex items-center gap-2.5">
                  <span className="text-white text-lg font-bold font-brand">{t("pricing.comparison.featuresHeader")}</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 border-t border-b border-zinc-800 flex flex-col justify-center items-start">
                    <span className="text-white text-base font-bold font-brand leading-6">{row.feature}</span>
                    <span className="text-white text-sm font-normal font-brand leading-5">{row.description}</span>
                  </div>
                ))}
              </div>

              {/* Basic column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-r border-zinc-800 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-brand">{t("pricing.plans.basic.name")}</span>
                  <span className="text-white text-sm font-normal font-brand leading-5">{displayPrice("basic", billing)}</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 outline outline-1 outline-offset-[-1px] outline-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-brand leading-6">{row.basic}</span>
                  </div>
                ))}
              </div>

              {/* Essential column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-r border-zinc-800 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-brand">{t("pricing.plans.essential.name")}</span>
                  <span className="text-white text-sm font-normal font-brand leading-5">{displayPrice("essential", billing)}</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 outline outline-1 outline-offset-[-1px] outline-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-brand leading-6">{row.essential}</span>
                  </div>
                ))}
              </div>

              {/* Pro column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-brand">{t("pricing.plans.pro.name")}</span>
                  <span className="text-white text-sm font-normal font-brand leading-5">{displayPrice("pro", billing)}</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 border-l border-t border-b border-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-brand leading-6">{row.pro}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>

        <FaqSection className="bg-transparent relative z-10" />
      </div>

      <div className="w-full px-4 lg:px-16">
        <div className="w-[calc(100%+8rem)] -mx-16 lg:-mx-16">
          <FinalCtaSection />
        </div>
      </div>
    </div>
  );
}
