CREATE TABLE "admin_campaign_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_id" integer,
	"email" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"purpose" text,
	"tag_ids" integer[] DEFAULT ARRAY[]::integer[],
	"excluded_tag_ids" integer[] DEFAULT ARRAY[]::integer[],
	"sender_name" text,
	"sender_email" text,
	"excluded_contact_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"subject" text,
	"message" text,
	"template_id" integer,
	"email_html" text,
	"email_design" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"bounce_count" integer DEFAULT 0 NOT NULL,
	"complaint_count" integer DEFAULT 0 NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_contact_tags" (
	"contact_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_contact_tags_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "admin_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "admin_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#888888',
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "admin_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"html" text NOT NULL,
	"design" text NOT NULL,
	"thumbnail" text,
	"category" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_daily_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"date" text NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"top_pages" text,
	"top_referrers" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"page" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"device_type" text,
	"session_id" text,
	"ip_hash" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "campaign_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"contact_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	CONSTRAINT "contact_tags_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmation_token" text,
	"subscribed_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contacts_email_website_progress_id_unique" UNIQUE("email","website_progress_id")
);
--> statement-breakpoint
CREATE TABLE "custom_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"email" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp NOT NULL,
	"payment_type" text DEFAULT 'cash' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" integer,
	"subscription_id" integer,
	"notes" text,
	"excluded_dates" text[] DEFAULT '{}'::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"html" text NOT NULL,
	"design" text NOT NULL,
	"thumbnail" text,
	"category" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logo_design_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"website_progress_id" integer,
	"onboarding_id" integer,
	"logo_type" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "newsletter_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"purpose" text,
	"tag_ids" integer[] DEFAULT ARRAY[]::integer[],
	"excluded_tag_ids" integer[] DEFAULT ARRAY[]::integer[],
	"sender_name" text,
	"sender_email" text,
	"excluded_subscriber_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"excluded_contact_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"subject" text,
	"message" text,
	"template_id" integer,
	"email_html" text,
	"email_design" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"bounce_count" integer DEFAULT 0 NOT NULL,
	"complaint_count" integer DEFAULT 0 NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmation_token" text,
	"subscribed_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "newsletter_subscribers_email_website_progress_id_unique" UNIQUE("email","website_progress_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_form_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"account_email" text NOT NULL,
	"contact_email" text NOT NULL,
	"business_description" text NOT NULL,
	"website_language" text DEFAULT 'en',
	"has_domain" text NOT NULL,
	"existing_domain" text,
	"domain_access" text,
	"domain_connection_preference" text,
	"domain_purchase_preference" text,
	"preferred_domains" text,
	"has_emails" text NOT NULL,
	"email_provider" text,
	"email_access" text,
	"existing_emails" text,
	"email_count" text,
	"email_names" text,
	"email_redirect" text,
	"redirect_inbox_address" text,
	"has_website" text NOT NULL,
	"website_link" text,
	"website_changes" text,
	"wanted_pages" text[],
	"not_sure_pages" boolean DEFAULT false,
	"has_text_content" text NOT NULL,
	"has_media_content" text NOT NULL,
	"business_logo_url" text,
	"business_logo_name" text,
	"business_logo_public_id" text,
	"create_text_logo" boolean DEFAULT false,
	"color_palette" text,
	"inspiration_websites" text[],
	"preferred_fonts" text,
	"site_style" text,
	"selected_template_id" integer,
	"custom_template_request" text,
	"has_social_media" text NOT NULL,
	"facebook_link" text,
	"instagram_link" text,
	"linkedin_link" text,
	"tiktok_link" text,
	"youtube_link" text,
	"other_social_links" text,
	"logo_design_service" text,
	"project_deadline" text,
	"additional_notes" text,
	"submission_id" text NOT NULL,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_obligations" (
	"id" serial PRIMARY KEY NOT NULL,
	"custom_payment_id" integer,
	"subscription_id" integer,
	"user_id" integer,
	"client_name" text NOT NULL,
	"amount_due" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"origin" text DEFAULT 'custom' NOT NULL,
	"stripe_invoice_id" text,
	"stripe_payment_intent_id" text,
	"grace_days" integer DEFAULT 7,
	"next_retry_date" timestamp,
	"attempt_count" integer DEFAULT 0,
	"last_failure_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"obligation_id" integer NOT NULL,
	"amount_paid" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"paid_at" timestamp NOT NULL,
	"payment_method" text,
	"reference" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"billing_period" text NOT NULL,
	"price_id" text NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stripe_prices_tier_billing_period_unique" UNIQUE("tier","billing_period")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"website_progress_id" integer,
	"product_type" text DEFAULT 'plan',
	"product_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_item_id" text,
	"tier" text,
	"status" text NOT NULL,
	"price" integer,
	"vat_number" text,
	"city" text,
	"street" text,
	"number" text,
	"postal_code" text,
	"pdf_url" text,
	"invoice_type" text DEFAULT 'invoice',
	"classification_type" text,
	"invoice_type_code" text,
	"product_name" text,
	"first_name" text,
	"last_name" text,
	"billing_period" text DEFAULT 'monthly',
	"cancellation_reason" text,
	"access_until" timestamp,
	"emails_sent_this_month" integer DEFAULT 0 NOT NULL,
	"email_limit_reset_date" timestamp DEFAULT now() NOT NULL,
	"is_legacy" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'bg-blue-100 text-blue-800',
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_website_progress_id_unique" UNIQUE("name","website_progress_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"translation_key" text NOT NULL,
	"description" text NOT NULL,
	"preview" text NOT NULL,
	"images" text[] NOT NULL,
	"category" text NOT NULL,
	"features" text[] NOT NULL,
	"tech" text[],
	"full_description" text,
	"external_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "templates_translation_key_unique" UNIQUE("translation_key")
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"pdf_url" text,
	"stripe_invoice_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "transactions_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text,
	"stripe_customer_id" text,
	"role" text DEFAULT 'subscriber' NOT NULL,
	"account_kind" text DEFAULT 'customer' NOT NULL,
	"language" text DEFAULT 'en',
	"analytics_email" text,
	"vat_number" text,
	"email_notifications_enabled" boolean DEFAULT true,
	"tip_email_notifications" boolean DEFAULT true,
	"tips_email_notifications" boolean DEFAULT true,
	"password_reset_token" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "website_analytics_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"api_key" text NOT NULL,
	"domain" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "website_analytics_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "website_change_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"domain" text NOT NULL,
	"change_description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_id" integer,
	"completed_by" integer,
	"completed_at" timestamp,
	"user_feedback" text,
	"files" jsonb,
	"month_year" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"domain" text NOT NULL,
	"changes_used" integer DEFAULT 0 NOT NULL,
	"changes_allowed" integer DEFAULT 0 NOT NULL,
	"month_year" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "website_changes_user_id_domain_month_year_unique" UNIQUE("user_id","domain","month_year")
);
--> statement-breakpoint
CREATE TABLE "website_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"invoice_number" text,
	"title" text NOT NULL,
	"description" text,
	"pdf_url" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"amount" integer,
	"currency" text DEFAULT 'eur',
	"issue_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"uploaded_by" integer,
	"status" text DEFAULT 'COMPLETED',
	"wrapp_invoice_id" text,
	"subscription_id" integer,
	"payment_intent_id" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "website_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"domain" text NOT NULL,
	"project_name" text,
	"website_language" text DEFAULT 'en',
	"current_stage" integer DEFAULT 1 NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb,
	"bonus_emails" integer DEFAULT 0 NOT NULL,
	"bonus_emails_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_progress_id" integer NOT NULL,
	"stage_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"waiting_info" text,
	"reminder_interval" integer DEFAULT 1,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "admin_campaign_messages" ADD CONSTRAINT "admin_campaign_messages_campaign_id_admin_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."admin_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_campaign_messages" ADD CONSTRAINT "admin_campaign_messages_contact_id_admin_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."admin_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_campaigns" ADD CONSTRAINT "admin_campaigns_template_id_admin_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."admin_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_contact_tags" ADD CONSTRAINT "admin_contact_tags_contact_id_admin_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."admin_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_contact_tags" ADD CONSTRAINT "admin_contact_tags_tag_id_admin_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."admin_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily_summaries" ADD CONSTRAINT "analytics_daily_summaries_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_newsletter_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_payments" ADD CONSTRAINT "custom_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_payments" ADD CONSTRAINT "custom_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logo_design_purchases" ADD CONSTRAINT "logo_design_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logo_design_purchases" ADD CONSTRAINT "logo_design_purchases_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logo_design_purchases" ADD CONSTRAINT "logo_design_purchases_onboarding_id_onboarding_form_responses_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboarding_form_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_form_responses" ADD CONSTRAINT "onboarding_form_responses_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_custom_payment_id_custom_payments_id_fk" FOREIGN KEY ("custom_payment_id") REFERENCES "public"."custom_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlements" ADD CONSTRAINT "payment_settlements_obligation_id_payment_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."payment_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_analytics_keys" ADD CONSTRAINT "website_analytics_keys_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_change_logs" ADD CONSTRAINT "website_change_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_change_logs" ADD CONSTRAINT "website_change_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_change_logs" ADD CONSTRAINT "website_change_logs_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_changes" ADD CONSTRAINT "website_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_invoices" ADD CONSTRAINT "website_invoices_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_invoices" ADD CONSTRAINT "website_invoices_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_progress" ADD CONSTRAINT "website_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_stages" ADD CONSTRAINT "website_stages_website_progress_id_website_progress_id_fk" FOREIGN KEY ("website_progress_id") REFERENCES "public"."website_progress"("id") ON DELETE no action ON UPDATE no action;