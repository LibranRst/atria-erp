import { createHash } from "node:crypto";
import { z } from "zod";
import { and, asc, count, eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  tenantMember,
  session,
  project,
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
) {
  throw new Error("Named disposable preview only.");
}
const id = z.string().guid().parse(process.argv[2]);
const staff = await db.query.user.findFirst({
  where: eq(user.id, id),
  columns: { id: true, name: true, email: true, roleId: true, isActive: true },
});
if (!staff?.email.endsWith("@fixture.invalid")) throw new Error("Synthetic staff required.");
const membership = await db.query.tenantMember.findMany({
  where: eq(tenantMember.userId, id),
  columns: { roleId: true, isActive: true },
});
const sessions = (await db.select({ n: count() }).from(session).where(eq(session.userId, id)))[0].n;
const audits = (
  await db
    .select({ n: count() })
    .from(auditLog)
    .where(and(eq(auditLog.targetId, id), eq(auditLog.action, "UPDATE_STAFF_USER")))
)[0].n;
const receipts = (
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
  projects: await db.query.project.findMany({ orderBy: [asc(project.id)] }),
};
console.log(
  JSON.stringify({
    staff,
    membership,
    sessions,
    audits,
    receipts,
    invariantHash: createHash("sha256").update(JSON.stringify(invariant)).digest("hex"),
  }),
);
await pool.end();
