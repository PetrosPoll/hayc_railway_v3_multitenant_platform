import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  automationEvents,
  websiteProgress,
  type AutomationJobPayload,
} from "@shared/schema";
import {
  startRunsForEvent,
  type EmitEventResult,
} from "./automation-engine-v2";
import { startWorkflowForFormSubmit } from "./automation-engine";

export type EmitEventInput = {
  websiteProgressId: number;
  type: string;
  payload: Record<string, unknown>;
  dedupeKey?: string | null;
  cancelKey?: string | null;
};

/**
 * Persist an automation event (deduped) and start matching v2 workflows.
 * When the website is still on `legacy`, form.submitted is not handled here —
 * callers should use the legacy path instead.
 */
export async function emitEvent(
  input: EmitEventInput,
): Promise<EmitEventResult> {
  const dedupeKey =
    typeof input.dedupeKey === "string" && input.dedupeKey.trim()
      ? input.dedupeKey.trim()
      : null;

  if (dedupeKey) {
    const existing = await db
      .select()
      .from(automationEvents)
      .where(
        and(
          eq(automationEvents.websiteProgressId, input.websiteProgressId),
          eq(automationEvents.dedupeKey, dedupeKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return {
        eventId: existing[0].id,
        deduped: true,
        runIds: [],
      };
    }
  }

  let eventRow: typeof automationEvents.$inferSelect;
  try {
    const [inserted] = await db
      .insert(automationEvents)
      .values({
        websiteProgressId: input.websiteProgressId,
        type: input.type,
        payload: input.payload,
        dedupeKey,
      })
      .returning();
    eventRow = inserted;
  } catch (err: any) {
    // Race on unique dedupe index
    if (dedupeKey && (err?.code === "23505" || /unique/i.test(String(err?.message)))) {
      const [existing] = await db
        .select()
        .from(automationEvents)
        .where(
          and(
            eq(automationEvents.websiteProgressId, input.websiteProgressId),
            eq(automationEvents.dedupeKey, dedupeKey),
          ),
        )
        .limit(1);
      if (existing) {
        return { eventId: existing.id, deduped: true, runIds: [] };
      }
    }
    throw err;
  }

  const runIds = await startRunsForEvent({
    event: eventRow,
    cancelKey: input.cancelKey ?? null,
  });

  return { eventId: eventRow.id, deduped: false, runIds };
}

export async function getAutomationsEngineMode(
  websiteProgressId: number,
): Promise<"legacy" | "v2"> {
  const [row] = await db
    .select({ automationsEngine: websiteProgress.automationsEngine })
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId))
    .limit(1);
  return row?.automationsEngine === "v2" ? "v2" : "legacy";
}

/**
 * Form-submit entry used by contact/newsletter routes.
 * Routes visitor email through v2 or legacy based on the website flag.
 * Returns true if a workflow (v2 or legacy) handled the visitor path.
 */
export async function handleFormSubmittedAutomation(params: {
  websiteProgressId: number;
  formId: string;
  payload: AutomationJobPayload;
  dedupeKey?: string | null;
  cancelKey?: string | null;
  extraPayload?: Record<string, unknown>;
}): Promise<boolean> {
  const mode = await getAutomationsEngineMode(params.websiteProgressId);

  if (mode === "v2") {
    const result = await emitEvent({
      websiteProgressId: params.websiteProgressId,
      type: "form.submitted",
      dedupeKey: params.dedupeKey,
      cancelKey: params.cancelKey,
      payload: {
        form_id: params.formId,
        visitorEmail: params.payload.visitorEmail,
        visitorName: params.payload.visitorName,
        visitorPhone: params.payload.visitorPhone,
        visitorMessage: params.payload.visitorMessage,
        siteLabel: params.payload.siteLabel,
        siteId: params.payload.siteId,
        ownerEmail: params.payload.ownerEmail,
        fromName: params.payload.fromName,
        language: params.payload.language,
        ...(params.extraPayload || {}),
      },
    });
    if (result.deduped) return true;
    return result.runIds.length > 0;
  }

  return startWorkflowForFormSubmit({
    websiteProgressId: params.websiteProgressId,
    formId: params.formId,
    payload: params.payload,
  });
}

/** Build a stable-ish dedupe key for double-click protection (1-minute bucket). */
export function formSubmitDedupeKey(params: {
  websiteProgressId: number;
  formId: string;
  email: string;
  message?: string;
}): string {
  const bucket = Math.floor(Date.now() / 60_000);
  const msg = (params.message || "").slice(0, 80);
  return `form:${params.websiteProgressId}:${params.formId}:${params.email.toLowerCase()}:${bucket}:${msg}`;
}
