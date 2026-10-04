CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"status" varchar(30) DEFAULT 'ACTIVE' NOT NULL,
	"subscription_starts_at" timestamp,
	"subscription_ends_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Tenant Dekoria harus ada sebelum 53 foreign key di bawah dipasang, dan
-- sebelum DEFAULT pada ADD COLUMN mengisi baris yang sudah ada. Disisipkan
-- manual: drizzle-kit tidak tahu tentang baris perancah ini.
INSERT INTO "tenant" ("id", "name", "slug", "status", "notes")
VALUES (
	'00000000-0000-4000-8000-000000000001',
	'Dekoria',
	'dekoria',
	'ACTIVE',
	'Tenant perancah. Dibuat migrasi 0035; lihat docs/plans/2026-08-27-tenant-foundation.md.'
) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
CREATE TABLE "tenant_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "client_email_unique";--> statement-breakpoint
ALTER TABLE "expense_category" DROP CONSTRAINT "expense_category_code_unique";--> statement-breakpoint
ALTER TABLE "material_category" DROP CONSTRAINT "material_category_name_unique";--> statement-breakpoint
ALTER TABLE "bank_account" DROP CONSTRAINT "bank_account_account_number_unique";--> statement-breakpoint
ALTER TABLE "client_invoice" DROP CONSTRAINT "client_invoice_invoice_number_unique";--> statement-breakpoint
ALTER TABLE "vendor" DROP CONSTRAINT "vendor_email_unique";--> statement-breakpoint
ALTER TABLE "vendor_bill" DROP CONSTRAINT "vendor_bill_bill_number_unique";--> statement-breakpoint
ALTER TABLE "goods_receipt" DROP CONSTRAINT "goods_receipt_receipt_number_unique";--> statement-breakpoint
ALTER TABLE "inventory_location" DROP CONSTRAINT "inventory_location_name_unique";--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" DROP CONSTRAINT "inventory_opening_batch_batch_number_unique";--> statement-breakpoint
ALTER TABLE "stock_count" DROP CONSTRAINT "stock_count_count_number_unique";--> statement-breakpoint
ALTER TABLE "stock_transfer" DROP CONSTRAINT "stock_transfer_transfer_number_unique";--> statement-breakpoint
ALTER TABLE "ai_proposal_confirmation" DROP CONSTRAINT "ai_proposal_confirmation_tool_call_id_unique";--> statement-breakpoint
ALTER TABLE "app_config" DROP CONSTRAINT "app_config_key_unique";--> statement-breakpoint
DROP INDEX "bsr_fingerprint_uidx";--> statement-breakpoint
DROP INDEX "ipl_code_uidx";--> statement-breakpoint
ALTER TABLE "budget_allocation_setting" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_allocation_setting_category" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_category" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_draft" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_category" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_change_order" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_profitability_snapshot" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_rap" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_rap_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "rab_estimate" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "rab_estimate_bundle" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_statement_import" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_statement_row" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_invoice" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_payment" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_cost" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "goods_receipt_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_location" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "item_price_library" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "item_price_library_cost_component" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_inventory" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_master" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_count" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_count_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_message" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposal_confirmation" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_run" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "approval" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_member" ADD CONSTRAINT "tenant_member_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_member" ADD CONSTRAINT "tenant_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_member" ADD CONSTRAINT "tenant_member_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_slug_uidx" ON "tenant" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tenant_status_idx" ON "tenant" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_member_tenant_user_uidx" ON "tenant_member" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_member_user_id_idx" ON "tenant_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_member_role_id_idx" ON "tenant_member" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "budget_allocation_setting" ADD CONSTRAINT "budget_allocation_setting_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocation_setting_category" ADD CONSTRAINT "budget_allocation_setting_category_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_draft" ADD CONSTRAINT "form_draft_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget" ADD CONSTRAINT "project_budget_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD CONSTRAINT "project_budget_category_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD CONSTRAINT "project_budget_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_change_order" ADD CONSTRAINT "project_change_order_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_profitability_snapshot" ADD CONSTRAINT "project_profitability_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap" ADD CONSTRAINT "project_rap_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap_item" ADD CONSTRAINT "project_rap_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate" ADD CONSTRAINT "rab_estimate_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate_bundle" ADD CONSTRAINT "rab_estimate_bundle_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rab_estimate_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_row" ADD CONSTRAINT "bank_statement_row_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invoice" ADD CONSTRAINT "client_invoice_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment" ADD CONSTRAINT "client_payment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_location" ADD CONSTRAINT "inventory_location_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" ADD CONSTRAINT "inventory_opening_batch_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD CONSTRAINT "inventory_opening_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_library" ADD CONSTRAINT "item_price_library_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_library_cost_component" ADD CONSTRAINT "item_price_library_cost_component_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_inventory" ADD CONSTRAINT "material_inventory_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_item" ADD CONSTRAINT "stock_count_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposal_confirmation" ADD CONSTRAINT "ai_proposal_confirmation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_tenant_email_uidx" ON "client" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "client_tenant_id_idx" ON "client" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ec_tenant_code_uidx" ON "expense_category" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "ec_tenant_id_idx" ON "expense_category" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mc_tenant_name_uidx" ON "material_category" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "mc_tenant_id_idx" ON "material_category" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ba_tenant_account_number_uidx" ON "bank_account" USING btree ("tenant_id","account_number");--> statement-breakpoint
CREATE INDEX "ba_tenant_id_idx" ON "bank_account" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bsr_tenant_fingerprint_uidx" ON "bank_statement_row" USING btree ("tenant_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "ci_tenant_invoice_number_uidx" ON "client_invoice" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "ci_tenant_id_idx" ON "client_invoice" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_tenant_email_uidx" ON "vendor" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "vendor_tenant_id_idx" ON "vendor" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vb_tenant_bill_number_uidx" ON "vendor_bill" USING btree ("tenant_id","bill_number");--> statement-breakpoint
CREATE INDEX "vb_tenant_id_idx" ON "vendor_bill" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gr_tenant_receipt_number_uidx" ON "goods_receipt" USING btree ("tenant_id","receipt_number");--> statement-breakpoint
CREATE INDEX "gr_tenant_id_idx" ON "goods_receipt" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "il_tenant_name_uidx" ON "inventory_location" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "il_tenant_id_idx" ON "inventory_location" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "iob_tenant_batch_number_uidx" ON "inventory_opening_batch" USING btree ("tenant_id","batch_number");--> statement-breakpoint
CREATE INDEX "iob_tenant_id_idx" ON "inventory_opening_batch" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ipl_tenant_code_uidx" ON "item_price_library" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_tenant_count_number_uidx" ON "stock_count" USING btree ("tenant_id","count_number");--> statement-breakpoint
CREATE INDEX "sc_tenant_id_idx" ON "stock_count" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "st_tenant_transfer_number_uidx" ON "stock_transfer" USING btree ("tenant_id","transfer_number");--> statement-breakpoint
CREATE INDEX "st_tenant_id_idx" ON "stock_transfer" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_proposal_tenant_tool_call_uidx" ON "ai_proposal_confirmation" USING btree ("tenant_id","tool_call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_config_tenant_key_uidx" ON "app_config" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "app_config_tenant_id_idx" ON "app_config" USING btree ("tenant_id");