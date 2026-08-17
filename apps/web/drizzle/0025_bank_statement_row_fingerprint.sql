ALTER TABLE "bank_statement_row" ADD COLUMN "fingerprint" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "bsr_fingerprint_uidx" ON "bank_statement_row" USING btree ("fingerprint");