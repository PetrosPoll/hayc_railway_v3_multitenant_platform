CREATE TABLE "popup_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"html" text NOT NULL,
	"design" text NOT NULL,
	"thumbnail" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"delay_ms" integer DEFAULT 1500 NOT NULL,
	"show_once_every_days" integer DEFAULT 7 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "popup_templates" ADD CONSTRAINT "popup_templates_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "popup_templates_website_idx" ON "popup_templates" USING btree ("website_progress_id");