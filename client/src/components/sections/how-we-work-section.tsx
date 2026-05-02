import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Figma frame dimensions
const FRAME_W = 1440;
const FRAME_H = 1684;

export function HowWeWorkSection() {
  const navigate = useNavigate();

  return (
    <div
      className="relative w-full bg-black overflow-hidden"
      style={{ height: "100vh" }}
    >
      {/* 
        Scale the Figma frame (1440x1684) to fill 100vh.
        We use a CSS scale + translate trick:
        - The inner div is exactly 1440x1684px with all Figma positions
        - We scale it down using vw/vh units so it fits the viewport
        - transform-origin: top left, then translate to center if needed
      */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${FRAME_W}px`,
          height: `${FRAME_H}px`,
          transformOrigin: "top left",
          // Scale to fit height: scale = 100vh / 1684px
          transform: `scale(calc(100vh / ${FRAME_H}px))`,
        }}
      >
        {/* Section title — top right */}
        <div style={{
          position: "absolute",
          top: 60,
          right: 64,
          textAlign: "right" as const,
        }}>
          <h2 style={{
            color: "white",
            fontSize: "48px",
            fontWeight: 600,
            fontFamily: "Montserrat, sans-serif",
            lineHeight: "70px",
            margin: 0,
          }}>
            A process created around{" "}
            <span style={{ color: "#ED4C14" }}>you.</span>
          </h2>
        </div>

        {/* Outer orange dashed circle: 688.52x688.53, left:-344.26, top:494.23 */}
        <div style={{
          position: "absolute",
          width: "688.52px",
          height: "688.53px",
          left: "-344.26px",
          top: "494.23px",
          border: "1.62px dashed #ea580c",
          borderRadius: "50%",
          boxSizing: "border-box",
        }} />

        {/* Outer round indigo circle: 853.41x853.41, left:-426.83, top:411.98 */}
        <div style={{
          position: "absolute",
          width: "853.41px",
          height: "853.41px",
          left: "-426.83px",
          top: "411.98px",
          borderRadius: "50%",
          border: "1px solid #a5b4fc",
          boxSizing: "border-box",
        }} />

        {/* Active step 01: left:507.5, top:723.3 */}
        <div style={{
          position: "absolute",
          width: "842px",
          left: "507.5px",
          top: "600px",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "flex-end",
        }}>
          <div style={{
            color: "#ea580c",
            fontSize: "262.57px",
            fontWeight: 600,
            fontFamily: "Montserrat, sans-serif",
            lineHeight: "233.69px",
          }}>01</div>

          <div style={{
            flex: 1,
            height: "240px",
            paddingTop: "14px",
            paddingBottom: "14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            gap: "40px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{
                color: "white",
                fontSize: "36px",
                fontWeight: 600,
                fontFamily: "Montserrat, sans-serif",
              }}>
                Create your account and choose your template
              </div>
              <div style={{
                color: "white",
                fontSize: "16px",
                fontWeight: 400,
                fontFamily: "Montserrat, sans-serif",
                lineHeight: "24px",
              }}>
                Subscribe in seconds and start your journey with us.
              </div>
            </div>

            <button
              onClick={() => navigate("/pricing")}
              style={{
                height: "44px",
                padding: "14px 20px",
                backgroundColor: "#ED4C14",
                borderRadius: "10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "16px",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{
                color: "#EFF6FF",
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "Montserrat, sans-serif",
              }}>Get Started</span>
              <ArrowRight style={{ width: 16, height: 16, color: "#EFF6FF" }} />
            </button>
          </div>
        </div>

        {/* Inactive 01 opposite: left:-507, top:950.02, rotate(-180deg) */}
        <div style={{
          position: "absolute",
          left: "-507px",
          top: "950.02px",
          transform: "rotate(-180deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>01</div>

        {/* Inactive 04 top-left: left:-648.19, top:558.53, rotate(-135deg) */}
        <div style={{
          position: "absolute",
          left: "-648.19px",
          top: "558.53px",
          transform: "rotate(-135deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>04</div>

        {/* Inactive 04 bottom-right: left:642.72, top:1090.61, rotate(45deg) */}
        <div style={{
          position: "absolute",
          left: "642.72px",
          top: "1090.61px",
          transform: "rotate(45deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>04</div>

        {/* Inactive 03 top: left:-116, top:421.32, rotate(-90deg) */}
        <div style={{
          position: "absolute",
          left: "-116px",
          top: "421.32px",
          transform: "rotate(-90deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>03</div>

        {/* Inactive 03 bottom: left:101, top:1342, rotate(90deg) */}
        <div style={{
          position: "absolute",
          left: "101px",
          top: "1342px",
          transform: "rotate(90deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>03</div>

        {/* Inactive 02 top-right: left:279, top:208.40, rotate(-45deg) */}
        <div style={{
          position: "absolute",
          left: "279px",
          top: "208.40px",
          transform: "rotate(-45deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>02</div>

        {/* Inactive 02 bottom-left: left:-308.47, top:1441.33, rotate(135deg) */}
        <div style={{
          position: "absolute",
          left: "-308.47px",
          top: "1441.33px",
          transform: "rotate(135deg)",
          transformOrigin: "top left",
          color: "#27272a",
          fontSize: "262.57px",
          fontWeight: 600,
          fontFamily: "Montserrat, sans-serif",
          lineHeight: "233.69px",
        }}>02</div>

        {/* Asterisk — circle center is at x:0, y:838px (half of 1684) */}
        <div style={{
          position: "absolute",
          left: "-36px",
          top: "838px",
          transform: "translateY(-50%)",
        }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24.24 23.468"
            style={{ width: "72px", height: "72px" }}
            fill="none"
          >
            <path
              d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
              fill="#ED4C14"
            />
          </svg>
        </div>

        {/* Progress dots */}
        <div style={{
          position: "absolute",
          bottom: "60px",
          left: 0,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
        }}>
          {[0, 1, 2, 3].map((j) => (
            <div key={j} style={{
              width: j === 0 ? 24 : 8,
              height: 8,
              borderRadius: "9999px",
              backgroundColor: j === 0 ? "#ED4C14" : "#404040",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
