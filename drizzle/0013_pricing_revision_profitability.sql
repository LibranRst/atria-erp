ALTER TABLE "project_category_plan_item" ADD COLUMN "source_library_item_id" uuid;
ALTER TABLE "project_category_plan_item" ADD COLUMN "supersedes_project_category_plan_item_id" uuid;
ALTER TABLE "project_category_plan_item" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
ALTER TABLE "project_category_plan_item" ADD COLUMN "suggested_client_unit_price" numeric(15, 2) DEFAULT '0.00' NOT NULL;
ALTER TABLE "project_category_plan_item" ADD COLUMN "locked_by_id" uuid;
ALTER TABLE "project_category_plan_item" ADD COLUMN "locked_at" timestamp;

ALTER TABLE "project_expenses" ADD COLUMN "source_type" varchar(50) DEFAULT 'CASH_EXPENSE' NOT NULL;
ALTER TABLE "project_expenses" ADD COLUMN "is_cash_impact" boolean DEFAULT true NOT NULL;

ALTER TABLE "project_profitability_snapshot" ADD COLUMN "realized_margin_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL;
ALTER TABLE "project_profitability_snapshot" ADD COLUMN "realized_margin_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL;
ALTER TABLE "project_profitability_snapshot" ADD COLUMN "cash_position" numeric(15, 2) DEFAULT '0.00' NOT NULL;
ALTER TABLE "project_profitability_snapshot" ADD COLUMN "snapshot_type" varchar(50) DEFAULT 'PERIODIC' NOT NULL;

ALTER TABLE "item_price_library" ADD COLUMN "default_vendor_id" uuid;
ALTER TABLE "item_price_library" ADD COLUMN "pricing_mode" varchar(50) DEFAULT 'MARGIN_BASED' NOT NULL;
ALTER TABLE "item_price_library" ADD COLUMN "target_gross_percentage" numeric(8, 4) DEFAULT '0.0000' NOT NULL;
ALTER TABLE "item_price_library" ADD COLUMN "price_source_type" varchar(50) DEFAULT 'COST_BREAKDOWN' NOT NULL;
ALTER TABLE "item_price_library" ADD COLUMN "source_note" text;
ALTER TABLE "item_price_library" ADD COLUMN "effective_from" timestamp DEFAULT now() NOT NULL;

CREATE TABLE "item_price_library_cost_component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_price_library_id" uuid NOT NULL,
	"vendor_id" uuid,
	"component_type" varchar(50) NOT NULL,
	"label" varchar(255) NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL,
	"unit" varchar(50) DEFAULT 'ls' NOT NULL,
	"unit_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"note" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "project_rap" ADD COLUMN "supersedes_project_rap_id" uuid;
ALTER TABLE "project_rap_item" ADD COLUMN "source_library_item_id" uuid;
ALTER TABLE "project_rap_item" ADD COLUMN "suggested_client_unit_price" numeric(15, 2) DEFAULT '0.00' NOT NULL;

ALTER TABLE "rab_estimate" ADD COLUMN "supersedes_rab_estimate_id" uuid;
ALTER TABLE "rab_estimate_item" ADD COLUMN "source_library_item_id" uuid;
ALTER TABLE "rab_estimate_item" ADD COLUMN "source_revision" integer;
ALTER TABLE "rab_estimate_item" ADD COLUMN "source_updated_at" timestamp;

CREATE TABLE "goods_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_bill_id" uuid,
	"project_id" uuid NOT NULL,
	"inventory_location_id" uuid NOT NULL,
	"receipt_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"received_at" timestamp NOT NULL,
	"note" text,
	"received_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_receipt_number_unique" UNIQUE("receipt_number")
);

CREATE TABLE "goods_receipt_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"project_rap_item_id" uuid,
	"stock_movement_id" uuid,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "project_change_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"base_rab_estimate_id" uuid NOT NULL,
	"revised_rab_estimate_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"reason" text NOT NULL,
	"scope_summary" text NOT NULL,
	"previous_contract_value" numeric(15, 2) NOT NULL,
	"value_delta" numeric(15, 2) NOT NULL,
	"revised_contract_value" numeric(15, 2) NOT NULL,
	"client_confirmed_at" timestamp,
	"client_confirmation_reference" varchar(255),
	"created_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "pcpi_source_library_item_fk" FOREIGN KEY ("source_library_item_id") REFERENCES "public"."item_price_library"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "pcpi_supersedes_fk" FOREIGN KEY ("supersedes_project_category_plan_item_id") REFERENCES "public"."project_category_plan_item"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_category_plan_item" ADD CONSTRAINT "pcpi_locked_by_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "item_price_library" ADD CONSTRAINT "ipl_default_vendor_fk" FOREIGN KEY ("default_vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "item_price_library_cost_component" ADD CONSTRAINT "iplcc_library_item_fk" FOREIGN KEY ("item_price_library_id") REFERENCES "public"."item_price_library"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "item_price_library_cost_component" ADD CONSTRAINT "iplcc_vendor_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_rap" ADD CONSTRAINT "project_rap_supersedes_fk" FOREIGN KEY ("supersedes_project_rap_id") REFERENCES "public"."project_rap"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_rap_item" ADD CONSTRAINT "pri_source_library_item_fk" FOREIGN KEY ("source_library_item_id") REFERENCES "public"."item_price_library"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "rab_estimate" ADD CONSTRAINT "rab_estimate_supersedes_fk" FOREIGN KEY ("supersedes_rab_estimate_id") REFERENCES "public"."rab_estimate"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rei_source_library_item_fk" FOREIGN KEY ("source_library_item_id") REFERENCES "public"."item_price_library"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "goods_receipt" ADD CONSTRAINT "gr_vendor_bill_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bill"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "goods_receipt" ADD CONSTRAINT "gr_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "goods_receipt" ADD CONSTRAINT "gr_location_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_location"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "goods_receipt" ADD CONSTRAINT "gr_received_by_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "gri_receipt_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "gri_material_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "gri_rap_item_fk" FOREIGN KEY ("project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "gri_stock_movement_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movement"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "project_change_order" ADD CONSTRAINT "pco_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "project_change_order" ADD CONSTRAINT "pco_base_rab_fk" FOREIGN KEY ("base_rab_estimate_id") REFERENCES "public"."rab_estimate"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "project_change_order" ADD CONSTRAINT "pco_revised_rab_fk" FOREIGN KEY ("revised_rab_estimate_id") REFERENCES "public"."rab_estimate"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "project_change_order" ADD CONSTRAINT "pco_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "project_change_order" ADD CONSTRAINT "pco_approved_by_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;

CREATE INDEX "pcpi_source_library_item_id_idx" ON "project_category_plan_item" USING btree ("source_library_item_id");
CREATE INDEX "pcpi_supersedes_idx" ON "project_category_plan_item" USING btree ("supersedes_project_category_plan_item_id");
CREATE INDEX "pe_source_type_idx" ON "project_expenses" USING btree ("source_type");
CREATE INDEX "pps_snapshot_type_idx" ON "project_profitability_snapshot" USING btree ("snapshot_type");
CREATE INDEX "ipl_default_vendor_id_idx" ON "item_price_library" USING btree ("default_vendor_id");
CREATE INDEX "iplcc_library_item_id_idx" ON "item_price_library_cost_component" USING btree ("item_price_library_id");
CREATE INDEX "iplcc_vendor_id_idx" ON "item_price_library_cost_component" USING btree ("vendor_id");
CREATE INDEX "iplcc_component_type_idx" ON "item_price_library_cost_component" USING btree ("component_type");
CREATE INDEX "pr_supersedes_idx" ON "project_rap" USING btree ("supersedes_project_rap_id");
CREATE INDEX "pri_source_library_item_id_idx" ON "project_rap_item" USING btree ("source_library_item_id");
CREATE INDEX "re_supersedes_idx" ON "rab_estimate" USING btree ("supersedes_rab_estimate_id");
CREATE INDEX "rei_source_library_item_id_idx" ON "rab_estimate_item" USING btree ("source_library_item_id");
CREATE INDEX "gr_vendor_bill_id_idx" ON "goods_receipt" USING btree ("vendor_bill_id");
CREATE INDEX "gr_project_id_idx" ON "goods_receipt" USING btree ("project_id");
CREATE INDEX "gr_inventory_location_id_idx" ON "goods_receipt" USING btree ("inventory_location_id");
CREATE INDEX "gr_status_idx" ON "goods_receipt" USING btree ("status");
CREATE INDEX "gri_goods_receipt_id_idx" ON "goods_receipt_item" USING btree ("goods_receipt_id");
CREATE INDEX "gri_material_id_idx" ON "goods_receipt_item" USING btree ("material_id");
CREATE INDEX "gri_project_rap_item_id_idx" ON "goods_receipt_item" USING btree ("project_rap_item_id");
CREATE INDEX "gri_stock_movement_id_idx" ON "goods_receipt_item" USING btree ("stock_movement_id");
CREATE UNIQUE INDEX "pco_revised_rab_uidx" ON "project_change_order" USING btree ("revised_rab_estimate_id");
CREATE INDEX "pco_project_id_idx" ON "project_change_order" USING btree ("project_id");
CREATE INDEX "pco_base_rab_idx" ON "project_change_order" USING btree ("base_rab_estimate_id");
CREATE INDEX "pco_status_idx" ON "project_change_order" USING btree ("status");

UPDATE "item_price_library"
SET
	"target_gross_percentage" = CASE
		WHEN "item_type" = 'MATERIAL_ITEM' THEN '0.3000'
		WHEN "item_type" IN ('WORK_PACKAGE', 'SUBCON_PACKAGE') THEN '0.2000'
		ELSE '0.4000'
	END,
	"price_source_type" = 'LEGACY_BACKFILL',
	"source_note" = COALESCE("source_note", 'Migrated from legacy default internal cost; review and replace with a detailed cost breakdown.');

INSERT INTO "item_price_library_cost_component" (
	"item_price_library_id", "component_type", "label", "quantity", "unit", "unit_cost", "total_cost", "note"
)
SELECT
	"id", 'OTHER', 'Legacy internal cost', '1.00', "unit", "default_internal_cost", "default_internal_cost",
	'Automatic backfill. Replace with labor/material/equipment/logistics/overhead components when reviewed.'
FROM "item_price_library";
