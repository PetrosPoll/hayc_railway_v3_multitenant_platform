import latin400Woff2 from "@fontsource/manrope/files/manrope-latin-400-normal.woff2?url";
import greek400Woff2 from "@fontsource/manrope/files/manrope-greek-400-normal.woff2?url";
import latin700Woff2 from "@fontsource/manrope/files/manrope-latin-700-normal.woff2?url";
import greek700Woff2 from "@fontsource/manrope/files/manrope-greek-700-normal.woff2?url";

const LANDING_FONT_PRELOADS = [
  latin400Woff2,
  greek400Woff2,
  latin700Woff2,
  greek700Woff2,
] as const;

export function installLandingPreloads(): void {
  if (typeof document === "undefined") return;

  for (const href of LANDING_FONT_PRELOADS) {
    if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
      continue;
    }

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.appendChild(link);
  }
}
