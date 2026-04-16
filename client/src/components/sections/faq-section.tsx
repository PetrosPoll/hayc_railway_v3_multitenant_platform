import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "What is HAYC and how does it work?",
    answer:
      "HAYC is your website partner. You choose a design, tell us what you need, and we build it for you, start to finish. Later on, you can manage your website, track its progress, and expand its capabilities through your dashboard.",
  },
  { question: "Can I build an e-shop or online store with HAYC?", answer: "" },
  { question: "What if I already have a domain name?", answer: "" },
  { question: "Can I cancel my subscription anytime?", answer: "" },
  { question: "What do I need to do on my end for you to build the website?", answer: "" },
  { question: "Can I change my subscription plan later?", answer: "" },
];

export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (i: number) => setOpenFaq((prev) => (prev === i ? null : i));

  return (
    <section className="w-full bg-black">
      <div className="max-w-screen-xl mx-auto px-4 py-[50px] flex flex-col gap-12">
        <div className="w-full flex flex-col items-start">
          <h2 className="text-3xl lg:text-5xl font-semibold font-['Montserrat'] lg:leading-[70px] leading-10">
            <span className="text-white">Imagine Wix, </span>
            <span className="text-[#ED4C14]">without the DIY</span>
            <span className="text-white">.</span>
          </h2>
          <p className="text-base font-normal font-['Montserrat'] leading-6 text-white mt-2">
            That's what HAYC is. We build it. You use it. No stress, no setup, just results.
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
                <p className="text-xl font-medium font-['Montserrat'] leading-7 text-white flex-1">
                  {faq.question}
                </p>
                <img
                  src={openFaq === i ? "/images/OPEN.svg" : "/images/CLOSE.svg"}
                  alt={openFaq === i ? "open icon" : "close icon"}
                  className="w-6 h-6"
                />
              </div>

              {openFaq === i && faq.answer && (
                <p className="text-base font-normal font-['Montserrat'] leading-5 text-white">
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

