ALTER TABLE "website_progress" ADD COLUMN "billing_vat_number" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_street" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_number" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_postal_code" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_invoice_type" text DEFAULT 'invoice';--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_classification_type" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_invoice_type_code" text;--> statement-breakpoint
ALTER TABLE "website_progress" ADD COLUMN "billing_product_name" text;