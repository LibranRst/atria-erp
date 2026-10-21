CREATE TABLE IF NOT EXISTS "form_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"form_type" varchar(50) NOT NULL,
	"project_id" uuid,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"last_saved_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"submission_group_id" uuid,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_draft" ADD CONSTRAINT "form_draft_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_draft" ADD CONSTRAINT "form_draft_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_draft_owner_status_idx" ON "form_draft" USING btree ("owner_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_draft_project_idx" ON "form_draft" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_draft_expiry_idx" ON "form_draft" USING btree ("status", "expires_at");
