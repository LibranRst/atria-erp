import { createHash } from "node:crypto";
import { z } from "zod";
import { asc, eq, count } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  project,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
  projectBudgets,
  projectCost,
  bankAccount,
  auditLog,
  aiProposalConfirmation,
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
  throw new Error("Named disposable Browser database only.");
const id = z.string().guid().parse(process.argv[2]);
const p = await db.query.project.findFirst({ where: eq(project.id, id) });
if (p?.name !== "Proyek QA · ekspor RAB") throw new Error("Synthetic project required.");
const state = {
  project: p,
  rabs: await db.query.rabEstimate.findMany({
    where: eq(rabEstimate.projectId, id),
    orderBy: [asc(rabEstimate.id)],
  }),
  items: await db.query.rabEstimateItem.findMany({ orderBy: [asc(rabEstimateItem.id)] }),
  bundles: await db.query.rabEstimateBundle.findMany({ orderBy: [asc(rabEstimateBundle.id)] }),
  budgets: await db.query.projectBudgets.findMany({ orderBy: [asc(projectBudgets.id)] }),
  costs: await db.query.projectCost.findMany({ orderBy: [asc(projectCost.id)] }),
  banks: await db.query.bankAccount.findMany({ orderBy: [asc(bankAccount.id)] }),
  counts: await Promise.all(
    [auditLog, aiProposalConfirmation, cashTransaction, stockMovement].map(
      async (t) => (await db.select({ n: count() }).from(t))[0].n,
    ),
  ),
};
console.log(
  JSON.stringify({
    hash: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    counts: state.counts,
  }),
);
await pool.end();
