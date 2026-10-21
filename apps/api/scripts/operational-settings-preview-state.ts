import { createHash } from "node:crypto";
import { and, eq, asc, count } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  expenseCategory,
  auditLog,
  aiProposalConfirmation,
  bankAccount,
  projectBudgets,
  projectCost,
  cashTransaction,
  stockMovement,
} from "../src/backend/db/schema";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable preview only.");
const id = process.argv[2];
if (!id) throw new Error("Category ID required.");
const [category] = await db.select().from(expenseCategory).where(eq(expenseCategory.id, id));
const audit = (
  await db
    .select({ n: count() })
    .from(auditLog)
    .where(and(eq(auditLog.targetId, id), eq(auditLog.action, "UPDATE_EXPENSE_CATEGORY_SETTING")))
)[0].n;
const receipt = (
  await db
    .select({ n: count() })
    .from(aiProposalConfirmation)
    .where(eq(aiProposalConfirmation.documentId, id))
)[0].n;
const invariant = {
  banks: await db.query.bankAccount.findMany({ orderBy: [asc(bankAccount.id)] }),
  budgets: await db.query.projectBudgets.findMany({ orderBy: [asc(projectBudgets.id)] }),
  costs: await db.query.projectCost.findMany({ orderBy: [asc(projectCost.id)] }),
  cash: (await db.select({ n: count() }).from(cashTransaction))[0].n,
  stock: (await db.select({ n: count() }).from(stockMovement))[0].n,
};
console.log(
  JSON.stringify({
    category: {
      name: category?.name,
      description: category?.description,
      defaultRatio: category?.defaultRatio,
      isActive: category?.isActive,
    },
    audit,
    receipt,
    invariantHash: createHash("sha256").update(JSON.stringify(invariant)).digest("hex"),
  }),
);
await pool.end();
