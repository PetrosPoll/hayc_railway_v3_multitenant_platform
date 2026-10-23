import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  automationEvents,
  requestDocs,
  requests,
  websiteAutomationWorkflows,
  websiteProgress,
} from "@shared/schema";
import { emitDocsMissing } from "./reception";
import { isClosedStatus } from "./reception-logic";

function athensYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Daily job: required docs still missing N days after the request was created. */
export async function processReceptionDocsMissing(): Promise<number> {
  const sites = await db
    .select({ id: websiteProgress.id })
    .from(websiteProgress)
    .where(
      and(
        eq(websiteProgress.receptionEnabled, true),
        eq(websiteProgress.automationsEngine, "v2"),
      ),
    );

  const today = athensYmd(new Date());
  let emitted = 0;

  for (const site of sites) {
    const workflows = await db
      .select()
      .from(websiteAutomationWorkflows)
      .where(
        and(
          eq(websiteAutomationWorkflows.websiteProgressId, site.id),
          eq(websiteAutomationWorkflows.enabled, true),
          eq(websiteAutomationWorkflows.triggerType, "request.docs_missing"),
        ),
      );
    const offsetValues = workflows
      .map((workflow) => Number((workflow.triggerConfig as { offsetDays?: number } | null)?.offsetDays ?? NaN))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const offsets = Array.from(new Set(offsetValues));
    if (!offsets.length) continue;

    const open = (
      await db.select().from(requests).where(eq(requests.websiteProgressId, site.id))
    ).filter((request) => !isClosedStatus(request.status));
    if (!open.length) continue;

    const docs = await db
      .select()
      .from(requestDocs)
      .where(inArray(requestDocs.requestId, open.map((request) => request.id)));

    for (const request of open) {
      const required = docs.filter((doc) => doc.requestId === request.id && doc.required);
      if (!required.length || !required.some((doc) => !doc.received)) continue;
      const created = athensYmd(new Date(request.createdAt));
      for (const offsetDays of offsets) {
        if (addCalendarDays(created, offsetDays) !== today) continue;
        const dedupeKey = `request.docs_missing:${request.id}:${offsetDays}:${today}`;
        const [existing] = await db
          .select({ id: automationEvents.id })
          .from(automationEvents)
          .where(
            and(
              eq(automationEvents.websiteProgressId, site.id),
              eq(automationEvents.dedupeKey, dedupeKey),
            ),
          )
          .limit(1);
        if (existing) continue;
        await emitDocsMissing({
          requestId: request.id,
          websiteProgressId: site.id,
          offsetDays,
          dedupeKey,
        });
        emitted += 1;
      }
    }
  }

  return emitted;
}
