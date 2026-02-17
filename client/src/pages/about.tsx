
import React from "react";
import { Code, PiggyBank, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AboutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background mt-[65px]">
      {/* Hero Section - Blue Background with Main Goal */}
      <section className="bg-[#3b5698] text-white py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg mb-4 uppercase tracking-wide opacity-90">
              {t("about.hero.subtitle")}
            </p>
            <h1 className="text-4xl font-bold mb-8">
              {t("about.hero.mainTitle")}
            </h1>
            <p className="text-xl md:text-2xl mb-2">
              {t("about.hero.description1")}
            </p>
            <p className="text-xl md:text-2xl mb-2">
              {t("about.hero.description2")}
            </p>
            <p className="text-2xl md:text-3xl font-bold">
              {t("about.hero.description3")}
            </p>
          </div>
        </div>
      </section>

      {/* How hayc Works Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 text-[#182B53]">
              {t("about.howItWorks.title")}
            </h2>
            <div className="text-center text-lg text-[#182B53] leading-relaxed">
              <p className="mb-6">
                {t("about.howItWorks.description")}
                <span className="text-green-600 font-semibold">
                  {t("about.howItWorks.guarantee")}
                </span>
                {t("about.howItWorks.continuedDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different Section */}
      {/* <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16 text-[#182B53]">
            {t("about.differences.title")}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

            <div className="text-center">
              <div className="mb-6">
                <Code className="w-12 h-12 text-[#3b5698] mx-auto" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#182B53]">
                {t("about.differences.customCoded.title")}
              </h3>
              <p className="text-[#182B53] leading-relaxed">
                {t("about.differences.customCoded.description")}
                <span className="font-semibold">
                  {t("about.differences.customCoded.highlight")}
                </span>
                {t("about.differences.customCoded.continuedDescription")}
              </p>
            </div>


            <div className="text-center">
              <div className="mb-6">
                <PiggyBank className="w-12 h-12 text-[#3b5698] mx-auto" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#182B53]">
                {t("about.differences.zeroRisk.title")}
              </h3>
              <p className="text-[#182B53] leading-relaxed">
                {t("about.differences.zeroRisk.description")}
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <Shield className="w-12 h-12 text-[#3b5698] mx-auto" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-[#182B53]">
                {t("about.differences.fullPayment.title")}
              </h3>
              <p className="text-[#182B53] leading-relaxed">
                {t("about.differences.fullPayment.description")}
              </p>
            </div>
          </div>
        </div>
      </section>  */}

      {/* Call to Action Section */}
      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4 text-[#182B53]">
              {t("about.cta.title")}
            </h2>
            <p className="text-xl mb-8 text-[#182B53]">
              {t("about.cta.subtitle")}
            </p>
            <Button 
              size="lg"
              className="bg-[#3b5698] hover:bg-[#2d4578] text-white px-8 py-4 text-lg"
              onClick={() => navigate("/contact")}
            >
              {t("about.cta.button")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
