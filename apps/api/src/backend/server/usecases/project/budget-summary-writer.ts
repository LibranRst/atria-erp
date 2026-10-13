import { db } from "@backend/db";
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  auditLog,
  vendorBill,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { readBudgetCategorySourceTx } from "@backend/lib/budget/budget-sync";
import { budgetUsageSummary } from "@atria/core/budget/usage-summary";
import {
  budgetSyncProposalSchema,
  budgetSummaryChanges,
  type BudgetSyncProposal,
} from "@atria/core/ai/budget-sync";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

export class BudgetSummaryError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertBudgetSummaryRights(actor: Actor, write = false): void {
  if (
    !actor.isActive ||
    !["GLOBAL", "ASSIGNED"].includes(actor.dataScope) ||
    !actorCan(actor, "view:project") ||
    !actorCan(actor, "view:budget") ||
    (write && !actorCan(actor, "update:budget"))
  )
    throw new BudgetSummaryError(
      "FORBIDDEN",
      "Akses pemeriksaan atau sinkronisasi budget tidak tersedia.",
    );
}
/** Same project → budget → ordered-category lock order for inspection and explicit manual/AI repairs. */
export async function inspectBudgetSummaryTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
): Promise<BudgetSyncProposal> {
  assertBudgetSummaryRights(actor);
  const [p] = await tx
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!p || (actor.dataScope === "ASSIGNED" && p.projectManagerId !== actor.userId))
    throw new BudgetSummaryError("FORBIDDEN", "Proyek di luar akses Anda.");
  const [budget] = await tx
    .select()
    .from(projectBudgets)
    .where(and(eq(projectBudgets.projectId, p.id), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!budget)
    throw new BudgetSummaryError(
      "NOT_FOUND",
      "Budget proyek belum dibuat. Siapkan budget sebelum memeriksa ringkasannya.",
    );
  const categories = await tx
    .select()
    .from(projectBudgetCategory)
    .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
    .orderBy(asc(projectBudgetCategory.id))
    .for("update");
  if (!categories.length || categories.length > 100)
    throw new BudgetSummaryError(
      "CONFLICT",
      "Kategori budget tidak lengkap atau jumlahnya tidak didukung. Periksa budget proyek.",
    );
  const rows: BudgetSyncProposal["categories"] = [],
    source: unknown[] = [p, budget];
  for (const c of categories) {
    const category = await tx.query.expenseCategory.findFirst({
      where: eq(expenseCategory.id, c.expenseCategoryId),
    });
    if (c.tenantId !== INSTANCE_TENANT_ID || category?.tenantId !== INSTANCE_TENANT_ID)
      throw new BudgetSummaryError(
        "CONFLICT",
        "Referensi kategori budget tidak valid. Periksa budget proyek.",
      );
    const usage = await readBudgetCategorySourceTx(tx, c.id);
    if (
      usage.expenses.some(
        (e) =>
          e.tenantId !== INSTANCE_TENANT_ID ||
          e.projectId !== p.id ||
          e.projectBudgetId !== budget.id ||
          e.expenseCategoryId !== c.expenseCategoryId,
      ) ||
      usage.payments.some((e) => e.tenantId !== INSTANCE_TENANT_ID)
    )
      throw new BudgetSummaryError(
        "CONFLICT",
        "Referensi pengeluaran tidak sesuai proyek. Periksa transaksi sebelum sinkronisasi.",
      );
    const billSources: unknown[] = [];
    for (const billId of new Set(
      usage.expenses.flatMap((e) => (e.vendorBillId ? [e.vendorBillId] : [])),
    )) {
      const bill = await tx.query.vendorBill.findFirst({ where: eq(vendorBill.id, billId) });
      if (!bill || bill.tenantId !== INSTANCE_TENANT_ID || bill.projectId !== p.id)
        throw new BudgetSummaryError(
          "CONFLICT",
          "Referensi tagihan tidak sesuai proyek. Periksa tagihan sebelum sinkronisasi.",
        );
      billSources.push(bill);
    }
    source.push(c, category, usage, billSources);
    rows.push({
      id: c.id,
      name: ["MATERIAL", "TUKANG", "OPERASIONAL", "LAIN_LAIN", "SUBCON"].includes(category.code)
        ? formatBusinessLabel(category.code)
        : category.name,
      allocatedAmount: fromCents(parseNumericToCents(c.allocatedAmount)),
      before: {
        pendingAmount: c.pendingAmount,
        actualAmount: c.actualAmount,
        paidAmount: c.paidAmount,
        remainingAmount: c.remainingAmount,
        usedPercentage: c.usedPercentage,
        status:
          c.status === "SAFE" ||
          c.status === "WATCH" ||
          c.status === "CRITICAL" ||
          c.status === "OVER_BUDGET"
            ? c.status
            : "SAFE",
      },
      after: budgetUsageSummary(c.allocatedAmount, usage),
    });
    if (!["SAFE", "WATCH", "CRITICAL", "OVER_BUDGET"].includes(c.status))
      throw new BudgetSummaryError(
        "CONFLICT",
        "Kondisi kategori budget tidak valid. Periksa budget proyek.",
      );
  }
  const order = new Map(categories.map((c) => [c.id, c.sortOrder]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) || a.id.localeCompare(b.id));
  return budgetSyncProposalSchema.parse({
    kind: "BUDGET_SYNC",
    input: { projectId },
    projectBudgetId: budget.id,
    projectName: p.name,
    internalBudget: fromCents(parseNumericToCents(budget.internalBudget)),
    categories: rows,
    expectedContext: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
  });
}
export async function writeBudgetSummaryTx(
  tx: FinanceTransaction,
  actor: Actor,
  proposal: BudgetSyncProposal,
): Promise<void> {
  assertBudgetSummaryRights(actor, true);
  const changed = proposal.categories.filter((c) => budgetSummaryChanges(c).length > 0);
  if (!changed.length) return;
  for (const c of changed)
    await tx
      .update(projectBudgetCategory)
      .set({ ...c.after, updatedAt: new Date() })
      .where(eq(projectBudgetCategory.id, c.id));
  const verified = await inspectBudgetSummaryTx(tx, actor, proposal.input.projectId);
  if (verified.categories.some((c) => budgetSummaryChanges(c).length))
    throw new BudgetSummaryError(
      "CONFLICT",
      "Hasil sinkronisasi belum sesuai. Tidak ada perubahan yang disimpan.",
    );
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "SYNC_PROJECT_BUDGET_SUMMARY",
    targetTable: "project_budgets",
    targetId: proposal.projectBudgetId,
    originalState: JSON.stringify(changed.map((c) => ({ id: c.id, summary: c.before }))),
    newState: JSON.stringify(changed.map((c) => ({ id: c.id, summary: c.after }))),
  });
}

export async function inspectBudgetSummary(
  actor: Actor,
  projectId: string,
): Promise<BudgetSyncProposal> {
  return db.transaction((tx) => inspectBudgetSummaryTx(tx, actor, projectId));
}
