ALTER TABLE "website_invoices" ADD COLUMN IF NOT EXISTS "amount_locked" boolean DEFAULT false NOT NULL;
