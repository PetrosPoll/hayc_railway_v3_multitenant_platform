/**
 * Renders each newsletter HTML template in headless Chromium and saves a
 * portrait preview as images/thumbnail.png for use as the gallery thumbnail.
 *
 * Usage: npx tsx scripts/generate-newsletter-template-thumbnails.ts
 */
import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { chromium } from "playwright";

const IMPORT_ROOT = path.resolve(process.cwd(), "newsletter-templates-import");
const LEGACY_ROOTS = [
  path.resolve(process.cwd(), "client/public/email-templates/sports-newsletter"),
  path.resolve(process.cwd(), "client/public/email-templates/restaurant-email"),
];

const VIEWPORT_WIDTH = 640;
const VIEWPORT_HEIGHT = 853; // ~3:4 portrait
const DEVICE_SCALE = 2;

async function findHtml(templateDir: string): Promise<string | null> {
  for (const name of ["index.html", "template.html"]) {
    const p = path.join(templateDir, name);
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

async function ensureImagesDir(templateDir: string): Promise<string> {
  const imagesDir = path.join(templateDir, "images");
  await fs.mkdir(imagesDir, { recursive: true });
  return imagesDir;
}

async function screenshotTemplate(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  templateDir: string,
): Promise<boolean> {
  const htmlPath = await findHtml(templateDir);
  if (!htmlPath) {
    console.warn(`[skip] ${path.basename(templateDir)} (no html)`);
    return false;
  }

  const imagesDir = await ensureImagesDir(templateDir);
  const outPath = path.join(imagesDir, "thumbnail.png");
  const fileUrl = pathToFileURL(htmlPath).href;

  const page = await browser.newPage({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: DEVICE_SCALE,
  });

  try {
    await page.goto(fileUrl, { waitUntil: "load", timeout: 60000 });
    // Wait for images / fonts to settle
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });
    await page.waitForTimeout(200);

    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: false,
      animations: "disabled",
    });

    console.log(`[ok] ${path.basename(templateDir)} → images/thumbnail.png`);
    return true;
  } catch (err) {
    console.error(`[fail] ${path.basename(templateDir)}`, err);
    return false;
  } finally {
    await page.close();
  }
}

async function listImportDirs(): Promise<string[]> {
  try {
    const dirents = await fs.readdir(IMPORT_ROOT, { withFileTypes: true });
    return dirents
      .filter((d) => d.isDirectory())
      .map((d) => path.join(IMPORT_ROOT, d.name))
      .sort();
  } catch {
    return [];
  }
}

async function run(): Promise<void> {
  const dirs = [...(await listImportDirs())];
  for (const legacy of LEGACY_ROOTS) {
    try {
      await fs.access(legacy);
      dirs.push(legacy);
    } catch {
      // missing legacy sample
    }
  }

  if (dirs.length === 0) {
    throw new Error("No newsletter template directories found");
  }

  const browser = await chromium.launch({ headless: true });
  let ok = 0;
  let failed = 0;

  try {
    for (const dir of dirs) {
      const success = await screenshotTemplate(browser, dir);
      if (success) ok++;
      else failed++;
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${ok} thumbnails written, ${failed} skipped/failed.`);
  console.log(
    "Next: npm run templates:import-newsletters -- --update-existing",
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
