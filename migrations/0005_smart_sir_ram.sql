CREATE TABLE "website_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"content_json" jsonb DEFAULT '{"sections":[]}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_pages_website_progress_id_slug_unique" UNIQUE("website_progress_id","slug")
);
--> statement-breakpoint
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE cascade ON UPDATE no action;