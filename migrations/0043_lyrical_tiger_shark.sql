CREATE TABLE "video_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_video_id" text,
	"provider_task_id" text,
	"style_id" text NOT NULL,
	"style_name" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"error" text,
	"s3_key" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "video_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_jobs_website_idx" ON "video_jobs" USING btree ("website_progress_id");