CREATE TABLE IF NOT EXISTS "rab_estimate_bundle" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rab_estimate_id" uuid NOT NULL,
  "client_label" varchar(255) NOT NULL,
  "description" text,
  "quantity" numeric(12,2) DEFAULT '1.00' NOT NULL,
  "unit" varchar(50) DEFAULT 'paket' NOT NULL,
  "unit_price" numeric(15,2) NOT NULL,
  "line_total" numeric(15,2) NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_hidden" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "rab_estimate_bundle" ADD CONSTRAINT "rab_estimate_bundle_rab_estimate_id_rab_estimate_id_fk" FOREIGN KEY ("rab_estimate_id") REFERENCES "public"."rab_estimate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "rab_estimate_item" ADD COLUMN IF NOT EXISTS "bundle_id" uuid;
DO $$ BEGIN
 ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rab_estimate_item_bundle_id_rab_estimate_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."rab_estimate_bundle"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "reb_rab_estimate_id_idx" ON "rab_estimate_bundle" USING btree ("rab_estimate_id");
CREATE INDEX IF NOT EXISTS "rei_bundle_id_idx" ON "rab_estimate_item" USING btree ("bundle_id");
