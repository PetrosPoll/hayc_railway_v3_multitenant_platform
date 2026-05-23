import { useTranslation } from "react-i18next";

export default function WalkthroughExplainer() {
  const { t } = useTranslation();
  return (
    <div className="w-full rounded-[10px] bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/5 p-6 flex flex-col gap-6 overflow-hidden relative">

      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(237,76,20,0.08),transparent)] pointer-events-none" />

      {/* Steps */}
      <div className="flex flex-col gap-0 relative z-10">

        {/* Step 1 — Payment */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full bg-[#ED4C14] flex items-center justify-center flex-shrink-0"
              style={{ animation: "pulse-orange 2s ease-in-out infinite" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="16" height="11" rx="2" stroke="white" strokeWidth="1.5"/>
                <path d="M1 8h16" stroke="white" strokeWidth="1.5"/>
                <path d="M4 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-[#ED4C14] to-white/10" />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-white text-sm font-semibold font-brand">
              {t("getStarted.summary.walkthrough.step1.title")}
            </span>
            <span className="text-white/50 text-xs font-normal font-brand leading-5">
              {t("getStarted.summary.walkthrough.step1.subtitle")}
            </span>
          </div>
        </div>

        {/* Step 2 — Setup */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0"
              style={{ animation: "pulse-white 2s ease-in-out infinite 0.4s" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L11 7H16L12 10.5L13.5 15.5L9 12.5L4.5 15.5L6 10.5L2 7H7L9 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-white/20 to-white/5" />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-white text-sm font-semibold font-brand">
              {t("getStarted.summary.walkthrough.step2.title")}
            </span>
            <span className="text-white/50 text-xs font-normal font-brand leading-5">
              {t("getStarted.summary.walkthrough.step2.subtitle")}
            </span>
          </div>
        </div>

        {/* Step 3 — We build */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0"
              style={{ animation: "pulse-white 2s ease-in-out infinite 0.8s" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5"/>
                <path d="M6 16h6M9 13v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-white/10 to-transparent" />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-white text-sm font-semibold font-brand">
              {t("getStarted.summary.walkthrough.step3.title")}
            </span>
            <span className="text-white/50 text-xs font-normal font-brand leading-5">
              {t("getStarted.summary.walkthrough.step3.subtitle")}
            </span>
          </div>
        </div>

        {/* Step 4 — Live */}
        <div className="flex gap-4 items-start">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0"
              style={{ animation: "pulse-white 2s ease-in-out infinite 1.2s" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.5"/>
                <path d="M9 5v4l3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-white text-sm font-semibold font-brand">
              {t("getStarted.summary.walkthrough.step4.title")}
            </span>
            <span className="text-white/50 text-xs font-normal font-brand leading-5">
              {t("getStarted.summary.walkthrough.step4.subtitle")}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

