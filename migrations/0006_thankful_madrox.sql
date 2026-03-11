ALTER TABLE "website_progress" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "stripe_account_status" text DEFAULT 'disconnected' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "stripe_connected_at" timestamp;