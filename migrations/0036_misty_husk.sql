ALTER TABLE "contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "dates" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "consent_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_booking_at" timestamp;