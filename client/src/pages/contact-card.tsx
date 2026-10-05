import { useEffect, useState } from "react";
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
import {
  getContactCard,
  type ContactCard,
  type ContactCardLinkKind,
} from "@shared/contact-cards";

const LINK_ICONS: Record<ContactCardLinkKind, typeof FaPhone> = {
  phone: FaPhone,
  email: FaEnvelope,
  website: FaGlobe,
  instagram: FaInstagram,
  facebook: FaFacebookF,
  linkedin: FaLinkedinIn,
};

type WalletStatus = {
  available: boolean;
  url: string;
};

export default function ContactCardPage() {
  const { slug = "" } = useParams();
  const card = getContactCard(slug);
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useNoIndex();

  useEffect(() => {
    document.title = card ? `${card.name} · hayc` : "hayc";
  }, [card]);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    fetch(`/cards/${card.slug}/wallet`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: WalletStatus | null) => {
        if (cancelled) return;
        setWallet(data ?? { available: false, url: `https://hayc.gr/card/${card.slug}` });
      })
      .catch(() => {
        if (!cancelled) setWallet({ available: false, url: `https://hayc.gr/card/${card.slug}` });
      });
    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <main className="flex min-h-[100dvh] w-full justify-center bg-[radial-gradient(120%_70%_at_50%_-10%,#2777E9_0%,#182B53_45%,#101b33_100%)] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-white font-brand">
      {card ? (
        <ContactCardView
          card={card}
          wallet={wallet}
          walletNote={walletNote}
          downloading={downloading}
          onWalletUnavailable={() =>
            setWalletNote("Το Apple Wallet θέλει πιστοποιητικό υπογραφής από την Apple. Μέχρι τότε κατέβασε το QR.")
          }
          onDownload={() => downloadQr(card, setDownloading)}
        />
      ) : (
        <p className="m-auto text-center text-lg">Η κάρτα δεν βρέθηκε.</p>
      )}
    </main>
  );
}

function ContactCardView({
  card,
  wallet,
  walletNote,
  downloading,
  onWalletUnavailable,
  onDownload,
}: {
  card: ContactCard;
  wallet: WalletStatus | null;
  walletNote: string | null;
  downloading: boolean;
  onWalletUnavailable: () => void;
  onDownload: () => void;
}) {
  const pageUrl = wallet?.url ?? `https://hayc.gr/card/${card.slug}`;

  return (
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

      <section className="mt-10 w-full rounded-3xl bg-white px-5 py-6 text-[#182B53]">
        <h2 className="text-center text-base font-semibold">QR για σκανάρισμα</h2>
        <p className="mt-1 text-center text-sm text-[#182B53]/70">
          Όποιος το σκανάρει ανοίγει αυτή τη σελίδα.
        </p>
        <img
          src={`/cards/${card.slug}/qr.png`}
          alt={`QR code για την κάρτα του ${card.name}`}
          width={720}
          height={720}
          className="mx-auto mt-4 h-56 w-56"
        />
        <p className="mt-2 break-all text-center text-xs text-[#182B53]/60">
          {pageUrl.replace(/^https?:\/\//, "")}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="h-11 rounded-xl bg-[#182B53] text-sm font-semibold text-white transition hover:bg-[#2777E9] disabled:opacity-60"
          >
            {downloading ? "Ετοιμάζεται..." : "Λήψη QR"}
          </button>
          {wallet === null ? (
            <button
              type="button"
              disabled
              className="h-11 rounded-xl bg-black text-sm font-semibold text-white opacity-60"
            >
              Προσθήκη στο Apple Wallet
            </button>
          ) : wallet.available ? (
            <a
              href={`/cards/${card.slug}/pass.pkpass`}
              className="flex h-11 items-center justify-center rounded-xl bg-black text-sm font-semibold text-white"
            >
              Προσθήκη στο Apple Wallet
            </a>
          ) : (
            <button
              type="button"
              onClick={onWalletUnavailable}
              className="h-11 rounded-xl bg-black text-sm font-semibold text-white"
            >
              Προσθήκη στο Apple Wallet
            </button>
          )}
        </div>
        {walletNote ? <p className="mt-3 text-center text-xs leading-relaxed text-[#182B53]/70">{walletNote}</p> : null}
      </section>
    </div>
  );
}

async function downloadQr(card: ContactCard, setDownloading: (value: boolean) => void) {
  setDownloading(true);
  try {
    const response = await fetch(`/cards/${card.slug}/qr.png`);
    if (!response.ok) return;
    const blob = await response.blob();
    const file = new File([blob], `${card.slug}-qr.png`, { type: "image/png" });
    const canShareFiles =
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } finally {
    setDownloading(false);
  }
}
