import type { Express, Request, Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { websiteProgress } from "@shared/schema";
import { ReceptionError, type IncomingReceptionFile } from "./lib/reception";
import {
  askForDocs,
  createReceptionRequest,
  downloadReceptionZip,
  getReceptionRequest,
  listReceptionRequests,
  publicReceptionView,
  setDocReceived,
  setReceptionStatus,
  uploadFromMagicLink,
} from "./lib/reception";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 12 },
});

const limiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const DEV_ORIGINS = new Set([
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173",
]);

function filesOf(req: Request): IncomingReceptionFile[] {
  const files = (req.files || []) as { fieldname: string; buffer: Buffer; mimetype: string; originalname: string; size: number }[];
  return files.map((file) => ({
    fieldname: file.fieldname,
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  }));
}

function sendError(res: Response, err: unknown) {
  if (err instanceof ReceptionError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error("[reception]", err);
  return res.status(500).json({ error: "Reception request failed" });
}

async function allowOrigin(origin: string | undefined): Promise<string | null> {
  if (!origin) return null;
  if (DEV_ORIGINS.has(origin)) return origin;
  if (/^https:\/\/[a-zA-Z0-9-]+\.hayc\.gr$/.test(origin)) return origin;
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  const [row] = await db
    .select({ id: websiteProgress.id })
    .from(websiteProgress)
    .where(eq(websiteProgress.customDomain, host))
    .limit(1);
  return row ? origin : null;
}

function parseChecklist(value: unknown): Record<string, boolean> {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = item === true || item === "true" || item === "1";
  }
  return out;
}

function parseCrossSell(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",").map((part) => part.trim()).filter(Boolean);
    }
  }
  return value;
}

function answersFromBody(body: Record<string, unknown>): Record<string, string> {
  const skip = new Set([
    "siteId",
    "typeKey",
    "name",
    "email",
    "phone",
    "policyRef",
    "policy_ref",
    "crossSell",
    "cross_sell",
    "checklist",
    "_hp",
  ]);
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (skip.has(key) || value == null || typeof value === "object") continue;
    answers[key] = String(value);
  }
  if (typeof body.policy_ref === "string") answers.policy_ref = body.policy_ref;
  if (typeof body.policyRef === "string") answers.policy_ref = body.policyRef;
  return answers;
}

export function registerReceptionRoutes(
  app: Express,
  authorize: (req: Request, websiteId: number) => Promise<{
    error?: { status: number; body: { error: string } };
    website?: { receptionEnabled: boolean };
  }>,
) {
  app.options("/public/reception", async (req, res) => {
    const allowed = await allowOrigin(req.get("Origin"));
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", allowed);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    res.sendStatus(204);
  });

  app.post("/public/reception", limiter, upload.any(), async (req, res) => {
    try {
      const allowed = await allowOrigin(req.get("Origin"));
      if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
      const body = (req.body || {}) as Record<string, unknown>;
      if (typeof body._hp === "string" && body._hp.trim()) {
        return res.json({ ok: true });
      }
      const siteId = String(body.siteId || "").trim();
      const typeKey = String(body.typeKey || "").trim();
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim();
      if (!siteId || !typeKey || !name || !email) {
        return res.status(400).json({ error: "siteId, typeKey, name and email are required" });
      }
      const created = await createReceptionRequest({
        siteId,
        typeKey,
        name,
        email,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        policyRef: typeof body.policyRef === "string" ? body.policyRef : typeof body.policy_ref === "string" ? body.policy_ref : undefined,
        crossSell: parseCrossSell(body.crossSell ?? body.cross_sell),
        checklist: parseChecklist(body.checklist),
        answers: answersFromBody(body),
        files: filesOf(req),
      });
      return res.status(201).json(created);
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/public/reception/:token", async (req, res) => {
    try {
      return res.json(await publicReceptionView(req.params.token));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/public/reception/:token", upload.any(), async (req, res) => {
    try {
      return res.json(await uploadFromMagicLink(req.params.token, filesOf(req)));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/api/websites/:id/requests", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      if (Number.isNaN(websiteId)) return res.status(400).json({ error: "Invalid website id" });
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      const requests = await listReceptionRequests(websiteId, {
        typeKey: typeof req.query.type === "string" ? req.query.type : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      return res.json({ requests });
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/api/websites/:id/requests/:requestId", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      if (Number.isNaN(websiteId) || Number.isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      return res.json(await getReceptionRequest(websiteId, requestId));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.patch("/api/websites/:id/requests/:requestId", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      if (Number.isNaN(websiteId) || Number.isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      const status = String(req.body?.status || "");
      return res.json(await setReceptionStatus(websiteId, requestId, status));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/websites/:id/requests/:requestId/docs/:docId", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      const docId = parseInt(req.params.docId, 10);
      if ([websiteId, requestId, docId].some(Number.isNaN)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      return res.json(
        await setDocReceived(websiteId, requestId, docId, req.body?.received !== false),
      );
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/websites/:id/requests/:requestId/ask-docs", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      if (Number.isNaN(websiteId) || Number.isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      const docIds = Array.isArray(req.body?.docIds)
        ? req.body.docIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
        : [];
      const labels = Array.isArray(req.body?.labels)
        ? req.body.labels.map((label: unknown) => String(label))
        : [];
      return res.json(await askForDocs(websiteId, requestId, { docIds, labels }));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/api/websites/:id/requests/:requestId/zip", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id, 10);
      const requestId = parseInt(req.params.requestId, 10);
      if (Number.isNaN(websiteId) || Number.isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const access = await authorize(req, websiteId);
      if (access.error) return res.status(access.error.status).json(access.error.body);
      const zip = await downloadReceptionZip(websiteId, requestId);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="aitima-${requestId}.zip"`);
      return res.send(zip);
    } catch (err) {
      return sendError(res, err);
    }
  });
}
