CREATE TABLE "budget_allocation_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"budget_cap_ratio" numeric(8, 6) DEFAULT '0.900000' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_allocation_setting_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_allocation_setting_id" uuid NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"ratio_percentage" numeric(8, 6) DEFAULT '0.000000' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_price_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"material_id" uuid,
	"code" varchar(100),
	"item_type" varchar(50) DEFAULT 'CLIENT_LINE' NOT NULL,
	"item_category" varchar(120) DEFAULT 'General' NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"unit" varchar(50) NOT NULL,
	"default_client_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"default_internal_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_allocation_setting" ADD CONSTRAINT "budget_allocation_setting_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocation_setting_category" ADD CONSTRAINT "budget_allocation_setting_category_budget_allocation_setting_id_budget_allocation_setting_id_fk" FOREIGN KEY ("budget_allocation_setting_id") REFERENCES "public"."budget_allocation_setting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocation_setting_category" ADD CONSTRAINT "budget_allocation_setting_category_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_library" ADD CONSTRAINT "item_price_library_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_library" ADD CONSTRAINT "item_price_library_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price_library" ADD CONSTRAINT "item_price_library_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bas_status_idx" ON "budget_allocation_setting" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bas_is_active_idx" ON "budget_allocation_setting" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "bas_updated_by_id_idx" ON "budget_allocation_setting" USING btree ("updated_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "basc_setting_category_uidx" ON "budget_allocation_setting_category" USING btree ("budget_allocation_setting_id","expense_category_id");--> statement-breakpoint
CREATE INDEX "basc_setting_id_idx" ON "budget_allocation_setting_category" USING btree ("budget_allocation_setting_id");--> statement-breakpoint
CREATE INDEX "basc_expense_category_id_idx" ON "budget_allocation_setting_category" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "basc_is_enabled_idx" ON "budget_allocation_setting_category" USING btree ("is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "ipl_code_uidx" ON "item_price_library" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ipl_expense_category_id_idx" ON "item_price_library" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "ipl_material_id_idx" ON "item_price_library" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "ipl_item_type_idx" ON "item_price_library" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "ipl_item_category_idx" ON "item_price_library" USING btree ("item_category");--> statement-breakpoint
CREATE INDEX "ipl_is_active_idx" ON "item_price_library" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ipl_updated_by_id_idx" ON "item_price_library" USING btree ("updated_by_id");--> statement-breakpoint
INSERT INTO "budget_allocation_setting" ("id", "name", "status", "budget_cap_ratio", "notes", "is_active")
VALUES ('41414141-4141-4141-4141-414141414101', 'Default Project Budget Allocation', 'ACTIVE', '0.900000', 'Default allocation used when creating a new Project Budget. Project-level values can still be overridden.', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "budget_allocation_setting_category" ("budget_allocation_setting_id", "expense_category_id", "ratio_percentage", "is_enabled", "sort_order")
SELECT
	'41414141-4141-4141-4141-414141414101',
	"id",
	"default_ratio",
	true,
	"sort_order"
FROM "expense_category"
WHERE "code" IN ('MATERIAL', 'TUKANG', 'OPERASIONAL', 'LAIN_LAIN', 'SUBCON')
ON CONFLICT DO NOTHING;
