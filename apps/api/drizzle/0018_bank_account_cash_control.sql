ALTER TABLE "bank_account" ADD COLUMN IF NOT EXISTS "card_color_from" varchar(7) DEFAULT '#0F2B5C' NOT NULL;
ALTER TABLE "bank_account" ADD COLUMN IF NOT EXISTS "card_color_to" varchar(7) DEFAULT '#1E40AF' NOT NULL;
ALTER TABLE "bank_account" ADD COLUMN IF NOT EXISTS "card_text_color" varchar(10) DEFAULT 'light' NOT NULL;
ALTER TABLE "bank_account" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS "ba_is_active_idx" ON "bank_account"("is_active");
