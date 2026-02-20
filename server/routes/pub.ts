import { Router } from "express";
import { db } from "../db";
import { websiteDomains, websiteProgress, websitePages } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { normalizeHost } from "../utils/normalizeHost";
import { SimpleCache } from "../utils/simpleCache";

export const pubRouter = Router();

const siteCache = new SimpleCache<object>();
const pageCache = new SimpleCache<object>();
const CACHE_TTL = 120; // seconds

// GET /pub/site?host=example.com — public, no auth required
pubRouter.get("/site", async (req, res) => {
  const rawHost = req.query.host as string;

  if (!rawHost) {
    return res.status(400).json({ error: "host param required" });
  }

  const host = normalizeHost(rawHost);

  // Check cache first
  const cached = siteCache.get(`site:${host}`);
  if (cached) {
    return res.status(200).json(cached);
  }

  const result = await db
    .select()
    .from(websiteDomains)
    .innerJoin(websiteProgress, eq(websiteDomains.websiteProgressId, websiteProgress.id))
    .where(eq(websiteDomains.domain, host))
    .limit(1);

  if (!result.length || result[0].website_progress.status !== "published") {
    return res.status(404).json({ error: "Site not found" });
  }

  const site = result[0].website_progress;

  const responseObj = {
    websiteId: site.id,
    projectName: site.projectName ?? null,
    language: site.websiteLanguage ?? null,
    template: null,
    bookingEnabled: site.bookingEnabled ?? false,
    newsletterEnabled: false,
  };

  // Cache the successful response
  siteCache.set(`site:${host}`, responseObj, CACHE_TTL);

  return res.status(200).json(responseObj);
});

// GET /pub/page?host=example.com&slug=about — public, no auth required
pubRouter.get("/page", async (req, res) => {
  const rawHost = req.query.host as string;
  const slug = req.query.slug as string;

  if (!rawHost || !slug) {
    return res.status(400).json({ error: "host and slug params required" });
  }

  const host = normalizeHost(rawHost);
  const cacheKey = `page:${host}:${slug}`;

  // Check cache first
  const cached = pageCache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  // Resolve host → websiteProgressId
  const siteResult = await db
    .select({ id: websiteProgress.id, status: websiteProgress.status })
    .from(websiteDomains)
    .innerJoin(websiteProgress, eq(websiteDomains.websiteProgressId, websiteProgress.id))
    .where(eq(websiteDomains.domain, host))
    .limit(1);

  if (!siteResult.length || siteResult[0].status !== "published") {
    return res.status(404).json({ error: "Site not found" });
  }

  const websiteProgressId = siteResult[0].id;

  // Fetch the page
  const pageResult = await db
    .select()
    .from(websitePages)
    .where(
      and(
        eq(websitePages.websiteProgressId, websiteProgressId),
        eq(websitePages.slug, slug),
        eq(websitePages.status, "published")
      )
    )
    .limit(1);

  if (!pageResult.length) {
    return res.status(404).json({ error: "Page not found" });
  }

  const page = pageResult[0];

  const responseObj = {
    slug: page.slug,
    title: page.title,
    metaTitle: page.metaTitle ?? null,
    metaDescription: page.metaDescription ?? null,
    contentJson: page.contentJson,
    updatedAt: page.updatedAt,
  };

  pageCache.set(cacheKey, responseObj, CACHE_TTL);

  return res.status(200).json(responseObj);
});
