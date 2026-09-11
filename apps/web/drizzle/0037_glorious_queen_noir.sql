CREATE TABLE "user_push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" varchar(20) NOT NULL,
	"token" text,
	"endpoint" text,
	"p256dh" text,
	"auth" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "category" varchar(50) DEFAULT 'INFORMATIONAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "is_resolved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "resolved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "user_push_subscription" ADD CONSTRAINT "user_push_subscription_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_subscription" ADD CONSTRAINT "user_push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_sub_user_idx" ON "user_push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_sub_token_idx" ON "user_push_subscription" USING btree ("token");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notif_user_category_idx" ON "notification" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "notif_ref_idx" ON "notification" USING btree ("reference_type","reference_id");