import { createHash, randomBytes } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { EmailService } from "../email-service";
import { resolveUnsubscribeBaseUrl } from "../unsubscribe-utils";
import {
  contacts,
  onboardingFormResponses,
  requestDocs,
  requestEvents,
  requestTypes,
  requests,
  websiteProgress,
  type ReceptionFile,
} from "@shared/schema";
import { upsertAutomationContact } from "./automation-contacts";
import { emitEvent } from "./automation-events";
import { cancelRuns } from "./automation-engine-v2";
import { RECEPTION_TYPE_SEEDS } from "./reception-catalog";
import {
  signedReceptionUrl,
  uploadReceptionFile,
  zipReceptionFiles,
} from "./reception-cloudinary";
import {
  RECEPTION_MAGIC_DAYS,
  contactFolder,
  crossSellLabel,
  fileExt,
  filterCrossSell,
  isClosedStatus,
  isStuck,
  mimeAllowed,
  nextChecklistStatus,
  resourceTypeForMime,
  statusLabel,
  statusesForKind,
} from "./reception-logic";
import { loadReceptionAutomationPatch } from "./reception-payload";

type RequestDoc = typeof requestDocs.$inferSelect;

export class ReceptionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function ensureReceptionRequestTypes(): Promise<void> {
  for (const seed of RECEPTION_TYPE_SEEDS) {
    await db
      .insert(requestTypes)
      .values({
        key: seed.key,
        label: seed.label,
        kind: seed.kind,
        fields: seed.fields,
        requiredDocs: seed.requiredDocs,
        allowUploads: seed.allowUploads,
        active: true,
      })
      .onConflictDoUpdate({
        target: requestTypes.key,
        set: {
          label: seed.label,
          kind: seed.kind,
          fields: seed.fields,
          requiredDocs: seed.requiredDocs,
          allowUploads: seed.allowUploads,
          active: true,
        },
      });
  }
}

export async function assertReceptionEnabled(websiteProgressId: number): Promise<void> {
  const [row] = await db
    .select({ receptionEnabled: websiteProgress.receptionEnabled })
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId))
    .limit(1);
  if (!row) throw new ReceptionError(404, "Website not found");
  if (!row.receptionEnabled) throw new ReceptionError(403, "Reception is disabled");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueMagicLink(requestId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RECEPTION_MAGIC_DAYS * 24 * 60 * 60 * 1000);
  await db
    .update(requests)
    .set({
      magicTokenHash: hashToken(token),
      magicTokenExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(requests.id, requestId));
  return `${resolveUnsubscribeBaseUrl()}/reception/${token}`;
}

async function ownerEmailFor(websiteProgressId: number): Promise<string> {
  const [website] = await db
    .select({ contactEmail: websiteProgress.contactEmail })
    .from(websiteProgress)
    .where(eq(websiteProgress.id, websiteProgressId))
    .limit(1);
  if (website?.contactEmail?.trim()) return website.contactEmail.trim();
  const [onboarding] = await db
    .select({ accountEmail: onboardingFormResponses.accountEmail })
    .from(onboardingFormResponses)
    .where(eq(onboardingFormResponses.websiteProgressId, websiteProgressId))
    .orderBy(desc(onboardingFormResponses.createdAt))
    .limit(1);
  return onboarding?.accountEmail?.trim() || "";
}

async function logEvent(
  requestId: number,
  type: string,
  actor: "client" | "agent" | "system",
  payload: Record<string, unknown>,
) {
  await db.insert(requestEvents).values({ requestId, type, actor, payload });
}

async function touch(requestId: number, extra: Partial<typeof requests.$inferInsert> = {}) {
  await db
    .update(requests)
    .set({ ...extra, lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(requests.id, requestId));
}

async function loadBundle(requestId: number, websiteProgressId?: number) {
  const [row] = await db
    .select({
      request: requests,
      type: requestTypes,
      contact: contacts,
      projectName: websiteProgress.projectName,
      domain: websiteProgress.domain,
      siteId: websiteProgress.siteId,
      receptionEnabled: websiteProgress.receptionEnabled,
      websiteLanguage: websiteProgress.websiteLanguage,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.typeId))
    .innerJoin(contacts, eq(contacts.id, requests.contactId))
    .innerJoin(websiteProgress, eq(websiteProgress.id, requests.websiteProgressId))
    .where(eq(requests.id, requestId))
    .limit(1);
  if (!row) throw new ReceptionError(404, "Request not found");
  if (websiteProgressId != null && row.request.websiteProgressId !== websiteProgressId) {
    throw new ReceptionError(404, "Request not found");
  }
  const docs = await db.select().from(requestDocs).where(eq(requestDocs.requestId, requestId));
  return { ...row, docs };
}

async function emitReception(params: {
  requestId: number;
  websiteProgressId: number;
  type: "request.created" | "request.status_changed" | "request.docs_missing";
  cancelKey: string;
  dedupeKey?: string;
  magicLink?: string;
  offsetDays?: number;
}) {
  const live = await loadReceptionAutomationPatch(params.requestId);
  if (!live?.enabled) return;
  const bundle = await loadBundle(params.requestId);
  const ownerEmail = await ownerEmailFor(params.websiteProgressId);
  await emitEvent({
    websiteProgressId: params.websiteProgressId,
    type: params.type,
    dedupeKey: params.dedupeKey,
    cancelKey: params.cancelKey,
    payload: {
      request_id: params.requestId,
      ...live.patch,
      magic_link: params.magicLink || "",
      offsetDays: params.offsetDays,
      visitorEmail: bundle.contact.email,
      visitorName: String(live.patch.client_name || ""),
      visitorPhone: bundle.contact.phone || "",
      siteLabel: bundle.projectName || bundle.domain,
      siteId: bundle.siteId || "",
      ownerEmail,
      fromName: bundle.projectName || bundle.domain,
      language: bundle.websiteLanguage === "en" ? "en" : "gr",
    },
  });
}

async function syncStatus(requestId: number, actor: "client" | "agent" | "system") {
  const bundle = await loadBundle(requestId);
  const next = nextChecklistStatus(bundle.type.kind, bundle.request.status, bundle.docs);
  const missing = bundle.docs.some((d) => d.required && !d.received);
  if (!missing && bundle.docs.some((d) => d.required)) {
    await cancelRuns(`request:${requestId}:docs`);
  }
  if (next === bundle.request.status) return bundle.request.status;
  await touch(requestId, {
    status: next,
    closedAt: isClosedStatus(next) ? new Date() : bundle.request.closedAt,
  });
  await logEvent(requestId, "status_changed", actor, {
    from: bundle.request.status,
    to: next,
    label: statusLabel(next),
  });
  await emitReception({
    requestId,
    websiteProgressId: bundle.request.websiteProgressId,
    type: "request.status_changed",
    cancelKey: `request:${requestId}:status`,
    dedupeKey: `request.status_changed:${requestId}:${next}:${Date.now()}`,
  });
  if (next !== "new") await cancelRuns(`request:${requestId}`);
  return next;
}

function withUrls(docs: RequestDoc[]) {
  return docs.map((doc) => ({
    ...doc,
    files: (doc.files || []).map((file) => {
      let url: string | null = null;
      try {
        url = signedReceptionUrl(file);
      } catch {
        url = null;
      }
      return { ...file, url };
    }),
  }));
}

export async function listReceptionRequests(
  websiteProgressId: number,
  filters: { typeKey?: string; status?: string },
) {
  await assertReceptionEnabled(websiteProgressId);
  const rows = await db
    .select({
      request: requests,
      type: requestTypes,
      contact: contacts,
    })
    .from(requests)
    .innerJoin(requestTypes, eq(requestTypes.id, requests.typeId))
    .innerJoin(contacts, eq(contacts.id, requests.contactId))
    .where(eq(requests.websiteProgressId, websiteProgressId))
    .orderBy(desc(requests.lastActivityAt));

  const ids = rows.map((r) => r.request.id);
  const docs = ids.length
    ? await db.select().from(requestDocs).where(inArray(requestDocs.requestId, ids))
    : [];
  const docsByRequest = new Map<number, RequestDoc[]>();
  for (const doc of docs) {
    const list = docsByRequest.get(doc.requestId) || [];
    list.push(doc);
    docsByRequest.set(doc.requestId, list);
  }

  return rows
    .filter((row) => {
      if (filters.typeKey && row.type.key !== filters.typeKey) return false;
      if (filters.status && row.request.status !== filters.status) return false;
      return true;
    })
    .map((row) => {
      const requestDocsRows = docsByRequest.get(row.request.id) || [];
      const required = requestDocsRows.filter((d) => d.required);
      const name = [row.contact.firstName, row.contact.lastName].filter(Boolean).join(" ").trim();
      return {
        id: row.request.id,
        typeKey: row.type.key,
        typeLabel: row.type.label,
        kind: row.type.kind,
        kindLabel: row.type.kind === "lead" ? "Lead" : "Service",
        status: row.request.status,
        statusLabel: statusLabel(row.request.status),
        crossSell: (row.request.crossSell || []).map((value) => ({
          value,
          label: crossSellLabel(value),
        })),
        contactName: name || row.contact.email,
        contactEmail: row.contact.email,
        contactPhone: row.contact.phone,
        stuck: isStuck(row.request.lastActivityAt, row.request.status),
        missingCount: required.filter((d) => !d.received).length,
        receivedCount: required.filter((d) => d.received).length,
        createdAt: row.request.createdAt,
        lastActivityAt: row.request.lastActivityAt,
      };
    });
}

export async function getReceptionRequest(websiteProgressId: number, requestId: number) {
  await assertReceptionEnabled(websiteProgressId);
  const bundle = await loadBundle(requestId, websiteProgressId);
  const events = await db
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(desc(requestEvents.createdAt));
  const name = [bundle.contact.firstName, bundle.contact.lastName].filter(Boolean).join(" ").trim();
  return {
    id: bundle.request.id,
    typeKey: bundle.type.key,
    typeLabel: bundle.type.label,
    kind: bundle.type.kind,
    kindLabel: bundle.type.kind === "lead" ? "Lead" : "Service",
    allowUploads: bundle.type.allowUploads,
    status: bundle.request.status,
    statusLabel: statusLabel(bundle.request.status),
    statuses: statusesForKind(bundle.type.kind).map((key) => ({
      key,
      label: statusLabel(key),
    })),
    policyRef: bundle.request.policyRef,
    data: bundle.request.data || {},
    fields: bundle.type.fields || [],
    crossSell: (bundle.request.crossSell || []).map((value) => ({
      value,
      label: crossSellLabel(value),
    })),
    contact: {
      name: name || bundle.contact.email,
      email: bundle.contact.email,
      phone: bundle.contact.phone,
    },
    stuck: isStuck(bundle.request.lastActivityAt, bundle.request.status),
    docs: withUrls(bundle.docs),
    events,
    createdAt: bundle.request.createdAt,
    lastActivityAt: bundle.request.lastActivityAt,
  };
}

export async function setReceptionStatus(
  websiteProgressId: number,
  requestId: number,
  status: string,
) {
  await assertReceptionEnabled(websiteProgressId);
  const bundle = await loadBundle(requestId, websiteProgressId);
  if (!statusesForKind(bundle.type.kind).includes(status)) {
    throw new ReceptionError(400, "Invalid status");
  }
  if (bundle.request.status === status) return getReceptionRequest(websiteProgressId, requestId);
  await touch(requestId, {
    status,
    closedAt: isClosedStatus(status) ? new Date() : null,
  });
  await logEvent(requestId, "status_changed", "agent", {
    from: bundle.request.status,
    to: status,
    label: statusLabel(status),
  });
  await emitReception({
    requestId,
    websiteProgressId,
    type: "request.status_changed",
    cancelKey: `request:${requestId}:status`,
    dedupeKey: `request.status_changed:${requestId}:${status}:${Date.now()}`,
  });
  if (status !== "new") await cancelRuns(`request:${requestId}`);
  if (isClosedStatus(status)) await cancelRuns(`request:${requestId}:docs`);
  return getReceptionRequest(websiteProgressId, requestId);
}

export async function setDocReceived(
  websiteProgressId: number,
  requestId: number,
  docId: number,
  received: boolean,
) {
  await assertReceptionEnabled(websiteProgressId);
  await loadBundle(requestId, websiteProgressId);
  const [doc] = await db
    .select()
    .from(requestDocs)
    .where(and(eq(requestDocs.id, docId), eq(requestDocs.requestId, requestId)))
    .limit(1);
  if (!doc) throw new ReceptionError(404, "Document not found");
  await db.update(requestDocs).set({ received }).where(eq(requestDocs.id, docId));
  await logEvent(requestId, "doc_received", "agent", {
    docKey: doc.docKey,
    label: doc.label,
    received,
  });
  await touch(requestId);
  await syncStatus(requestId, "agent");
  return getReceptionRequest(websiteProgressId, requestId);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function askForDocs(
  websiteProgressId: number,
  requestId: number,
  input: { docIds: number[]; labels: string[] },
) {
  await assertReceptionEnabled(websiteProgressId);
  const bundle = await loadBundle(requestId, websiteProgressId);
  const chosen = bundle.docs.filter((d) => input.docIds.includes(d.id));
  const labels = input.labels.map((l) => l.trim()).filter(Boolean).slice(0, 10);
  if (chosen.length === 0 && labels.length === 0) {
    throw new ReceptionError(400, "Διάλεξε τουλάχιστον ένα έγγραφο");
  }
  for (const doc of chosen) {
    await db.update(requestDocs).set({ received: false }).where(eq(requestDocs.id, doc.id));
  }
  for (const label of labels) {
    const key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.insert(requestDocs).values({
      requestId,
      docKey: key,
      label,
      required: true,
      received: false,
      files: [],
      requestedManually: true,
    });
  }
  await touch(requestId, { status: "missing_docs", closedAt: null });
  const asked = [...chosen.map((d) => d.label), ...labels];
  await logEvent(requestId, "doc_requested", "agent", { labels: asked });
  const magicLink = await issueMagicLink(requestId);
  const list = asked.map((label) => `• ${label}`).join("\n");
  const name = [bundle.contact.firstName, bundle.contact.lastName].filter(Boolean).join(" ").trim();
  const body = `Γεια σας ${name},\n\nΓια το αίτημα «${bundle.type.label}» χρειαζόμαστε:\n\n${list}\n\n${magicLink}`;
  const replyTo = await ownerEmailFor(websiteProgressId);
  await EmailService.sendEmail({
    to: bundle.contact.email,
    subject: "Χρειαζόμαστε έγγραφα για το αίτημά σας",
    message: body,
    fromEmail: "notifications@hayc.gr",
    fromName: bundle.projectName || bundle.domain,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</div>`,
    replyToAddresses: replyTo ? [replyTo] : undefined,
  });
  if (bundle.request.status !== "missing_docs") {
    await emitReception({
      requestId,
      websiteProgressId,
      type: "request.status_changed",
      cancelKey: `request:${requestId}:status`,
      dedupeKey: `request.status_changed:${requestId}:missing_docs:${Date.now()}`,
    });
  }
  await cancelRuns(`request:${requestId}`);
  return getReceptionRequest(websiteProgressId, requestId);
}

export type IncomingReceptionFile = {
  fieldname: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

async function storeFiles(
  requestId: number,
  folder: string,
  allowUploads: boolean,
  docs: RequestDoc[],
  files: IncomingReceptionFile[],
) {
  if (!files.length) return docs;
  if (!allowUploads) throw new ReceptionError(400, "Αυτό το αίτημα δεν δέχεται αρχεία");
  let current = docs;
  for (const file of files) {
    if (!mimeAllowed(file.mimetype)) throw new ReceptionError(400, "Μη αποδεκτός τύπος αρχείου");
    const doc = current.find((d) => d.docKey === file.fieldname);
    if (!doc) throw new ReceptionError(400, "Άγνωστο έγγραφο");
    const existing = doc.files || [];
    const n = existing.length + 1;
    const ext = fileExt(file.originalname, file.mimetype);
    const uploaded = await uploadReceptionFile({
      buffer: file.buffer,
      folder,
      publicId: `${doc.docKey}_${n}`,
      resourceType: resourceTypeForMime(file.mimetype),
    });
    const nextFile: ReceptionFile = {
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      mime: file.mimetype,
      size: file.size,
      ext,
    };
    const filesNext = [...existing, nextFile];
    await db
      .update(requestDocs)
      .set({ files: filesNext, received: true, uploadedAt: new Date() })
      .where(eq(requestDocs.id, doc.id));
    await logEvent(requestId, "file_uploaded", "client", { docKey: doc.docKey, label: doc.label });
    current = current.map((d) => (d.id === doc.id ? { ...d, files: filesNext, received: true } : d));
  }
  return current;
}

export async function createReceptionRequest(input: {
  siteId: string;
  typeKey: string;
  name: string;
  email: string;
  phone?: string;
  policyRef?: string;
  crossSell?: unknown;
  checklist?: Record<string, boolean>;
  answers?: Record<string, string>;
  files?: IncomingReceptionFile[];
}) {
  const siteId = input.siteId.trim();
  const [website] = await db
    .select()
    .from(websiteProgress)
    .where(eq(websiteProgress.siteId, siteId))
    .limit(1);
  if (!website) throw new ReceptionError(404, "Site not found");
  if (!website.receptionEnabled) throw new ReceptionError(403, "Reception is disabled");

  const [type] = await db
    .select()
    .from(requestTypes)
    .where(and(eq(requestTypes.key, input.typeKey.trim()), eq(requestTypes.active, true)))
    .limit(1);
  if (!type) throw new ReceptionError(400, "Unknown request type");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 120) throw new ReceptionError(400, "Name is required");
  if (!email.includes("@") || email.length > 200) throw new ReceptionError(400, "Email is required");
  const files = input.files || [];
  if (files.length && !type.allowUploads) {
    throw new ReceptionError(400, "Αυτό το αίτημα δεν δέχεται αρχεία");
  }

  const upserted = await upsertAutomationContact({
    websiteProgressId: website.id,
    email,
    name,
    phone: input.phone,
    source: "reception",
  });
  if (!upserted) throw new ReceptionError(400, "Email is required");

  let folder = upserted.contact.cloudinaryFolder;
  if (!folder) {
    folder = contactFolder(website.siteId || siteId, name, upserted.contact.id);
    await db
      .update(contacts)
      .set({ cloudinaryFolder: folder, updatedAt: new Date() })
      .where(eq(contacts.id, upserted.contact.id));
  }

  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.answers || {})) {
    if (!key || key.length > 80) continue;
    answers[key] = String(value ?? "").slice(0, 4000);
  }
  const policyRef = (input.policyRef || answers.policy_ref || "").trim().slice(0, 120) || null;

  const [request] = await db
    .insert(requests)
    .values({
      websiteProgressId: website.id,
      contactId: upserted.contact.id,
      typeId: type.id,
      status: "new",
      data: answers,
      crossSell: filterCrossSell(input.crossSell),
      policyRef,
      lastActivityAt: new Date(),
    })
    .returning();

  try {
    const checklist = input.checklist || {};
    for (const doc of type.requiredDocs || []) {
      const ticked = checklist[doc.key] === true;
      await db.insert(requestDocs).values({
        requestId: request.id,
        docKey: doc.key,
        label: doc.label,
        required: doc.required,
        received: !type.allowUploads && ticked,
        files: [],
      });
    }
    const docs = await db.select().from(requestDocs).where(eq(requestDocs.requestId, request.id));
    await storeFiles(request.id, folder, type.allowUploads, docs, files);
    const magicLink = await issueMagicLink(request.id);
    await logEvent(request.id, "created", "client", { typeKey: type.key });
    await syncStatus(request.id, "system");
    await emitReception({
      requestId: request.id,
      websiteProgressId: website.id,
      type: "request.created",
      cancelKey: `request:${request.id}`,
      dedupeKey: `request.created:${request.id}`,
      magicLink,
    });
    return { id: request.id };
  } catch (err) {
    await db.delete(requests).where(eq(requests.id, request.id));
    throw err;
  }
}

async function requestByToken(token: string) {
  const [row] = await db
    .select()
    .from(requests)
    .where(eq(requests.magicTokenHash, hashToken(token)))
    .limit(1);
  if (!row) throw new ReceptionError(404, "Ο σύνδεσμος δεν ισχύει");
  if (!row.magicTokenExpiresAt || row.magicTokenExpiresAt.getTime() < Date.now()) {
    throw new ReceptionError(410, "Ο σύνδεσμος έληξε");
  }
  const bundle = await loadBundle(row.id);
  if (!bundle.receptionEnabled) throw new ReceptionError(403, "Reception is disabled");
  return bundle;
}

export async function publicReceptionView(token: string) {
  const request = await requestByToken(token);
  const missing = request.docs.filter((d) => d.required && !d.received);
  return {
    typeLabel: request.type.label,
    allowUploads: request.type.allowUploads,
    missing: missing.map((d) => ({ id: d.id, key: d.docKey, label: d.label })),
  };
}

export async function uploadFromMagicLink(token: string, files: IncomingReceptionFile[]) {
  const bundle = await requestByToken(token);
  if (!bundle.type.allowUploads) throw new ReceptionError(400, "Αυτό το αίτημα δεν δέχεται αρχεία");
  if (!files.length) throw new ReceptionError(400, "Δεν επιλέχθηκε αρχείο");
  const missingKeys = new Set(bundle.docs.filter((d) => !d.received).map((d) => d.docKey));
  for (const file of files) {
    if (!missingKeys.has(file.fieldname)) throw new ReceptionError(400, "Αυτό το έγγραφο δεν λείπει");
  }
  if (!bundle.contact.cloudinaryFolder) throw new ReceptionError(500, "Contact folder is missing");
  await storeFiles(bundle.request.id, bundle.contact.cloudinaryFolder, true, bundle.docs, files);
  await touch(bundle.request.id);
  await syncStatus(bundle.request.id, "client");
  return publicReceptionView(token);
}

export async function downloadReceptionZip(websiteProgressId: number, requestId: number) {
  await assertReceptionEnabled(websiteProgressId);
  const bundle = await loadBundle(requestId, websiteProgressId);
  if (!bundle.type.allowUploads) throw new ReceptionError(400, "Δεν υπάρχουν αρχεία για αυτό το αίτημα");
  const items: { docKey: string; ext: string; file: ReceptionFile }[] = [];
  for (const doc of bundle.docs) {
    for (const file of doc.files || []) {
      items.push({ docKey: doc.docKey, ext: file.ext || "bin", file });
    }
  }
  if (!items.length) throw new ReceptionError(400, "Δεν υπάρχουν αρχεία");
  const zip = await zipReceptionFiles(items);
  await logEvent(requestId, "zip_downloaded", "agent", { count: items.length });
  await touch(requestId);
  return zip;
}

export async function emitDocsMissing(params: {
  requestId: number;
  websiteProgressId: number;
  offsetDays: number;
  dedupeKey: string;
}) {
  const magicLink = await issueMagicLink(params.requestId);
  await emitReception({
    requestId: params.requestId,
    websiteProgressId: params.websiteProgressId,
    type: "request.docs_missing",
    cancelKey: `request:${params.requestId}:docs`,
    dedupeKey: params.dedupeKey,
    magicLink,
    offsetDays: params.offsetDays,
  });
}
