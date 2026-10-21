/** Days with no activity before a request shows the stuck badge. */
export const RECEPTION_STUCK_DAYS = 7;

export const RECEPTION_MAGIC_DAYS = 30;

export const SERVICE_STATUSES = ["new", "missing_docs", "complete", "sent", "closed"] as const;
export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

export const STATUS_LABELS: Record<string, string> = {
  new: "Νέο",
  missing_docs: "Λείπουν έγγραφα",
  complete: "Πλήρες",
  sent: "Στάλθηκε στην εταιρεία",
  closed: "Κλειστό",
  contacted: "Επικοινωνία",
  quoted: "Προσφορά",
  won: "Έγινε πελάτης",
  lost: "Χάθηκε",
};

export const CROSS_SELL_OPTIONS = [
  { value: "health", label: "Υγεία" },
  { value: "life", label: "Ζωή" },
  { value: "vehicle", label: "Αυτοκίνητο" },
  { value: "home", label: "Κατοικία" },
  { value: "business", label: "Επιχείρηση" },
] as const;

const CROSS_SELL_VALUES = new Set<string>(CROSS_SELL_OPTIONS.map((o) => o.value));

const GREEK_SLUG: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i",
  θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "u", ύ: "u", ϋ: "u",
  ΰ: "u", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function statusesForKind(kind: string): readonly string[] {
  return kind === "lead" ? LEAD_STATUSES : SERVICE_STATUSES;
}

export function isClosedStatus(status: string): boolean {
  return status === "closed" || status === "won" || status === "lost";
}

export function slugPart(value: string): string {
  const lower = value.trim().toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += GREEK_SLUG[ch] ?? ch;
  }
  out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out.slice(0, 48) || "contact";
}

export function contactFolder(siteId: string, name: string, contactId: number): string {
  const short = contactId.toString(36);
  return `${siteId}/leads/${slugPart(name)}-${short}`;
}

export function filterCrossSell(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    const key = String(value || "").trim();
    if (CROSS_SELL_VALUES.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function crossSellLabel(value: string): string {
  return CROSS_SELL_OPTIONS.find((o) => o.value === value)?.label || value;
}

export type ChecklistDoc = { required: boolean; received: boolean };

const AUTO_STATUSES = new Set(["new", "missing_docs", "complete"]);

/**
 * Service requests: missing required docs → Λείπουν έγγραφα.
 * All required docs in → Πλήρες.
 * Lead statuses and later service statuses stay as the agent set them.
 */
export function nextChecklistStatus(
  kind: string,
  status: string,
  docs: ChecklistDoc[],
): string {
  if (kind !== "service") return status;
  if (!AUTO_STATUSES.has(status)) return status;
  const required = docs.filter((d) => d.required);
  if (required.length === 0) return status;
  const missing = required.some((d) => !d.received);
  if (missing) return "missing_docs";
  return "complete";
}

export function isStuck(lastActivityAt: Date | string | null, status: string, now = new Date()): boolean {
  if (isClosedStatus(status) || !lastActivityAt) return false;
  const at = lastActivityAt instanceof Date ? lastActivityAt : new Date(lastActivityAt);
  if (Number.isNaN(at.getTime())) return false;
  return now.getTime() - at.getTime() >= RECEPTION_STUCK_DAYS * 24 * 60 * 60 * 1000;
}

export function missingDocsList(docs: { label: string; required: boolean; received: boolean }[]): string {
  return docs
    .filter((d) => d.required && !d.received)
    .map((d) => d.label)
    .join("\n");
}

export function fileExt(name: string, mime: string | null): string {
  const fromName = name.includes(".") ? name.split(".").pop() || "" : "";
  const clean = fromName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (clean) return clean;
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  return "bin";
}

export function resourceTypeForMime(mime: string): "image" | "raw" {
  return mime.startsWith("image/") ? "image" : "raw";
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function mimeAllowed(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

/** Uncompressed ZIP so names stay `<doc_key>_<n>.<ext>`. */
export function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, "/"), "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, file.data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

export function zipEntryName(docKey: string, n: number, ext: string): string {
  const key = docKey.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "file";
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `${key}_${n}.${safeExt}`;
}
