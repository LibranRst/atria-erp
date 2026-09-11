CREATE TABLE "notification_condition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"key" varchar(255) NOT NULL,
	"stage" varchar(100) DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "required_permission" varchar(100);--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "event_key" varchar(255);--> statement-breakpoint
ALTER TABLE "notification_condition" ADD CONSTRAINT "notification_condition_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_condition_key_uidx" ON "notification_condition" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_event_recipient_uidx" ON "notification" USING btree ("tenant_id","user_id","event_key");--> statement-breakpoint
CREATE INDEX "notif_feed_idx" ON "notification" USING btree ("tenant_id","user_id","category","is_resolved","created_at","id");--> statement-breakpoint
INSERT INTO "notification_condition" ("tenant_id", "key")
VALUES ('00000000-0000-4000-8000-000000000001', 'scheduler')
ON CONFLICT ("tenant_id", "key") DO NOTHING;--> statement-breakpoint
UPDATE "notification" SET "read_at" = "created_at" WHERE "read" = true;
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = c."project_id", "required_permission" = 'view:cost' FROM "project_cost" c WHERE n."reference_type" = 'project_cost' AND n."reference_id" = c."id" AND n."tenant_id" = c."tenant_id";
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = b."project_id", "required_permission" = 'view:vendor_bill' FROM "vendor_bill" b WHERE n."reference_type" = 'vendor_bill' AND n."reference_id" = b."id" AND n."tenant_id" = b."tenant_id";
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = b."project_id", "required_permission" = 'view:vendor_bill' FROM "vendor_payment" p JOIN "vendor_bill" b ON b."id" = p."vendor_bill_id" WHERE n."reference_type" = 'vendor_payment' AND n."reference_id" = p."id" AND n."tenant_id" = b."tenant_id";
--> statement-breakpoint
UPDATE "notification" n SET "reference_type" = 'vendor_payment' FROM "vendor_payment" p WHERE n."reference_type" = 'vendor_bill' AND n."reference_id" = p."id";
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = g."project_id", "required_permission" = 'view:material' FROM "goods_receipt" g WHERE n."reference_type" = 'goods_receipt' AND n."reference_id" = g."id" AND n."tenant_id" = g."tenant_id";
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = i."project_id", "required_permission" = 'view:client_invoice' FROM "client_invoice" i WHERE n."reference_type" = 'client_invoice' AND n."reference_id" = i."id" AND n."tenant_id" = i."tenant_id";
--> statement-breakpoint
UPDATE "notification" n SET "project_id" = i."project_id", "required_permission" = 'view:client_invoice' FROM "client_payment" p JOIN "client_invoice" i ON i."id" = p."client_invoice_id" WHERE n."reference_type" = 'client_payment' AND n."reference_id" = p."id" AND n."tenant_id" = i."tenant_id";
--> statement-breakpoint
UPDATE "notification" SET "is_resolved" = true, "resolved_at" = now(), "read" = true, "read_at" = now() WHERE "category" = 'ACTION_REQUIRED' AND "event_key" IS NULL;
