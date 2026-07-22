CREATE TABLE "platform_analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"session_id" text NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_analytics_events" ADD CONSTRAINT "platform_analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_analytics_events_user_created_idx" ON "platform_analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_analytics_events_created_idx" ON "platform_analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_analytics_events_type_created_idx" ON "platform_analytics_events" USING btree ("event_type","created_at");