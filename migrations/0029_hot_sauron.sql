CREATE TABLE "churn_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"events_cutover_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churn_stripe_event_receipts" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_stripe_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_stripe_accounts_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_price_map" (
	"stripe_price_id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"tier" text
);
--> statement-breakpoint
CREATE TABLE "subscription_event_reason_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" bigint NOT NULL,
	"edited_by_user_id" integer NOT NULL,
	"old_reason_code" text,
	"new_reason_code" text,
	"old_reason_note" text,
	"new_reason_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"stripe_subscription_id" text,
	"stripe_event_id" text,
	"type" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"status_after" text,
	"mrr_after_cents" integer,
	"mrr_delta_cents" integer,
	"tier_after" text,
	"churn_kind" text,
	"reason_code" text,
	"reason_note" text,
	"pre_launch" boolean,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "launched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_stripe_accounts" ADD CONSTRAINT "customer_stripe_accounts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_event_reason_audits" ADD CONSTRAINT "subscription_event_reason_audits_event_id_subscription_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."subscription_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_event_reason_audits" ADD CONSTRAINT "subscription_event_reason_audits_edited_by_user_id_users_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_stripe_accounts_customer_idx" ON "customer_stripe_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscription_events_customer_time_idx" ON "subscription_events" USING btree ("customer_id","effective_at","id");