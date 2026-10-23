/**
 * DB smoke tests for Automations v2.
 * Run: doppler run -- npx vitest run server/lib/automation-v2.integration.test.ts
 *
 * Skips automatically when DATABASE_URL is missing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

vi.mock("../email-service", () => ({
  EmailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test" }),
  },
}));

vi.mock("../s3-config", () => ({
  getConfig: vi.fn().mockResolvedValue({}),
}));

describe.runIf(hasDb)("Automations v2 DB smoke", () => {
  let db: typeof import("../db").db;
  let emitEvent: typeof import("./automation-events").emitEvent;
  let cancelRuns: typeof import("./automation-engine-v2").cancelRuns;
  let processDueAutomationSteps: typeof import("./automation-engine-v2").processDueAutomationSteps;
  let schema: typeof import("@shared/schema");
  let eq: typeof import("drizzle-orm").eq;
  let and: typeof import("drizzle-orm").and;

  let websiteId: number;
  let workflowId: number;
  let createdEventIds: number[] = [];
  let createdRunIds: number[] = [];

  beforeAll(async () => {
    ({ db } = await import("../db"));
    ({ emitEvent } = await import("./automation-events"));
    ({ cancelRuns, processDueAutomationSteps } = await import(
      "./automation-engine-v2"
    ));
    schema = await import("@shared/schema");
    ({ eq, and } = await import("drizzle-orm"));

    const [website] = await db
      .select({ id: schema.websiteProgress.id })
      .from(schema.websiteProgress)
      .limit(1);
    if (!website) {
      throw new Error("No website_progress row — cannot run smoke test");
    }
    websiteId = website.id;

    await db
      .update(schema.websiteProgress)
      .set({ automationsEngine: "v2" })
      .where(eq(schema.websiteProgress.id, websiteId));

    const formId = `smoke-form-${Date.now()}`;
    const [wf] = await db
      .insert(schema.websiteAutomationWorkflows)
      .values({
        websiteProgressId: websiteId,
        name: "Smoke test workflow",
        enabled: true,
        triggerFormId: formId,
        triggerType: "form.submitted",
        triggerConfig: { formId },
        graph: {
          nodes: [
            {
              id: "t1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: { formId },
            },
            {
              id: "e1",
              type: "email",
              position: { x: 200, y: 0 },
              data: {
                subject: "Smoke {{name}}",
                body: "Hello {{name}}",
              },
            },
          ],
          edges: [{ id: "e", source: "t1", target: "e1" }],
        },
      })
      .returning();
    workflowId = wf.id;

    // stash formId on workflow for emit payload
    (globalThis as any).__smokeFormId = formId;
  });

  afterAll(async () => {
    if (!websiteId || !workflowId) return;
    try {
      const runs = await db
        .select({ id: schema.websiteAutomationRuns.id })
        .from(schema.websiteAutomationRuns)
        .where(eq(schema.websiteAutomationRuns.workflowId, workflowId));
      const runIds = runs.map((r) => r.id);
      if (runIds.length) {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.websiteAutomationSteps)
          .where(inArray(schema.websiteAutomationSteps.runId, runIds));
        await db
          .delete(schema.websiteAutomationRuns)
          .where(eq(schema.websiteAutomationRuns.workflowId, workflowId));
      }
      await db
        .delete(schema.websiteAutomationWorkflows)
        .where(eq(schema.websiteAutomationWorkflows.id, workflowId));
      if (createdEventIds.length) {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.automationEvents)
          .where(inArray(schema.automationEvents.id, createdEventIds));
      }
      await db
        .update(schema.websiteProgress)
        .set({ automationsEngine: "legacy" })
        .where(eq(schema.websiteProgress.id, websiteId));
    } catch (err) {
      console.warn("smoke cleanup warning:", err);
    }
  });

  it("dedupes the same dedupe_key (one event, one run batch)", async () => {
    const formId = (globalThis as any).__smokeFormId as string;
    const dedupeKey = `smoke-dedupe-${Date.now()}`;

    const first = await emitEvent({
      websiteProgressId: websiteId,
      type: "form.submitted",
      dedupeKey,
      payload: {
        form_id: formId,
        visitorEmail: "smoke@example.com",
        visitorName: "Smoke",
        visitorPhone: "",
        visitorMessage: "hi",
        siteLabel: "Smoke Site",
        siteId: "",
        ownerEmail: "owner@example.com",
        fromName: "Smoke",
        language: "en",
      },
    });
    createdEventIds.push(first.eventId);
    createdRunIds.push(...first.runIds);

    expect(first.deduped).toBe(false);
    expect(first.runIds.length).toBe(1);

    const second = await emitEvent({
      websiteProgressId: websiteId,
      type: "form.submitted",
      dedupeKey,
      payload: {
        form_id: formId,
        visitorEmail: "smoke@example.com",
        visitorName: "Smoke",
        visitorPhone: "",
        visitorMessage: "hi",
        siteLabel: "Smoke Site",
        siteId: "",
        ownerEmail: "owner@example.com",
        fromName: "Smoke",
        language: "en",
      },
    });

    expect(second.deduped).toBe(true);
    expect(second.eventId).toBe(first.eventId);
    expect(second.runIds).toEqual([]);

    const steps = await db
      .select()
      .from(schema.websiteAutomationSteps)
      .where(eq(schema.websiteAutomationSteps.runId, first.runIds[0]));
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps.every((s) => s.status === "done" || s.status === "pending")).toBe(
      true,
    );
  });

  it("schedules a delayed child and cancels pending steps via cancel_key", async () => {
    const formId = `smoke-delay-${Date.now()}`;
    const [wf] = await db
      .insert(schema.websiteAutomationWorkflows)
      .values({
        websiteProgressId: websiteId,
        name: "Smoke delay workflow",
        enabled: true,
        triggerFormId: formId,
        triggerType: "form.submitted",
        triggerConfig: { formId },
        graph: {
          nodes: [
            {
              id: "t1",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: { formId },
            },
            {
              id: "d1",
              type: "delay",
              position: { x: 150, y: 0 },
              data: { amount: 3, unit: "days" },
            },
            {
              id: "e1",
              type: "email",
              position: { x: 300, y: 0 },
              data: { subject: "Later", body: "Later" },
            },
          ],
          edges: [
            { id: "e1", source: "t1", target: "d1" },
            { id: "e2", source: "d1", target: "e1" },
          ],
        },
      })
      .returning();

    const cancelKey = `cancel-${Date.now()}`;
    const result = await emitEvent({
      websiteProgressId: websiteId,
      type: "form.submitted",
      dedupeKey: `delay-${Date.now()}`,
      cancelKey,
      payload: {
        form_id: formId,
        visitorEmail: "delay@example.com",
        visitorName: "Delay",
        visitorPhone: "",
        visitorMessage: "",
        siteLabel: "Smoke",
        siteId: "",
        ownerEmail: "owner@example.com",
        fromName: "Smoke",
        language: "en",
      },
    });
    createdEventIds.push(result.eventId);

    expect(result.runIds.length).toBe(1);
    const runId = result.runIds[0];

    const pending = await db
      .select()
      .from(schema.websiteAutomationSteps)
      .where(
        and(
          eq(schema.websiteAutomationSteps.runId, runId),
          eq(schema.websiteAutomationSteps.status, "pending"),
        ),
      );
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((s) => s.runAt.getTime() > Date.now() + 86_400_000)).toBe(
      true,
    );

    const cancelled = await cancelRuns(cancelKey);
    expect(cancelled).toBeGreaterThanOrEqual(1);

    const [run] = await db
      .select()
      .from(schema.websiteAutomationRuns)
      .where(eq(schema.websiteAutomationRuns.id, runId))
      .limit(1);
    expect(run?.status).toBe("cancelled");

    // cleanup this workflow
    await db
      .delete(schema.websiteAutomationSteps)
      .where(eq(schema.websiteAutomationSteps.runId, runId));
    await db
      .delete(schema.websiteAutomationRuns)
      .where(eq(schema.websiteAutomationRuns.id, runId));
    await db
      .delete(schema.websiteAutomationWorkflows)
      .where(eq(schema.websiteAutomationWorkflows.id, wf.id));

    // keep worker callable
    await processDueAutomationSteps({ limit: 5 });
  });
});

describe.runIf(!hasDb)("Automations v2 DB smoke (skipped)", () => {
  it("skips when DATABASE_URL is not set", () => {
    expect(hasDb).toBe(false);
  });
});
