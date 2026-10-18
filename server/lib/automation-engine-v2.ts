import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { getConfig } from "../s3-config";
import { EmailService } from "../email-service";
import {
  automationEvents,
  websiteAutomationRuns,
  websiteAutomationSteps,
  websiteAutomationWorkflows,
  websiteEmailTemplates,
  type AutomationGraph,
  type AutomationGraphNode,
  type AutomationJobPayload,
  type WebsiteAutomationWorkflow,
} from "@shared/schema";
import {
  applyFormEmailPlaceholders,
  extractLogoFromSiteConfig,
  formatAutomationBodyToHtml,
} from "./form-automations";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 2_000, 10_000, 60_000, 300_000, 900_000];

export type EmitEventResult = {
  eventId: number;
  deduped: boolean;
  runIds: number[];
};

const EMAIL_TEMPLATE_DIRS = [
  path.join(__dirname, "email-templates"),
  path.join(__dirname, "..", "email-templates"),
];

function resolveEmailTemplatePath(lang: string, fileName: string): string | null {
  for (const dir of EMAIL_TEMPLATE_DIRS) {
    const candidate = path.join(dir, lang, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function normalizeEmailLanguage(language: string | null | undefined): "en" | "gr" {
  const lang = (language || "en").toLowerCase();
  if (lang === "gr" || lang === "el" || lang === "greek") return "gr";
  return "en";
}

function getBaseUrl(): string {
  return process.env.VITE_APP_URL || "https://hayc.gr";
}

function loadEmailTemplate(
  fileName: string,
  replacements: Record<string, string>,
  language: string,
): string {
  const lang = normalizeEmailLanguage(language);
  const filePath = resolveEmailTemplatePath(lang, fileName);
  let template: string;
  try {
    if (!filePath) throw new Error("not found");
    template = fs.readFileSync(filePath, "utf8");
  } catch {
    if (lang !== "en") return loadEmailTemplate(fileName, replacements, "en");
    throw new Error(`Missing email template ${fileName}`);
  }
  const enriched: Record<string, string> = { baseUrl: getBaseUrl(), ...replacements };
  template = template.replace(
    /{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g,
    (_m, condition, content) => {
      const value = enriched[condition.trim()];
      const isTruthy =
        value === "true" || (!!value && value !== "false" && value !== "0");
      return isTruthy ? content : "";
    },
  );
  for (const key of Object.keys(enriched)) {
    template = template.replace(new RegExp(`{{${key}}}`, "g"), enriched[key] ?? "");
  }
  return template;
}

function delayMsFromNode(node: AutomationGraphNode): number {
  const data = node.data || {};
  if (typeof data.delayMs === "number" && data.delayMs > 0) return data.delayMs;
  if (typeof data.delayMinutes === "number" && data.delayMinutes > 0) {
    return data.delayMinutes * 60_000;
  }
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  const unit = typeof data.unit === "string" ? data.unit : "minutes";
  if (!Number.isFinite(amount) || amount <= 0) return 60_000;
  if (unit === "hours") return amount * 3_600_000;
  if (unit === "days") return amount * 86_400_000;
  return amount * 60_000;
}

function outgoingTargets(graph: AutomationGraph, nodeId: string): string[] {
  return graph.edges.filter((e) => e.source === nodeId).map((e) => e.target);
}

function findNode(graph: AutomationGraph, nodeId: string): AutomationGraphNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function payloadFromEvent(
  payload: Record<string, unknown>,
): AutomationJobPayload {
  return {
    visitorEmail: String(payload.visitorEmail || payload.email || ""),
    visitorName: String(payload.visitorName || payload.name || ""),
    visitorPhone: String(payload.visitorPhone || payload.phone || ""),
    visitorMessage: String(payload.visitorMessage || payload.message || ""),
    siteLabel: String(payload.siteLabel || ""),
    siteId: String(payload.siteId || ""),
    formId:
      typeof payload.form_id === "string"
        ? payload.form_id
        : typeof payload.formId === "string"
          ? payload.formId
          : null,
    ownerEmail: String(payload.ownerEmail || ""),
    fromName: String(payload.fromName || "Client"),
    language: String(payload.language || "en"),
  };
}

async function resolveEmailContent(
  websiteProgressId: number,
  node: AutomationGraphNode,
  siteId: string | null,
): Promise<{ subject: string; body: string; logoUrl: string | null }> {
  const data = node.data || {};
  const templateId =
    typeof data.templateId === "number"
      ? data.templateId
      : typeof data.templateId === "string"
        ? parseInt(data.templateId, 10)
        : NaN;

  if (Number.isFinite(templateId)) {
    const [tpl] = await db
      .select()
      .from(websiteEmailTemplates)
      .where(
        and(
          eq(websiteEmailTemplates.id, templateId),
          eq(websiteEmailTemplates.websiteProgressId, websiteProgressId),
        ),
      )
      .limit(1);
    if (tpl) {
      return { subject: tpl.subject, body: tpl.body, logoUrl: tpl.logoUrl };
    }
  }

  let logoUrl =
    typeof data.logoUrl === "string" && data.logoUrl.trim() ? data.logoUrl.trim() : null;
  if (!logoUrl && siteId) {
    try {
      const config = await getConfig(siteId);
      logoUrl = extractLogoFromSiteConfig(config as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }

  return {
    subject: typeof data.subject === "string" ? data.subject : "We received your message",
    body:
      typeof data.body === "string"
        ? data.body
        : "Hi {{name}}, thank you for your message.",
    logoUrl,
  };
}

async function sendVisitorAutomationEmail(params: {
  websiteProgressId: number;
  node: AutomationGraphNode;
  payload: AutomationJobPayload;
}): Promise<void> {
  const { websiteProgressId, node, payload } = params;
  const content = await resolveEmailContent(
    websiteProgressId,
    node,
    payload.siteId,
  );
  const vars = {
    name: payload.visitorName,
    email: payload.visitorEmail,
    phone: payload.visitorPhone || "",
    message: payload.visitorMessage,
    siteLabel: payload.siteLabel,
  };
  const subject = applyFormEmailPlaceholders(content.subject, vars);
  const bodyHtml = formatAutomationBodyToHtml(
    applyFormEmailPlaceholders(content.body, vars),
  ).replace(/\$/g, "&#36;");

  const html = loadEmailTemplate(
    "public-contact-visitor-custom.html",
    {
      bodyHtml,
      logoUrl: content.logoUrl || "",
      logoAlt: payload.siteLabel || "Logo",
    },
    payload.language,
  );

  const result = await EmailService.sendEmail({
    to: payload.visitorEmail,
    subject,
    message: subject,
    fromEmail: "notifications@hayc.gr",
    fromName: payload.fromName,
    html,
    replyToAddresses: payload.ownerEmail ? [payload.ownerEmail] : undefined,
  });
  if (!result.success) {
    throw new Error(result.error || "Failed to send automation email");
  }
}

function workflowMatchesEvent(
  workflow: WebsiteAutomationWorkflow,
  eventType: string,
  payload: Record<string, unknown>,
): boolean {
  if (workflow.triggerType !== eventType) return false;
  if (eventType === "form.submitted") {
    const formId =
      typeof payload.form_id === "string"
        ? payload.form_id
        : typeof payload.formId === "string"
          ? payload.formId
          : null;
    if (!formId) return false;
    return workflow.triggerFormId === formId;
  }
  return true;
}

async function enqueueStep(params: {
  runId: number;
  websiteProgressId: number;
  nodeId: string;
  runAt?: Date;
}): Promise<void> {
  await db.insert(websiteAutomationSteps).values({
    runId: params.runId,
    websiteProgressId: params.websiteProgressId,
    nodeId: params.nodeId,
    status: "pending",
    runAt: params.runAt ?? new Date(),
    attempts: 0,
  });
}

/**
 * Create runs for all matching active workflows for an event.
 */
export async function startRunsForEvent(params: {
  event: typeof automationEvents.$inferSelect;
  cancelKey?: string | null;
}): Promise<number[]> {
  const { event, cancelKey } = params;
  const workflows = await db
    .select()
    .from(websiteAutomationWorkflows)
    .where(
      and(
        eq(websiteAutomationWorkflows.websiteProgressId, event.websiteProgressId),
        eq(websiteAutomationWorkflows.enabled, true),
        eq(websiteAutomationWorkflows.isSystem, false),
      ),
    );

  const matching = workflows.filter((w) =>
    workflowMatchesEvent(w, event.type, event.payload || {}),
  );

  const runIds: number[] = [];
  for (const workflow of matching) {
    const graph = workflow.graph as AutomationGraph;
    const formId =
      typeof event.payload?.form_id === "string"
        ? event.payload.form_id
        : workflow.triggerFormId;
    const trigger =
      graph.nodes.find(
        (n) =>
          n.type === "trigger" &&
          (n.data?.formId === formId || !n.data?.formId),
      ) || graph.nodes.find((n) => n.type === "trigger");
    if (!trigger) continue;

    const [run] = await db
      .insert(websiteAutomationRuns)
      .values({
        workflowId: workflow.id,
        websiteProgressId: event.websiteProgressId,
        eventId: event.id,
        status: "running",
        cancelKey: cancelKey || null,
      })
      .returning();

    runIds.push(run.id);
    await enqueueStep({
      runId: run.id,
      websiteProgressId: event.websiteProgressId,
      nodeId: trigger.id,
      runAt: new Date(),
    });
  }

  // Drain immediate steps (trigger → email …) so form replies stay snappy
  if (runIds.length > 0) {
    for (let i = 0; i < 20; i++) {
      const n = await processDueAutomationSteps({ limit: 50, runIds });
      if (n === 0) break;
    }
  }

  return runIds;
}

async function markRunFinished(runId: number, status: "completed" | "failed" | "cancelled") {
  await db
    .update(websiteAutomationRuns)
    .set({ status, finishedAt: new Date() })
    .where(eq(websiteAutomationRuns.id, runId));
}

async function maybeCompleteRun(runId: number): Promise<void> {
  const pending = await db
    .select({ id: websiteAutomationSteps.id })
    .from(websiteAutomationSteps)
    .where(
      and(
        eq(websiteAutomationSteps.runId, runId),
        inArray(websiteAutomationSteps.status, ["pending", "processing"]),
      ),
    )
    .limit(1);
  if (pending.length > 0) return;

  const failed = await db
    .select({ id: websiteAutomationSteps.id })
    .from(websiteAutomationSteps)
    .where(
      and(
        eq(websiteAutomationSteps.runId, runId),
        eq(websiteAutomationSteps.status, "failed"),
      ),
    )
    .limit(1);

  await markRunFinished(runId, failed.length ? "failed" : "completed");
}

async function executeNode(params: {
  workflow: WebsiteAutomationWorkflow;
  runId: number;
  nodeId: string;
  payload: AutomationJobPayload;
}): Promise<"continue" | "delayed"> {
  const { workflow, runId, nodeId, payload } = params;
  const graph = workflow.graph as AutomationGraph;
  const node = findNode(graph, nodeId);
  if (!node) return "continue";

  if (node.type === "trigger") {
    for (const targetId of outgoingTargets(graph, nodeId)) {
      await enqueueStep({
        runId,
        websiteProgressId: workflow.websiteProgressId,
        nodeId: targetId,
      });
    }
    return "continue";
  }

  if (node.type === "delay") {
    const ms = delayMsFromNode(node);
    // Children run after delay — schedule each child with runAt
    const runAt = new Date(Date.now() + ms);
    const targets = outgoingTargets(graph, nodeId);
    if (targets.length === 0) return "continue";
    for (const targetId of targets) {
      await enqueueStep({
        runId,
        websiteProgressId: workflow.websiteProgressId,
        nodeId: targetId,
        runAt,
      });
    }
    return "delayed";
  }

  if (node.type === "email") {
    await sendVisitorAutomationEmail({
      websiteProgressId: workflow.websiteProgressId,
      node,
      payload,
    });
    for (const targetId of outgoingTargets(graph, nodeId)) {
      await enqueueStep({
        runId,
        websiteProgressId: workflow.websiteProgressId,
        nodeId: targetId,
      });
    }
    return "continue";
  }

  return "continue";
}

/**
 * Claim and execute due pending steps (optimistic claim + optional SKIP LOCKED via raw SQL fallback).
 */
export async function processDueAutomationSteps(options?: {
  limit?: number;
  runIds?: number[];
}): Promise<number> {
  const limit = options?.limit ?? 50;
  const now = new Date();

  const filters = [
    eq(websiteAutomationSteps.status, "pending"),
    lte(websiteAutomationSteps.runAt, now),
  ];
  if (options?.runIds?.length) {
    filters.push(inArray(websiteAutomationSteps.runId, options.runIds));
  }

  const due = await db
    .select()
    .from(websiteAutomationSteps)
    .where(and(...filters))
    .limit(limit);
  if (!due.length) return 0;

  let processed = 0;
  for (const step of due) {
    const [claimed] = await db
      .update(websiteAutomationSteps)
      .set({
        status: "processing",
        attempts: step.attempts + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(websiteAutomationSteps.id, step.id),
          eq(websiteAutomationSteps.status, "pending"),
        ),
      )
      .returning();
    if (!claimed) continue;

    const stepId = claimed.id;
    const runId = claimed.runId;
    const nodeId = claimed.nodeId;
    const attempts = claimed.attempts;

    try {
      const [run] = await db
        .select()
        .from(websiteAutomationRuns)
        .where(eq(websiteAutomationRuns.id, runId))
        .limit(1);
      if (!run || run.status === "cancelled") {
        await db
          .update(websiteAutomationSteps)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(websiteAutomationSteps.id, stepId));
        continue;
      }

      const [workflow] = await db
        .select()
        .from(websiteAutomationWorkflows)
        .where(eq(websiteAutomationWorkflows.id, run.workflowId))
        .limit(1);
      if (!workflow) {
        throw new Error("Workflow missing");
      }

      let payload: AutomationJobPayload = {
        visitorEmail: "",
        visitorName: "",
        visitorPhone: "",
        visitorMessage: "",
        siteLabel: "",
        siteId: "",
        formId: workflow.triggerFormId,
        ownerEmail: "",
        fromName: "Client",
        language: "en",
      };
      if (run.eventId) {
        const [event] = await db
          .select()
          .from(automationEvents)
          .where(eq(automationEvents.id, run.eventId))
          .limit(1);
        if (event) payload = payloadFromEvent(event.payload || {});
      }

      await executeNode({ workflow, runId, nodeId, payload });

      await db
        .update(websiteAutomationSteps)
        .set({ status: "done", error: null, updatedAt: new Date() })
        .where(eq(websiteAutomationSteps.id, stepId));

      await maybeCompleteRun(runId);
      processed += 1;
    } catch (err: any) {
      const message = err?.message?.slice(0, 500) || "Unknown error";
      console.error(`[AUTOMATION:v2] Step #${stepId} failed:`, err);

      if (attempts < MAX_ATTEMPTS) {
        const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] || 60_000;
        await db
          .update(websiteAutomationSteps)
          .set({
            status: "pending",
            runAt: new Date(Date.now() + backoff),
            error: message,
            updatedAt: new Date(),
          })
          .where(eq(websiteAutomationSteps.id, stepId));
      } else {
        await db
          .update(websiteAutomationSteps)
          .set({
            status: "failed",
            error: message,
            updatedAt: new Date(),
          })
          .where(eq(websiteAutomationSteps.id, stepId));
        await markRunFinished(runId, "failed");
      }
    }
  }

  return processed;
}

/** Cancel pending/processing steps for runs matching cancel_key. */
export async function cancelRuns(cancelKey: string): Promise<number> {
  if (!cancelKey.trim()) return 0;
  const runs = await db
    .select()
    .from(websiteAutomationRuns)
    .where(eq(websiteAutomationRuns.cancelKey, cancelKey.trim()));

  if (!runs.length) return 0;

  const runIds = runs.map((r) => r.id);
  await db
    .update(websiteAutomationRuns)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(inArray(websiteAutomationRuns.id, runIds));

  const updated = await db
    .update(websiteAutomationSteps)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        inArray(websiteAutomationSteps.runId, runIds),
        inArray(websiteAutomationSteps.status, ["pending", "processing"]),
      ),
    )
    .returning({ id: websiteAutomationSteps.id });

  return updated.length;
}

/** Drain legacy delay jobs table still used by legacy engine. */
export { processDueAutomationJobs } from "./automation-engine";
