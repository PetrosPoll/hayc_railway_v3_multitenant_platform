import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../client/public/portfolio-thumbs");

/** Client domains from Cloudflare (exclude hayc brand properties). */
const DOMAINS = [
  "accountnr.gr",
  "adytomykonos.com",
  "ak-business-consultant.gr",
  "carinaprizer.com",
  "dexapus.com.gr",
  "elm-routes.gr",
  "filippouinbuildtech.gr",
  "georgiachogloubaltravel.com",
  "gsacademy.gr",
  "kavalahospitality.gr",
  "mahiba.gr",
  "mamacoach.gr",
  "marianthikatsouda.gr",
  "nathaliespiliopoulou.com",
  "nickshurgamandfriends.com",
  "primaverastudios.net",
  "primelustransfer.com",
  "proisoffice.com",
  "solar-house.gr",
  "spanishwithdiaconis.com",
  "stamatopoulosbakery.gr",
  "taniamillou.com",
  "vayo.gr",
];

function slugFromDomain(domain) {
  return domain.replace(/\./g, "-");
}

function haycPreviewHost(domain) {
  // demo/dev sites live at {label}.hayc.gr
  const label = domain
    .replace(/\.com\.gr$/i, "")
    .replace(/\.(gr|com|net|org)$/i, "")
    .replace(/\./g, "-");
  return `${label}.hayc.gr`;
}

function looksLikeMaintenance(title, bodyText) {
  const t = `${title}\n${bodyText}`.toLowerCase();
  return (
    /maintenance|under construction|coming soon|σε συντήρηση|υπό κατασκευή|parking page|domain parking|default web page|welcome to nginx|apache2 ubuntu default|this site can.?t be reached|403 forbidden|404 not found|cloudflare|pending|soon available/.test(
      t,
    ) && t.length < 2500
  );
}

async function tryCapture(page, url) {
  try {
    const res = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(2500);
    const status = res?.status() ?? 0;
    const title = await page.title().catch(() => "");
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "");
    const badStatus = status >= 400 || status === 0;
    const maintenance = looksLikeMaintenance(title, bodyText.slice(0, 2000));
    return { ok: !badStatus && !maintenance, status, title, maintenance, url };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      title: "",
      maintenance: true,
      url,
      error: String(err?.message || err),
    };
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "el-GR",
  });
  const page = await context.newPage();
  const manifest = [];

  for (const domain of DOMAINS) {
    const slug = slugFromDomain(domain);
    const candidates = [
      `https://${domain}`,
      `https://www.${domain}`,
      `https://${haycPreviewHost(domain)}`,
    ];

    let chosen = null;
    for (const url of candidates) {
      console.log(`→ try ${url}`);
      const result = await tryCapture(page, url);
      console.log(
        `  status=${result.status} maintenance=${result.maintenance} ok=${result.ok} title="${result.title}"`,
      );
      if (result.ok) {
        chosen = result;
        break;
      }
      // keep last attempt for fallback screenshot even if imperfect
      chosen = result;
    }

    const file = `${slug}.jpg`;
    const filePath = path.join(outDir, file);
    try {
      await page.screenshot({
        path: filePath,
        type: "jpeg",
        quality: 72,
        fullPage: false,
      });
    } catch (err) {
      console.error(`  screenshot failed for ${domain}:`, err.message);
    }

    const entry = {
      domain,
      slug,
      name: domain.replace(/\.(gr|com|net|org|com\.gr)$/i, ""),
      url: chosen?.url || `https://${domain}`,
      thumb: `/portfolio-thumbs/${file}`,
      source: chosen?.url?.includes(".hayc.gr")
        ? "hayc-preview"
        : "live",
      title: chosen?.title || "",
      ok: Boolean(chosen?.ok),
    };
    manifest.push(entry);
    console.log(`✓ ${domain} → ${entry.url} (${entry.source})`);
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  await browser.close();
  console.log(`\nDone. ${manifest.length} sites → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
