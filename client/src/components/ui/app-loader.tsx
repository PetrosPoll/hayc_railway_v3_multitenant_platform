import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { heroReady } from "@/lib/hero-ready";

export function AppLoader({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000); // hard cap

    const finish = () => {
      if (!cancelled) {
        window.clearTimeout(timeout);
        setReady(true);
      }
    };

    // Wait for both fonts AND hero video
    Promise.all([
      document.fonts.ready,
      new Promise<void>((resolve) => heroReady.onReady(resolve)),
    ]).then(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black pointer-events-none"
        style={{
          opacity: ready ? 0 : 1,
          transition: "opacity 0.5s ease-out",
          willChange: "opacity",
        }}
        aria-hidden
      >
        <svg
          width="52"
          height="52"
          viewBox="0 0 24.24 23.468"
          fill="none"
          style={{ animation: "pulse 1.5s ease-in-out infinite" }}
        >
          <path
            d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
            fill="#ED4C14"
          />
        </svg>
      </div>
      <div style={{ visibility: ready ? "visible" : "hidden" }}>
        {children}
      </div>
    </>
  );
}
