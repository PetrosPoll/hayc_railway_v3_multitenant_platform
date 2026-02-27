import { Router } from "express";
import { db } from "../db";
import { websiteDomains, websiteProgress } from "@shared/schema";
import { eq } from "drizzle-orm";
import { normalizeHost } from "../utils/normalizeHost";
import { SimpleCache } from "../utils/simpleCache";

export const pubRouter = Router();

const siteCache = new SimpleCache<object>();
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
