ALTER TABLE "project_cost" DROP CONSTRAINT "project_cost_project_budget_item_id_project_budget_item_id_fk";
--> statement-breakpoint
ALTER TABLE "project_cost" DROP CONSTRAINT "project_cost_project_budget_category_id_project_budget_category_id_fk";
--> statement-breakpoint
ALTER TABLE "vendor_bill" DROP CONSTRAINT "vendor_bill_project_budget_item_id_project_budget_item_id_fk";
--> statement-breakpoint
ALTER TABLE "vendor_bill" DROP CONSTRAINT "vendor_bill_project_budget_category_id_project_budget_category_id_fk";
--> statement-breakpoint
ALTER TABLE "project_cost" ALTER COLUMN "project_budget_item_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "project_cost" AS pc
SET "project_budget_category_id" = pbc."id"
FROM "project_budget_item" AS pbi
INNER JOIN "project_budget" AS pb ON pb."id" = pbi."project_budget_id"
INNER JOIN "project_budgets" AS pbs ON pbs."project_id" = pb."project_id"
INNER JOIN "project_cost_category" AS pcc ON pcc."id" = pbi."cost_category_id"
INNER JOIN "expense_category" AS ec ON ec."code" = CASE
  WHEN pcc."name" = 'MATERIAL' THEN 'MATERIAL'
  WHEN pcc."name" = 'OPERATIONAL' THEN 'OPERASIONAL'
  ELSE 'LAIN_LAIN'
END
INNER JOIN "project_budget_category" AS pbc ON pbc."project_budget_id" = pbs."id" AND pbc."expense_category_id" = ec."id"
WHERE pc."project_budget_category_id" IS NULL
  AND pc."project_budget_item_id" = pbi."id";--> statement-breakpoint
UPDATE "project_cost" AS pc
SET "project_budget_category_id" = pbc."id"
FROM "project_budgets" AS pbs
INNER JOIN "expense_category" AS ec ON ec."code" = 'LAIN_LAIN'
INNER JOIN "project_budget_category" AS pbc ON pbc."project_budget_id" = pbs."id" AND pbc."expense_category_id" = ec."id"
WHERE pc."project_budget_category_id" IS NULL
  AND pc."project_id" = pbs."project_id";--> statement-breakpoint
ALTER TABLE "project_cost" ALTER COLUMN "project_budget_category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_bill" ALTER COLUMN "project_budget_item_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "vendor_bill" AS vb
SET "project_budget_category_id" = pbc."id"
FROM "project_budget_item" AS pbi
INNER JOIN "project_budget" AS pb ON pb."id" = pbi."project_budget_id"
INNER JOIN "project_budgets" AS pbs ON pbs."project_id" = pb."project_id"
INNER JOIN "project_cost_category" AS pcc ON pcc."id" = pbi."cost_category_id"
INNER JOIN "expense_category" AS ec ON ec."code" = CASE
  WHEN pcc."name" = 'MATERIAL' THEN 'MATERIAL'
  WHEN pcc."name" = 'OPERATIONAL' THEN 'OPERASIONAL'
  ELSE 'LAIN_LAIN'
END
INNER JOIN "project_budget_category" AS pbc ON pbc."project_budget_id" = pbs."id" AND pbc."expense_category_id" = ec."id"
WHERE vb."project_budget_category_id" IS NULL
  AND vb."project_budget_item_id" = pbi."id";--> statement-breakpoint
UPDATE "vendor_bill" AS vb
SET "project_budget_category_id" = pbc."id"
FROM "project_budgets" AS pbs
INNER JOIN "expense_category" AS ec ON ec."code" = 'LAIN_LAIN'
INNER JOIN "project_budget_category" AS pbc ON pbc."project_budget_id" = pbs."id" AND pbc."expense_category_id" = ec."id"
WHERE vb."project_budget_category_id" IS NULL
  AND vb."project_id" = pbs."project_id";--> statement-breakpoint
ALTER TABLE "vendor_bill" ALTER COLUMN "project_budget_category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD COLUMN "pending_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_budget_category" ADD COLUMN "paid_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_budget_item_id_project_budget_item_id_fk" FOREIGN KEY ("project_budget_item_id") REFERENCES "public"."project_budget_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_budget_item_id_project_budget_item_id_fk" FOREIGN KEY ("project_budget_item_id") REFERENCES "public"."project_budget_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_budget_category_id_project_budget_category_id_fk" FOREIGN KEY ("project_budget_category_id") REFERENCES "public"."project_budget_category"("id") ON DELETE restrict ON UPDATE no action;
