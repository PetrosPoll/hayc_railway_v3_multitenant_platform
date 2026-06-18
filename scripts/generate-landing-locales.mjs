// Generates the lightweight landing locale slices from the full locale files.
// The landing page only needs the `landingPage` and `cookieConsent` namespaces,
// so we extract just those to keep them out of the main entry bundle.
// Run automatically as part of the build (see scripts/build.js).

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../client/src/locales");
const outDir = resolve(localesDir, "landing");

const LANDING_NAMESPACES = ["landingPage", "cookieConsent"];
const LANGS = ["en", "gr"];

mkdirSync(outDir, { recursive: true });

for (const lang of LANGS) {
  const full = JSON.parse(readFileSync(resolve(localesDir, `${lang}.json`), "utf8"));
  const slice = {};
  for (const ns of LANDING_NAMESPACES) {
    if (full[ns] !== undefined) {
      slice[ns] = full[ns];
    }
  }
  writeFileSync(
    resolve(outDir, `${lang}.json`),
    JSON.stringify(slice, null, 2) + "\n",
    "utf8",
  );
  console.log(`[landing-locales] wrote landing/${lang}.json (${LANDING_NAMESPACES.join(", ")})`);
}
