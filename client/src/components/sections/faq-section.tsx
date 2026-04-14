import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQS: FaqItem[] = [
  {
    question: "What is HAYC and how does it work?",
    answer: "HAYC is your website partner. You choose a design, tell us what you need, and we build it for you, start to finish. Later on, you can manage your website, track its progress, and expand its capabilities through your dashboard.",
  },
  {
    question: "Can I build an e-shop or online store with HAYC?",
    answer: "",
  },
  {
    question: "What if I already have a domain name?",
    answer: "",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "",
  },
  {
    question: "What do I need to do on my end for you to build the website?",
    answer: "",
  },
  {
    question: "Can I change my subscription plan later?",
    answer: "",
  },
];

export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section className="w-full px-16 py-24 bg-black flex flex-col justify-start items-start gap-12">
      <div className="w-[580px] flex flex-col justify-start items-start gap-2">
        <h2 className="text-5xl font-semibold font-['Montserrat'] leading-[70px]">
          <span className="text-white">Imagine Wix, </span>
          <span className="text-[#ED4C14]">without<br />the DIY</span>
          <span className="text-white">.</span>
        </h2>
        <p className="text-white text-base font-normal font-['Montserrat'] leading-6">
          That's what HAYC is. We build it. You use it. No stress, no setup, just results.
        </p>
      </div>

      <div className="w-full flex flex-col">
        {FAQS.map((faq, i) => (
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
                {faq.question}
              </span>
              {openFaq === i ? (
                <img src="/images/CLOSE.svg" alt="Open" className="w-6 h-6 flex-shrink-0" />
              ) : (
                <img src="/images/OPEN.svg" alt="Close" className="w-6 h-6 flex-shrink-0" />
              )}
            </button>
            {openFaq === i && faq.answer && (
              <p className="text-white text-base font-normal font-['Montserrat'] leading-5">
                {faq.answer}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

