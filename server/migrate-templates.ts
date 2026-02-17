import { db } from "./db";
import { templates } from "@shared/schema";
import { TEMPLATES } from "../client/src/data/templates";

async function migrateTemplates() {
  console.log("Starting template migration...");
  
  try {
    // Insert all templates
    for (const template of TEMPLATES) {
      const templateData = {
        name: template.name,
        translationKey: template.translationKey,
        description: template.description,
        preview: template.preview,
        images: template.images,
        category: template.category,
        features: template.features,
        tech: template.tech || [],
        fullDescription: template.fullDescription || null,
        externalUrl: template.externalUrl || null,
      };

      await db.insert(templates).values(templateData).onConflictDoNothing();
      console.log(`✓ Migrated template: ${template.name}`);
    }

    console.log(`\nMigration complete! ${TEMPLATES.length} templates migrated.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateTemplates();
