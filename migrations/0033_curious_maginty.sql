CREATE TABLE "admin_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"obligation_id" integer,
	"user_id" integer,
	"attempt_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_obligation_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"obligation_id" integer NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"source" text NOT NULL,
	"actor_user_id" integer,
	"stripe_event_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_obligations" RENAME COLUMN "amount_due" TO "amount_due_cents";--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_realtime_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_customer_email_action_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_customer_email_cancel_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_customer_email_ending_soon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_customer_email_offline_reminder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "calendar_customer_email_offline_overdue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "amount_paid_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "amount_refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "period_start" timestamp;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "period_end" timestamp;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "risk_flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "stripe_schedule_id" text;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "vat_included" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "assumed_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD COLUMN "next_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_settlements" ADD COLUMN "actor_user_id" integer;--> statement-breakpoint
ALTER TABLE "billing_email_log" ADD CONSTRAINT "billing_email_log_obligation_id_payment_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."payment_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_email_log" ADD CONSTRAINT "billing_email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_obligation_history" ADD CONSTRAINT "payment_obligation_history_obligation_id_payment_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."payment_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_obligation_history" ADD CONSTRAINT "payment_obligation_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlements" ADD CONSTRAINT "payment_settlements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;