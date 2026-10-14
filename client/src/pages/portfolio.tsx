import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { portfolioSites } from "@/data/portfolio-sites";

const LIVE = portfolioSites.filter((s) => s.thumb);

function useInView<T extends HTMLElement>(margin = "0px 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: margin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, visible };
}

export default function Portfolio() {
  const grid = useInView<HTMLElement>();

  return (
    <div className="portfolio-page min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-black font-brand text-white">
      <style>{`
        .portfolio-page {
          background:
            radial-gradient(min(900px, 140vw) 500px at 10% -5%, rgba(61,149,244,0.18), transparent 55%),
            radial-gradient(min(700px, 120vw) 420px at 95% 15%, rgba(62,113,224,0.14), transparent 50%),
            #000000;
        }
        .pf-item {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 650ms cubic-bezier(0.22, 1, 0.36, 1), transform 650ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .pf-item.is-in {
          opacity: 1;
          transform: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-item {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 md:px-8 md:py-16">
        <header className="mb-8 max-w-2xl sm:mb-12">
          <p className="text-xs font-semibold tracking-[0.22em] text-[#A0BAF3] uppercase sm:text-sm sm:tracking-[0.28em]">
            HAYC
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:mt-3 sm:text-3xl md:text-4xl">
            Client websites
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65 sm:mt-3 sm:text-base">
            Live sites we built — open any preview to visit the real homepage.
          </p>
        </header>

        <section id="work" className="w-full min-w-0">
          <div
            ref={grid.ref as RefObject<HTMLDivElement>}
            className="grid w-full grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:gap-6 md:gap-8 lg:grid-cols-3"
          >
            {LIVE.map((site, i) => (
              <a
                key={site.domain}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`pf-item group block min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D95F4] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  grid.visible ? "is-in" : ""
                }`}
                style={{ transitionDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                <div className="overflow-hidden rounded-lg bg-[#00070F] ring-1 ring-white/15 transition active:ring-[#3D95F4]/60 group-hover:ring-[#3D95F4]/60">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#182B53]/40">
                    <img
                      src={site.thumb!}
                      alt={`${site.name} homepage`}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 479px) 100vw, (max-width: 1023px) 50vw, 33vw"
                      className="h-full w-full max-w-full object-cover object-top transition duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex min-w-0 items-end justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] tracking-[0.14em] text-[#A0BAF3] uppercase sm:text-xs sm:tracking-[0.16em]">
                        {site.category}
                      </p>
                      <h2 className="mt-0.5 truncate text-base font-semibold text-white sm:mt-1 sm:text-lg">
                        {site.name}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-white/50 sm:mt-1 sm:text-sm">
                        {site.domain}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="mb-0.5 shrink-0 text-[#3D95F4] transition group-hover:translate-x-1 sm:mb-1"
                    >
                      →
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-white/10 pt-10 text-center sm:mt-20 sm:pt-14 md:mt-24 md:pt-16">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
            Ready for your own site?
          </h2>
          <p className="mx-auto mt-3 max-w-lg px-1 text-sm text-white/60 sm:text-base">
            Tell us about your business and we’ll send a clear website offer.
          </p>
          <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
            <Link
              to="/get-started"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#3E71E0] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3D95F4] sm:w-auto"
            >
              Get started
            </Link>
            <a
              href="mailto:info@hayc.gr?subject=Website%20offer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5 sm:w-auto"
            >
              Email us
            </a>
          </div>
          <p className="mt-8 text-[10px] tracking-[0.18em] text-white/35 uppercase sm:mt-10 sm:text-xs sm:tracking-[0.2em]">
            hayc.gr
          </p>
        </section>
      </div>
    </div>
  );
}
