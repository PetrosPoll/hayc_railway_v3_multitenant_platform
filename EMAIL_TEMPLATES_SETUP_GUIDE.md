# Default Email Templates Implementation Guide

## Overview
This guide explains how to add ready-made newsletter templates from Unlayer to your application. These default templates will appear in the "Email Templates" tab alongside user-created templates, but users won't be able to delete them.

---

## Step 1: Update Database Schema

Add an `isDefault` field to the `emailTemplates` table in `shared/schema.ts`:

```typescript
// Find the emailTemplates table definition (around line 946)
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  websiteProgressId: integer("website_progress_id")
    .notNull()
    .references(() => websiteProgress.id),
  name: text("name").notNull(),
  html: text("html").notNull(),
  design: text("design").notNull(), // JSON string of Unlayer design
  thumbnail: text("thumbnail"), // Preview image (data URL or URL)
  category: text("category"),
  isDefault: boolean("is_default").notNull().default(false), // ADD THIS LINE
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

After making this change, create a database migration:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

---

## Step 2: Organize Template Files

Create a directory structure for default templates:

```
server/
  default-newsletter-templates/
    business-newsletter/
      template.html
      design.json
      images/
        image1.png
        image2.png
    promotional-sale/
      template.html
      design.json
      images/
        image1.png
    event-announcement/
      template.html
      design.json
      images/
```

For each Unlayer template you downloaded:
1. Create a folder with a descriptive name (e.g., `business-newsletter`, `promotional-sale`)
2. Place the HTML file as `template.html`
3. Create a `design.json` file containing the Unlayer design JSON
4. Place all images in an `images/` subfolder

**Getting design.json**: If you only have HTML, load it in Unlayer editor and export using:
```javascript
editor.exportHtml(function(data) {
  const { design, html } = data;
  // Save design as design.json
  // Save html as template.html
});
```

---

## Step 3: Create Migration Script

Create `server/migrate-default-templates.ts`:

```typescript
import { db } from "./db";
import { emailTemplates } from "@shared/schema";
import fs from "fs";
import path from "path";

interface DefaultTemplate {
  name: string;
  folder: string;
  category: string;
  websiteProgressId: number;
}

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  { 
    name: "Business Newsletter", 
    folder: "business-newsletter",
    category: "Business",
    websiteProgressId: 1
  },
  { 
    name: "Promotional Sale", 
    folder: "promotional-sale",
    category: "Marketing",
    websiteProgressId: 1
  },
  { 
    name: "Event Announcement", 
    folder: "event-announcement",
    category: "Events",
    websiteProgressId: 1
  },
];

async function migrateDefaultTemplates() {
  console.log("Starting default email templates migration...");
  
  const templatesDir = path.join(__dirname, "default-newsletter-templates");
  
  try {
    for (const template of DEFAULT_TEMPLATES) {
      const templatePath = path.join(templatesDir, template.folder);
      const htmlPath = path.join(templatePath, "template.html");
      const designPath = path.join(templatePath, "design.json");
      
      if (!fs.existsSync(htmlPath)) {
        console.warn(`⚠ HTML file not found for ${template.name}, skipping...`);
        continue;
      }
      
      if (!fs.existsSync(designPath)) {
        console.warn(`⚠ Design file not found for ${template.name}, skipping...`);
        continue;
      }
      
      const html = fs.readFileSync(htmlPath, "utf-8");
      const design = fs.readFileSync(designPath, "utf-8");
      
      await db.insert(emailTemplates).values({
        websiteProgressId: template.websiteProgressId,
        name: template.name,
        html,
        design,
        thumbnail: null,
        category: template.category,
        isDefault: true,
      }).onConflictDoNothing();
      
      console.log(`✓ Migrated template: ${template.name}`);
    }
    
    console.log(`\n✅ Migration complete! ${DEFAULT_TEMPLATES.length} templates processed.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateDefaultTemplates();
```

Run the migration:
```bash
npx tsx server/migrate-default-templates.ts
```

---

## Step 4: Update API Routes

In `server/routes.ts`, update the template routes:

### Get Templates Route (around line 1203):
```typescript
app.get("/api/email-templates/:websiteId", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const websiteId = parseInt(req.params.websiteId);
    
    const userTemplates = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.websiteProgressId, websiteId))
      .orderBy(desc(emailTemplates.updatedAt));
    
    const defaultTemplates = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.isDefault, true))
      .orderBy(emailTemplates.name);
    
    const allTemplates = [...defaultTemplates, ...userTemplates];
    res.json(allTemplates);
  } catch (error) {
    console.error("Error fetching email templates:", error);
    res.status(500).json({ error: "Failed to fetch email templates" });
  }
});
```

### Delete Template Route:
```typescript
app.delete("/api/email-template/:id", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const templateId = parseInt(req.params.id);
    
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .limit(1);
    
    if (!template || template.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    if (template[0].isDefault) {
      return res.status(403).json({ 
        error: "Cannot delete default templates" 
      });
    }
    
    await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting email template:", error);
    res.status(500).json({ error: "Failed to delete email template" });
  }
});
```

---

## Step 5: Update Frontend

In `client/src/pages/website-dashboard.tsx`, update the `renderTemplatesView` function:

### Add delete mutation (after other mutations):
```typescript
const deleteTemplateMutation = useMutation({
  mutationFn: async (templateId: number) => {
    const response = await fetch(`/api/email-template/${templateId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete template");
    }
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ["/api/email-templates", websiteId] 
    });
    toast({
      title: t("dashboard.success") || "Success",
      description: "Template deleted successfully",
    });
  },
  onError: (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

### Update template card (around line 2431):
```typescript
{emailTemplates.map((template) => (
  <Card key={template.id} className="hover:border-primary transition-colors flex flex-col">
    <CardHeader className="flex-1">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="text-base font-semibold">
              {template.name}
            </CardTitle>
            {template.isDefault && (
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            )}
          </div>
          {template.category && (
            <Badge variant="outline" className="mb-2">
              {template.category}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            Last updated:{" "}
            {new Date(template.updatedAt || template.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sessionStorage.setItem("loadTemplateId", template.id.toString());
            navigate(`/websites/${websiteId}/email-builder`);
          }}
          className="flex-1"
        >
          <Pencil className="h-4 w-4 mr-2" />
          {template.isDefault ? "Use Template" : "Edit"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          const previewWindow = window.open("", "_blank");
          if (previewWindow) {
            previewWindow.document.write(template.html);
            previewWindow.document.close();
          }
        }} className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          const blob = new Blob([template.html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${template.name}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
      
      {!template.isDefault && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full mt-2"
          onClick={() => deleteTemplateMutation.mutate(template.id)}
          disabled={deleteTemplateMutation.isPending}
        >
          {deleteTemplateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </>
          )}
        </Button>
      )}
    </CardContent>
  </Card>
))}
```

---

## Step 6: Run Migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
npx tsx server/migrate-default-templates.ts
```

---

## Step 7: Testing Checklist

- [ ] Default templates appear with "Default" badge
- [ ] Can preview default templates
- [ ] Can download default templates
- [ ] Cannot delete default templates (no delete button)
- [ ] Can delete user-created templates
- [ ] Templates are sorted properly (defaults first)

---

## Important Notes

### Design JSON
Unlayer requires both HTML and design JSON. Export both from each template using the Unlayer editor.

### Images
Template images should use absolute URLs or be uploaded to your image hosting service (e.g., Cloudinary).

### WebsiteProgressId
Use ID 1 or your admin website ID for default templates. Change the value in the migration script.

### Categories
Organize templates by category: Marketing, Events, Business, Newsletters, Promotions

---

## Alternative: Copy on Use

Instead of editing default templates directly, copy them when the user clicks "Use Template":

```typescript
onClick={async () => {
  if (template.isDefault) {
    const response = await fetch("/api/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteProgressId: parseInt(websiteId),
        name: `${template.name} (Copy)`,
        html: template.html,
        design: template.design,
        thumbnail: template.thumbnail,
        category: template.category,
      }),
      credentials: "include",
    });
    const newTemplate = await response.json();
    sessionStorage.setItem("loadTemplateId", newTemplate.id.toString());
  } else {
    sessionStorage.setItem("loadTemplateId", template.id.toString());
  }
  navigate(`/websites/${websiteId}/email-builder`);
}}
```

---

## Troubleshooting

**Templates not appearing**: Check migration ran successfully and API route returns both types

**Cannot delete defaults**: Expected behavior - check `isDefault` field is set correctly

**Images not loading**: Use absolute URLs or upload to CDN

**Design not loading**: Verify design.json contains valid Unlayer JSON format
