CREATE TABLE "automation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"website_progress_id" integer NOT NULL,
	"event_id" integer,
	"contact_id" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"cancel_key" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "website_automation_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"website_progress_id" integer NOT NULL,
	"node_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_form_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"form_id" text NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_form_fields_unique" UNIQUE("website_progress_id","form_id","field_key")
);
--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "trigger_type" text DEFAULT 'form.submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "frequency" text DEFAULT 'every_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "preset_key" text;--> statement-breakpoint
ALTER TABLE "website_automation_workflows" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "automations_engine" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_events" ADD CONSTRAINT "automation_events_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_runs" ADD CONSTRAINT "website_automation_runs_workflow_id_website_automation_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."website_automation_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_runs" ADD CONSTRAINT "website_automation_runs_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_runs" ADD CONSTRAINT "website_automation_runs_event_id_automation_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."automation_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_steps" ADD CONSTRAINT "website_automation_steps_run_id_website_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."website_automation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_automation_steps" ADD CONSTRAINT "website_automation_steps_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_form_fields" ADD CONSTRAINT "website_form_fields_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_events_website_type_idx" ON "automation_events" USING btree ("website_progress_id","type");--> statement-breakpoint
CREATE INDEX "website_automation_runs_workflow_idx" ON "website_automation_runs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "website_automation_runs_website_idx" ON "website_automation_runs" USING btree ("website_progress_id");--> statement-breakpoint
CREATE INDEX "website_automation_runs_cancel_idx" ON "website_automation_runs" USING btree ("cancel_key");--> statement-breakpoint
CREATE INDEX "website_automation_steps_due_idx" ON "website_automation_steps" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "website_automation_steps_run_idx" ON "website_automation_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "website_form_fields_website_idx" ON "website_form_fields" USING btree ("website_progress_id");--> statement-breakpoint
CREATE INDEX "website_automation_workflows_type_idx" ON "website_automation_workflows" USING btree ("website_progress_id","trigger_type");