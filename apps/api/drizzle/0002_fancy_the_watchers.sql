ALTER TABLE "project_budget_item" ADD COLUMN "quantity" numeric(12, 2) DEFAULT '1.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD COLUMN "unit" varchar(50) DEFAULT 'm2' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD COLUMN "unit_price" numeric(15, 2) DEFAULT '0.00' NOT NULL;