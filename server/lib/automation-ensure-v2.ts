import { ne } from "drizzle-orm";
import { db } from "../db";
import { websiteProgress } from "@shared/schema";
import { migrateLegacyFormAutomationsToWorkflows } from "./automation-legacy-migrate";

/**
 * Flip every website to automations v2 and migrate enabled legacy form
 * confirmations into editable workflows (idempotent).
 */
export async function ensureAllSitesAutomationsV2(): Promise<{
  flipped: number;
  migration: { created: number; skipped: number };
}> {
  const flippedRows = await db
    .update(websiteProgress)
    .set({ automationsEngine: "v2", updatedAt: new Date() })
    .where(ne(websiteProgress.automationsEngine, "v2"))
    .returning({ id: websiteProgress.id });

  const migration = await migrateLegacyFormAutomationsToWorkflows();

  return { flipped: flippedRows.length, migration };
}
