CREATE TABLE "onboarding_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"step_id" varchar(50),
	"readiness_item_id" varchar(50),
	"outcome" varchar(30) DEFAULT 'SUCCESS' NOT NULL,
	"error_code" varchar(50),
	"duration_ms" integer,
	"idempotency_key" varchar(160),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "project_manager_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_event" ADD CONSTRAINT "onboarding_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_event" ADD CONSTRAINT "onboarding_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_event_idempotency_uidx" ON "onboarding_event" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "onboarding_event_actor_idx" ON "onboarding_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "onboarding_event_type_idx" ON "onboarding_event" USING btree ("tenant_id","event_type","created_at");