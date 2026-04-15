import { useState } from "react";
import { useTranslation } from "react-i18next";

type FaqItem = {
  questionKey: string;
  answerKey: string;
};

const FAQS: FaqItem[] = [
  {
    questionKey: "home.faqSection.items.0.question",
    answerKey: "home.faqSection.items.0.answer",
  },
  {
    questionKey: "home.faqSection.items.1.question",
    answerKey: "home.faqSection.items.1.answer",
  },
  {
    questionKey: "home.faqSection.items.2.question",
    answerKey: "home.faqSection.items.2.answer",
  },
  {
    questionKey: "home.faqSection.items.3.question",
    answerKey: "home.faqSection.items.3.answer",
  },
  {
    questionKey: "home.faqSection.items.4.question",
    answerKey: "home.faqSection.items.4.answer",
  },
  {
    questionKey: "home.faqSection.items.5.question",
    answerKey: "home.faqSection.items.5.answer",
  },
];

export function FaqSection() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="w-full px-16 py-24 bg-black flex flex-col justify-start items-start gap-12">
      <div className="w-[580px] flex flex-col justify-start items-start gap-2">
        <h2 className="text-5xl font-semibold font-['Montserrat'] leading-[70px]">
          <span className="text-white">{t("home.faqSection.titlePrefix")} </span>
          <span className="text-[#ED4C14]">
            {t("home.faqSection.titleHighlightLine1")}
            <br />
            {t("home.faqSection.titleHighlightLine2")}
          </span>
          <span className="text-white">{t("home.faqSection.titleSuffix")}</span>
        </h2>
        <p className="text-white text-base font-normal font-['Montserrat'] leading-6">
          {t("home.faqSection.subtitle")}
        </p>
      </div>

      <div className="w-full flex flex-col">
        {FAQS.map((faq, i) => {
          const answer = t(faq.answerKey, { defaultValue: "" });
          return (
          <div
            key={i}
            className="w-full p-6 border-t border-b border-zinc-800 flex flex-col justify-start items-start gap-6"
          >
            <button
              type="button"
              className="w-full flex justify-between items-center text-left"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <span className="text-white text-xl font-medium font-['Montserrat'] leading-7 pr-4">
                {t(faq.questionKey)}
              </span>
              {openFaq === i ? (
                <img src="/images/CLOSE.svg" alt={t("home.faqSection.icons.closeAlt")} className="w-6 h-6 flex-shrink-0" />
              ) : (
                <img src="/images/OPEN.svg" alt={t("home.faqSection.icons.openAlt")} className="w-6 h-6 flex-shrink-0" />
              )}
            </button>
            {openFaq === i && answer && (
              <p className="text-white text-base font-normal font-['Montserrat'] leading-5">
                {answer}
              </p>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}

