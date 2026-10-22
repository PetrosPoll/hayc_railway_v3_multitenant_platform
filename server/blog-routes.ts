import type { Express, Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { blogPosts, RolePermissions, websiteProgress } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { sanitizeBlogHtml, slugifyTitle } from "./lib/blog-html";
import { generateBlogPost } from "./lib/generate-blog-post";

const generateSchema = z.object({
  topic: z.string().trim().min(3).max(400),
  notes: z.string().trim().max(1000).optional(),
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
  return { website };
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

function publicPost(post: typeof blogPosts.$inferSelect) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    html: post.html,
    publishedAt: post.publishedAt,
  };
}

export function registerBlogRoutes(app: Express) {
  app.get("/api/public/blog/:siteId", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const siteId = req.params.siteId.trim();
    if (!siteId) return res.status(400).json({ error: "Missing site id" });
    const [website] = await db
      .select({ id: websiteProgress.id })
      .from(websiteProgress)
      .where(eq(websiteProgress.siteId, siteId))
      .limit(1);
    if (!website) return res.status(404).json({ error: "Website not found" });
    const posts = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.websiteProgressId, website.id), eq(blogPosts.published, true)))
      .orderBy(desc(blogPosts.publishedAt));
    res.json({ siteId, posts: posts.map(publicPost) });
  });

  app.get("/api/public/blog/:siteId/:slug", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const siteId = req.params.siteId.trim();
    const slug = req.params.slug.trim();
    const [website] = await db
      .select({ id: websiteProgress.id })
      .from(websiteProgress)
      .where(eq(websiteProgress.siteId, siteId))
      .limit(1);
    if (!website) return res.status(404).json({ error: "Website not found" });
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(
        eq(blogPosts.websiteProgressId, website.id),
        eq(blogPosts.slug, slug),
        eq(blogPosts.published, true),
      ))
      .limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(publicPost(post));
  });

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
    res.json(posts);
  });

  app.post("/api/websites/:id/blog/generate", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a topic of at least 3 characters" });
    try {
      const generated = await generateBlogPost({
        topic: parsed.data.topic,
        notes: parsed.data.notes,
        websiteLanguage: access.website.websiteLanguage,
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
      res.json(post);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate post";
      const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/websites/:id/blog", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access) return res.status(access.error.status).json({ error: access.error.message });
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
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, existing.id))
      .returning();
    res.json(post);
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
