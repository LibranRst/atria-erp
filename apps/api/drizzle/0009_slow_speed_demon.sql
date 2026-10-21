CREATE TABLE "project_category_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_id" uuid NOT NULL,
	"project_budget_category_id" uuid NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"vendor_id" uuid,
	"name" varchar(255) NOT NULL,
	"scope_description" text,
	"area" varchar(150) DEFAULT 'Umum' NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL,
	"unit" varchar(50) DEFAULT 'ls' NOT NULL,
	"estimated_unit_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"estimated_total_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"internal_note" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_expenses" ADD COLUMN "project_category_plan_item_id" uuid;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD COLUMN "source_type" varchar(50) DEFAULT 'RAP_MATERIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD COLUMN "source_project_category_plan_item_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "project_category_plan_item_id" uuid;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "project_category_plan_item_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pcpi_project_id_idx" ON "project_category_plan_item" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pcpi_project_budget_id_idx" ON "project_category_plan_item" USING btree ("project_budget_id");--> statement-breakpoint
CREATE INDEX "pcpi_project_budget_category_id_idx" ON "project_category_plan_item" USING btree ("project_budget_category_id");--> statement-breakpoint
CREATE INDEX "pcpi_expense_category_id_idx" ON "project_category_plan_item" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "pcpi_vendor_id_idx" ON "project_category_plan_item" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "pcpi_status_idx" ON "project_category_plan_item" USING btree ("status");--> statement-breakpoint
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_category_plan_item_id_project_category_plan_item_id_fk" FOREIGN KEY ("project_category_plan_item_id") REFERENCES "public"."project_category_plan_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rab_estimate_item_source_project_category_plan_item_id_project_category_plan_item_id_fk" FOREIGN KEY ("source_project_category_plan_item_id") REFERENCES "public"."project_category_plan_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_category_plan_item_id_project_category_plan_item_id_fk" FOREIGN KEY ("project_category_plan_item_id") REFERENCES "public"."project_category_plan_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pe_project_category_plan_item_id_idx" ON "project_expenses" USING btree ("project_category_plan_item_id");--> statement-breakpoint
CREATE INDEX "rei_source_type_idx" ON "rab_estimate_item" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "rei_source_project_category_plan_item_id_idx" ON "rab_estimate_item" USING btree ("source_project_category_plan_item_id");--> statement-breakpoint
CREATE INDEX "vb_project_category_plan_item_id_idx" ON "vendor_bill" USING btree ("project_category_plan_item_id");