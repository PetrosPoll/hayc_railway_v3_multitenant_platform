import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { adminTemplates } from "../shared/schema";

const IMPORT_ROOT = path.resolve(process.cwd(), "newsletter-templates-import");
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

async function inlineTemplateAssets(html: string, templateDir: string): Promise<string> {
  let output = html;
  const cache = new Map<string, string>();
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

    // Prefer files with same stem (different extension).
    const sameStem = imagesOnly.find((f) => path.basename(f).toLowerCase().replace(/\.[^.]+$/, "") === wantedStem);
    if (sameStem) return sameStem;

    // Then pick nearest file name by edit distance.
    let best: { file: string; score: number } | null = null;
    for (const file of imagesOnly) {
      const base = path.basename(file).toLowerCase();
      // Skip non-image artifacts.
      if (base === "thumbs.db" || base.endsWith(".db_encryptable")) continue;
      const score = levenshtein(base, wantedBase);
      if (!best || score < best.score) best = { file, score };
    }

    // Avoid very weak matches.
    if (!best || best.score > Math.max(6, Math.floor(wantedBase.length * 0.6))) {
      return null;
    }

    return best.file;
  }

  async function getInlinedAsset(relativeAssetPath: string): Promise<string | null> {
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

    try {
      if (!cache.has(absoluteAssetPath)) {
        cache.set(absoluteAssetPath, await readAsDataUri(absoluteAssetPath));
      }
      return cache.get(absoluteAssetPath)!;
    } catch {
      return null;
    }
  }

  const attrRegex = /(src|href|background)=["']((?:\.\/)?images\/[^"']+)["']/gi;
  const attrMatches = [...output.matchAll(attrRegex)];
  for (const match of attrMatches) {
    const full = match[0];
    const attr = match[1];
    const rel = match[2];
    const inlined = await getInlinedAsset(rel);
    if (inlined) {
      output = output.replace(full, `${attr}="${inlined}"`);
    }
  }

  const cssRegex = /url\((['"]?)((?:\.\/)?images\/[^'")]+)\1\)/gi;
  const cssMatches = [...output.matchAll(cssRegex)];
  for (const match of cssMatches) {
    const full = match[0];
    const rel = match[2];
    const inlined = await getInlinedAsset(rel);
    if (inlined) {
      output = output.replace(full, `url("${inlined}")`);
    }
  }

  return output;
}

async function getThumbnailDataUri(templateDir: string): Promise<string | null> {
  const preferred = [
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
    const html = await inlineTemplateAssets(rawHtml, templateDir);
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
          thumbnail: null,
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
