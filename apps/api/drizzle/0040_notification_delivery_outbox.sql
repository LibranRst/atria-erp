CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"notification_id" uuid NOT NULL,
	"push_subscription_id" uuid NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"receipt_attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp,
	"provider_ticket_id" varchar(255),
	"last_error" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "user_push_subscription" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_push_subscription_id_user_push_subscription_id_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."user_push_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notif_delivery_notification_subscription_uidx" ON "notification_delivery" USING btree ("notification_id","push_subscription_id");--> statement-breakpoint
CREATE INDEX "notif_delivery_due_idx" ON "notification_delivery" USING btree ("tenant_id","status","next_attempt_at","id");--> statement-breakpoint
CREATE INDEX "notif_delivery_ticket_idx" ON "notification_delivery" USING btree ("provider_ticket_id");--> statement-breakpoint
ALTER TABLE "ai_conversation" ADD CONSTRAINT "ai_conversation_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_subscription" ADD CONSTRAINT "user_push_subscription_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_sub_session_idx" ON "user_push_subscription" USING btree ("session_id");