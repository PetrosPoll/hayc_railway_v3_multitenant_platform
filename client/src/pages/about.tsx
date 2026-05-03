
import React, { useState } from "react";
import { ArrowRight, Code, PiggyBank, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCtaSection } from "@/components/sections/final-cta-section";

export default function AboutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openProcess, setOpenProcess] = useState<number>(0);

  const processSteps = [
    { num: "01", title: "Pick a Template", description: "Subscribe in seconds and get started." },
    { num: "02", title: "Share your needs", description: "Tell us about your business and what you need." },
    { num: "03", title: "We launch fast", description: "We build and launch your website in days." },
    { num: "04", title: "Stay in control", description: "Manage your site and grow through your dashboard." },
  ];

  return (
    <div className="min-h-screen bg-background mt-[65px]">
      {/* About Page Header */}
      <section className="w-full px-4 lg:px-16 pt-12 pb-24 bg-black flex flex-col justify-center items-center gap-6">
        {/* 3D Asterisk video */}
        <div className="h-64 w-64 overflow-hidden lg:h-72 lg:w-72">
          <video
            src="/videos/asterisk_1_jtw9zn.mp4"
            className="h-full w-full object-cover object-center mix-blend-screen brightness-110 contrast-125"
            autoPlay
            muted
            loop
            playsInline
            aria-label="HAYC asterisk"
          />
        </div>

        {/* Content */}
        <div className="w-full lg:w-[736px] flex flex-col justify-center items-center gap-12">
          <div className="flex flex-col justify-start items-end gap-3">
            <h1 className="text-center text-3xl lg:text-6xl leading-10 lg:leading-tight font-semibold font-['Montserrat']">
              <span className="text-[#ED4C14]">Helping businesses</span>
              <span className="text-white"> get successfully online.</span>
            </h1>
            <p className="text-center text-white text-base lg:text-lg font-normal lg:font-medium leading-5 lg:leading-normal font-['Montserrat']">
              HAYC isn't a DIY website builder. It's a website creation service. Choose a template, and we take care of build, hosting, and ongoing updates.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col lg:flex-row justify-center lg:justify-start items-center lg:items-start gap-3">
            <button
              className="h-11 px-5 py-3.5 bg-[#A0BAF3] rounded-[10px] flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
              onClick={() => navigate('/templates')}
            >
              <span className="text-center text-[#0C275F] text-base font-semibold font-['Montserrat'] leading-5">
                Explore Templates
              </span>
              <ArrowRight className="h-4 w-4 text-[#0C275F]" />
            </button>
            <button
              className="h-11 px-5 py-3.5 bg-[#A0BAF3] rounded-[10px] flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
              onClick={() => navigate('/contact')}
            >
              <span className="text-center text-[#0C275F] text-base font-semibold font-['Montserrat'] leading-5">
                Contact us
              </span>
              <ArrowRight className="h-4 w-4 text-[#0C275F]" />
            </button>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="w-full bg-black flex flex-col lg:flex-row px-4 lg:px-16 py-12 lg:py-24 gap-6 lg:gap-20">
        <div className="text-[#ED4C14] text-lg font-medium font-['Montserrat'] text-left lg:text-right lg:w-32 lg:flex-shrink-0">
          OUR MISSION
        </div>
        <div className="text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px] flex-1">
          <span className="text-white">To launch professional websites in days, then keep them evolving </span>
          <span className="text-white/30">with ongoing support and new features.</span>
        </div>
      </section>

      {/* Vision Section */}
      <div className="w-full bg-black flex flex-col lg:flex-row px-4 lg:px-16 py-12 lg:py-24 gap-6 lg:gap-20">
        <div className="text-[#ED4C14] text-lg font-medium font-['Montserrat'] text-left lg:text-right lg:w-32 lg:flex-shrink-0">
          OUR VISION
        </div>
        <div className="self-stretch justify-start">
          <span className="text-white text-3xl font-semibold font-['Montserrat'] leading-10">A world where every small business can have a modern, reliable </span>
          <span className="text-white/30 text-3xl font-semibold font-['Montserrat'] leading-10">website without needing a team, tools, or tech stress.</span>
        </div>
      </div>

      {/* Full Width Video */}
      <div className="w-full h-52 lg:h-[800px] bg-black overflow-hidden">
        <video
          src="/videos/Logo_Animation_1_g2fcoo.mp4"
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-label="HAYC logo animation"
        />
      </div>

      {/* Stats Section */}
      <section className="w-full bg-black flex flex-col lg:flex-row justify-center items-center px-4 lg:px-16 py-24 gap-20 lg:gap-48">
        <div className="flex-1 flex flex-col justify-center items-center">
          <span className="text-center text-white text-4xl lg:text-6xl font-semibold font-['Montserrat']">99%</span>
          <span className="text-center text-white text-lg font-medium font-['Montserrat']">uptime guarantee</span>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center">
          <span className="text-center text-white text-4xl lg:text-6xl font-semibold font-['Montserrat']">Save 20%</span>
          <span className="text-center text-white text-lg font-medium font-['Montserrat']">on annual plans</span>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center">
          <span className="text-center text-white text-4xl lg:text-6xl font-semibold font-['Montserrat']">30-day</span>
          <span className="text-center text-white text-lg font-medium font-['Montserrat']">money-back guarantee</span>
        </div>
      </section>

      {/* Process Section */}
      <section className="w-full px-4 lg:px-16 py-12 lg:py-24 bg-black flex flex-col justify-start items-start gap-2.5">
        {/* Header */}
        <div className="w-full py-12 flex flex-col lg:flex-row justify-start items-start gap-6 lg:gap-20">
          <div className="text-left lg:text-right lg:w-36 lg:flex-shrink-0 text-[#ED4C14] text-lg font-medium font-['Montserrat']">
            OUR PROCESS
          </div>
          <div className="flex-1 text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px]">
            <span className="text-white">We created our process to feel effortle</span>
            <span className="text-white/30">ss and help every business get the website it deserves with ease.</span>
          </div>
        </div>

        {/* Cards */}
        <div className="w-full flex flex-col lg:flex-row justify-start items-center gap-3">
          {processSteps.map((step, i) => {
            const isOpen = openProcess === i;
            return (
              <div
                key={i}
                onClick={() => setOpenProcess(i)}
                className={`px-6 pt-6 pb-12 rounded-[10px] flex flex-col justify-start items-start gap-2 cursor-pointer transition-all duration-300 ${
                  isOpen
                    ? 'w-full lg:flex-1 h-96 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 outline outline-1 outline-offset-[-1px] outline-white/80'
                    : 'w-full lg:w-56 lg:h-96 bg-gradient-to-br from-neutral-700/0 to-neutral-700/10 outline outline-1 outline-offset-[-1px] outline-white/50'
                }`}
                style={{ flexShrink: isOpen ? 1 : 0 }}
              >
                <span className={`text-2xl font-medium font-['Montserrat'] ${isOpen ? 'text-white' : 'text-white/30'}`}>
                  {step.num}
                </span>
                <div className="flex-1 flex flex-col justify-start items-start">
                  <span className={`text-2xl lg:text-4xl font-semibold font-['Montserrat'] ${isOpen ? 'text-white' : 'text-white/30'}`}>
                    {step.title}
                  </span>
                  {isOpen && (
                    <span className="text-white text-2xl font-medium font-['Montserrat'] mt-auto">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <TestimonialsSection />
      <FaqSection />
      <FinalCtaSection />

    </div>
  );
}
