ALTER TABLE "project_rap" ADD COLUMN "setup_stage" varchar(50) DEFAULT 'MATERIAL' NOT NULL;
ALTER TABLE "project_rap" ADD COLUMN "tukang_scope_skipped" boolean DEFAULT false NOT NULL;
ALTER TABLE "project_rap" ADD COLUMN "subcon_scope_skipped" boolean DEFAULT false NOT NULL;
ALTER TABLE "project_rap" ADD COLUMN "setup_updated_by_id" uuid;
ALTER TABLE "project_rap" ADD CONSTRAINT "project_rap_setup_updated_by_id_user_id_fk" FOREIGN KEY ("setup_updated_by_id") REFERENCES "public"."user"("id") ON DELETE restrict;
CREATE INDEX "pr_setup_updated_by_id_idx" ON "project_rap"("setup_updated_by_id");
