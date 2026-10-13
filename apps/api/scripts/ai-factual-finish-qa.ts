import { and, asc, eq, gte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { classifyCashFlow } from "../../../packages/core/src/finance/dashboard-cash-flow";
import { normalizeCashDirection } from "../../../packages/core/src/finance/cash-direction";
import { fromCents, parseNumericToCents } from "../../../packages/core/src/finance/money-minor";
import { financialHistoryOutputSchema } from "../../../packages/core/src/ai/financial-history";
import { db, pool } from "../src/backend/db";
import * as s from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { buildAiTools } from "../src/backend/lib/ai/tools";
import { buildOperationsTools } from "../src/backend/lib/ai/tools/operations-tools";
import { readFinancialHistory } from "../src/backend/lib/ai/tools/financial-history-tools";

// Operator-only evidence: no inserts, updates, auth bypass, provider calls or production target.
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Exact disposable factual QA database required");
const mode = z.enum(["facts", "baseline", "verify", "observe", "probes"]).parse(process.argv[2]);
const dir = "../../output/ai-chat-qa/factual-finish";
mkdirSync(dir, { recursive: true });
const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function protectedSnapshot(): Promise<Record<string, { count: number; sha256: string }>> {
  const collections: Record<string, readonly unknown[]> = {
    projects: await db.select().from(s.project).orderBy(asc(s.project.id)),
    budgets: await db.select().from(s.projectBudgets).orderBy(asc(s.projectBudgets.id)),
    categories: await db
      .select()
      .from(s.projectBudgetCategory)
      .orderBy(asc(s.projectBudgetCategory.id)),
    raps: await db.select().from(s.projectRap).orderBy(asc(s.projectRap.id)),
    rapItems: await db.select().from(s.projectRapItem).orderBy(asc(s.projectRapItem.id)),
    rabs: await db.select().from(s.rabEstimate).orderBy(asc(s.rabEstimate.id)),
    rabItems: await db.select().from(s.rabEstimateItem).orderBy(asc(s.rabEstimateItem.id)),
    accounts: await db.select().from(s.bankAccount).orderBy(asc(s.bankAccount.id)),
    cash: await db.select().from(s.cashTransaction).orderBy(asc(s.cashTransaction.id)),
    bills: await db.select().from(s.vendorBill).orderBy(asc(s.vendorBill.id)),
    payments: await db.select().from(s.vendorPayment).orderBy(asc(s.vendorPayment.id)),
    expenses: await db.select().from(s.projectExpenses).orderBy(asc(s.projectExpenses.id)),
    costs: await db.select().from(s.projectCost).orderBy(asc(s.projectCost.id)),
    inventory: await db.select().from(s.materialInventory).orderBy(asc(s.materialInventory.id)),
    movements: await db.select().from(s.stockMovement).orderBy(asc(s.stockMovement.id)),
    goodsReceipts: await db.select().from(s.goodsReceipt).orderBy(asc(s.goodsReceipt.id)),
    goodsReceiptItems: await db
      .select()
      .from(s.goodsReceiptItem)
      .orderBy(asc(s.goodsReceiptItem.id)),
    statementImports: await db
      .select()
      .from(s.bankStatementImport)
      .orderBy(asc(s.bankStatementImport.id)),
    statementRows: await db.select().from(s.bankStatementRow).orderBy(asc(s.bankStatementRow.id)),
    confirmations: await db
      .select()
      .from(s.aiProposalConfirmation)
      .orderBy(asc(s.aiProposalConfirmation.id)),
    audits: await db.select().from(s.auditLog).orderBy(asc(s.auditLog.id)),
    settings: await db.select().from(s.appConfig).orderBy(asc(s.appConfig.key)),
    roles: await db.select().from(s.role).orderBy(asc(s.role.id)),
    grants: await db.select().from(s.rolePermission).orderBy(asc(s.rolePermission.id)),
    memberships: await db.select().from(s.tenantMember).orderBy(asc(s.tenantMember.id)),
    users: await db.select().from(s.user).orderBy(asc(s.user.id)),
    credentials: await db.select().from(s.account).orderBy(asc(s.account.id)),
  };
  return Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [
      name,
      { count: rows.length, sha256: digest(rows) },
    ]),
  );
}

if (mode === "baseline") {
  const evidence = { startedAt: new Date().toISOString(), collections: await protectedSnapshot() };
  writeFileSync(`${dir}/baseline.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      path: `${dir}/baseline.json`,
      counts: Object.fromEntries(
        Object.entries(evidence.collections).map(([k, v]) => [k, v.count]),
      ),
    }),
  );
} else if (mode === "verify") {
  const before = z
    .object({
      startedAt: z.string(),
      collections: z.record(z.string(), z.object({ count: z.number(), sha256: z.string() })),
    })
    .parse(JSON.parse(readFileSync(`${dir}/baseline.json`, "utf8")));
  const after = await protectedSnapshot();
  const changes = Object.keys(before.collections).filter(
    (key) => JSON.stringify(before.collections[key]) !== JSON.stringify(after[key]),
  );
  const evidence = {
    verifiedAt: new Date().toISOString(),
    unchanged: changes.length === 0,
    changes,
    before: before.collections,
    after,
  };
  writeFileSync(`${dir}/business-verification.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      unchanged: evidence.unchanged,
      changes,
      collections: Object.keys(after).length,
    }),
  );
  if (changes.length) process.exitCode = 1;
} else if (mode === "observe") {
  const baseline = z
    .object({ startedAt: z.string().datetime() })
    .parse(JSON.parse(readFileSync(`${dir}/baseline.json`, "utf8")));
  const cutoff = new Date(baseline.startedAt);
  const messages = await db
    .select({
      id: s.aiMessage.id,
      conversationId: s.aiMessage.conversationId,
      userId: s.aiConversation.userId,
      role: s.aiMessage.role,
      parts: s.aiMessage.parts,
      provider: s.aiMessage.provider,
      createdAt: s.aiMessage.createdAt,
    })
    .from(s.aiMessage)
    .innerJoin(s.aiConversation, eq(s.aiConversation.id, s.aiMessage.conversationId))
    .where(
      and(eq(s.aiConversation.tenantId, s.INSTANCE_TENANT_ID), gte(s.aiMessage.createdAt, cutoff)),
    )
    .orderBy(asc(s.aiMessage.createdAt));
  const receipts = await db
    .select({ id: s.aiProposalConfirmation.id })
    .from(s.aiProposalConfirmation)
    .where(gte(s.aiProposalConfirmation.createdAt, cutoff));
  writeFileSync(
    `${dir}/browser-observation.json`,
    JSON.stringify(
      { observedAt: new Date().toISOString(), messages, newReceipts: receipts.length },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      messages: messages.length,
      newReceipts: receipts.length,
      path: `${dir}/browser-observation.json`,
    }),
  );
} else if (mode === "probes") {
  const before = await protectedSnapshot();
  const checks: { label: string; pass: boolean }[] = [];
  const observations: {
    key: string;
    expense: unknown;
    foreignExpense: unknown;
    history: unknown;
    cash: unknown;
  }[] = [];
  const selectedId = "2791b70e-9f18-46bf-ae67-24b45fc8c7d7";
  const operationalProject = "33bf90c2-7897-4fa1-935a-eb1a3d99e665";
  const roleB = "a0e3b7f1-7541-439d-99d8-eb22cfd1785e";
  const options = { toolCallId: "factual-finish-read-only-probe", messages: [], context: {} };
  const rowsSchema = z.object({
    matchedCount: z.number(),
    expenses: z.array(
      z.object({
        id: z.string(),
        exactAmount: z.string(),
        status: z.string(),
        paymentStatus: z.string(),
      }),
    ),
  });
  for (const key of ["owner", "finance", "purchasing", "pm_a", "pm_b", "custom_none", "no_ai"]) {
    const row = await db.query.user.findFirst({
      where: eq(s.user.email, `ai-role-${key}@fixture.invalid`),
    });
    if (!row || !row.name.startsWith("QA ")) throw new Error("Synthetic role actor required");
    const access = await getRoleAccess(row.roleId);
    if (!access) throw new Error("Effective role required");
    const context = { ...access, userId: row.id };
    const catalog = buildAiTools(context);
    const execute = buildOperationsTools(context).getRecentExpenses.execute;
    if (!execute) throw new Error("Reader missing");
    const expense = catalog.getRecentExpenses
      ? await execute({ expenseId: selectedId, limit: 20, offset: 0 }, options)
      : { error: "Not registered for actual actor" };
    const foreignExpense = catalog.getRecentExpenses
      ? await execute(
          { projectId: key === "pm_b" ? operationalProject : roleB, limit: 20, offset: 0 },
          options,
        )
      : { error: "Not registered for actual actor" };
    const parsedExpense = rowsSchema.safeParse(expense);
    const shouldRead = ["owner", "finance", "pm_a"].includes(key);
    checks.push({
      label: `${key}: selected expense scope`,
      pass: shouldRead
        ? parsedExpense.success &&
          parsedExpense.data.expenses.length === 1 &&
          parsedExpense.data.expenses[0].id === selectedId &&
          parsedExpense.data.expenses[0].exactAmount === "400000.00" &&
          parsedExpense.data.expenses[0].status === "APPROVED" &&
          parsedExpense.data.expenses[0].paymentStatus === "NON_CASH"
        : !parsedExpense.success ||
          (parsedExpense.data.matchedCount === 0 && parsedExpense.data.expenses.length === 0),
    });
    if (["pm_a", "pm_b"].includes(key))
      checks.push({
        label: `${key}: reciprocal foreign project denial`,
        pass: !rowsSchema.safeParse(foreignExpense).success,
      });
    const history = await readFinancialHistory(
      {
        ...context,
        userQuestion:
          "Bandingkan pengeluaran Proyek Operasional QA Oktober 2026 dengan September 2026",
        asOf: new Date().toISOString(),
      },
      { projectId: operationalProject },
    );
    const parsedHistory = financialHistoryOutputSchema.safeParse(history);
    checks.push({
      label: `${key}: historical project scope`,
      pass: shouldRead
        ? parsedHistory.success &&
          parsedHistory.data.periods.length === 2 &&
          parsedHistory.data.periods[0].expenses?.recordedExpenseAmount === "400000.00" &&
          parsedHistory.data.periods[0].expenses?.excludedAmount === "1000000.00" &&
          parsedHistory.data.periods[1].expenses?.recordedExpenseAmount === "0.00"
        : !parsedHistory.success,
    });
    const cash = await readFinancialHistory(
      {
        ...context,
        userQuestion: "Bandingkan arus kas perusahaan Oktober 2026 dengan September 2026",
        asOf: new Date().toISOString(),
      },
      {},
    );
    const parsedCash = financialHistoryOutputSchema.safeParse(cash);
    const shouldReadCash = ["owner", "finance"].includes(key);
    checks.push({
      label: `${key}: historical company cash scope`,
      pass: shouldReadCash
        ? parsedCash.success &&
          parsedCash.data.periods[0].cash?.cashOut === "3043500.00" &&
          parsedCash.data.periods[0].cash?.transactionCount === 48 &&
          parsedCash.data.periods[1].cash?.cashOut === "0.00"
        : !parsedCash.success ||
          parsedCash.data.periods.every((period) => period.cash === undefined),
    });
    observations.push({ key, expense, foreignExpense, history, cash });
    if (key === "owner") {
      const duplicate = await execute(
        { query: "Invoice asli pemasok · data sintetis", limit: 2, offset: 0 },
        options,
      );
      const duplicateParsed = z
        .object({
          matchedCount: z.number(),
          requiresExpenseChoice: z.boolean(),
          hasMore: z.boolean(),
          nextOffset: z.number().nullable(),
          expenses: z.array(z.unknown()),
        })
        .parse(duplicate);
      checks.push({
        label: "Duplicate identity is explicit and first page is bounded",
        pass:
          duplicateParsed.matchedCount === 5 &&
          duplicateParsed.requiresExpenseChoice &&
          duplicateParsed.hasMore &&
          duplicateParsed.nextOffset === 2 &&
          duplicateParsed.expenses.length === 2,
      });
      const paid = rowsSchema.parse(
        await execute(
          { expenseId: "ed44d30a-1bd7-45b4-a747-e3ccf318e859", limit: 20, offset: 0 },
          options,
        ),
      );
      checks.push({
        label: "Exact cents and mismatching current fields are not silently normalized",
        pass:
          paid.expenses[0].exactAmount === "150000.25" &&
          paid.expenses[0].status === "PAID" &&
          paid.expenses[0].paymentStatus === "UNPAID",
      });
      const account = financialHistoryOutputSchema.parse(
        await readFinancialHistory(
          {
            ...context,
            userQuestion:
              "Bandingkan arus kas Rekening Operasional QA Oktober 2026 dengan September 2026",
            asOf: new Date().toISOString(),
          },
          { bankAccountName: "Rekening Operasional QA" },
        ),
      );
      checks.push({
        label: "Account cash report is distinct from balance and project expenses",
        pass:
          account.scope.kind === "account" &&
          account.periods[0].cash?.cashOut === "1000000.00" &&
          account.periods[0].cash?.transactionCount === 1 &&
          account.periods.every((period) => !period.expenses),
      });
      const ambiguous = await readFinancialHistory(
        {
          ...context,
          userQuestion:
            "Bandingkan pengeluaran Proyek QA · Sumber berubah Oktober 2026 dengan September 2026",
          asOf: new Date().toISOString(),
        },
        { projectName: "Proyek QA · Sumber berubah" },
      );
      checks.push({
        label: "Case-insensitive duplicate project names require human choice",
        pass: z
          .object({
            needsDisambiguation: z.literal(true),
            projects: z.array(z.unknown()).length(2),
          })
          .safeParse(ambiguous).success,
      });
    }
  }
  const after = await protectedSnapshot();
  checks.push({
    label: "Read probes preserve all protected collections",
    pass: JSON.stringify(before) === JSON.stringify(after),
  });
  writeFileSync(
    `${dir}/backend-probes.json`,
    JSON.stringify(
      { observedAt: new Date().toISOString(), checks, observations, before, after },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      passed: checks.filter((check) => check.pass).length,
      failed: checks.filter((check) => !check.pass),
      path: `${dir}/backend-probes.json`,
    }),
  );
  if (checks.some((check) => !check.pass)) process.exitCode = 1;
} else {
  const projects = await db
    .select({
      id: s.project.id,
      name: s.project.name,
      projectManagerId: s.project.projectManagerId,
    })
    .from(s.project)
    .where(eq(s.project.tenantId, s.INSTANCE_TENANT_ID))
    .orderBy(asc(s.project.name));
  const expenses = await db
    .select({
      id: s.projectExpenses.id,
      legacyProjectCostId: s.projectExpenses.legacyProjectCostId,
      projectId: s.projectExpenses.projectId,
      projectName: s.project.name,
      description: s.projectExpenses.description,
      amount: s.projectExpenses.amount,
      status: s.projectExpenses.status,
      paymentStatus: s.projectExpenses.paymentStatus,
      sourceType: s.projectExpenses.sourceType,
      isCashImpact: s.projectExpenses.isCashImpact,
      expenseDate: s.projectExpenses.expenseDate,
      createdAt: s.projectExpenses.createdAt,
      category: s.expenseCategory.name,
      categoryCode: s.expenseCategory.code,
      requestedById: s.projectExpenses.requestedById,
    })
    .from(s.projectExpenses)
    .innerJoin(s.project, eq(s.project.id, s.projectExpenses.projectId))
    .innerJoin(s.expenseCategory, eq(s.expenseCategory.id, s.projectExpenses.expenseCategoryId))
    .where(eq(s.projectExpenses.tenantId, s.INSTANCE_TENANT_ID))
    .orderBy(asc(s.projectExpenses.expenseDate), asc(s.projectExpenses.id));
  const cash = await db
    .select({
      id: s.cashTransaction.id,
      accountId: s.cashTransaction.bankAccountId,
      accountName: s.bankAccount.name,
      amount: s.cashTransaction.amount,
      type: s.cashTransaction.type,
      category: s.cashTransaction.category,
      referenceType: s.cashTransaction.referenceType,
      referenceId: s.cashTransaction.referenceId,
      description: s.cashTransaction.description,
      createdAt: s.cashTransaction.createdAt,
      reconciled: s.cashTransaction.reconciled,
    })
    .from(s.cashTransaction)
    .innerJoin(s.bankAccount, eq(s.bankAccount.id, s.cashTransaction.bankAccountId))
    .where(eq(s.cashTransaction.tenantId, s.INSTANCE_TENANT_ID))
    .orderBy(asc(s.cashTransaction.createdAt), asc(s.cashTransaction.id));
  const periods = ["2026-08", "2026-09", "2026-10"].map((month) => {
    const start = new Date(`${month}-01T00:00:00+07:00`);
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1) - 7 * 60 * 60 * 1000);
    const end = new Date(Math.min(next.getTime(), Date.now()));
    const included = cash.filter((row) => row.createdAt >= start && row.createdAt < end);
    let incoming = 0n,
      outgoing = 0n;
    const exclusions: Record<string, { count: number; amount: bigint }> = {};
    for (const row of included) {
      const cents = parseNumericToCents(row.amount);
      const kind = classifyCashFlow(row);
      if (kind !== "included") {
        const entry = exclusions[kind] ?? { count: 0, amount: 0n };
        entry.count += 1;
        entry.amount += cents;
        exclusions[kind] = entry;
      } else if (normalizeCashDirection(row.type) === "INFLOW") incoming += cents;
      else outgoing += cents;
    }
    const scopedExpenses = expenses.filter(
      (row) => row.expenseDate >= start && row.expenseDate < end,
    );
    const byProject = projects.map((project) => {
      const rows = scopedExpenses.filter((row) => row.projectId === project.id);
      const byStatus = Object.fromEntries(
        [...new Set(rows.map((row) => row.status))].map((status) => {
          const group = rows.filter((row) => row.status === status);
          return [
            status,
            {
              count: group.length,
              amount: fromCents(
                group.reduce((sum, row) => sum + parseNumericToCents(row.amount), 0n),
              ),
            },
          ];
        }),
      );
      const recognized = rows.filter((row) =>
        ["VERIFIED", "APPROVED", "PAID"].includes(row.status),
      );
      return {
        projectId: project.id,
        name: project.name,
        rowCount: rows.length,
        recordedExpenseAmount: fromCents(
          recognized.reduce((sum, row) => sum + parseNumericToCents(row.amount), 0n),
        ),
        byStatus,
        sourceTypes: [...new Set(rows.map((row) => row.sourceType))],
      };
    });
    return {
      month,
      start: start.toISOString(),
      end: end.toISOString(),
      cashBasis: "cashTransaction.createdAt",
      expenseBasis: "projectExpenses.expenseDate",
      partial: end < next,
      allCashRowCount: included.length,
      includedCashCount: included.filter((row) => classifyCashFlow(row) === "included").length,
      cashIn: fromCents(incoming),
      cashOut: fromCents(outgoing),
      cashNet: fromCents(incoming - outgoing),
      exclusions: Object.fromEntries(
        Object.entries(exclusions).map(([key, value]) => [
          key,
          { count: value.count, amount: fromCents(value.amount) },
        ]),
      ),
      byProject,
    };
  });
  const actors = await Promise.all(
    ["owner", "finance", "purchasing", "pm_a", "pm_b", "custom_none", "no_ai"].map(async (key) => {
      const row = await db.query.user.findFirst({
        where: eq(s.user.email, `ai-role-${key}@fixture.invalid`),
      });
      if (!row || !row.name.startsWith("QA ")) throw new Error("Synthetic actor required");
      const access = await getRoleAccess(row.roleId);
      if (!access) throw new Error("Effective role missing");
      return {
        key,
        userId: row.id,
        roleName: access.roleName,
        dataScope: access.dataScope,
        permissions: access.permissions,
        tools: Object.keys(buildAiTools({ ...access, userId: row.id })).sort(),
        assignedProjects: projects
          .filter((project) => project.projectManagerId === row.id)
          .map((project) => project.id),
      };
    }),
  );
  const duplicates = expenses.filter(
    (row) => expenses.filter((other) => other.description === row.description).length > 1,
  );
  const evidence = {
    observedAt: new Date().toISOString(),
    projects,
    expenses,
    cash,
    periods,
    actors,
    duplicates,
  };
  writeFileSync(`${dir}/expected-facts.json`, JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      path: `${dir}/expected-facts.json`,
      expenseCount: expenses.length,
      cashCount: cash.length,
      duplicateDescriptions: [...new Set(duplicates.map((row) => row.description))],
      periods: periods.map((period) => ({
        month: period.month,
        cashIn: period.cashIn,
        cashOut: period.cashOut,
        exclusions: period.exclusions,
        expenses: period.byProject.filter((project) => project.rowCount),
      })),
    }),
  );
}
await pool.end();
