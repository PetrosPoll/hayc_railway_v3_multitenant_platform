import React, { useState } from "react";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");
  const [showComparison, setShowComparison] = useState(false);
  const [mobileComparisonPlan, setMobileComparisonPlan] = useState<"basic" | "essential" | "pro">("basic");

  const plans = [
    {
      name: "Basic",
      tagline: "For getting online fast.",
      monthlyPrice: "34€",
      annualPrice: "27€",
      features: [
        "Up to 3 pages",
        "1 content update / month",
        "SEO (essential)",
        "Newsletter: 1,000 emails / month",
        "Email Support (GR/EN)",
      ],
      highlighted: false,
    },
    {
      name: "Essential",
      tagline: "For growing businesses.",
      monthlyPrice: "39€",
      annualPrice: "31€",
      features: [
        "Up to 10 pages",
        "2 content updates / month",
        "Analytics (Basic)",
        "SEO (Advanced)",
        "Newsletter: 3,000 emails / month",
        "Email Support (GR/EN)",
      ],
      highlighted: true,
    },
    {
      name: "Pro",
      tagline: "For teams that want a partner.",
      monthlyPrice: "200€",
      annualPrice: "160€",
      features: [
        "Up to 50 pages",
        "5 content changes / month",
        "Analytics (Advanced)",
        "SEO (Premium) + Competitor research",
        "Newsletter: 10,000 emails / month",
        "Phone Support (business hours)",
        "Monthly Strategy Call",
        "All add-ons included",
      ],
      highlighted: false,
    },
  ];

  const comparisonRows = [
    {
      feature: "Pages",
      description: "The number of pages included in your website",
      basic: "Up to 3",
      essential: "Up to 10",
      pro: "Up to 50",
    },
    {
      feature: "Content updates / month",
      description: "Monthly edits to keep your content fresh",
      basic: "1",
      essential: "2",
      pro: "5",
    },
    {
      feature: "Delivery",
      description: "How fast we complete your requested updates",
      basic: "up to 10 business days",
      essential: "up to 10 business days",
      pro: "Priority (3 - 5 business days)",
    },
    {
      feature: "SEO",
      description: "On-page optimization to help you show up on Google",
      basic: "-",
      essential: "Advanced",
      pro: "Premium",
    },
    {
      feature: "Email Marketing (emails / month)",
      description: "Newsletter sending limits included in your plan.",
      basic: "Essential",
      essential: "Basic",
      pro: "Advanced",
    },
    {
      feature: "Analytics",
      description: "Traffic insights to understand what's working",
      basic: "1,000",
      essential: "3,000",
      pro: "10,000",
    },
    {
      feature: "Add-ons",
      description: "Extra features you can add anytime.",
      basic: "By Email (GR/EN)",
      essential: "By Email (GR/EN)",
      pro: "Email + Phone",
    },
    {
      feature: "Support",
      description: "Help when you need it, in Greek and English.",
      basic: "+10€ / month each",
      essential: "+10€ / month each",
      pro: "Included",
    },
  ];

  const mobileComparisonPrice =
    mobileComparisonPlan === "basic" ? "34€" : mobileComparisonPlan === "essential" ? "39€" : "200€";

  return (
    <div className="w-full bg-black min-h-screen px-4 lg:px-16 flex flex-col items-center gap-12 py-16">
      {/* Pricing Header */}
      <section className="w-full bg-black px-4 py-[50px] lg:px-16 lg:py-16 flex flex-col items-center gap-3">
        {/* Badge */}
        <div className="px-3 py-1.5 bg-gradient-to-br from-blue-50/0 to-blue-50/5 rounded-full outline outline-1 outline-offset-[-1px] outline-slate-100/50 flex justify-center items-center gap-2.5">
          <span className="text-center text-[#EFF6FF] text-sm font-normal font-['Montserrat'] leading-5">
            Bring your business to the best scale
          </span>
        </div>

        {/* Headline */}
        <h2
          className="text-center text-[#EFF6FF] text-3xl leading-10 lg:text-5xl lg:leading-tight font-semibold font-['Montserrat']"
          style={{ maxWidth: "766px" }}
        >
          Get the Best Pricing and Elevate Your Business
        </h2>

        {/* Subtext */}
        <p className="text-center text-[#EFF6FF] text-base font-normal font-['Montserrat'] leading-5" style={{ maxWidth: "601px" }}>
          Select the plan that fits your needs. We created each one with you and your business in mind, to be the perfect fit.
        </p>
      </section>

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
            className={`text-base font-semibold font-['Montserrat'] leading-5 ${
              billing === "monthly" ? "text-black" : "text-[#EFF6FF]"
            }`}
          >
            Monthly
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
            className={`text-base font-semibold font-['Montserrat'] leading-5 ${
              billing === "annually" ? "text-black" : "text-[#EFF6FF]"
            }`}
          >
            Annually
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
                    <span className="text-white text-2xl font-medium font-['Montserrat']">{plan.name}</span>
                    <span className="text-white text-sm font-semibold font-['Montserrat'] tracking-tight">
                      {plan.tagline}
                    </span>
                  </div>
                  <div className="w-full flex items-center gap-1.5">
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-end gap-1.5">
                        <span className="text-white text-5xl font-semibold font-['Montserrat'] leading-[70px]">
                          {billing === "monthly" ? plan.monthlyPrice : plan.annualPrice}
                        </span>
                        <span className="text-white/80 text-sm font-normal font-['Montserrat'] leading-5 mb-3">
                          / per month
                        </span>
                      </div>
                      <span className="text-blue-400 text-sm font-normal font-['Montserrat'] leading-5">
                        Save 20% annually
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/25" />

                {/* Features */}
                <div className="flex flex-col gap-4">
                  <span className="text-white text-base font-normal font-['Montserrat'] leading-6">What you will get</span>
                  <div className="flex flex-col gap-4">
                    {plan.features.map((feature, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <img src="/images/tick.svg" alt="check" className="w-4 h-4 flex-shrink-0" />
                        <span className="text-white/80 text-sm font-normal font-['Montserrat'] leading-5">{feature}</span>
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
                  onClick={() => (window.location.href = "/auth")}
                >
                  <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">Get Started</span>
                </button>
                <p className="text-center text-white/80 text-sm font-normal font-['Montserrat'] leading-5">
                  Each plan requires + 99€ setup fee
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* All Plans Include bar */}
        <div className="w-full p-6 bg-gradient-to-bl from-neutral-700/5 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-blue-50/20 flex flex-col lg:flex-row justify-start lg:justify-between items-start lg:items-center gap-3 overflow-hidden">
          <span className="text-white text-2xl font-medium font-['Montserrat']">All Plans Include:</span>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="/images/card-tick.svg" alt="" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-['Montserrat'] leading-6">
              0% transaction fees on digital products
            </span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="/images/driver.svg" alt="" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-['Montserrat'] leading-6">Hosting</span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="/images/wrench.svg" alt="" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-['Montserrat'] leading-6">Ongoing Maintenance</span>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2">
            <img src="/images/shield-tick.svg" alt="" className="w-6 h-6" />
            <span className="text-white text-base font-normal font-['Montserrat'] leading-6">Secure &amp; fast performance</span>
          </div>
        </div>
      </div>

      {/* Comparison Table Section */}
      <div className="w-full px-4 py-12 lg:px-16 lg:py-24 flex flex-col items-center gap-12">
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setShowComparison(!showComparison)}
          className="pl-6 pr-5 py-3.5 bg-[#EFF6FF] rounded-lg flex justify-start items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <span className="text-center text-[#0C275F] text-base font-semibold font-['Montserrat'] leading-5">
            Compare all Plans
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-6 h-6 text-[#0C275F] transition-transform duration-300 ${showComparison ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Comparison table */}
        {showComparison && (
          <div className="w-full bg-gradient-to-br from-neutral-700/30 to-neutral-700/20 rounded-[20px] outline outline-1 outline-offset-[-1px] outline-white/30 overflow-hidden">
            {/* Mobile table */}
            <div className="w-full flex flex-col lg:hidden">
              <div className="p-5 flex justify-between items-end">
                <div className="flex justify-start items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("basic")}
                    className={`text-lg font-['Montserrat'] ${
                      mobileComparisonPlan === "basic" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    Basic
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("essential")}
                    className={`text-lg font-['Montserrat'] ${
                      mobileComparisonPlan === "essential" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    Essential
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileComparisonPlan("pro")}
                    className={`text-lg font-['Montserrat'] ${
                      mobileComparisonPlan === "pro" ? "text-white font-bold" : "text-neutral-500 font-medium"
                    }`}
                  >
                    Pro
                  </button>
                </div>
                <span className="text-white text-base font-normal font-['Montserrat'] leading-5">{mobileComparisonPrice}</span>
              </div>
              <div className="w-full flex justify-between items-start">
                <div className="flex-1 flex flex-col">
                  {comparisonRows.map((row, i) => (
                    <div key={i} className="h-36 px-3.5 py-6 border-t border-zinc-800 flex flex-col justify-center items-start">
                      <span className="text-white text-base font-bold font-['Montserrat'] leading-5">{row.feature}</span>
                      <span className="text-white text-sm font-normal font-['Montserrat'] leading-5">{row.description}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col">
                  {comparisonRows.map((row, i) => (
                    <div
                      key={i}
                      className="h-36 px-5 py-6 border-l border-t border-zinc-800 flex flex-col justify-center items-center gap-2.5"
                    >
                      <span className="text-center text-white text-base font-normal font-['Montserrat'] leading-5">
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
                  <span className="text-white text-lg font-bold font-['Montserrat']">Features</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 border-t border-b border-zinc-800 flex flex-col justify-center items-start">
                    <span className="text-white text-base font-bold font-['Montserrat'] leading-6">{row.feature}</span>
                    <span className="text-white text-sm font-normal font-['Montserrat'] leading-5">{row.description}</span>
                  </div>
                ))}
              </div>

              {/* Basic column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-r border-zinc-800 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-['Montserrat']">Basic</span>
                  <span className="text-white text-sm font-normal font-['Montserrat'] leading-5">34€</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 outline outline-1 outline-offset-[-1px] outline-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-['Montserrat'] leading-6">{row.basic}</span>
                  </div>
                ))}
              </div>

              {/* Essential column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-r border-zinc-800 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-['Montserrat']">Essential</span>
                  <span className="text-white text-sm font-normal font-['Montserrat'] leading-5">39€</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 outline outline-1 outline-offset-[-1px] outline-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-['Montserrat'] leading-6">{row.essential}</span>
                  </div>
                ))}
              </div>

              {/* Pro column */}
              <div className="flex-1 flex flex-col">
                <div className="p-5 flex justify-between items-end">
                  <span className="text-white text-lg font-bold font-['Montserrat']">Pro</span>
                  <span className="text-white text-sm font-normal font-['Montserrat'] leading-5">200€</span>
                </div>
                {comparisonRows.map((row, i) => (
                  <div key={i} className="h-36 px-5 py-6 border-l border-t border-b border-zinc-800 flex flex-col justify-center items-center gap-2.5">
                    <span className="text-center text-white text-base font-normal font-['Montserrat'] leading-6">{row.pro}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <FaqSection />
      <div className="w-[calc(100%+8rem)] -mx-16">
        <FinalCtaSection />
      </div>
    </div>
  );
}
