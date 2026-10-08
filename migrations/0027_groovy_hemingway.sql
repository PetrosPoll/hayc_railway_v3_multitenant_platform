ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "demo_slug" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "demo_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD CONSTRAINT "website_progress_demo_slug_unique" UNIQUE("demo_slug");