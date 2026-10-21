import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  project,
  projectBudgets,
  projectBudgetCategory,
  projectExpenses,
  cashTransaction,
  stockMovement,
  bankAccount,
  vendorPayment,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  auditLog,
  aiProposalConfirmation,
} from "../src/backend/db/schema";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable database only.");
const f = z
  .object({
    conversationId: z.string().guid(),
    drift: z.object({ projectId: z.string().guid(), budgetId: z.string().guid() }),
  })
  .parse(JSON.parse(readFileSync("/tmp/atria-budget-sync-preview-fixture.json", "utf8")));
const [p, b, c, e, cash, stock, bank, pay, settings, allocation] = await Promise.all([
  db.select().from(project).where(eq(project.id, f.drift.projectId)),
  db.select().from(projectBudgets).where(eq(projectBudgets.id, f.drift.budgetId)),
  db
    .select()
    .from(projectBudgetCategory)
    .where(eq(projectBudgetCategory.projectBudgetId, f.drift.budgetId)),
  db.select().from(projectExpenses).where(eq(projectExpenses.projectId, f.drift.projectId)),
  db.select().from(cashTransaction),
  db.select().from(stockMovement),
  db.select().from(bankAccount),
  db.select().from(vendorPayment),
  db.select().from(budgetAllocationSetting),
  db.select().from(budgetAllocationSettingCategory),
]);
function hash(v: unknown): string {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
// UPDATE changes physical row order in PostgreSQL. Align category identities with
// the saved baseline before hashing immutable allocation fields; values stay live.
const baseline = process.env.ATRIA_BUDGET_SYNC_BASELINE;
if (baseline && baseline !== "/tmp/atria-budget-sync-before.json")
  throw new Error("Named QA baseline only.");
if (baseline) {
  const ids = z
    .object({ categories: z.array(z.object({ id: z.string().guid() })) })
    .parse(JSON.parse(readFileSync(baseline, "utf8")))
    .categories.map((r) => r.id);
  c.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}
const sourceHash = hash([
  p,
  b,
  c.map(({ id, expenseCategoryId, allocatedAmount, ratioPercentage, isManualOverride }) => ({
    id,
    expenseCategoryId,
    allocatedAmount,
    ratioPercentage,
    isManualOverride,
  })),
  e,
  cash,
  stock,
  bank,
  pay,
  settings,
  allocation,
]);
const audits = await db.select().from(auditLog).where(eq(auditLog.targetId, f.drift.budgetId));
const receipts = await db
  .select()
  .from(aiProposalConfirmation)
  .where(eq(aiProposalConfirmation.conversationId, f.conversationId));
console.log(
  JSON.stringify({
    sourceHash,
    categories: c.map(
      ({ id, pendingAmount, actualAmount, paidAmount, remainingAmount, status }) => ({
        id,
        pendingAmount,
        actualAmount,
        paidAmount,
        remainingAmount,
        status,
      }),
    ),
    auditCount: audits.length,
    receiptCount: receipts.length,
  }),
);
await pool.end();
