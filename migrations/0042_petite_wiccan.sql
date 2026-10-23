ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "site_path" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "synced_at" timestamp;