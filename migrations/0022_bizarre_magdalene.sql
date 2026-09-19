CREATE TABLE "website_contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer,
	"site_id" text NOT NULL,
	"site_label" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"extra_fields" jsonb,
	"owner_email" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "website_contact_submissions_created_at_idx" ON "website_contact_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "website_contact_submissions_website_idx" ON "website_contact_submissions" USING btree ("website_progress_id");