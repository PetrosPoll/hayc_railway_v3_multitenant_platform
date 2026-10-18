import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  websiteAutomationWorkflows,
  websiteFormAutomations,
} from "@shared/schema";

/**
 * For every enabled legacy confirmation email that has no workflow for the
 * same form, create an editable workflow: trigger → email (same subject/body).
 * Returns number of workflows created.
 */
export async function migrateLegacyFormAutomationsToWorkflows(
  websiteProgressId?: number,
): Promise<{ created: number; skipped: number }> {
  const legacyRows = websiteProgressId
    ? await db
        .select()
        .from(websiteFormAutomations)
        .where(
          and(
            eq(websiteFormAutomations.websiteProgressId, websiteProgressId),
            eq(websiteFormAutomations.enabled, true),
          ),
        )
    : await db
        .select()
        .from(websiteFormAutomations)
        .where(eq(websiteFormAutomations.enabled, true));

  let created = 0;
  let skipped = 0;

  for (const legacy of legacyRows) {
    const [existing] = await db
      .select({ id: websiteAutomationWorkflows.id })
      .from(websiteAutomationWorkflows)
      .where(
        and(
          eq(
            websiteAutomationWorkflows.websiteProgressId,
            legacy.websiteProgressId,
          ),
          eq(websiteAutomationWorkflows.triggerFormId, legacy.formId),
        ),
      )
      .limit(1);

    if (existing) {
      skipped += 1;
      continue;
    }

    const triggerId = "trigger-1";
    const emailId = "email-1";
    const graph = {
      nodes: [
        {
          id: triggerId,
          type: "trigger" as const,
          position: { x: 80, y: 120 },
          data: { formId: legacy.formId, label: "Form" },
        },
        {
          id: emailId,
          type: "email" as const,
          position: { x: 360, y: 120 },
          data: {
            subject: legacy.visitorSubject,
            body: legacy.visitorBody,
            logoUrl: legacy.logoUrl || undefined,
            label: "Αποστολή email",
          },
        },
      ],
      edges: [
        {
          id: "e-trigger-email",
          source: triggerId,
          target: emailId,
        },
      ],
    };

    await db.insert(websiteAutomationWorkflows).values({
      websiteProgressId: legacy.websiteProgressId,
      name: `Αυτόματη απάντηση — ${legacy.formId}`,
      enabled: true,
      triggerFormId: legacy.formId,
      triggerType: "form.submitted",
      triggerConfig: { formId: legacy.formId, migratedFromLegacy: true },
      graph,
      frequency: "every_time",
      isSystem: false,
      presetKey: "legacy_confirmation",
      version: 1,
    });
    created += 1;
  }

  return { created, skipped };
}
