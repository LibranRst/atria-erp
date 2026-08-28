ALTER TABLE "project_cost" ADD COLUMN "requires_owner_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD COLUMN "requires_owner_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill: baris yang sudah ada harus punya jawaban, bukan `false` bawaan.
-- Adanya baris `approval` adalah bukti paling tepat bahwa persetujuan memang
-- diminta saat itu; ambang nominal dan penanda overrun menutup sisanya.
UPDATE "project_cost" SET "requires_owner_approval" = true
WHERE "amount" >= 5000000
   OR "budget_overrun" = true
   OR EXISTS (
     SELECT 1 FROM "approval"
     WHERE "approval"."reference_type" = 'project_cost'
       AND "approval"."reference_id" = "project_cost"."id"
   );--> statement-breakpoint
UPDATE "vendor_payment" SET "requires_owner_approval" = true
WHERE "amount_paid" >= 5000000
   OR EXISTS (
     SELECT 1 FROM "approval"
     WHERE "approval"."reference_type" = 'vendor_payment'
       AND "approval"."reference_id" = "vendor_payment"."id"
   );--> statement-breakpoint
-- Ambang menjadi konfigurasi. Nilainya dalam SEN, sesuai aturan uang aplikasi.
INSERT INTO "app_config" ("key", "value", "description")
VALUES
  ('approval.field_cost.owner_threshold', '500000000', 'Ambang persetujuan Owner untuk pengeluaran lapangan, dalam sen.'),
  ('approval.vendor_payment.owner_threshold', '500000000', 'Ambang persetujuan Owner untuk pembayaran vendor, dalam sen.')
ON CONFLICT ("key") DO NOTHING;
