UPDATE "cash_transaction"
SET "type" = 'INFLOW'
WHERE "type" = 'DEBIT';
--> statement-breakpoint
UPDATE "cash_transaction"
SET "type" = 'OUTFLOW'
WHERE "type" = 'CREDIT';
--> statement-breakpoint
UPDATE "bank_statement_row"
SET "type" = 'INFLOW'
WHERE "type" = 'DEBIT';
--> statement-breakpoint
UPDATE "bank_statement_row"
SET "type" = 'OUTFLOW'
WHERE "type" = 'CREDIT';
