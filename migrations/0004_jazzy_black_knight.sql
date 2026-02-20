CREATE TABLE "website_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"domain" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE cascade ON UPDATE no action;