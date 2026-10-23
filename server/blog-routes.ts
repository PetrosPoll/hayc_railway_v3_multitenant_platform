import type { Express, Request } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { blogPosts, RolePermissions, websiteProgress } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { sanitizeBlogHtml, slugifyTitle } from "./lib/blog-html";
import { syncBlogPostsIntoConfig } from "./lib/blog-config-sync";
import { generateBlogPost } from "./lib/generate-blog-post";
import { getConfig, putConfig } from "./s3-config";
import {
  athensMonthStart,
  BLOG_HARD_LIMIT_PER_MONTH,
  BLOG_RECOMMENDED_PER_MONTH,
} from "./lib/blog-quota";

const generateSchema = z.object({
  topic: z.string().trim().min(3).max(400),
  notes: z.string().trim().max(1000).optional(),
  confirmOverRecommended: z.boolean().optional(),
});

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(400).optional(),
  html: z.string().trim().min(1).max(100_000),
  topic: z.string().trim().max(400).optional(),
  published: z.boolean().optional(),
});

async function authorize(req: Request, websiteId: number) {
  if (!req.isAuthenticated() || !req.user) {
    return { error: { status: 401 as const, message: "Not authenticated" } };
  }
  const user = await storage.getUserById(req.user.id);
  if (!user) {
    return { error: { status: 403 as const, message: "Not authorized" } };
  }
  const [website] = await db
    .select()
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteId))
    .limit(1);
  if (!website) {
    return { error: { status: 404 as const, message: "Website not found" } };
  }
  const staff = RolePermissions[user.role]?.canManageWebsites === true;
  if (website.userId !== user.id && !staff) {
    return { error: { status: 403 as const, message: "Not authorized" } };
  }
  if (!website.blogEnabled) {
    return { error: { status: 403 as const, message: "Blog is not enabled for this website" } };
  }
  return { website };
}

async function monthlyCount(websiteId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blogPosts)
    .where(and(
      eq(blogPosts.websiteProgressId, websiteId),
      gte(blogPosts.createdAt, athensMonthStart()),
    ));
  return row?.count ?? 0;
}

function usage(count: number) {
  return {
    count,
    recommended: BLOG_RECOMMENDED_PER_MONTH,
    limit: BLOG_HARD_LIMIT_PER_MONTH,
  };
}

async function uniqueSlug(websiteId: number, title: string, ignoreId?: number) {
  const base = slugifyTitle(title);
  let slug = base;
  let n = 2;
  while (n < 50) {
    const [existing] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.websiteProgressId, websiteId), eq(blogPosts.slug, slug)))
      .limit(1);
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${n}`.slice(0, 90);
    n += 1;
  }
  return `${base}-${Date.now()}`;
}

export function registerBlogRoutes(app: Express) {
  app.get("/api/websites/:id/blog", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    const posts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.websiteProgressId, websiteId))
      .orderBy(desc(blogPosts.updatedAt));
    res.json({ posts, usage: usage(await monthlyCount(websiteId)) });
  });

  app.post("/api/websites/:id/blog/generate", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a topic of at least 3 characters" });

    const count = await monthlyCount(websiteId);
    if (count >= BLOG_HARD_LIMIT_PER_MONTH) {
      return res.status(429).json({
        code: "monthly_limit",
        error: "Έχετε φτάσει το όριο των 15 άρθρων για αυτόν τον μήνα. Νέα άρθρα θα είναι διαθέσιμα από τον επόμενο μήνα.",
        usage: usage(count),
      });
    }
    if (count >= BLOG_RECOMMENDED_PER_MONTH && !parsed.data.confirmOverRecommended) {
      return res.status(409).json({
        code: "recommended_limit",
        error: "Προτείνουμε έως 7 άρθρα τον μήνα. Λιγότερα και πιο ποιοτικά άρθρα βοηθούν περισσότερο στην κατάταξη στη Google από πολλά άρθρα μαζί. Μπορείτε να συνεχίσετε αν θέλετε.",
        usage: usage(count),
      });
    }

    try {
      const generated = await generateBlogPost({
        topic: parsed.data.topic,
        notes: parsed.data.notes,
        website: access.website,
      });
      const slug = await uniqueSlug(websiteId, generated.title);
      const [post] = await db
        .insert(blogPosts)
        .values({
          websiteProgressId: websiteId,
          title: generated.title,
          slug,
          excerpt: generated.excerpt,
          html: generated.html,
          topic: parsed.data.topic,
          published: false,
          updatedAt: new Date(),
        })
        .returning();
      res.json({ post, usage: usage(count + 1) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate post";
      const missingKey = message.includes("is not set");
      res.status(missingKey ? 503 : 502).json({ error: message });
    }
  });

  app.post("/api/websites/:id/blog", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    const count = await monthlyCount(websiteId);
    if (count >= BLOG_HARD_LIMIT_PER_MONTH) {
      return res.status(429).json({
        code: "monthly_limit",
        error: "Έχετε φτάσει το όριο των 15 άρθρων για αυτόν τον μήνα. Νέα άρθρα θα είναι διαθέσιμα από τον επόμενο μήνα.",
        usage: usage(count),
      });
    }
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Title and body are required" });
    const published = parsed.data.published === true;
    const slug = await uniqueSlug(websiteId, parsed.data.title);
    const [post] = await db
      .insert(blogPosts)
      .values({
        websiteProgressId: websiteId,
        title: parsed.data.title,
        slug,
        excerpt: parsed.data.excerpt || "",
        html: sanitizeBlogHtml(parsed.data.html),
        topic: parsed.data.topic || null,
        published,
        publishedAt: published ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning();
    res.json(post);
  });

  app.patch("/api/websites/:id/blog/:postId", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    const postId = parseInt(req.params.postId, 10);
    if (!Number.isFinite(websiteId) || !Number.isFinite(postId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    const [existing] = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.id, postId), eq(blogPosts.websiteProgressId, websiteId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Post not found" });
    const parsed = saveSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid post" });
    const title = parsed.data.title ?? existing.title;
    const published = parsed.data.published ?? existing.published;
    const slug = title === existing.title
      ? existing.slug
      : await uniqueSlug(websiteId, title, existing.id);
    const [post] = await db
      .update(blogPosts)
      .set({
        title,
        slug,
        excerpt: parsed.data.excerpt ?? existing.excerpt,
        html: parsed.data.html != null ? sanitizeBlogHtml(parsed.data.html) : existing.html,
        topic: parsed.data.topic ?? existing.topic,
        published,
        publishedAt: published ? existing.publishedAt || new Date() : null,
        syncedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, existing.id))
      .returning();
    res.json(post);
  });

  app.post("/api/websites/:id/blog/sync", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    if (!access.website.siteId) {
      return res.status(404).json({ error: "Αυτό το website δεν έχει site για συγχρονισμό." });
    }
    const rows = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.websiteProgressId, websiteId));
    const ready = rows.filter((post) => post.published);
    const stalePaths = rows
      .filter((post) => !post.published && post.sitePath)
      .map((post) => post.sitePath as string);
    if (ready.length === 0 && stalePaths.length === 0) {
      return res.status(400).json({ error: "Δεν υπάρχουν άρθρα έτοιμα για συγχρονισμό." });
    }
    try {
      const config = await getConfig(access.website.siteId);
      const synced = syncBlogPostsIntoConfig(config, ready.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        html: post.html,
        sitePath: post.sitePath,
      })), stalePaths);
      if ("error" in synced) return res.status(409).json({ error: synced.error });
      await putConfig(access.website.siteId, synced.config);
      const now = new Date();
      for (const post of ready) {
        await db.update(blogPosts).set({
          sitePath: synced.paths[post.id] || post.sitePath,
          syncedAt: now,
        }).where(eq(blogPosts.id, post.id));
      }
      for (const post of rows.filter((item) => !item.published && item.sitePath)) {
        await db.update(blogPosts).set({ sitePath: null, syncedAt: null }).where(eq(blogPosts.id, post.id));
      }
      res.json({ syncedAt: now.toISOString(), count: ready.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync blog";
      res.status(500).json({ error: message });
    }
  });

  app.delete("/api/websites/:id/blog/:postId", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    const postId = parseInt(req.params.postId, 10);
    if (!Number.isFinite(websiteId) || !Number.isFinite(postId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    await db
      .delete(blogPosts)
      .where(and(eq(blogPosts.id, postId), eq(blogPosts.websiteProgressId, websiteId)));
    res.json({ success: true });
  });
}
