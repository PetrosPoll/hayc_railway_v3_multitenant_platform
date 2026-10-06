import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { getConfig } from "../s3-config";
import { EmailService } from "../email-service";
import {
  websiteAutomationJobs,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const filePath = path.join(__dirname, "..", "email-templates", lang, fileName);
  let template: string;
  try {
    template = fs.readFileSync(filePath, "utf8");
  } catch {
    if (lang !== "en") {
      return loadEmailTemplate(fileName, replacements, "en");
    }
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
      return {
        subject: tpl.subject,
        body: tpl.body,
        logoUrl: tpl.logoUrl,
      };
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

async function enqueueJob(
  workflowId: number,
  websiteProgressId: number,
  nodeId: string,
  runAt: Date,
  payload: AutomationJobPayload,
): Promise<void> {
  await db.insert(websiteAutomationJobs).values({
    workflowId,
    websiteProgressId,
    nodeId,
    runAt,
    status: "pending",
    payload,
  });
}

/**
 * Process a node and continue to children (or schedule delay).
 */
export async function processAutomationNode(params: {
  workflow: WebsiteAutomationWorkflow;
  nodeId: string;
  payload: AutomationJobPayload;
}): Promise<void> {
  const { workflow, nodeId, payload } = params;
  const graph = workflow.graph as AutomationGraph;
  const node = findNode(graph, nodeId);
  if (!node) return;

  if (node.type === "trigger") {
    for (const targetId of outgoingTargets(graph, nodeId)) {
      await processAutomationNode({ workflow, nodeId: targetId, payload });
    }
    return;
  }

  if (node.type === "delay") {
    const ms = delayMsFromNode(node);
    const runAt = new Date(Date.now() + ms);
    // Schedule continuation at this delay node: when job fires, process children
    await enqueueJob(workflow.id, workflow.websiteProgressId, nodeId, runAt, {
      ...payload,
      // stash: job for delay nodes means "resume after delay"
    });
    return;
  }

  if (node.type === "email") {
    await sendVisitorAutomationEmail({
      websiteProgressId: workflow.websiteProgressId,
      node,
      payload,
    });
    for (const targetId of outgoingTargets(graph, nodeId)) {
      await processAutomationNode({ workflow, nodeId: targetId, payload });
    }
  }
}

/**
 * Start workflow from its trigger node after a form submit.
 * Returns true if a workflow handled the visitor email path.
 */
export async function startWorkflowForFormSubmit(params: {
  websiteProgressId: number;
  formId: string;
  payload: AutomationJobPayload;
}): Promise<boolean> {
  const [workflow] = await db
    .select()
    .from(websiteAutomationWorkflows)
    .where(
      and(
        eq(websiteAutomationWorkflows.websiteProgressId, params.websiteProgressId),
        eq(websiteAutomationWorkflows.triggerFormId, params.formId),
        eq(websiteAutomationWorkflows.enabled, true),
      ),
    )
    .limit(1);

  if (!workflow) return false;

  const graph = workflow.graph as AutomationGraph;
  const trigger =
    graph.nodes.find(
      (n) =>
        n.type === "trigger" &&
        (n.data?.formId === params.formId || !n.data?.formId),
    ) || graph.nodes.find((n) => n.type === "trigger");

  if (!trigger) return false;

  await processAutomationNode({
    workflow,
    nodeId: trigger.id,
    payload: params.payload,
  });
  return true;
}

/**
 * When a delay job fires: continue to outgoing nodes from that delay node.
 */
async function resumeAfterDelayJob(job: typeof websiteAutomationJobs.$inferSelect): Promise<void> {
  const [workflow] = await db
    .select()
    .from(websiteAutomationWorkflows)
    .where(eq(websiteAutomationWorkflows.id, job.workflowId))
    .limit(1);
  if (!workflow || !workflow.enabled) {
    throw new Error("Workflow missing or disabled");
  }
  const graph = workflow.graph as AutomationGraph;
  const targets = outgoingTargets(graph, job.nodeId);
  for (const targetId of targets) {
    await processAutomationNode({
      workflow,
      nodeId: targetId,
      payload: job.payload,
    });
  }
}

export async function processDueAutomationJobs(): Promise<void> {
  const now = new Date();
  const due = await db
    .select()
    .from(websiteAutomationJobs)
    .where(
      and(
        eq(websiteAutomationJobs.status, "pending"),
        lte(websiteAutomationJobs.runAt, now),
      ),
    )
    .limit(50);

  for (const job of due) {
    const [claimed] = await db
      .update(websiteAutomationJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(websiteAutomationJobs.id, job.id),
          eq(websiteAutomationJobs.status, "pending"),
        ),
      )
      .returning();
    if (!claimed) continue;

    try {
      await resumeAfterDelayJob(claimed);
      await db
        .update(websiteAutomationJobs)
        .set({ status: "done", updatedAt: new Date(), errorMessage: null })
        .where(eq(websiteAutomationJobs.id, claimed.id));
    } catch (err: any) {
      console.error(`[AUTOMATION] Job #${claimed.id} failed:`, err);
      await db
        .update(websiteAutomationJobs)
        .set({
          status: "failed",
          errorMessage: err?.message?.slice(0, 500) || "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(websiteAutomationJobs.id, claimed.id));
    }
  }
}
