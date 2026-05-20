
import React, { useRef, useEffect, useState } from "react";
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
  const [bgLoaded, setBgLoaded] = useState(false);
  const missionRef = useRef<HTMLDivElement | null>(null);
  const [missionProgress, setMissionProgress] = useState(0);
  const visionRef = useRef<HTMLDivElement | null>(null);
  const [visionProgress, setVisionProgress] = useState(0);
  const processRef = useRef<HTMLDivElement | null>(null);
  const [processProgress, setProcessProgress] = useState(0);

  const processSteps = [
    { num: "01", title: "Pick a Template", description: "Subscribe in seconds and get started." },
    { num: "02", title: "Share your needs", description: "Tell us about your business and what you need." },
    { num: "03", title: "We launch fast", description: "We build and launch your website in days." },
    { num: "04", title: "Stay in control", description: "Manage your site and grow through your dashboard." },
  ];

  useEffect(() => {
    const getProgress = (el: HTMLDivElement | null) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;
      return Math.min(
        1,
        Math.max(0, (windowH - rect.top) / (windowH * 0.7))
      );
    };

    const handleScroll = () => {
      setMissionProgress(getProgress(missionRef.current));
      setVisionProgress(getProgress(visionRef.current));
      setProcessProgress(getProgress(processRef.current));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* About Page Header */}
      <div className="w-full relative pt-[65px]">
        <section className="relative w-full">
          <div className="w-full max-w-7xl mx-auto px-4 lg:px-16 pt-12 pb-24 flex flex-col justify-center items-center gap-6">
              {/* 3D Asterisk video */}
              <div className="h-64 w-64 overflow-hidden lg:h-72 lg:w-72">
                <video
                  src="https://d8zdlelupx224.cloudfront.net/asterisk_1_jtw9zn.mp4"
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
                    onClick={() => navigate("/templates")}
                  >
                    <span className="text-center text-[#0C275F] text-base font-semibold font-['Montserrat'] leading-5">
                      Explore Templates
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#0C275F]" />
                  </button>
                  <button
                    className="h-11 px-5 py-3.5 bg-[#A0BAF3] rounded-[10px] flex justify-start items-center gap-4 hover:opacity-80 transition-opacity"
                    onClick={() => navigate("/contact")}
                  >
                    <span className="text-center text-[#0C275F] text-base font-semibold font-['Montserrat'] leading-5">
                      Contact us
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#0C275F]" />
                  </button>
                </div>
              </div>
          </div>
        </section>
      </div>

      {/* Mission Section */}
      <section className="w-full bg-black">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row px-4 lg:px-16 py-12 lg:py-24 gap-6 lg:gap-20">
          <div className="text-[#ED4C14] text-lg font-medium font-['Montserrat'] text-left lg:text-right lg:w-32 lg:flex-shrink-0">
            OUR MISSION
          </div>
          <div
            ref={missionRef}
            className="text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px] flex-1"
          >
            {(() => {
              const allWords = "To launch professional websites in days, then keep them evolving with ongoing support and new features.".split(" ");
              const totalWords = allWords.length;

              return allWords.map((word, i) => {
                const threshold = i / totalWords;
                const wordProgress = Math.min(
                  1,
                  Math.max(0, (missionProgress - threshold) / (1 / totalWords))
                );
                const opacity = 0.15 + wordProgress * 0.85;
                return (
                  <span
                    key={i}
                    className="text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px] text-white transition-opacity duration-200"
                    style={{ opacity }}
                  >
                    {word}{" "}
                  </span>
                );
              });
            })()}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="w-full bg-black">
        <div
          ref={visionRef}
          className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row px-4 lg:px-16 py-12 lg:py-24 gap-6 lg:gap-20"
        >
          <div className="text-[#ED4C14] text-lg font-medium font-['Montserrat'] text-left lg:text-right lg:w-32 lg:flex-shrink-0">
            OUR VISION
          </div>
          <div className="self-stretch">
            {(() => {
              const whiteWords = "A world where every small business can have a modern, reliable".split(" ");
              const fadedWords = "website without needing a team, tools, or tech stress.".split(" ");
              const allWords = [...whiteWords, ...fadedWords];
              const totalWords = allWords.length;

              return allWords.map((word, i) => {
                const threshold = i / totalWords;
                const wordProgress = Math.min(
                  1,
                  Math.max(0, (visionProgress - threshold) / (1 / totalWords))
                );
                const opacity = 0.15 + wordProgress * 0.85;
                return (
                  <span
                    key={i}
                    className="text-3xl font-semibold font-['Montserrat'] leading-10 text-white transition-opacity duration-200"
                    style={{ opacity }}
                  >
                    {word}{" "}
                  </span>
                );
              });
            })()}
          </div>
        </div>
      </section>

      {/* Full Width Video */}
      <div className="w-full h-52 lg:h-[800px] bg-black overflow-hidden">
        <video
          src="https://d8zdlelupx224.cloudfront.net/Logo_Animation_1_g2fcoo.mp4"
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-label="HAYC logo animation"
        />
      </div>

      {/* Stats + Process — about_first bg */}
      <div className="relative w-full overflow-hidden pb-8">
        <img
          src="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/about_first_desktop.png"
          srcSet="https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/about_first_mobile.png 767w, https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/about_first_desktop.png 768w"
          sizes="(max-width: 767px) 100vw, 100vw"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className={`absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-300 ${bgLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setBgLoaded(true)}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] z-[1] h-40 w-screen max-w-[100vw] bg-gradient-to-b from-transparent to-black lg:h-48"
        />

        <div className="relative z-10 w-full">
          <section className="relative w-full">
            <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-center px-4 lg:px-16 py-24 gap-20 lg:gap-48">
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
            </div>
          </section>

          <section className="relative w-full">
            <div className="w-full max-w-7xl mx-auto px-4 lg:px-16 py-12 lg:py-24 flex flex-col justify-start items-start gap-2.5">
          {/* Header */}
          <div className="w-full py-12 flex flex-col lg:flex-row justify-start items-start gap-6 lg:gap-20">
            <div className="text-left lg:text-right lg:w-36 lg:flex-shrink-0 text-[#ED4C14] text-lg font-medium font-['Montserrat']">
              OUR PROCESS
            </div>
            <div
              ref={processRef}
              className="flex-1 text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px]"
            >
              {(() => {
                const allWords = "We created our process to feel effortless and help every business get the website it deserves with ease.".split(" ");
                const totalWords = allWords.length;

                return allWords.map((word, i) => {
                  const threshold = i / totalWords;
                  const wordProgress = Math.min(
                    1,
                    Math.max(0, (processProgress - threshold) / (1 / totalWords))
                  );
                  const opacity = 0.15 + wordProgress * 0.85;
                  return (
                    <span
                      key={i}
                      className="text-3xl lg:text-5xl font-semibold font-['Montserrat'] leading-10 lg:leading-[70px] text-white transition-opacity duration-200"
                      style={{ opacity }}
                    >
                      {word}{" "}
                    </span>
                  );
                });
              })()}
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
                  className={`px-6 pt-6 pb-12 rounded-[10px] flex flex-col justify-start items-start gap-2 cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isOpen
                      ? "w-full lg:flex-1 h-96 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 outline outline-1 outline-offset-[-1px] outline-white/80"
                      : "w-full lg:w-56 lg:h-96 bg-gradient-to-br from-neutral-700/0 to-neutral-700/10 outline outline-1 outline-offset-[-1px] outline-white/50"
                  }`}
                  style={{ flexShrink: isOpen ? 1 : 0 }}
                >
                  <span className={`text-2xl font-medium font-['Montserrat'] transition-colors duration-300 ${isOpen ? "text-white" : "text-white/30"}`}>
                    {step.num}
                  </span>
                  <div className="flex-1 flex flex-col justify-start items-start">
                    <span className={`text-2xl lg:text-4xl font-semibold font-['Montserrat'] transition-colors duration-300 ${isOpen ? "text-white" : "text-white/30"}`}>
                      {step.title}
                    </span>
                    <span
                      className={`text-white text-2xl font-medium font-['Montserrat'] mt-auto overflow-hidden transition-all duration-400 ease-out ${
                        isOpen ? "max-h-24 opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-2"
                      }`}
                    >
                      {step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative -mt-24 w-full overflow-hidden pt-24 flex flex-col items-center px-4 lg:px-16 pb-16 lg:-mt-32 lg:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/about_second_mobile.png')] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[calc(50%-50vw)] hidden w-screen max-w-[100vw] bg-cover bg-left-top bg-no-repeat bg-[url('https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/about_second_desktop.png')] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_82%,transparent_100%)] lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-[calc(50%-50vw)] z-[1] h-40 w-screen max-w-[100vw] bg-gradient-to-b from-black to-transparent lg:h-48"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] z-[1] h-32 w-screen max-w-[100vw] bg-gradient-to-b from-transparent to-black lg:h-40"
        />

        <div className="relative z-10 w-full flex flex-col items-center gap-12">
          <TestimonialsSection className="bg-transparent relative z-10" />
          <FaqSection className="bg-transparent relative z-10" />
        </div>
      </div>

      <FinalCtaSection />
    </div>
  );
}
