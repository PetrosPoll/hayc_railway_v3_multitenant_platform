CREATE TABLE "website_automation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"website_progress_id" integer NOT NULL,
	"node_id" text NOT NULL,
	"run_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_automation_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_form_id" text NOT NULL,
	"graph" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"logo_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "website_automation_jobs" ADD CONSTRAINT "website_automation_jobs_workflow_id_website_automation_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."website_automation_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_jobs" ADD CONSTRAINT "website_automation_jobs_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD CONSTRAINT "website_automation_workflows_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_email_templates" ADD CONSTRAINT "website_email_templates_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_automation_jobs_due_idx" ON "website_automation_jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "website_automation_jobs_workflow_idx" ON "website_automation_jobs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "website_automation_workflows_website_idx" ON "website_automation_workflows" USING btree ("website_progress_id");--> statement-breakpoint
CREATE INDEX "website_automation_workflows_trigger_idx" ON "website_automation_workflows" USING btree ("website_progress_id","trigger_form_id");--> statement-breakpoint
CREATE INDEX "website_email_templates_website_idx" ON "website_email_templates" USING btree ("website_progress_id");