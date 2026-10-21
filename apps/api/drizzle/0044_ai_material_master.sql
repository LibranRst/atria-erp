CREATE TABLE "material_import_analysis_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"tool_call_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'QUEUED' NOT NULL,
	"attachment_urls" jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extracted" integer DEFAULT 0 NOT NULL,
	"page_cursor" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp,
	"error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "material_import_analysis_job" ADD CONSTRAINT "material_import_analysis_job_draft_id_form_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."form_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_import_analysis_job" ADD CONSTRAINT "material_import_analysis_job_conversation_id_ai_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_import_analysis_job" ADD CONSTRAINT "material_import_analysis_job_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_analysis_proposal_uidx" ON "material_import_analysis_job" USING btree ("conversation_id","tool_call_id");--> statement-breakpoint
CREATE INDEX "material_analysis_due_idx" ON "material_import_analysis_job" USING btree ("status","next_attempt_at");
--> statement-breakpoint
INSERT INTO "role_permission" ("role_id", "permission_key")
SELECT "id", 'use:ai_chat' FROM "role" WHERE "name" = 'PURCHASING'
ON CONFLICT ("role_id", "permission_key") DO NOTHING;
