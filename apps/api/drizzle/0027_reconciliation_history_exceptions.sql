ALTER TABLE "cash_transaction" ADD COLUMN "reconciliation_exception_reason" text;
--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD COLUMN "reconciliation_exception_at" timestamp;
--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD COLUMN "reconciliation_exception_by_id" uuid;
--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_reconciliation_exception_by_id_user_id_fk" FOREIGN KEY ("reconciliation_exception_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ct_reconciliation_exception_at_idx" ON "cash_transaction" USING btree ("reconciliation_exception_at");
