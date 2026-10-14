import { chromium } from "playwright";
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../client/public/portfolio-thumbs");

/** Prefer live URLs; aliases fix Cloudflare typos / known hosts. */
const SITES = [
  { domain: "accountnr.gr", urls: ["https://accountnr.gr", "https://www.accountnr.gr"] },
  { domain: "adytomykonos.com", urls: ["https://adytomykonos.com", "https://www.adytomykonos.com"] },
  {
    domain: "ak-business-consultant.gr",
    urls: ["https://ak-business-consultant.gr"],
  },
  {
    domain: "carinaprizer.com",
    urls: ["https://carinapinzer.com", "https://www.carinapinzer.com", "https://carinaprizer.com"],
    displayDomain: "carinapinzer.com",
  },
  { domain: "dexapus.com.gr", urls: ["https://dexapus.com.gr", "https://www.dexapus.com.gr"] },
  { domain: "elm-routes.gr", urls: ["https://elm-routes.gr", "https://www.elm-routes.gr"] },
  {
    domain: "filippouinbuildtech.gr",
    urls: ["https://filippouinbuildtech.gr", "https://www.filippouinbuildtech.gr"],
  },
  {
    domain: "georgiachogloubaltravel.com",
    urls: ["https://georgiachogloubaltravel.com", "https://www.georgiachogloubaltravel.com"],
  },
  { domain: "gsacademy.gr", urls: ["https://gsacademy.gr"] },
  { domain: "kavalahospitality.gr", urls: ["https://kavalahospitality.gr"] },
  { domain: "mahiba.gr", urls: ["https://mahiba.gr", "https://www.mahiba.gr"] },
  { domain: "mamacoach.gr", urls: ["https://mamacoach.gr"] },
  { domain: "marianthikatsouda.gr", urls: ["https://marianthikatsouda.gr"] },
  { domain: "nathaliespiliopoulou.com", urls: ["https://nathaliespiliopoulou.com"] },
  {
    domain: "nickshurgamandfriends.com",
    urls: ["https://nickshurgamandfriends.com", "https://www.nickshurgamandfriends.com"],
  },
  { domain: "primaverastudios.net", urls: ["https://primaverastudios.net"] },
  {
    domain: "primelustransfer.com",
    urls: ["https://primelustransfer.com", "https://www.primelustransfer.com"],
  },
  { domain: "proisoffice.com", urls: ["https://proisoffice.com", "https://www.proisoffice.com"] },
  { domain: "solar-house.gr", urls: ["https://solar-house.gr"] },
  { domain: "spanishwithdiaconis.com", urls: ["https://spanishwithdiaconis.com"] },
  { domain: "stamatopoulosbakery.gr", urls: ["https://stamatopoulosbakery.gr"] },
  { domain: "taniamillou.com", urls: ["https://taniamillou.com", "https://www.taniamillou.com"] },
  { domain: "vayo.gr", urls: ["https://vayo.gr", "https://vayo.hayc.gr"] },
];

function slugFromDomain(domain) {
  return domain.replace(/\./g, "-");
}

function haycPreview(domain) {
  const label = domain
    .replace(/\.com\.gr$/i, "")
    .replace(/\.(gr|com|net|org)$/i, "")
    .replace(/\./g, "-");
  return `https://${label}.hayc.gr`;
}

function isErrorPage(title, body) {
  const t = `${title}\n${body}`.toLowerCase();
  return /access denied|accessdenied|this xml file|error\s*403|error\s*404|domain parking|coming soon|under construction|σε συντήρηση|υπό κατασκευή|default web page|welcome to nginx/.test(
    t,
  );
}

async function capture(page, url) {
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    const status = res?.status() ?? 0;
    const title = await page.title().catch(() => "");
    const body = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
    if (status >= 400 || status === 0) return { ok: false, status, title, url };
    if (isErrorPage(title, body.slice(0, 3000))) return { ok: false, status, title, url };
    return { ok: true, status, title, url };
  } catch {
    return { ok: false, status: 0, title: "", url };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "el-GR",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const manifest = [];

  for (const site of SITES) {
    const slug = slugFromDomain(site.domain);
    const candidates = [...site.urls, haycPreview(site.domain)];
    let chosen = null;
    for (const url of candidates) {
      console.log(`→ ${url}`);
      const result = await capture(page, url);
      console.log(`  ok=${result.ok} status=${result.status} "${result.title}"`);
      if (result.ok) {
        chosen = result;
        break;
      }
    }

    const file = `${slug}.jpg`;
    const filePath = path.join(outDir, file);
    let hasThumb = false;
    if (chosen?.ok) {
      await page.screenshot({ path: filePath, type: "jpeg", quality: 78, fullPage: false });
      hasThumb = true;
    }

    const displayDomain = site.displayDomain || site.domain;
    const name =
      chosen?.title?.split(/[-|–—]/)[0]?.trim() ||
      displayDomain.replace(/\.(gr|com|net|org|com\.gr)$/i, "");

    manifest.push({
      domain: displayDomain,
      listDomain: site.domain,
      slug,
      name,
      url: chosen?.ok ? chosen.url : `https://${displayDomain}`,
      thumb: hasThumb ? `/portfolio-thumbs/${file}` : null,
      source: chosen?.url?.includes(".hayc.gr") ? "hayc-preview" : chosen?.ok ? "live" : "unavailable",
      title: chosen?.title || "",
      ok: Boolean(chosen?.ok),
    });
    console.log(`✓ ${site.domain} → ${manifest.at(-1).source} thumb=${hasThumb}`);
  }

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log("\nDone", manifest.filter((m) => m.ok).length, "/", manifest.length, "ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
