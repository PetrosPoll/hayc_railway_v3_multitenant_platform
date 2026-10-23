import { eq } from "drizzle-orm";
import { db } from "../db";
import { contacts, requestDocs, requestTypes, requests, websiteProgress } from "@shared/schema";
import { missingDocsList, statusLabel } from "./reception-logic";

/**
 * Live request fields for automation conditions and emails.
 * `fields.status` / `fields.request_type` stay as keys.
 * Top-level `status` and `request_type` are the Greek labels used in emails.
 */
export async function loadReceptionAutomationPatch(requestId: number): Promise<{
  enabled: boolean;
  requestId: number;
  patch: Record<string, unknown>;
} | null> {
  const [row] = await db
    .select({
      request: requests,
      typeKey: requestTypes.key,
      typeLabel: requestTypes.label,
      kind: requestTypes.kind,
      receptionEnabled: websiteProgress.receptionEnabled,
      projectName: websiteProgress.projectName,
      domain: websiteProgress.domain,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.typeId))
    .innerJoin(websiteProgress, eq(websiteProgress.id, requests.websiteProgressId))
    .innerJoin(contacts, eq(contacts.id, requests.contactId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return null;

  const docs = await db
    .select()
    .from(requestDocs)
    .where(eq(requestDocs.requestId, requestId));

  const missing = missingDocsList(docs);
  const clientName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email;
  const agentName = (row.projectName || row.domain || "").trim();

  return {
    enabled: row.receptionEnabled,
    requestId,
    patch: {
      client_name: clientName,
      agent_name: agentName,
      request_type: row.typeLabel,
      missing_docs_list: missing,
      status: statusLabel(row.request.status),
      visitorName: clientName,
      visitorEmail: row.email,
      visitorPhone: row.phone || "",
      fields: {
        request_type: row.typeKey,
        status: row.request.status,
        missing_docs: missing,
        kind: row.kind,
      },
    },
  };
}
