import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

export function AddonsSection() {
  const { t } = useTranslation();
  const [openAddon, setOpenAddon] = useState<string | null>("home.addonsSection.categories.businessTools.title");

  const addonCategories = [
    {
      titleKey: "home.addonsSection.categories.businessTools.title",
      descriptionKey: "home.addonsSection.categories.businessTools.description",
      addonKeys: [
        "home.addonsSection.categories.businessTools.addons.bookingSystem",
        "home.addonsSection.categories.businessTools.addons.transportBooking",
        "home.addonsSection.categories.businessTools.addons.donationSystem",
      ],
    },
    {
      titleKey: "home.addonsSection.categories.digitalPayments.title",
      descriptionKey: "home.addonsSection.categories.digitalPayments.description",
      addonKeys: ["home.addonsSection.categories.digitalPayments.addons.onlinePayments"],
    },
    {
      titleKey: "home.addonsSection.categories.engagementData.title",
      descriptionKey: "home.addonsSection.categories.engagementData.description",
      addonKeys: ["home.addonsSection.categories.engagementData.addons.analyticsDashboard"],
    },
    {
      titleKey: "home.addonsSection.categories.educationContent.title",
      descriptionKey: "home.addonsSection.categories.educationContent.description",
      addonKeys: ["home.addonsSection.categories.educationContent.addons.lms"],
    },
    {
      titleKey: "home.addonsSection.categories.specializedSolutions.title",
      descriptionKey: "home.addonsSection.categories.specializedSolutions.description",
      addonKeys: ["home.addonsSection.categories.specializedSolutions.addons.customIntegration"],
    },
  ];

  return (
    <section className="w-full px-4 md:px-16 py-12 md:py-24 bg-black overflow-hidden relative">
      {/* <div className="hidden md:flex absolute right-[340px] top-1/2 -translate-y-1/2 w-[400px] h-[400px] items-center justify-center pointer-events-none z-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24.24 23.468"
          className="w-56 h-56"
          fill="none"
        >
          <path
            d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
            fill="#ED4C14"
            opacity="0.35"
          />
        </svg>
      </div> */}

      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-start items-start md:items-center gap-12 md:gap-24">
        {/* Left content */}
        <div className="w-full md:flex-1 flex flex-col justify-start items-start gap-12 relative z-10 md:max-w-2xl">
          <div className="flex flex-col justify-start items-start gap-6">
            <h2 className="text-3xl md:text-5xl font-semibold font-['Inter'] leading-10 md:leading-normal">
              <span className="text-white">Your </span>
              <span className="text-[#ED4C14]">website<br /></span>
              <span className="text-white">can </span>
              <span className="text-[#ED4C14]">grow</span>
              <span className="text-white"> with you.</span>
            </h2>
            <p className="text-white text-base font-normal font-['Montserrat'] leading-5 md:leading-6 max-w-full md:max-w-lg">
              {t("home.addonsSection.description")}
            </p>
          </div>

          {/* Accordion */}
          <div className="w-full md:w-[473px] flex flex-col gap-3">
            {addonCategories.map((cat, i) => {
              const isOpen = openAddon === cat.titleKey;
              return (
                <div
                  key={i}
                  className="w-full md:w-auto py-3 border-b border-black/30 md:border-none flex flex-col gap-6"
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setOpenAddon(cat.titleKey)}
                  >
                    {isOpen && (
                      <ArrowRight className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
                    )}
                    <span className={`font-['Montserrat'] font-medium ${
                      isOpen
                        ? "text-2xl text-white"
                        : "text-xl md:text-2xl text-white/50 leading-7"
                    }`}
                    >
                      {t(cat.titleKey)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-3">
                      <div className="pl-8">
                        <p className="text-white text-base font-normal font-['Montserrat'] leading-5">
                          {t(cat.descriptionKey)}
                        </p>
                      </div>
                      <div className="pl-8 flex flex-col md:flex-row items-start md:items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold font-['Montserrat'] tracking-tight">{t("home.addonsSection.addonsLabel")}</span>
                        <div className="flex flex-col md:flex-row gap-1 md:gap-2.5">
                          {cat.addonKeys.map((addonKey, j) => (
                            <span key={j} className="text-indigo-300 text-sm font-medium font-['Montserrat']">
                              {t(addonKey)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* <img
                        src="/images/addons_section.png"
                        alt={t(cat.titleKey)}
                        className="md:hidden w-full h-[320px] rounded-[20px] object-cover mt-3"
                        style={{ height: '320px' }}
                      /> */}
                      <div className="md:hidden w-full h-[320px] bg-neutral-700/30 rounded-[20px] mt-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side image space */}
        <div className="hidden md:flex w-[793px] h-[799px] flex-shrink-0 relative z-10">
          {/* <img
            src="/images/addons_section.png"
            alt="Add-ons illustration"
            className="w-full h-full object-cover rounded-tl-[20px] rounded-bl-[20px]"
          /> */}
          <div className="w-full w-[793px] h-[799px] bg-neutral-700/30 rounded-[20px] md:rounded-tl-[20px] md:rounded-bl-[20px] md:rounded-tr-none md:rounded-br-none" />
        </div>
      </div>
    </section>
  );
}
