import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const GET_STARTED_DEFAULT_PATH = "/get-started";

// Figma frame dimensions — used for scaling
const FRAME_W = 1200;
const FRAME_H = 800;

const STEPS = [
  {
    number: "01",
    title: "Create your account and choose your template",
    description: "Subscribe in seconds and start your journey with us.",
  },
  {
    number: "02",
    title: "Tell us what you need",
    description:
      "Choose your template, define your business, and select your features.",
  },
  {
    number: "03",
    title: "We build your website, fast",
    description:
      "Our team gets to work based on your selected template and tools. We will also reach out to fine-tune the details.",
  },
  {
    number: "04",
    title: "Stay in control",
    description:
      "See your website come to life step by step. From progress tracking to performance data and future upgrades. It's all in one place.",
  },
] as const;

// Wheel: 8 visual slots at 45deg (01–04 duplicated). Logical steps stay 4; rotate -45deg per step.
const WHEEL_SLOTS = 8;
const WHEEL_R = 380;
const WHEEL_CX = FRAME_W / 5 - 160;
const WHEEL_CY = 450;

// Decorative backdrop (indigo ring + diamond + asterisk) shares the wheel hub but is smaller,
// so the digits sit on a larger ring outside the disc instead of overlapping the path.
const BACKDROP_R = WHEEL_R - 80;
const BACKDROP_CX = WHEEL_CX - 80;
const BACKDROP_CY = WHEEL_CY;

const mobileStepStyles = `
  @keyframes stepFadeUp {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .step-number-enter {
    animation: stepFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .step-content-enter {
    animation: stepFadeUp 0.5s 0.12s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
`;

export function HowWeWorkSection() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [wheelProgress, setWheelProgress] = useState(0);
  const [panelMode, setPanelMode] = useState<"top" | "fixed" | "bottom">("top");
  const [panelLeft, setPanelLeft] = useState(0);
  const [panelWidth, setPanelWidth] = useState(0);
  const mobileWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const wrapper =
        typeof window !== "undefined" && window.innerWidth < 768
          ? mobileWrapperRef.current
          : wrapperRef.current;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      setPanelLeft(rect.left);
      setPanelWidth(rect.width);

      if (rect.top > 0) {
        setPanelMode("top");
      } else if (rect.bottom < window.innerHeight) {
        setPanelMode("bottom");
      } else {
        setPanelMode("fixed");
      }

      const scrolled = -rect.top;
      const total = rect.height - window.innerHeight;
      const progress = Math.min(1, Math.max(0, scrolled / total));
      const nextWheelProgress = progress * (STEPS.length - 1);
      const step = Math.min(
        STEPS.length - 1,
        Math.round(nextWheelProgress),
      );
      setWheelProgress(nextWheelProgress);
      setActiveStep(step);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Scale factor: fit the 1440x900 Figma frame into the actual viewport
  const scale =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H)
      : 1;

  return (
    <>
      <div
        ref={mobileWrapperRef}
        className="relative w-full bg-black overflow-visible md:hidden"
        style={{ height: `${STEPS.length * 100}vh` }}
      >
        <style>{mobileStepStyles}</style>
        <div
          className="relative z-10 flex h-screen flex-col justify-center overflow-hidden"
          style={{
            position: panelMode === "fixed" ? "fixed" : "absolute",
            top:
              panelMode === "bottom"
                ? `${mobileWrapperRef.current
                    ? mobileWrapperRef.current.getBoundingClientRect().height -
                      window.innerHeight
                    : 0}px`
                : 0,
            left: 0,
            width: "100%",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              style={{
                position: "absolute",
                width: "800px",
                height: "800px",
                right: "-100px",
                bottom: "-200px",
                background:
                  "radial-gradient(ellipse at center, rgba(237,76,20,0.35) 0%, rgba(237,76,20,0.1) 40%, transparent 70%)",
              }}
            />
          </div>

          {/* Header */}
          <div
            className="relative z-10"
            style={{
              position: "absolute",
              top: "9rem",
              left: "1.5rem",
              right: "1.5rem",
              textAlign: "right",
            }}
          >
            <h2 className="text-3xl font-semibold font-brand text-right">
              <span className="text-white">A process created around </span>
              <span className="text-[#ED4C14]">you.</span>
            </h2>
          </div>

          {/* Active step content */}
          <div className="relative z-10 px-6 flex flex-col gap-6">
            <div
              key={`mob-num-${activeStep}`}
              className="step-number-enter"
              style={{
                fontSize: "140px",
                fontWeight: 600,
                fontFamily: "Montserrat",
                lineHeight: 1,
                color: "#ED4C14",
              }}
            >
              {STEPS[activeStep].number}
            </div>
            <div
              key={`mob-content-${activeStep}`}
              className="step-content-enter"
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <h3 className="text-white text-xl font-semibold font-brand leading-tight">
                {STEPS[activeStep].title}
              </h3>
              <p className="text-white/70 text-sm font-brand leading-relaxed">
                {STEPS[activeStep].description}
              </p>
              <button
                type="button"
                onClick={() => navigate(GET_STARTED_DEFAULT_PATH)}
                className="h-10 px-4 bg-[#ED4C14] rounded-[10px] inline-flex
                           items-center gap-4 border-0 cursor-pointer w-fit mt-2"
              >
                <span className="text-[#EFF6FF] text-sm font-semibold font-brand">
                  Get Started
                </span>
                <ArrowRight className="h-4 w-4 text-[#EFF6FF]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative w-full bg-black overflow-visible hidden md:block"
        style={{ height: `${STEPS.length * 100}vh` }}
      >
      {/* Fixed/absolute panel */}
      <div
        className="h-screen overflow-hidden z-10"
        style={{
          position: panelMode === "fixed" ? "fixed" : "absolute",
          top:
            panelMode === "bottom"
              ? `${wrapperRef.current ? wrapperRef.current.getBoundingClientRect().height - window.innerHeight : 0}px`
              : 0,
          left: `${panelLeft}px`,
          width: `${panelWidth}px`,
        }}
      >
        {/* Headline — pinned with the same panelMode pattern as the wheel/video */}
        <div
          className="pointer-events-none text-right z-[20]"
          style={{
            position: "absolute",
            top: "calc(max(5.5rem, env(safe-area-inset-top, 0px) + 4.75rem) + 1.5rem)",
            right: "max(2.5rem, calc(1.5rem + env(safe-area-inset-right, 0px)))",
            maxWidth: "min(560px, calc(100vw - 2rem))",
          }}
        >
          <h2
            className="pointer-events-auto m-0 font-semibold font-brand"
            style={{
              fontSize: "clamp(1.25rem, 2.5vw + 0.5rem, 48px)",
              lineHeight: "1.15",
              fontWeight: 600,
            }}
          >
            <span style={{ color: "white" }}>A process created around </span>
            <span style={{ color: "#ED4C14" }}>you.</span>
          </h2>
        </div>

        {/* Scaled Figma frame */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${FRAME_W}px`,
            height: `${FRAME_H}px`,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        >
          {/* Radial orange glow — bottom center-right */}
          <div
            style={{
              position: "absolute",
              width: "800px",
              height: "800px",
              right: "-100px",
              bottom: "-200px",
              background:
                "radial-gradient(ellipse at center, rgba(237,76,20,0.35) 0%, rgba(237,76,20,0.1) 40%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Diamond/square circle — orange, rotated 45deg, centered on backdrop hub */}
          <div
            style={{
              position: "absolute",
              width: `${BACKDROP_R * 2 * (688.52 / 853.41)}px`,
              height: `${BACKDROP_R * 2 * (688.52 / 853.41)}px`,
              left: `${BACKDROP_CX}px`,
              top: `${BACKDROP_CY}px`,
              // border: "1.62px solid #ED4C14",
              transform: "translate(-50%, -50%) rotate(45deg)",
              transformOrigin: "center center",
            }}
          />

          {/* Round circle — indigo backdrop, offset from wheel so numbers sit beside it */}
          <div
            style={{
              position: "absolute",
              width: `${BACKDROP_R * 2}px`,
              height: `${BACKDROP_R * 2}px`,
              left: `${BACKDROP_CX}px`,
              top: `${BACKDROP_CY}px`,
              borderRadius: "50%",
              border: "1px solid #a5b4fc",
              transform: "translate(-50%, -50%)",
            }}
          />

          {/* HAYC asterisk logo mark — center of backdrop */}
          <div
            style={{
              position: "absolute",
              left: `${BACKDROP_CX}px`,
              top: `${BACKDROP_CY}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <svg
              width={BACKDROP_R * 1.35}
              height={BACKDROP_R * 1.35 * (23.468 / 24.24)}
              viewBox="0 0 24.24 23.468"
              fill="none"
              style={{ display: "block" }}
            >
              <path
                d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
                fill="none"
                stroke="#ED4C14"
                strokeWidth="0.35"
                strokeLinejoin="miter"
              />
            </svg>
          </div>

          {/* Rotating wheel of step numbers */}
          <div
            style={{
              position: "absolute",
              left: `${WHEEL_CX}px`,
              top: `${WHEEL_CY}px`,
              width: 0,
              height: 0,
              transition: "transform 0.12s linear",
              transform: `rotate(${wheelProgress * -45}deg)`,
              transformOrigin: "0px 0px",
            }}
          >
            {Array.from({ length: WHEEL_SLOTS }, (_, i) => {
              const angleDeg = i * (360 / WHEEL_SLOTS);
              const angleRad = (angleDeg * Math.PI) / 180;
              const x = WHEEL_R * Math.cos(angleRad);
              const y = WHEEL_R * Math.sin(angleRad);
              const step = STEPS[i % STEPS.length];
              const isActive = i === activeStep;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${x}px`,
                    top: `${y}px`,
                    userSelect: "none",
                  }}
                >
                  {/* Center translate uses only the number box so the rim stays on the circle; copy is out of that flow */}
                  <div
                    style={{
                      transform: `translate(-50%, -50%) rotate(${-angleDeg}deg)`,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        transform: `rotate(${angleDeg + wheelProgress * 45}deg)`,
                        transformOrigin: "center center",
                        verticalAlign: "middle",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "176px",
                          fontWeight: 600,
                          fontFamily: "Montserrat",
                          lineHeight: "1",
                          color: isActive ? "#ED4C14" : "#27272a",
                          transition: "color 0.5s ease",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.number}
                      </div>
                      {isActive && (
                        <div
                          key={activeStep}
                          style={{
                            position: "absolute",
                            left: "100%",
                            bottom: 0,
                            marginLeft: "16px",
                            maxWidth: "480px",
                            width: "480px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            alignItems: "flex-start",
                            gap: "24px",
                            paddingBottom: "14px",
                            whiteSpace: "normal",
                            animation: "fadeIn 0.4s ease",
                            pointerEvents: "auto",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                color: "white",
                                fontSize: "28px",
                                fontWeight: 600,
                                fontFamily: "Montserrat",
                                lineHeight: "1.2",
                              }}
                            >
                              {step.title}
                            </div>
                            <div
                              style={{
                                color: "rgba(255,255,255,0.7)",
                                fontSize: "14px",
                                fontFamily: "Montserrat",
                                lineHeight: "22px",
                              }}
                            >
                              {step.description}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(GET_STARTED_DEFAULT_PATH);
                            }}
                            style={{
                              height: "40px",
                              padding: "0 18px",
                              background: "#ED4C14",
                              borderRadius: "10px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "16px",
                              border: "none",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                color: "#EFF6FF",
                                fontSize: "14px",
                                fontWeight: 600,
                                fontFamily: "Montserrat",
                              }}
                            >
                              Get Started
                            </span>
                            <ArrowRight
                              style={{ width: "14px", height: "14px", color: "#EFF6FF" }}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

