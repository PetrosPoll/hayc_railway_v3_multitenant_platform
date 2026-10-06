CREATE TABLE "website_form_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"form_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"visitor_subject" text NOT NULL,
	"visitor_body" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "website_form_automations_website_form_unique" UNIQUE("website_progress_id","form_id")
);
--> statement-breakpoint
ALTER TABLE "website_contact_submissions" ADD COLUMN "form_id" text;--> statement-breakpoint
ALTER TABLE "website_form_automations" ADD CONSTRAINT "website_form_automations_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_form_automations_website_idx" ON "website_form_automations" USING btree ("website_progress_id");--> statement-breakpoint
CREATE INDEX "website_contact_submissions_form_id_idx" ON "website_contact_submissions" USING btree ("form_id");