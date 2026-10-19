CREATE TABLE "automation_email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"run_id" integer,
	"step_id" integer,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "automation_email_events" ADD CONSTRAINT "automation_email_events_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_email_events_message_idx" ON "automation_email_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "automation_email_events_run_idx" ON "automation_email_events" USING btree ("run_id");