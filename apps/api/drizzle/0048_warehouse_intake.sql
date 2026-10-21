CREATE TABLE "warehouse_intake" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"inventory_location_id" uuid NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"received_at" timestamp NOT NULL,
	"note" text NOT NULL,
	"received_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouse_intake" ADD CONSTRAINT "warehouse_intake_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_intake" ADD CONSTRAINT "warehouse_intake_inventory_location_id_inventory_location_id_fk" FOREIGN KEY ("inventory_location_id") REFERENCES "public"."inventory_location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_intake" ADD CONSTRAINT "warehouse_intake_received_by_id_user_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wi_tenant_reference_uidx" ON "warehouse_intake" USING btree ("tenant_id","reference_number");--> statement-breakpoint
CREATE INDEX "wi_location_idx" ON "warehouse_intake" USING btree ("inventory_location_id");