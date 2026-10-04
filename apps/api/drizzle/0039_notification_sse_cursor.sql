ALTER TABLE "notification" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "notif_stream_cursor_idx" ON "notification" USING btree ("tenant_id","user_id","updated_at","id");
