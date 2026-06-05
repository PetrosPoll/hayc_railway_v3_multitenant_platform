import { useEffect } from "react";

/** Prevents search engines from indexing the current page (restored on unmount). */
export function useNoIndex() {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"][data-hayc-noindex]');
    if (existing) {
      return;
    }

    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-hayc-noindex", "true");
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);
}
