import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  contacts,
  websiteAutomationWorkflows,
  websiteProgress,
} from "@shared/schema";
import { emitEvent } from "./automation-events";

/**
 * Daily 09:00 Europe/Athens job: emit schedule.date_offset for contacts
 * whose configured date + offset matches today (optionally yearly).
 */
export async function processScheduleDateOffsetTriggers(): Promise<number> {
  const sites = await db
    .select({
      id: websiteProgress.id,
      engine: websiteProgress.automationsEngine,
    })
    .from(websiteProgress)
    .where(eq(websiteProgress.automationsEngine, "v2"));

  let emitted = 0;
  const athensToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

  for (const site of sites) {
    const workflows = await db
      .select()
      .from(websiteAutomationWorkflows)
      .where(
        and(
          eq(websiteAutomationWorkflows.websiteProgressId, site.id),
          eq(websiteAutomationWorkflows.enabled, true),
          eq(websiteAutomationWorkflows.triggerType, "schedule.date_offset"),
        ),
      );

    if (!workflows.length) continue;

    const contactRows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.websiteProgressId, site.id));

    for (const workflow of workflows) {
      const cfg = (workflow.triggerConfig || {}) as Record<string, unknown>;
      const dateSource = String(cfg.dateSource || "last_booking");
      const offsetDays = Number(cfg.offsetDays ?? 0);
      const yearly = cfg.yearly === true;

      for (const contact of contactRows) {
        let base: Date | null = null;
        if (dateSource === "subscribed_at" && contact.subscribedAt) {
          base = new Date(contact.subscribedAt);
        } else if (dateSource === "last_booking" && contact.lastBookingAt) {
          base = new Date(contact.lastBookingAt);
        } else if (dateSource.startsWith("dates.")) {
          const key = dateSource.slice("dates.".length);
          const raw = (contact.dates as Record<string, string> | null)?.[key];
          if (raw) base = new Date(raw);
        }
        if (!base || Number.isNaN(base.getTime())) continue;

        const target = new Date(base);
        target.setUTCDate(target.getUTCDate() + (Number.isFinite(offsetDays) ? offsetDays : 0));

        const targetKey = yearly
          ? `${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`
          : target.toISOString().slice(0, 10);
        const todayKey = yearly ? athensToday.slice(5) : athensToday;
        if (targetKey !== todayKey) continue;

        const email = contact.email.toLowerCase();
        const result = await emitEvent({
          websiteProgressId: site.id,
          type: "schedule.date_offset",
          dedupeKey: `schedule:${site.id}:${workflow.id}:${email}:${athensToday}`,
          payload: {
            visitorEmail: contact.email,
            visitorName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
            visitorPhone: contact.phone || "",
            dateSource,
            offsetDays,
            yearly,
            contactId: contact.id,
          },
        });
        if (!result.deduped) emitted += result.runIds.length;
      }
    }
  }

  return emitted;
}
