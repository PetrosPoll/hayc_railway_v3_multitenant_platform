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
  { question: "Can I build an e-shop or online store with HAYC?", answer:
      "Not in the traditional sense — HAYC doesn't build self-managed e-shops. However, you can add online payment capabilities and booking systems through our add-ons, which we set up and integrate for you.",
  },
  { question: "What if I already have a domain name?", answer:
      "No problem. We can connect your existing domain to your new HAYC website. Just let us know during onboarding and we'll handle the setup.",
  },
  { question: "Can I cancel my subscription anytime?", answer:
      "Yes. You can cancel at any time from your dashboard. Your website stays live until the end of your current billing period, and we offer a 30-day money-back guarantee if you're not satisfied.",
  },
  { question: "What do I need to do on my end for you to build the website?", answer:
      "After subscribing, you fill in a short onboarding form — your business name, what you do, the features you need, and any content like your logo, photos, and text. Our team takes it from there and reaches out if we need anything else.",
  },
  { question: "Can I change my subscription plan later?", answer:
      "Yes. You can upgrade or change your plan at any time from your dashboard. Add-ons can also be added after your website is already live.",
  },
];

type FaqSectionProps = {
  className?: string;
};

export function FaqSection({ className = "bg-black" }: FaqSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (i: number) => setOpenFaq((prev) => (prev === i ? null : i));

  return (
    <section className={`w-full ${className}`}>
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
                  src={openFaq === i ? "https://res.cloudinary.com/dem12vqtl/image/upload/public/images/OPEN.svg" : "https://res.cloudinary.com/dem12vqtl/image/upload/public/images/CLOSE.svg"}
                  alt={openFaq === i ? "open icon" : "close icon"}
                  loading="lazy"
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

