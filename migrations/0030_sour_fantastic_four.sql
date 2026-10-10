CREATE TABLE "churn_ignored_churns" (
	"customer_id" integer NOT NULL,
	"effective_day" text NOT NULL,
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "churn_ignored_churns_customer_id_effective_day_pk" PRIMARY KEY("customer_id","effective_day")
);
--> statement-breakpoint
CREATE TABLE "churn_offline_actives" (
	"customer_id" integer PRIMARY KEY NOT NULL,
	"mrr_cents" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"until_at" timestamp with time zone,
	"note" text,
	"created_by_user_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "metrics_ignored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "metrics_ignored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "metrics_ignored_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "metrics_ignored_note" text;--> statement-breakpoint
ALTER TABLE "churn_ignored_churns" ADD CONSTRAINT "churn_ignored_churns_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_ignored_churns" ADD CONSTRAINT "churn_ignored_churns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_offline_actives" ADD CONSTRAINT "churn_offline_actives_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_offline_actives" ADD CONSTRAINT "churn_offline_actives_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_metrics_ignored_by_user_id_users_id_fk" FOREIGN KEY ("metrics_ignored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;