import { useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  FaEnvelope,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaPhone,
} from "react-icons/fa";
import { useNoIndex } from "@/hooks/use-noindex";
import { getContactCard, type ContactCardLinkKind } from "@shared/contact-cards";

const LINK_ICONS: Record<ContactCardLinkKind, typeof FaPhone> = {
  phone: FaPhone,
  email: FaEnvelope,
  website: FaGlobe,
  instagram: FaInstagram,
  facebook: FaFacebookF,
  linkedin: FaLinkedinIn,
};

export default function ContactCardPage() {
  const { slug = "" } = useParams();
  const card = getContactCard(slug);

  useNoIndex();

  useEffect(() => {
    document.title = card ? `${card.name} · hayc` : "hayc";
  }, [card]);

  return (
    <main className="flex min-h-[100dvh] w-full justify-center bg-[radial-gradient(120%_70%_at_50%_-10%,#2777E9_0%,#182B53_45%,#101b33_100%)] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-white font-brand">
      {card ? (
        <div className="flex w-full max-w-[420px] flex-col items-center">
          <p className="mb-8 text-[28px] font-semibold leading-none tracking-tight">
            <span className="text-[#ED4C14]">*</span>hayc
          </p>
          <div className="mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-white text-[28px] font-semibold text-[#182B53] ring-2 ring-[#ED4C14]">
            {card.initials}
          </div>
          <h1 className="text-center text-[28px] font-semibold leading-tight">{card.name}</h1>
          <p className="mt-2 text-sm font-medium text-[#A0BAF3]">{card.role}</p>
          <p className="mt-4 max-w-[320px] text-center text-sm leading-relaxed text-white/80">{card.bio}</p>

          <div className="mt-8 flex w-full flex-col gap-3">
            {card.links.map((link) => {
              const Icon = LINK_ICONS[link.kind];
              const external = link.href.startsWith("http");
              return (
                <a
                  key={link.kind}
                  href={link.href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 text-[15px] font-semibold text-[#182B53] transition hover:bg-[#EFF8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Icon className="text-[16px]" aria-hidden />
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="m-auto text-center text-lg">Η κάρτα δεν βρέθηκε.</p>
      )}
    </main>
  );
}
