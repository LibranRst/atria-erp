ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "temporary_password_issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendor" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
