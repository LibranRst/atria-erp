ALTER TABLE "rab_estimate" ADD COLUMN "void_reason" text;
ALTER TABLE "rab_estimate" ADD COLUMN "voided_at" timestamp;
ALTER TABLE "rab_estimate" ADD COLUMN "voided_by_id" uuid;
ALTER TABLE "rab_estimate" ADD CONSTRAINT "rab_estimate_voided_by_id_user_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."user"("id") ON DELETE restrict;
CREATE INDEX "re_voided_by_id_idx" ON "rab_estimate"("voided_by_id");
