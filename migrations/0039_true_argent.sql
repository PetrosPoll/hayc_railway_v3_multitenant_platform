CREATE TABLE "request_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"doc_key" text NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"received" boolean DEFAULT false NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_at" timestamp,
	"requested_manually" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allow_uploads" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "request_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cross_sell" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"policy_ref" text,
	"magic_token_hash" text,
	"magic_token_expires_at" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "cloudinary_folder" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "reception_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "request_docs" ADD CONSTRAINT "request_docs_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_type_id_request_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."request_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_docs_request_idx" ON "request_docs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_events_request_idx" ON "request_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "requests_website_idx" ON "requests" USING btree ("website_progress_id");--> statement-breakpoint
CREATE INDEX "requests_contact_idx" ON "requests" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "requests_magic_token_hash_idx" ON "requests" USING btree ("magic_token_hash");