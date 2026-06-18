import { installLandingPreloads } from "@/lib/landing-preloads";

// The "-en" route variant is English (Latin only); every other landing route
// renders Greek and needs the Greek subsets preloaded too.
const isEnglishVariant =
  typeof window !== "undefined" &&
  window.location.pathname.includes("book-a-call-en");

installLandingPreloads({ greek: !isEnglishVariant });

import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/greek-400.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/greek-700.css";
