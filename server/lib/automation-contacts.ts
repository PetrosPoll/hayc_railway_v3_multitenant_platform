import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  contactTags,
  contacts,
  tags,
  websiteAutomationRuns,
  type AutomationFrequency,
  type Contact,
} from "@shared/schema";

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Upsert a contact for automations (unique email per website).
 * Does not overwrite newsletter subscription status on existing rows.
 */
export async function upsertAutomationContact(params: {
  websiteProgressId: number;
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  dates?: Record<string, string>;
  consentMarketing?: boolean;
  lastBookingAt?: Date | null;
}): Promise<{ contact: Contact; created: boolean } | null> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const { firstName, lastName } = splitName(params.name || "");
  const phone = params.phone?.trim() || null;
  const source = params.source?.trim() || null;
  const dates = params.dates && Object.keys(params.dates).length ? params.dates : undefined;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.websiteProgressId, params.websiteProgressId),
        eq(contacts.email, email),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(contacts)
      .set({
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        phone: phone ?? existing.phone,
        source: source ?? existing.source,
        dates: dates ?? existing.dates ?? {},
        consentMarketing:
          params.consentMarketing === true
            ? true
            : existing.consentMarketing,
        lastBookingAt:
          params.lastBookingAt !== undefined
            ? params.lastBookingAt
            : existing.lastBookingAt,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, existing.id))
      .returning();
    return { contact: updated, created: false };
  }

  const [created] = await db
    .insert(contacts)
    .values({
      websiteProgressId: params.websiteProgressId,
      email,
      firstName,
      lastName,
      phone,
      source,
      dates: dates ?? {},
      consentMarketing: params.consentMarketing === true,
      status: "lead",
      subscribedAt: null,
      lastBookingAt: params.lastBookingAt ?? null,
    })
    .returning();
  return { contact: created, created: true };
}

export async function getContactTagNames(contactId: number): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(contactTags)
    .innerJoin(tags, eq(tags.id, contactTags.tagId))
    .where(eq(contactTags.contactId, contactId));
  return rows.map((r) => r.name);
}

async function findOrCreateTag(
  websiteProgressId: number,
  tagName: string,
): Promise<number | null> {
  const name = tagName.trim();
  if (!name) return null;
  const [existing] = await db
    .select()
    .from(tags)
    .where(
      and(eq(tags.websiteProgressId, websiteProgressId), eq(tags.name, name)),
    )
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(tags)
    .values({ websiteProgressId, name })
    .returning();
  return created.id;
}

export async function addTagToContact(params: {
  websiteProgressId: number;
  contactId: number;
  tagName: string;
}): Promise<void> {
  const tagId = await findOrCreateTag(params.websiteProgressId, params.tagName);
  if (!tagId) return;
  await db
    .insert(contactTags)
    .values({ contactId: params.contactId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromContact(params: {
  websiteProgressId: number;
  contactId: number;
  tagName: string;
}): Promise<void> {
  const name = params.tagName.trim();
  if (!name) return;
  const [tag] = await db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.websiteProgressId, params.websiteProgressId),
        eq(tags.name, name),
      ),
    )
    .limit(1);
  if (!tag) return;
  await db
    .delete(contactTags)
    .where(
      and(
        eq(contactTags.contactId, params.contactId),
        eq(contactTags.tagId, tag.id),
      ),
    );
}

/**
 * Returns true when frequency rules say this workflow should NOT start a new run.
 */
export async function shouldSkipRunForFrequency(params: {
  workflowId: number;
  frequency: string | null | undefined;
  contactId: number | null;
}): Promise<boolean> {
  const frequency = (params.frequency || "every_time") as AutomationFrequency;
  if (frequency === "every_time" || !params.contactId) return false;

  if (frequency === "once_per_contact") {
    const [row] = await db
      .select({ id: websiteAutomationRuns.id })
      .from(websiteAutomationRuns)
      .where(
        and(
          eq(websiteAutomationRuns.workflowId, params.workflowId),
          eq(websiteAutomationRuns.contactId, params.contactId),
          inArray(websiteAutomationRuns.status, [
            "running",
            "completed",
            "failed",
          ]),
        ),
      )
      .limit(1);
    return !!row;
  }

  if (
    frequency === "once_per_contact_per_24h" ||
    frequency === "once_per_contact_per_90d"
  ) {
    const hours = frequency === "once_per_contact_per_90d" ? 90 * 24 : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [row] = await db
      .select({ id: websiteAutomationRuns.id })
      .from(websiteAutomationRuns)
      .where(
        and(
          eq(websiteAutomationRuns.workflowId, params.workflowId),
          eq(websiteAutomationRuns.contactId, params.contactId),
          gte(websiteAutomationRuns.startedAt, since),
          inArray(websiteAutomationRuns.status, [
            "running",
            "completed",
            "failed",
          ]),
        ),
      )
      .limit(1);
    return !!row;
  }

  return false;
}
