import type { Express, Request } from "express";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { RolePermissions, videoJobs, websiteProgress } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { athensMonthStart } from "./lib/blog-quota";
import { createZapcapProvider } from "./lib/zapcap";
import { deleteVideoObject, presignVideoDownload, putVideoObject } from "./lib/video-storage";
import { VIDEO_LIMIT_PER_MONTH, VIDEO_MAX_SECONDS, type VideoProvider } from "./lib/video-provider";

const provider: VideoProvider = createZapcapProvider();

const ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MAX_BYTES = 500 * 1024 * 1024;

const createSchema = z.object({
  key: z.string().trim().min(1),
  styleId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(200),
  durationSeconds: z.number().positive().max(VIDEO_MAX_SECONDS),
});

async function authorize(req: Request, websiteId: number) {
  if (!req.isAuthenticated() || !req.user) {
    return { error: { status: 401 as const, message: "Not authenticated" } };
  }
  const user = await storage.getUserById(req.user.id);
  if (!user) return { error: { status: 403 as const, message: "Not authorized" } };
  const [website] = await db.select().from(websiteProgress).where(eq(websiteProgress.id, websiteId)).limit(1);
  if (!website) return { error: { status: 404 as const, message: "Website not found" } };
  const staff = RolePermissions[user.role]?.canManageWebsites === true;
  if (website.userId !== user.id && !staff) {
    return { error: { status: 403 as const, message: "Not authorized" } };
  }
  if (!website.videoEnabled) {
    return { error: { status: 403 as const, message: "Η επεξεργασία βίντεο δεν είναι ενεργή για αυτό το site." } };
  }
  return { website };
}

async function monthlyCount(websiteId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoJobs)
    .where(and(
      eq(videoJobs.websiteProgressId, websiteId),
      ne(videoJobs.status, "failed"),
      gte(videoJobs.createdAt, athensMonthStart()),
    ));
  return row?.count ?? 0;
}

async function refreshJob(job: typeof videoJobs.$inferSelect) {
  if (job.status !== "processing" || !job.providerVideoId || !job.providerTaskId) {
    return { job, stage: null as string | null };
  }
  try {
    const next = await provider.status({
      providerVideoId: job.providerVideoId,
      providerTaskId: job.providerTaskId,
    });
    const stage = next.stage || null;
    const clearFile = job.s3Key && (next.status === "completed" || next.status === "failed");
    if (clearFile && job.s3Key) await deleteVideoObject(job.s3Key).catch(() => undefined);
    if (next.status === job.status && !clearFile) return { job, stage };
    const [updated] = await db.update(videoJobs).set({
      status: next.status,
      error: next.status === "failed" ? (next.error || "Η επεξεργασία απέτυχε.") : null,
      s3Key: clearFile ? null : job.s3Key,
      updatedAt: new Date(),
    }).where(eq(videoJobs.id, job.id)).returning();
    return { job: updated || job, stage };
  } catch {
    return { job, stage: null as string | null };
  }
}

function publicJob(job: typeof videoJobs.$inferSelect, retentionDays: number, stage: string | null) {
  return {
    id: job.id,
    fileName: job.fileName,
    styleName: job.styleName,
    status: job.status,
    stage,
    error: job.error,
    createdAt: job.createdAt,
    retentionDays,
  };
}

export function registerVideoRoutes(app: Express) {
  app.get("/api/websites/:id/videos", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access && access.error) return res.status(access.error.status).json({ error: access.error.message });
    const rows = await db.select().from(videoJobs).where(eq(videoJobs.websiteProgressId, websiteId)).orderBy(desc(videoJobs.createdAt));
    const jobs = [];
    for (const row of rows) jobs.push(await refreshJob(row));
    const count = jobs.filter((item) => item.job.status !== "failed" && item.job.createdAt && item.job.createdAt >= athensMonthStart()).length;
    res.json({
      jobs: jobs.map((item) => publicJob(item.job, provider.retentionDays, item.stage)),
      usage: { count, limit: VIDEO_LIMIT_PER_MONTH },
      retentionDays: provider.retentionDays,
      maxSeconds: VIDEO_MAX_SECONDS,
    });
  });

  app.get("/api/websites/:id/videos/styles", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access && access.error) return res.status(access.error.status).json({ error: access.error.message });
    try {
      const styles = await provider.listStyles();
      res.json({ styles });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Τα στυλ δεν φορτώθηκαν.";
      res.status(503).json({ error: message });
    }
  });

  app.post("/api/websites/:id/videos/upload", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access && access.error) return res.status(access.error.status).json({ error: access.error.message });
    if (await monthlyCount(websiteId) >= VIDEO_LIMIT_PER_MONTH) {
      return res.status(429).json({ error: "Έχετε φτάσει τα 10 βίντεο για αυτόν τον μήνα." });
    }
    const contentType = String(req.headers["content-type"] || "").split(";")[0].trim();
    const bytes = Number(req.headers["content-length"]);
    if (!ALLOWED_TYPES.has(contentType) || !Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
      return res.status(400).json({ error: "Το αρχείο πρέπει να είναι mp4 ή mov έως 500 MB." });
    }
    const ext = contentType === "video/quicktime" ? "mov" : "mp4";
    const key = `video-uploads/${websiteId}/${randomUUID()}.${ext}`;
    try {
      await putVideoObject(key, req, contentType, bytes);
      res.json({ key });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Το ανέβασμα δεν ξεκίνησε.";
      res.status(503).json({ error: message });
    }
  });

  app.post("/api/websites/:id/videos", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(websiteId)) return res.status(400).json({ error: "Invalid website id" });
    const access = await authorize(req, websiteId);
    if ("error" in access && access.error) return res.status(access.error.status).json({ error: access.error.message });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.some((issue) => issue.path[0] === "durationSeconds")
        ? `Το βίντεο πρέπει να είναι έως ${VIDEO_MAX_SECONDS} δευτερόλεπτα.`
        : "Μη έγκυρο βίντεο." });
    }
    if (!parsed.data.key.startsWith(`video-uploads/${websiteId}/`)) {
      return res.status(400).json({ error: "Μη έγκυρο αρχείο." });
    }
    if (await monthlyCount(websiteId) >= VIDEO_LIMIT_PER_MONTH) {
      return res.status(429).json({ error: "Έχετε φτάσει τα 10 βίντεο για αυτόν τον μήνα." });
    }
    let styles;
    try {
      styles = await provider.listStyles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Τα στυλ δεν φορτώθηκαν.";
      return res.status(503).json({ error: message });
    }
    const style = styles.find((item) => item.id === parsed.data.styleId);
    if (!style) return res.status(400).json({ error: "Διάλεξε ένα από τα διαθέσιμα στυλ." });

    let submitted: { providerVideoId: string; providerTaskId: string; received: boolean };
    try {
      const sourceUrl = await presignVideoDownload(parsed.data.key);
      submitted = await provider.submit({ sourceUrl, styleId: style.id });
    } catch (error) {
      await deleteVideoObject(parsed.data.key).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Η επεξεργασία δεν ξεκίνησε.";
      return res.status(502).json({ error: message });
    }

    if (submitted.received) {
      await deleteVideoObject(parsed.data.key).catch(() => undefined);
    }

    const [job] = await db.insert(videoJobs).values({
      websiteProgressId: websiteId,
      provider: provider.id,
      providerVideoId: submitted.providerVideoId,
      providerTaskId: submitted.providerTaskId,
      styleId: style.id,
      styleName: style.label,
      fileName: parsed.data.fileName,
      status: "processing",
      s3Key: submitted.received ? null : parsed.data.key,
    }).returning();
    res.status(201).json(publicJob(job, provider.retentionDays, "pending"));
  });

  app.get("/api/websites/:id/videos/:jobId/download", async (req, res) => {
    const websiteId = parseInt(req.params.id, 10);
    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isFinite(websiteId) || !Number.isFinite(jobId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const access = await authorize(req, websiteId);
    if ("error" in access && access.error) return res.status(access.error.status).json({ error: access.error.message });
    const [job] = await db.select().from(videoJobs).where(and(
      eq(videoJobs.id, jobId),
      eq(videoJobs.websiteProgressId, websiteId),
    )).limit(1);
    if (!job || !job.providerVideoId || !job.providerTaskId) {
      return res.status(404).json({ error: "Το βίντεο δεν βρέθηκε." });
    }
    try {
      const url = await provider.downloadUrl({
        providerVideoId: job.providerVideoId,
        providerTaskId: job.providerTaskId,
      });
      res.json({ url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Η λήψη δεν είναι διαθέσιμη.";
      res.status(409).json({ error: message });
    }
  });
}
