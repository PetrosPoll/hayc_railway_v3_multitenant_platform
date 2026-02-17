CREATE TABLE "internal_business_email_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app" text NOT NULL,
	"business_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"reply_to_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "internal_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"app" text NOT NULL,
	"event" text NOT NULL,
	"business_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"status" text NOT NULL,
	"message_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
