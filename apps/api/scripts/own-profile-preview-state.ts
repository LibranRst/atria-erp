import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  role,
  rolePermission,
  account,
  session,
  tenantMember,
  project,
  projectBudgets,
  projectExpenses,
  cashTransaction,
  stockMovement,
  bankAccount,
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
  throw new Error("Named disposable Browser database only");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa) throw new Error("QA user");
const [
  r,
  keys,
  credentials,
  sessions,
  members,
  projects,
  budgets,
  expenses,
  cash,
  stock,
  banks,
  audits,
  receipts,
] = await Promise.all([
  db.select().from(role).where(eq(role.id, qa.roleId)),
  db.select().from(rolePermission).where(eq(rolePermission.roleId, qa.roleId)),
  db.select().from(account).where(eq(account.userId, qa.id)),
  db.select().from(session).where(eq(session.userId, qa.id)),
  db.select().from(tenantMember).where(eq(tenantMember.userId, qa.id)),
  db.select().from(project),
  db.select().from(projectBudgets),
  db.select().from(projectExpenses),
  db.select().from(cashTransaction),
  db.select().from(stockMovement),
  db.select().from(bankAccount),
  db.select().from(auditLog).where(eq(auditLog.targetId, qa.id)),
  db.select().from(aiProposalConfirmation).where(eq(aiProposalConfirmation.userId, qa.id)),
]);
function stable(rows: readonly { id: string }[]): readonly { id: string }[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}
const protectedHash = createHash("sha256")
  .update(
    JSON.stringify([
      {
        id: qa.id,
        email: qa.email,
        emailVerified: qa.emailVerified,
        roleId: qa.roleId,
        isActive: qa.isActive,
        mustChangePassword: qa.mustChangePassword,
        temporaryPasswordIssuedAt: qa.temporaryPasswordIssuedAt,
      },
      stable(r),
      stable(keys),
      stable(credentials),
      stable(sessions),
      stable(members),
      stable(projects),
      stable(budgets),
      stable(expenses),
      stable(cash),
      stable(stock),
      stable(banks),
    ]),
  )
  .digest("hex");
console.log(
  JSON.stringify({
    protectedHash,
    name: qa.name,
    hasPhoto: Boolean(qa.image),
    auditCount: audits.filter((a) => a.action === "UPDATE_OWN_PROFILE").length,
    receiptCount: receipts.filter((r) => r.proposalType === "OWN_PROFILE").length,
  }),
);
await pool.end();
