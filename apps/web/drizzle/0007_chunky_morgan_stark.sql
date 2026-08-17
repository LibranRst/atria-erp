CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"default_ratio" numeric(8, 6) DEFAULT '0.000000' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_category_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "project_budget_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_budget_id" uuid NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"legacy_project_budget_item_id" uuid,
	"ratio_percentage" numeric(8, 6) DEFAULT '0.000000' NOT NULL,
	"allocated_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"actual_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"remaining_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"used_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"status" varchar(50) DEFAULT 'SAFE' NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"legacy_project_budget_id" uuid,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"contract_value" numeric(15, 2) NOT NULL,
	"approved_rab_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"internal_budget" numeric(15, 2) NOT NULL,
	"budget_cap_ratio" numeric(8, 6) DEFAULT '0.900000' NOT NULL,
	"target_gross_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"target_gross_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"project_progress_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_id" uuid NOT NULL,
	"project_budget_category_id" uuid NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"legacy_project_cost_id" uuid,
	"vendor_id" uuid,
	"vendor_bill_id" uuid,
	"material_id" uuid,
	"project_rap_item_id" uuid,
	"stock_movement_id" uuid,
	"requested_by_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL,
	"unit_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"payment_status" varchar(50) DEFAULT 'UNPAID' NOT NULL,
	"receipt_image_url" text,
	"status" varchar(50) DEFAULT 'SUBMITTED' NOT NULL,
	"audit_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_profitability_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_id" uuid NOT NULL,
	"contract_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_rab_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"internal_budget" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"actual_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"remaining_budget" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"budget_used_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"target_gross_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"target_gross_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"projected_final_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"projected_margin_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"projected_margin_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"material_budget" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"material_actual" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"material_remaining" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"material_used_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL,
	"material_stock_value_applied" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"material_shortage_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"leftover_stock_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"risk_status" varchar(50) DEFAULT 'SAFE' NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_cost" ADD COLUMN "project_budget_category_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "project_budget_category_id" uuid;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD CONSTRAINT "project_budget_category_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD CONSTRAINT "project_budget_category_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD CONSTRAINT "project_budget_category_legacy_project_budget_item_id_project_budget_item_id_fk" FOREIGN KEY ("legacy_project_budget_item_id") REFERENCES "public"."project_budget_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_legacy_project_budget_id_project_budget_id_fk" FOREIGN KEY ("legacy_project_budget_id") REFERENCES "public"."project_budget"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_legacy_project_cost_id_project_cost_id_fk" FOREIGN KEY ("legacy_project_cost_id") REFERENCES "public"."project_cost"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_vendor_bill_id_vendor_bill_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_rap_item_id_project_rap_item_id_fk" FOREIGN KEY ("project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_stock_movement_id_stock_movement_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_profitability_snapshot" ADD CONSTRAINT "project_profitability_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_profitability_snapshot" ADD CONSTRAINT "project_profitability_snapshot_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ec_code_idx" ON "expense_category" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "pbc_budget_category_uidx" ON "project_budget_category" USING btree ("project_budget_id","expense_category_id");--> statement-breakpoint
CREATE INDEX "pbc_project_budget_id_idx" ON "project_budget_category" USING btree ("project_budget_id");--> statement-breakpoint
CREATE INDEX "pbc_expense_category_id_idx" ON "project_budget_category" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "pbc_legacy_budget_item_idx" ON "project_budget_category" USING btree ("legacy_project_budget_item_id");--> statement-breakpoint
CREATE INDEX "pbc_status_idx" ON "project_budget_category" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_budgets_project_id_uidx" ON "project_budgets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_budgets_status_idx" ON "project_budgets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_budgets_legacy_idx" ON "project_budgets" USING btree ("legacy_project_budget_id");--> statement-breakpoint
CREATE INDEX "pe_project_id_idx" ON "project_expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pe_project_budget_id_idx" ON "project_expenses" USING btree ("project_budget_id");--> statement-breakpoint
CREATE INDEX "pe_project_budget_category_id_idx" ON "project_expenses" USING btree ("project_budget_category_id");--> statement-breakpoint
CREATE INDEX "pe_expense_category_id_idx" ON "project_expenses" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "pe_legacy_project_cost_id_idx" ON "project_expenses" USING btree ("legacy_project_cost_id");--> statement-breakpoint
CREATE INDEX "pe_vendor_bill_id_idx" ON "project_expenses" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE INDEX "pe_material_id_idx" ON "project_expenses" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "pe_project_rap_item_id_idx" ON "project_expenses" USING btree ("project_rap_item_id");--> statement-breakpoint
CREATE INDEX "pe_stock_movement_id_idx" ON "project_expenses" USING btree ("stock_movement_id");--> statement-breakpoint
CREATE INDEX "pe_status_idx" ON "project_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pps_project_id_idx" ON "project_profitability_snapshot" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pps_project_budget_id_idx" ON "project_profitability_snapshot" USING btree ("project_budget_id");--> statement-breakpoint
CREATE INDEX "pps_risk_status_idx" ON "project_profitability_snapshot" USING btree ("risk_status");--> statement-breakpoint
CREATE INDEX "pps_snapshot_at_idx" ON "project_profitability_snapshot" USING btree ("snapshot_at");--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_project_budget_category_id_idx" ON "project_cost" USING btree ("project_budget_category_id");--> statement-breakpoint
CREATE INDEX "vb_project_budget_category_id_idx" ON "vendor_bill" USING btree ("project_budget_category_id");