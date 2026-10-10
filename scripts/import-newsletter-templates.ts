import fs from "fs/promises";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { db, pool } from "../server/db";
import { adminTemplates } from "../shared/schema";
import { NEWSLETTER_EMAIL_BG_FALLBACK } from "../shared/newsletter";

const IMPORT_ROOT = path.resolve(process.cwd(), "newsletter-templates-import");
/** Decorative body patterns — too large / unused by Gmail CSS; use solid color. */
const DECORATIVE_BG_BASENAMES = new Set([
  "pattern.jpg",
  "pattern.jpeg",
  "pattern.png",
  "pattern copy.jpg",
]);

function configureCloudinary(): void {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary env required (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET). " +
        "Email clients strip data-URI images; templates must use hosted HTTPS URLs.",
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}
const LEGACY_SAMPLE_TEMPLATES = [
  {
    name: "Sports Newsletter",
    category: "Newsletter",
    htmlPath: path.resolve(
      process.cwd(),
      "client/public/email-templates/sports-newsletter/template.html",
    ),
    sourceKey: "legacy-sample:sports-newsletter",
  },
  {
    name: "Restaurant Email",
    category: "Restaurant",
    htmlPath: path.resolve(
      process.cwd(),
      "client/public/email-templates/restaurant-email/template.html",
    ),
    sourceKey: "legacy-sample:restaurant-email",
  },
] as const;

function normalizeTemplateName(folderName: string): string {
  const noPrefix = folderName.replace(/^\d+_/, "");
  return noPrefix
    .replace(/_/g, " ")
    .replace(/\bthankyou\b/gi, "Thank You")
    .trim();
}

function deriveCategory(templateName: string): string {
  const stripped = templateName.replace(/\s*Template.*$/i, "").trim();
  return stripped || "General";
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function readAsDataUri(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  const mime = getMimeType(filePath);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/**
 * Host template images on Cloudinary and rewrite HTML to HTTPS URLs.
 * Gmail (and others) strip data-URI images and often ignore CSS background-image;
 * HTML background="https://..." on <td>/<table> is the reliable path for section art.
 */
async function resolveTemplateAssets(
  html: string,
  templateDir: string,
  folderName: string,
): Promise<string> {
  let output = html;
  const urlCache = new Map<string, string>();
  let templateFilesCache: string[] | null = null;

  async function getTemplateFiles(): Promise<string[]> {
    if (templateFilesCache) return templateFilesCache;
    const files: string[] = [];
    async function walk(dir: string, relPrefix = ""): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), rel);
        } else {
          files.push(rel.replace(/\\/g, "/"));
        }
      }
    }
    await walk(templateDir);
    templateFilesCache = files;
    return files;
  }

  function levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }
    return dp[a.length][b.length];
  }

  async function resolveFallbackAsset(normalized: string): Promise<string | null> {
    const allFiles = await getTemplateFiles();
    const imagesOnly = allFiles.filter((f) => f.startsWith("images/"));
    if (imagesOnly.length === 0) return null;

    const wantedBase = path.basename(normalized).toLowerCase();
    const wantedStem = wantedBase.replace(/\.[^.]+$/, "");

    const sameStem = imagesOnly.find(
      (f) => path.basename(f).toLowerCase().replace(/\.[^.]+$/, "") === wantedStem,
    );
    if (sameStem) return sameStem;

    let best: { file: string; score: number } | null = null;
    for (const file of imagesOnly) {
      const base = path.basename(file).toLowerCase();
      if (base === "thumbs.db" || base.endsWith(".db_encryptable")) continue;
      const score = levenshtein(base, wantedBase);
      if (!best || score < best.score) best = { file, score };
    }

    if (!best || best.score > Math.max(6, Math.floor(wantedBase.length * 0.6))) {
      return null;
    }
    return best.file;
  }

  async function resolveLocalAsset(
    relativeAssetPath: string,
  ): Promise<{ abs: string; rel: string } | null> {
    const normalized = relativeAssetPath.replace(/^\.?\//, "").replace(/\\/g, "/");
    let resolvedPath = normalized;
    let absoluteAssetPath = path.join(templateDir, resolvedPath);
    try {
      await fs.access(absoluteAssetPath);
    } catch {
      const fallback = await resolveFallbackAsset(normalized);
      if (!fallback) return null;
      resolvedPath = fallback;
      absoluteAssetPath = path.join(templateDir, resolvedPath);
    }
    return { abs: absoluteAssetPath, rel: resolvedPath };
  }

  async function getHostedAssetUrl(relativeAssetPath: string): Promise<string | null> {
    const local = await resolveLocalAsset(relativeAssetPath);
    if (!local) return null;

    const base = path.basename(local.rel).toLowerCase();
    if (DECORATIVE_BG_BASENAMES.has(base)) {
      return null; // caller uses solid fallback
    }

    if (urlCache.has(local.abs)) return urlCache.get(local.abs)!;

    const publicId = `newsletter-templates/${folderName}/${local.rel.replace(/\.[^.]+$/, "")}`
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/");

    const result = await cloudinary.uploader.upload(local.abs, {
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
      unique_filename: false,
    });
    const url = result.secure_url as string;
    urlCache.set(local.abs, url);
    console.log(`  [img] ${local.rel} → ${url}`);
    return url;
  }

  // src / href / HTML background="images/..."
  const attrRegex = /(src|href|background)=["']((?:\.\/)?images\/[^"']+)["']/gi;
  const attrMatches = [...output.matchAll(attrRegex)];
  for (const match of attrMatches) {
    const full = match[0];
    const attr = match[1];
    const rel = match[2];
    const base = path.basename(rel).toLowerCase();
    if (attr === "background" && DECORATIVE_BG_BASENAMES.has(base)) {
      output = output.replace(full, `background="${NEWSLETTER_EMAIL_BG_FALLBACK}"`);
      continue;
    }
    const hosted = await getHostedAssetUrl(rel);
    if (hosted) {
      output = output.replace(full, `${attr}="${hosted}"`);
    }
  }

  // CSS url(./images/...) — host content art; solid color for decorative patterns
  const cssRegex = /url\((['"]?)((?:\.\/)?images\/[^'")]+)\1\)/gi;
  const cssMatches = [...output.matchAll(cssRegex)];
  for (const match of cssMatches) {
    const full = match[0];
    const rel = match[2];
    const base = path.basename(rel).toLowerCase();
    if (DECORATIVE_BG_BASENAMES.has(base)) {
      output = output.replace(full, NEWSLETTER_EMAIL_BG_FALLBACK);
      continue;
    }
    const hosted = await getHostedAssetUrl(rel);
    if (hosted) {
      output = output.replace(full, `url('${hosted}')`);
    } else {
      output = output.replace(full, NEWSLETTER_EMAIL_BG_FALLBACK);
    }
  }

  // Gmail ignores many CSS background-image rules but honors HTML background on td/table.
  output = addHtmlBackgroundFromCss(output);

  return output;
}

/** Copy https background urls from style= onto the tag's background attribute. */
function addHtmlBackgroundFromCss(html: string): string {
  return html.replace(
    /<(td|table|th|body)\b([^>]*?)>/gi,
    (full, tag: string, attrs: string) => {
      if (/\bbackground\s*=\s*["']https?:\/\//i.test(attrs)) return full;

      const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
      if (!styleMatch) return full;
      const style = styleMatch[2];
      const urlMatch = style.match(
        /background(?:-image)?\s*:\s*url\(\s*(['"]?)(https:\/\/[^)'"]+)\1\s*\)/i,
      );
      if (!urlMatch) return full;

      return `<${tag} background="${urlMatch[2]}"${attrs}>`;
    },
  );
}

async function getThumbnailDataUri(templateDir: string): Promise<string | null> {
  const preferred = [
    "images/thumbnail.png", // Playwright screenshot of rendered email
    "images/template.png",
    "images/header-image.png",
    "images/header-image.jpg",
    "images/hero.png",
  ];

  for (const rel of preferred) {
    const p = path.join(templateDir, rel);
    try {
      await fs.access(p);
      return await readAsDataUri(p);
    } catch {
      // continue
    }
  }

  return null;
}

async function run(): Promise<void> {
  const shouldUpdateExisting = process.argv.includes("--update-existing");
  configureCloudinary();
  const dirents = await fs.readdir(IMPORT_ROOT, { withFileTypes: true });
  const templateDirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name).sort();

  let inserted = 0;
  let skipped = 0;

  for (const folderName of templateDirs) {
    const templateDir = path.join(IMPORT_ROOT, folderName);
    const htmlPath = path.join(templateDir, "index.html");

    try {
      await fs.access(htmlPath);
    } catch {
      console.warn(`[skip] ${folderName} (missing index.html)`);
      skipped++;
      continue;
    }

    const name = normalizeTemplateName(folderName);
    const category = deriveCategory(name);

    const existing = await db
      .select({ id: adminTemplates.id })
      .from(adminTemplates)
      .where(eq(adminTemplates.name, name))
      .limit(1);

    const rawHtml = await fs.readFile(htmlPath, "utf-8");
    console.log(`[import] ${name}`);
    const html = await resolveTemplateAssets(rawHtml, templateDir, folderName);
    const thumbnail = await getThumbnailDataUri(templateDir);
    const design = JSON.stringify({
      importSource: "newsletter-templates-import",
      folder: folderName,
      importedAt: new Date().toISOString(),
    });

    if (existing.length > 0) {
      if (!shouldUpdateExisting) {
        console.log(`[skip] ${name} (already exists)`);
        skipped++;
        continue;
      }

      await db
        .update(adminTemplates)
        .set({
          html,
          design,
          thumbnail,
          category,
          updatedAt: new Date(),
        })
        .where(eq(adminTemplates.id, existing[0].id));

      console.log(`[ok] Updated ${name}`);
      inserted++;
    } else {
      await db.insert(adminTemplates).values({
        name,
        html,
        design,
        thumbnail,
        category,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[ok] Imported ${name}`);
      inserted++;
    }
  }

  for (const sample of LEGACY_SAMPLE_TEMPLATES) {
    const existing = await db
      .select({ id: adminTemplates.id })
      .from(adminTemplates)
      .where(eq(adminTemplates.name, sample.name))
      .limit(1);

    try {
      const html = await fs.readFile(sample.htmlPath, "utf-8");
      const templateDir = path.dirname(sample.htmlPath);
      const thumbnail = await getThumbnailDataUri(templateDir);
      const design = JSON.stringify({
        importSource: "legacy-sample-templates",
        key: sample.sourceKey,
        importedAt: new Date().toISOString(),
      });

      if (existing.length > 0) {
        if (!shouldUpdateExisting) {
          console.log(`[skip] ${sample.name} (already exists)`);
          skipped++;
          continue;
        }

        await db
          .update(adminTemplates)
          .set({
            html,
            design,
            thumbnail,
            category: sample.category,
            updatedAt: new Date(),
          })
          .where(eq(adminTemplates.id, existing[0].id));
        console.log(`[ok] Updated ${sample.name}`);
        inserted++;
      } else {
        await db.insert(adminTemplates).values({
          name: sample.name,
          html,
          design,
          thumbnail,
          category: sample.category,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`[ok] Imported ${sample.name}`);
        inserted++;
      }
    } catch (err) {
      console.warn(`[skip] ${sample.name} (failed to read source HTML)`, err);
      skipped++;
    }
  }

  // Push fixed HTML into per-website copies of the same seeded template names.
  if (shouldUpdateExisting && inserted > 0) {
    const result = await db.execute(sql`
      UPDATE email_templates AS e
      SET
        html = a.html,
        design = a.design,
        thumbnail = a.thumbnail,
        category = a.category,
        updated_at = NOW()
      FROM admin_templates AS a
      WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(a.name))
        AND a.design LIKE '%importSource%'
        AND e.design LIKE '%importSource%'
    `);
    console.log(`[ok] Synced website email_templates from admin catalog`);
    void result;
  }

  console.log(`Done. Inserted: ${inserted}, skipped: ${skipped}`);
}

run()
  .catch((err) => {
    console.error("Template import failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
