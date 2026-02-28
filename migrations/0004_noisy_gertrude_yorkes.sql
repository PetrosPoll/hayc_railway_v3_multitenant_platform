ALTER TABLE "website_progress" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD CONSTRAINT "website_progress_site_id_unique" UNIQUE("site_id");