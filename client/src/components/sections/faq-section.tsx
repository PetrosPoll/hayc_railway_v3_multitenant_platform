import { useState } from "react";
import { useTranslation } from "react-i18next";

type FaqSectionProps = {
  className?: string;
};

export function FaqSection({ className = "bg-black" }: FaqSectionProps) {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = (t("home.faqSection.items", { returnObjects: true }) as Array<{ question: string; answer: string }>);

  const toggleFaq = (i: number) => setOpenFaq((prev) => (prev === i ? null : i));

  return (
    <section className={`w-full ${className}`}>
      <div className="max-w-screen-xl mx-auto px-4 py-[50px] flex flex-col gap-12">
        <div className="w-full flex flex-col items-start">
          <h2 className="text-3xl lg:text-5xl font-semibold font-brand lg:leading-[70px] leading-10">
            <span className="text-white">{t("home.faqSection.titlePrefix")} </span>
            <span className="text-[#ED4C14]">{t("home.faqSection.titleHighlightLine1")} {t("home.faqSection.titleHighlightLine2")}</span>
            <span className="text-white">{t("home.faqSection.titleSuffix")}</span>
          </h2>
          <p className="text-base font-normal font-brand leading-6 text-white mt-2">
            {t("home.faqSection.subtitle")}
          </p>
        </div>

        <div className="w-full flex flex-col">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border-t border-b border-zinc-800 px-2.5 py-6 flex flex-col gap-6 cursor-pointer"
              onClick={() => toggleFaq(i)}
            >
              <div className="flex justify-between items-center gap-4">
                <p className="text-xl font-medium font-brand leading-7 text-white flex-1">
                  {faq.question}
                </p>
                <img
                  src={openFaq === i ? "https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/OPEN.svg" : "https://res.cloudinary.com/dem12vqtl/image/upload/f_auto,q_auto/public/images/CLOSE.svg"}
                  alt={openFaq === i ? t("home.faqSection.icons.openAlt") : t("home.faqSection.icons.closeAlt")}
                  loading="lazy"
                  className="w-6 h-6"
                />
              </div>

              {openFaq === i && faq.answer && (
                <p className="text-base font-normal font-brand leading-5 text-white">
                  {faq.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
