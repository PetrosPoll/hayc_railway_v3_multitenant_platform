import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { adminTemplates } from "../shared/schema";

const IMPORT_ROOT = path.resolve(process.cwd(), "newsletter-templates-import");

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

  async function getInlinedAsset(relativeAssetPath: string): Promise<string | null> {
    const normalized = relativeAssetPath.replace(/^\.?\//, "").replace(/\\/g, "/");
    const absoluteAssetPath = path.join(templateDir, normalized);
    try {
      if (!cache.has(absoluteAssetPath)) {
        cache.set(absoluteAssetPath, await readAsDataUri(absoluteAssetPath));
      }
      return cache.get(absoluteAssetPath)!;
    } catch {
      return null;
    }
  }

  const attrRegex = /(src|href)=["'](images\/[^"']+)["']/gi;
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

  const cssRegex = /url\((['"]?)(images\/[^'")]+)\1\)/gi;
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

    if (existing.length > 0) {
      console.log(`[skip] ${name} (already exists)`);
      skipped++;
      continue;
    }

    const rawHtml = await fs.readFile(htmlPath, "utf-8");
    const html = await inlineTemplateAssets(rawHtml, templateDir);
    const thumbnail = await getThumbnailDataUri(templateDir);
    const design = JSON.stringify({
      importSource: "newsletter-templates-import",
      folder: folderName,
      importedAt: new Date().toISOString(),
    });

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
