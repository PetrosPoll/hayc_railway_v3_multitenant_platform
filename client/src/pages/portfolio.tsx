import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { portfolioSites } from "@/data/portfolio-sites";

const LIVE = portfolioSites.filter((s) => s.thumb);
const UPCOMING = portfolioSites.filter((s) => !s.thumb);

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
      { rootMargin: margin, threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, visible };
}

export default function Portfolio() {
  const grid = useInView<HTMLElement>();

  return (
    <div className="portfolio-page min-h-screen bg-black font-brand text-white">
      <style>{`
        .portfolio-page {
          background:
            radial-gradient(900px 500px at 10% -5%, rgba(61,149,244,0.18), transparent 55%),
            radial-gradient(700px 420px at 95% 15%, rgba(62,113,224,0.14), transparent 50%),
            #000000;
        }
        .pf-item {
          opacity: 0;
          transform: translateY(20px);
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

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.28em] text-[#A0BAF3] uppercase">
            HAYC
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Client websites
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/65">
            Live sites we built — open any preview to visit the real homepage.
          </p>
        </header>

        <section id="work">
          <div
            ref={grid.ref as RefObject<HTMLDivElement>}
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
          >
            {LIVE.map((site, i) => (
              <a
                key={site.domain}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`pf-item group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D95F4] ${
                  grid.visible ? "is-in" : ""
                }`}
                style={{ transitionDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <div className="overflow-hidden rounded-lg bg-[#00070F] ring-1 ring-white/15 transition group-hover:ring-[#3D95F4]/60">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#182B53]/40">
                    <img
                      src={site.thumb!}
                      alt={`${site.name} homepage`}
                      loading="lazy"
                      className="h-full w-full object-cover object-top transition duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="text-xs tracking-[0.16em] text-[#A0BAF3] uppercase">
                        {site.category}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">
                        {site.name}
                      </h2>
                      <p className="mt-1 text-sm text-white/50">{site.domain}</p>
                    </div>
                    <span
                      aria-hidden
                      className="mb-1 text-[#3D95F4] transition group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {UPCOMING.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-semibold text-white">Also in progress</h2>
            <p className="mt-2 max-w-xl text-white/60">
              Domains from our production set that are not publicly live yet.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {UPCOMING.map((site) => (
                <li
                  key={site.domain}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#00070F] px-4 py-3 ring-1 ring-white/10"
                >
                  <div>
                    <p className="font-medium text-white">{site.name}</p>
                    <p className="text-sm text-white/45">{site.domain}</p>
                  </div>
                  <span className="text-[10px] tracking-[0.14em] text-[#A0BAF3] uppercase">
                    Soon
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-24 border-t border-white/10 pt-16 text-center">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Ready for your own site?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/60">
            Tell us about your business and we’ll send a clear website offer.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/get-started"
              className="inline-flex rounded-lg bg-[#3E71E0] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3D95F4]"
            >
              Get started
            </Link>
            <a
              href="mailto:info@hayc.gr?subject=Website%20offer"
              className="inline-flex rounded-lg border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
            >
              Email us
            </a>
          </div>
          <p className="mt-10 text-xs tracking-[0.2em] text-white/35 uppercase">
            hayc.gr
          </p>
        </section>
      </div>
    </div>
  );
}
