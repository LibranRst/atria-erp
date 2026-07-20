CREATE TABLE "inventory_opening_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"cutover_date" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"note" text NOT NULL,
	"reference_number" varchar(100),
	"requested_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"posted_at" timestamp,
	"rejected_reason" text,
	"reversed_by_id" uuid,
	"reversed_at" timestamp,
	"reversal_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_opening_batch_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "inventory_opening_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"material_inventory_id" uuid NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"stock_movement_id" uuid,
	"reversal_stock_movement_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" ADD CONSTRAINT "inventory_opening_batch_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" ADD CONSTRAINT "inventory_opening_batch_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_batch" ADD CONSTRAINT "inventory_opening_batch_reversed_by_id_user_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD CONSTRAINT "inventory_opening_item_batch_id_inventory_opening_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_opening_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD CONSTRAINT "inventory_opening_item_material_inventory_id_material_inventory_id_fk" FOREIGN KEY ("material_inventory_id") REFERENCES "public"."material_inventory"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD CONSTRAINT "inventory_opening_item_stock_movement_id_stock_movement_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_opening_item" ADD CONSTRAINT "inventory_opening_item_reversal_stock_movement_id_stock_movement_id_fk" FOREIGN KEY ("reversal_stock_movement_id") REFERENCES "public"."stock_movement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iob_status_idx" ON "inventory_opening_batch" USING btree ("status");--> statement-breakpoint
CREATE INDEX "iob_requested_by_idx" ON "inventory_opening_batch" USING btree ("requested_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ioi_batch_inventory_uidx" ON "inventory_opening_item" USING btree ("batch_id","material_inventory_id");--> statement-breakpoint
CREATE INDEX "ioi_batch_idx" ON "inventory_opening_item" USING btree ("batch_id");