import type { db } from "@backend/db";
import {
  expenseCategory,
  projectBudgetCategory,
  projectBudgets,
  projectCost,
  projectExpenses,
  projectRap,
  projectRapItem,
  stockMovement,
  vendorBill,
} from "@backend/db/schema";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import { and, eq, inArray, isNull } from "drizzle-orm";

export type StockLinkTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StockMovementLinks = {
  readonly materialId?: string | null;
  readonly projectId?: string | null;
  readonly projectRapItemId?: string | null;
  readonly projectCostId?: string | null;
  readonly vendorBillId?: string | null;
};
export type ValidatedStockLinks = {
  readonly cost: typeof projectCost.$inferSelect | null;
  readonly costExpense: typeof projectExpenses.$inferSelect | null;
  readonly declaredCostMaterialId: string | null;
};

async function materialCategory(
  tx: StockLinkTransaction,
  categoryId: string,
  projectId: string,
): Promise<string> {
  const [category] = await tx
    .select({
      code: expenseCategory.code,
      expenseCategoryId: expenseCategory.id,
      projectId: projectBudgets.projectId,
    })
    .from(projectBudgetCategory)
    .innerJoin(projectBudgets, eq(projectBudgets.id, projectBudgetCategory.projectBudgetId))
    .innerJoin(expenseCategory, eq(expenseCategory.id, projectBudgetCategory.expenseCategoryId))
    .where(eq(projectBudgetCategory.id, categoryId));
  if (!category || category.projectId !== projectId || category.code !== "MATERIAL")
    throw new Error("STOCK_LINK_MATERIAL_CATEGORY_REQUIRED");
  return category.expenseCategoryId;
}
async function rapMaterial(
  tx: StockLinkTransaction,
  rapItemId: string,
  projectId: string,
  materialId: string | null | undefined,
): Promise<string | null> {
  const [item] = await tx
    .select({ materialId: projectRapItem.materialId, projectId: projectRap.projectId })
    .from(projectRapItem)
    .innerJoin(projectRap, eq(projectRap.id, projectRapItem.projectRapId))
    .where(eq(projectRapItem.id, rapItemId))
    .for("update");
  if (
    !item ||
    item.projectId !== projectId ||
    (materialId && item.materialId && item.materialId !== materialId)
  )
    throw new Error("STOCK_LINK_RAP_MISMATCH");
  return item.materialId;
}

/** Locks financial references before RAP references, consistently with goods receipt. */
export async function validateStockMovementLinksTx(
  tx: StockLinkTransaction,
  input: StockMovementLinks,
): Promise<ValidatedStockLinks> {
  if (!input.projectRapItemId && !input.projectCostId && !input.vendorBillId)
    return { cost: null, costExpense: null, declaredCostMaterialId: null };
  if (!input.projectId) throw new Error("STOCK_LINK_PROJECT_REQUIRED");
  const bill = input.vendorBillId
    ? (
        await tx
          .select()
          .from(vendorBill)
          .where(eq(vendorBill.id, input.vendorBillId))
          .for("update")
      )[0]
    : undefined;
  const cost = input.projectCostId
    ? (
        await tx
          .select()
          .from(projectCost)
          .where(eq(projectCost.id, input.projectCostId))
          .for("update")
      )[0]
    : undefined;
  if (input.vendorBillId && (!bill || bill.projectId !== input.projectId))
    throw new Error("STOCK_LINK_BILL_PROJECT_MISMATCH");
  if (input.projectCostId && (!cost || cost.projectId !== input.projectId))
    throw new Error("STOCK_LINK_COST_PROJECT_MISMATCH");
  let costExpense: typeof projectExpenses.$inferSelect | null = null;
  if (cost) {
    const categoryId = await materialCategory(tx, cost.projectBudgetCategoryId, input.projectId);
    if (input.materialId && cost.materialId && cost.materialId !== input.materialId)
      throw new Error("STOCK_LINK_COST_MATERIAL_MISMATCH");
    if (
      cost.projectRapItemId &&
      input.projectRapItemId &&
      cost.projectRapItemId !== input.projectRapItemId
    )
      throw new Error("STOCK_LINK_COST_RAP_MISMATCH");
    costExpense =
      (
        await tx
          .select()
          .from(projectExpenses)
          .where(eq(projectExpenses.legacyProjectCostId, cost.id))
          .for("update")
      )[0] ?? null;
    if (
      costExpense &&
      (costExpense.projectId !== input.projectId ||
        costExpense.projectBudgetCategoryId !== cost.projectBudgetCategoryId ||
        costExpense.expenseCategoryId !== categoryId ||
        (input.materialId &&
          costExpense.materialId &&
          costExpense.materialId !== input.materialId) ||
        (costExpense.projectRapItemId &&
          input.projectRapItemId &&
          costExpense.projectRapItemId !== input.projectRapItemId) ||
        (costExpense.projectRapItemId &&
          cost.projectRapItemId &&
          costExpense.projectRapItemId !== cost.projectRapItemId))
    )
      throw new Error("STOCK_LINK_CANONICAL_COST_MISMATCH");
  }
  if (bill) {
    await materialCategory(tx, bill.projectBudgetCategoryId, input.projectId);
    if (input.materialId && bill.materialId && bill.materialId !== input.materialId)
      throw new Error("STOCK_LINK_BILL_MATERIAL_MISMATCH");
    if (
      bill.projectRapItemId &&
      input.projectRapItemId &&
      bill.projectRapItemId !== input.projectRapItemId
    )
      throw new Error("STOCK_LINK_BILL_RAP_MISMATCH");
  }
  const rapIds = new Set(
    [
      input.projectRapItemId,
      cost?.projectRapItemId,
      costExpense?.projectRapItemId,
      bill?.projectRapItemId,
    ].filter((id): id is string => Boolean(id)),
  );
  const rapMaterials = new Map<string, string | null>();
  for (const id of [...rapIds].sort())
    rapMaterials.set(id, await rapMaterial(tx, id, input.projectId, input.materialId));
  const declaredCostMaterialId =
    cost?.materialId ??
    costExpense?.materialId ??
    (cost?.projectRapItemId ? rapMaterials.get(cost.projectRapItemId) : null) ??
    (costExpense?.projectRapItemId ? rapMaterials.get(costExpense.projectRapItemId) : null) ??
    null;
  return { cost: cost ?? null, costExpense, declaredCostMaterialId };
}

export function linkedCostConsumesBudget(links: ValidatedStockLinks): boolean {
  return Boolean(
    links.cost &&
    links.costExpense &&
    ["APPROVED", "PAID"].includes(links.cost.status) &&
    ["APPROVED", "PAID"].includes(links.costExpense.status),
  );
}

export type StockCostAttribution = { readonly amount: number; readonly quantity: number };
/** Prevent one legitimate expense link from suppressing unlimited stock consumption. */
export async function stockCostAttributionTx(
  tx: StockLinkTransaction,
  links: ValidatedStockLinks,
  operation: {
    readonly movementType: "USE" | "WASTE" | "RETURN";
    readonly materialId: string;
    readonly quantity: number;
    readonly unitCost: number;
  },
): Promise<StockCostAttribution> {
  const movementValue = parseNumericToCents((operation.quantity * operation.unitCost).toFixed(2));
  if (!links.cost)
    return {
      amount: Number(
        fromCents(operation.movementType === "RETURN" ? -movementValue : movementValue),
      ),
      quantity: operation.movementType === "RETURN" ? -operation.quantity : operation.quantity,
    };
  const expense = links.costExpense;
  if (!expense || !linkedCostConsumesBudget(links)) throw new Error("STOCK_LINK_COST_NOT_CONSUMED");
  if (operation.movementType !== "RETURN") {
    const unlinked = await tx.query.stockMovement.findMany({
      where: and(
        eq(stockMovement.projectId, links.cost.projectId),
        eq(stockMovement.materialId, operation.materialId),
        isNull(stockMovement.projectCostId),
      ),
    });
    const ids = unlinked.map((movement) => movement.id);
    const unassignedAdjustments = ids.length
      ? await tx.query.projectExpenses.findMany({
          where: and(
            inArray(projectExpenses.stockMovementId, ids),
            inArray(projectExpenses.sourceType, ["STOCK_USAGE", "STOCK_RETURN", "STOCK_WASTE"]),
            inArray(projectExpenses.status, ["APPROVED", "PAID"]),
          ),
        })
      : [];
    const unassignedValue = unassignedAdjustments.reduce(
      (sum, row) => sum + parseNumericToCents(row.amount),
      BigInt(0),
    );
    // An unlinked return may have credited this expense. Without a source link,
    // suppressing a subsequent debit cannot be proved safe; ordinary warehouse use still books it.
    if (unassignedValue < BigInt(0)) throw new Error("STOCK_LINK_UNASSIGNED_RETURN_CREDIT");
  }
  const movements = await tx.query.stockMovement.findMany({
    where: eq(stockMovement.projectCostId, links.cost.id),
  });
  let usedQuantity = BigInt(0);
  let coveredQuantity = BigInt(0);
  let coveredValue = BigInt(0);
  for (const movement of movements) {
    if (!["USE", "WASTE", "RETURN"].includes(movement.movementType)) continue;
    const quantity = parseNumericToCents(movement.quantity);
    const value = parseNumericToCents(
      (Number(movement.quantity) * Number(movement.unitCost)).toFixed(2),
    );
    const sign = movement.movementType === "RETURN" ? BigInt(-1) : BigInt(1);
    coveredQuantity += quantity * sign;
    coveredValue += value * sign;
    if (movement.movementType !== "WASTE") usedQuantity += quantity * sign;
  }
  if (usedQuantity < BigInt(0) || coveredQuantity < BigInt(0) || coveredValue < BigInt(0))
    throw new Error("STOCK_LINK_COST_HISTORY_INVALID");
  const quantity = parseNumericToCents(operation.quantity.toFixed(2));
  const fundingValue = parseNumericToCents(expense.amount);
  if (operation.movementType === "RETURN") {
    if (quantity > usedQuantity || movementValue > coveredValue)
      throw new Error("STOCK_LINK_RETURN_EXCEEDS_COST_USAGE");
    return { amount: -Number(fromCents(movementValue)), quantity: -operation.quantity };
  }
  if (
    (links.declaredCostMaterialId &&
      coveredQuantity + quantity > parseNumericToCents(links.cost.quantity)) ||
    coveredValue + movementValue > fundingValue
  )
    throw new Error("STOCK_LINK_COST_COVERAGE_EXCEEDED");
  const ids = movements.map((movement) => movement.id);
  const adjustments = ids.length
    ? await tx.query.projectExpenses.findMany({
        where: and(
          inArray(projectExpenses.stockMovementId, ids),
          inArray(projectExpenses.sourceType, ["STOCK_USAGE", "STOCK_RETURN", "STOCK_WASTE"]),
          inArray(projectExpenses.status, ["APPROVED", "PAID"]),
        ),
      })
    : [];
  const delta = adjustments.reduce((sum, row) => sum + parseNumericToCents(row.amount), BigInt(0));
  const returnedCredit = delta < BigInt(0) ? -delta : BigInt(0);
  // A return credited cost already counted by the expense; using that stock again restores the credit.
  const restore = returnedCredit < movementValue ? returnedCredit : movementValue;
  const amount = Number(fromCents(restore));
  return { amount, quantity: operation.unitCost > 0 ? amount / operation.unitCost : 0 };
}

const linkMessages: Readonly<Record<string, string>> = {
  STOCK_LINK_PROJECT_REQUIRED: "Pilih proyek untuk tautan biaya, RAP, atau tagihan material.",
  STOCK_LINK_MATERIAL_CATEGORY_REQUIRED:
    "Tautan stok hanya boleh menggunakan kategori Material dari proyek yang sama.",
  STOCK_LINK_COST_PROJECT_MISMATCH:
    "Pengeluaran tertaut tidak ditemukan atau berasal dari proyek lain.",
  STOCK_LINK_BILL_PROJECT_MISMATCH:
    "Tagihan tertaut tidak ditemukan atau berasal dari proyek lain.",
  STOCK_LINK_COST_MATERIAL_MISMATCH: "Material tidak sesuai dengan pengeluaran tertaut.",
  STOCK_LINK_BILL_MATERIAL_MISMATCH: "Material tidak sesuai dengan tagihan tertaut.",
  STOCK_LINK_RAP_MISMATCH: "Item RAP tidak sesuai dengan proyek atau material yang dipilih.",
  STOCK_LINK_COST_RAP_MISMATCH: "Item RAP tidak sesuai dengan pengeluaran tertaut.",
  STOCK_LINK_BILL_RAP_MISMATCH: "Item RAP tidak sesuai dengan tagihan tertaut.",
  STOCK_LINK_CANONICAL_COST_MISMATCH:
    "Rincian pengeluaran tertaut tidak konsisten. Minta Finance memeriksanya.",
  STOCK_LINK_COST_NOT_CONSUMED:
    "Gunakan pengeluaran Material yang sudah disetujui dan tercatat sebagai realisasi.",
  STOCK_LINK_COST_HISTORY_INVALID:
    "Riwayat pemakaian pengeluaran ini perlu diperiksa Finance sebelum ditautkan kembali.",
  STOCK_LINK_RETURN_EXCEEDS_COST_USAGE:
    "Jumlah atau nilai pengembalian melebihi pemakaian pengeluaran tertaut.",
  STOCK_LINK_COST_COVERAGE_EXCEEDED:
    "Pemakaian melebihi jumlah atau nilai pengeluaran tertaut. Gunakan pengeluaran yang sesuai.",
  STOCK_LINK_UNASSIGNED_RETURN_CREDIT:
    "Ada kredit retur tanpa tautan pengeluaran. Gunakan pemakaian gudang biasa atau minta Finance memeriksa sumber biayanya.",
};
export function stockLinkValidationMessage(reason: string): string | null {
  return linkMessages[reason] ?? null;
}
