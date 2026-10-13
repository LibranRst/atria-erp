import { adoptExpenseReceiptTx } from "./expense-receipt-adoption";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, asc } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  auditLog,
  projectCost,
  projectBudgetCategory,
  appConfig,
  materialMaster,
  inventoryLocation,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import {
  APPROVAL_THRESHOLD_CONFIG_KEYS,
  thresholdCentsToRupiah,
} from "@atria/core/finance/approval-thresholds";
import { hasTwoDecimalPrecision, RAP_COST_MAX } from "@atria/core/project/rap-cost";
import {
  submitFieldRequestsSchema,
  type SubmitFieldRequestsInput,
} from "@atria/core/validations/finance";
import { assertExpenseAttachment } from "./expense-attachment";
import { createSubmittedFieldRequestTx } from "@backend/app/actions/finance/field-request-submit";
/** One atomic reviewed group. Every manual/AI path calls this writer. */
export async function submitExpenseBatchTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: SubmitFieldRequestsInput,
  groupId = randomUUID(),
): Promise<(typeof projectCost.$inferSelect)[]> {
  const input = submitFieldRequestsSchema.parse(raw);
  assertFinancePermission(actor, "create:cost");
  if (input.items.length > 50) throw new Error("EXPENSE_BATCH_LIMIT");
  const project = await lockFinanceProject(tx, actor, input.projectId);
  if (project.tenantId !== INSTANCE_TENANT_ID) throw new Error("FORBIDDEN: Proyek tidak tersedia.");
  assertProjectStatusIsOperational(project.status);
  await assertExpenseAttachment(actor, input.projectId, input.receiptImageUrl, undefined, tx);
  const receiptImageUrl = await adoptExpenseReceiptTx(
    tx,
    actor,
    input.projectId,
    input.receiptImageUrl,
  );
  await tx
    .select()
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        eq(appConfig.key, APPROVAL_THRESHOLD_CONFIG_KEYS.fieldCost),
      ),
    )
    .for("update");
  const threshold = thresholdCentsToRupiah((await readApprovalThresholds(tx)).fieldCostCents);
  const categoryIds = [...new Set(input.items.map((i) => i.projectBudgetCategoryId))].sort();
  await tx
    .select()
    .from(projectBudgetCategory)
    .where(inArray(projectBudgetCategory.id, categoryIds))
    .orderBy(asc(projectBudgetCategory.id))
    .for("update");
  for (const item of input.items) {
    if (
      !Number.isFinite(item.amount) ||
      item.amount > RAP_COST_MAX ||
      !hasTwoDecimalPrecision(item.amount) ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice > RAP_COST_MAX ||
      !hasTwoDecimalPrecision(item.unitPrice) ||
      !hasTwoDecimalPrecision(item.quantity) ||
      item.quantity > 999999999
    )
      throw new Error("EXPENSE_AMOUNT_INVALID");
    if (item.stockHandling !== "EXPENSE_ONLY") {
      assertFinancePermission(actor, "create:stock_movement");
      if (
        !item.materialId ||
        !item.inventoryLocationId ||
        Math.abs(Math.round(item.quantity * item.unitPrice * 100) / 100 - item.amount) > 0.001
      )
        throw new Error("EXPENSE_STOCK_VALUES_INVALID");
      const m = await tx.query.materialMaster.findFirst({
        where: and(
          eq(materialMaster.id, item.materialId),
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          eq(materialMaster.isActive, true),
        ),
      });
      const l = await tx.query.inventoryLocation.findFirst({
        where: and(
          eq(inventoryLocation.id, item.inventoryLocationId),
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryLocation.isActive, true),
        ),
      });
      if (!m || !l) throw new Error("EXPENSE_STOCK_REFERENCE_INVALID");
    }
  }
  if (
    input.items.reduce((sum, item) => sum + BigInt(Math.round(item.amount * 100)), 0n) >
    BigInt(Math.round(RAP_COST_MAX * 100))
  )
    throw new Error("EXPENSE_AMOUNT_INVALID");
  const costs: (typeof projectCost.$inferSelect)[] = [];
  for (const item of input.items) {
    const cost = await createSubmittedFieldRequestTx(tx, {
      projectId: input.projectId,
      requestedById: actor.userId,
      receiptImageUrl,
      receiptGroupId: groupId,
      item,
      includeApprovalCategoryLabel: true,
      ownerApprovalThreshold: threshold,
    });
    costs.push(cost);
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "SUBMIT_FIELD_REQUEST",
      targetTable: "project_cost",
      targetId: cost.id,
      newState: JSON.stringify(cost),
    });
  }
  return costs;
}
