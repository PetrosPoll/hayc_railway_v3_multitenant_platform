import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { websiteFormFields } from "@shared/schema";

function slugifyKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64) || "field";
}

type RawField = {
  key?: unknown;
  name?: unknown;
  label?: unknown;
  id?: unknown;
  type?: unknown;
  fieldType?: unknown;
};

/**
 * Sync form field catalog from site config.forms into website_form_fields.
 * Field keys stay stable when labels change (key preferred over slugified label).
 */
export async function syncWebsiteFormFieldsFromConfig(
  websiteProgressId: number,
  config: Record<string, unknown> | null | undefined,
): Promise<number> {
  if (!config || !Array.isArray(config.forms)) return 0;

  let upserted = 0;
  const seen = new Set<string>();

  for (const entry of config.forms) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const form = entry as Record<string, unknown>;
    const formId = typeof form.id === "string" ? form.id.trim() : "";
    if (!formId) continue;

    const fields = Array.isArray(form.fields) ? form.fields : [];
    for (const raw of fields) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const f = raw as RawField;
      const label =
        (typeof f.label === "string" && f.label.trim()) ||
        (typeof f.name === "string" && f.name.trim()) ||
        "";
      const explicitKey =
        (typeof f.key === "string" && f.key.trim()) ||
        (typeof f.id === "string" && f.id.trim()) ||
        (typeof f.name === "string" && f.name.trim()) ||
        "";
      const fieldKey = explicitKey || (label ? slugifyKey(label) : "");
      if (!fieldKey) continue;

      const fieldType =
        (typeof f.fieldType === "string" && f.fieldType.trim()) ||
        (typeof f.type === "string" && f.type.trim()) ||
        "text";

      const dedupe = `${formId}::${fieldKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const [existing] = await db
        .select()
        .from(websiteFormFields)
        .where(
          and(
            eq(websiteFormFields.websiteProgressId, websiteProgressId),
            eq(websiteFormFields.formId, formId),
            eq(websiteFormFields.fieldKey, fieldKey),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(websiteFormFields)
          .set({
            label: label || existing.label,
            fieldType,
            updatedAt: new Date(),
          })
          .where(eq(websiteFormFields.id, existing.id));
      } else {
        await db.insert(websiteFormFields).values({
          websiteProgressId,
          formId,
          fieldKey,
          label: label || fieldKey,
          fieldType,
        });
      }
      upserted += 1;
    }
  }

  return upserted;
}
