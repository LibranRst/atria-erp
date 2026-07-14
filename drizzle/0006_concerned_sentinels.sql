CREATE TABLE "inventory_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_location_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "material_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "material_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"current_stock" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"reserved_stock" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"minimum_stock" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"average_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"last_purchase_price" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_master" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"default_vendor_id" uuid,
	"name" varchar(255) NOT NULL,
	"specification" text,
	"brand" varchar(100),
	"code" varchar(100),
	"color" varchar(100),
	"unit" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_rap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"locked_by_id" uuid,
	"locked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_rap_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_rap_id" uuid NOT NULL,
	"material_id" uuid,
	"area" varchar(150) DEFAULT 'Umum' NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"required_quantity" numeric(12, 2) NOT NULL,
	"buffer_quantity" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_quantity" numeric(12, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"estimated_unit_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"estimated_total_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"source" varchar(50) DEFAULT 'PURCHASE' NOT NULL,
	"status" varchar(50) DEFAULT 'PLANNED' NOT NULL,
	"internal_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rab_estimate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_project_rap_id" uuid,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"title" varchar(255) NOT NULL,
	"client_notes" text,
	"approved_value" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rab_estimate_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rab_estimate_id" uuid NOT NULL,
	"source_project_rap_item_id" uuid,
	"client_label" varchar(255) NOT NULL,
	"description" text,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_bundle" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"inventory_location_id" uuid NOT NULL,
	"project_id" uuid,
	"project_rap_item_id" uuid,
	"project_cost_id" uuid,
	"vendor_bill_id" uuid,
	"movement_type" varchar(50) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"note" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_cost" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "project_cost" ADD COLUMN "project_rap_item_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD COLUMN "project_rap_item_id" uuid;--> statement-breakpoint
ALTER TABLE "material_inventory" ADD CONSTRAINT "material_inventory_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_inventory" ADD CONSTRAINT "material_inventory_location_id_inventory_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_category_id_material_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_master" ADD CONSTRAINT "material_master_default_vendor_id_vendor_id_fk" FOREIGN KEY ("default_vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap" ADD CONSTRAINT "project_rap_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap" ADD CONSTRAINT "project_rap_locked_by_id_user_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap_item" ADD CONSTRAINT "project_rap_item_project_rap_id_project_rap_id_fk" FOREIGN KEY ("project_rap_id") REFERENCES "public"."project_rap"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rap_item" ADD CONSTRAINT "project_rap_item_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate" ADD CONSTRAINT "rab_estimate_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate" ADD CONSTRAINT "rab_estimate_source_project_rap_id_project_rap_id_fk" FOREIGN KEY ("source_project_rap_id") REFERENCES "public"."project_rap"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rab_estimate_item_rab_estimate_id_rab_estimate_id_fk" FOREIGN KEY ("rab_estimate_id") REFERENCES "public"."rab_estimate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rab_estimate_item" ADD CONSTRAINT "rab_estimate_item_source_project_rap_item_id_project_rap_item_id_fk" FOREIGN KEY ("source_project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_inventory_location_id_inventory_location_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_project_rap_item_id_project_rap_item_id_fk" FOREIGN KEY ("project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_project_cost_id_project_cost_id_fk" FOREIGN KEY ("project_cost_id") REFERENCES "public"."project_cost"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_vendor_bill_id_vendor_bill_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bill"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mi_material_location_uidx" ON "material_inventory" USING btree ("material_id","location_id");--> statement-breakpoint
CREATE INDEX "mi_material_id_idx" ON "material_inventory" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "mi_location_id_idx" ON "material_inventory" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "mm_category_id_idx" ON "material_master" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "mm_default_vendor_id_idx" ON "material_master" USING btree ("default_vendor_id");--> statement-breakpoint
CREATE INDEX "mm_name_idx" ON "material_master" USING btree ("name");--> statement-breakpoint
CREATE INDEX "pr_project_id_idx" ON "project_rap" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pr_locked_by_id_idx" ON "project_rap" USING btree ("locked_by_id");--> statement-breakpoint
CREATE INDEX "pri_project_rap_id_idx" ON "project_rap_item" USING btree ("project_rap_id");--> statement-breakpoint
CREATE INDEX "pri_material_id_idx" ON "project_rap_item" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "pri_status_idx" ON "project_rap_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "re_project_id_idx" ON "rab_estimate" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "re_source_project_rap_id_idx" ON "rab_estimate" USING btree ("source_project_rap_id");--> statement-breakpoint
CREATE INDEX "re_status_idx" ON "rab_estimate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rei_rab_estimate_id_idx" ON "rab_estimate_item" USING btree ("rab_estimate_id");--> statement-breakpoint
CREATE INDEX "rei_source_project_rap_item_id_idx" ON "rab_estimate_item" USING btree ("source_project_rap_item_id");--> statement-breakpoint
CREATE INDEX "sm_material_id_idx" ON "stock_movement" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "sm_location_id_idx" ON "stock_movement" USING btree ("inventory_location_id");--> statement-breakpoint
CREATE INDEX "sm_project_id_idx" ON "stock_movement" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sm_project_rap_item_id_idx" ON "stock_movement" USING btree ("project_rap_item_id");--> statement-breakpoint
CREATE INDEX "sm_project_cost_id_idx" ON "stock_movement" USING btree ("project_cost_id");--> statement-breakpoint
CREATE INDEX "sm_vendor_bill_id_idx" ON "stock_movement" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE INDEX "sm_created_by_id_idx" ON "stock_movement" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "sm_type_idx" ON "stock_movement" USING btree ("movement_type");--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_rap_item_id_project_rap_item_id_fk" FOREIGN KEY ("project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_material_id_material_master_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_rap_item_id_project_rap_item_id_fk" FOREIGN KEY ("project_rap_item_id") REFERENCES "public"."project_rap_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pc_material_id_idx" ON "project_cost" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "pc_project_rap_item_id_idx" ON "project_cost" USING btree ("project_rap_item_id");--> statement-breakpoint
CREATE INDEX "vb_material_id_idx" ON "vendor_bill" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "vb_project_rap_item_id_idx" ON "vendor_bill" USING btree ("project_rap_item_id");