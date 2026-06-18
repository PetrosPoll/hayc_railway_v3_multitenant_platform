import latin400Woff2 from "@fontsource/manrope/files/manrope-latin-400-normal.woff2?url";
import greek400Woff2 from "@fontsource/manrope/files/manrope-greek-400-normal.woff2?url";
import latin700Woff2 from "@fontsource/manrope/files/manrope-latin-700-normal.woff2?url";
import greek700Woff2 from "@fontsource/manrope/files/manrope-greek-700-normal.woff2?url";

// Latin is needed by both languages (digits, brand name, Latin glyphs).
// Greek subsets are only needed on the Greek variant of the landing page.
const LATIN_FONT_PRELOADS = [latin400Woff2, latin700Woff2] as const;
const GREEK_FONT_PRELOADS = [greek400Woff2, greek700Woff2] as const;

function preloadFont(href: string): void {
  if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Preloads only the font subsets the active language needs.
 * @param options.greek when true, also preloads the Greek subsets.
 */
export function installLandingPreloads(options: { greek?: boolean } = {}): void {
  if (typeof document === "undefined") return;

  for (const href of LATIN_FONT_PRELOADS) {
    preloadFont(href);
  }

  if (options.greek) {
    for (const href of GREEK_FONT_PRELOADS) {
      preloadFont(href);
    }
  }
}
