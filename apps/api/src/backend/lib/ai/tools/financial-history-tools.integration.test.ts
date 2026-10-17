import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "@backend/db";
import {
  bankAccount,
  cashTransaction,
  client,
  expenseCategory,
  INSTANCE_TENANT_ID,
  project,
  projectBudgets,
  projectBudgetCategory,
  projectExpenses,
  role,
  tenant,
  user,
} from "@backend/db/schema";
import { financialHistoryOutputSchema } from "@atria/core/ai/financial-history";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import {
  financialHistoryInputSchema,
  readFinancialHistory,
  type FinancialHistoryToolContext,
} from "./financial-history-tools";
const prefix = `HISTORY-${randomUUID().slice(0, 8)}`;
const asOf = "2026-10-13T10:00:00.000Z";
let ownProjectId: string,
  otherProjectId: string,
  foreignProjectId: string,
  accountId: string,
  owner: FinancialHistoryToolContext,
  pm: FinancialHistoryToolContext;
function ctx(actor: FinancialHistoryToolContext, question: string): FinancialHistoryToolContext {
  return { ...actor, userQuestion: question, asOf };
}
const projectName = `${prefix} Proyek A`,
  bankName = `${prefix} Rekening A`;
describeIntegration("Financial history full aggregates and original-period binding", () => {
  beforeAll(async () => {
    const [r] = await db.insert(role).values({ name: prefix, dataScope: "ASSIGNED" }).returning();
    const [person] = await db
      .insert(user)
      .values({ name: prefix, email: `${randomUUID()}@fixture.invalid`, roleId: r.id })
      .returning();
    const [other] = await db
      .insert(user)
      .values({ name: `${prefix} other`, email: `${randomUUID()}@fixture.invalid`, roleId: r.id })
      .returning();
    owner = aiToolContextForRole("OWNER", { userId: person.id });
    pm = aiToolContextForRole("PROJECT_MANAGER", {
      userId: person.id,
      permissions: ["use:ai_chat", "view:cost", "view:bank_account"],
      dataScope: "ASSIGNED",
    });
    const [foreign] = await db
      .insert(tenant)
      .values({ name: prefix, slug: prefix.toLowerCase() })
      .returning();
    const [category] = await db
      .insert(expenseCategory)
      .values({ code: prefix, name: prefix })
      .returning();
    for (const [tenantId, name, manager] of [
      [INSTANCE_TENANT_ID, projectName, person.id],
      [INSTANCE_TENANT_ID, `${prefix} Proyek B`, other.id],
      [foreign.id, `${prefix} Proyek foreign`, person.id],
    ] as const) {
      const [c] = await db
        .insert(client)
        .values({ tenantId, name, email: `${randomUUID()}@fixture.invalid`, phone: "-" })
        .returning();
      const [p] = await db
        .insert(project)
        .values({
          tenantId,
          name,
          clientId: c.id,
          projectManagerId: manager,
          status: "ACTIVE",
          totalContractValue: "2000000.00",
        })
        .returning();
      const [budget] = await db
        .insert(projectBudgets)
        .values({
          tenantId,
          projectId: p.id,
          contractValue: "2000000.00",
          internalBudget: "1800000.00",
        })
        .returning();
      const [bucket] = await db
        .insert(projectBudgetCategory)
        .values({
          tenantId,
          projectBudgetId: budget.id,
          expenseCategoryId: category.id,
          allocatedAmount: "1800000.00",
        })
        .returning();
      if (name === projectName) {
        ownProjectId = p.id;
      } else if (tenantId === INSTANCE_TENANT_ID) {
        otherProjectId = p.id;
      } else {
        foreignProjectId = p.id;
      }
      const base = {
        tenantId,
        projectId: p.id,
        projectBudgetId: budget.id,
        projectBudgetCategoryId: bucket.id,
        expenseCategoryId: category.id,
        requestedById: person.id,
        description: prefix,
        sourceType: "STOCK_USAGE",
        status: "APPROVED",
      };
      await db.insert(projectExpenses).values([
        { ...base, amount: "400000.25", expenseDate: new Date("2026-09-30T17:00:00Z") },
        { ...base, amount: "3.11", expenseDate: new Date("2026-09-30T16:59:59.999Z") },
        { ...base, amount: "999.00", expenseDate: new Date(asOf) },
        {
          ...base,
          amount: "1000000.07",
          status: "INVENTORY_ASSET",
          sourceType: "INVENTORY_PURCHASE",
          expenseDate: new Date("2026-10-10T00:00:00Z"),
        },
        {
          ...base,
          amount: "11.12",
          status: "SUBMITTED",
          sourceType: "CASH_EXPENSE",
          expenseDate: new Date("2026-10-10T00:00:00Z"),
        },
        ...Array.from({ length: 24 }, () => ({
          ...base,
          amount: "0.01",
          expenseDate: new Date("2026-10-10T00:00:00Z"),
        })),
      ]);
    }
    const [account] = await db
      .insert(bankAccount)
      .values({
        name: bankName,
        bankName: "QA",
        accountNumber: randomUUID(),
        holderName: prefix,
        isActive: false,
        balance: "9999.00",
      })
      .returning();
    accountId = account.id;
    const [foreignBank] = await db
      .insert(bankAccount)
      .values({
        tenantId: foreign.id,
        name: `${prefix} foreignbank`,
        bankName: "QA",
        accountNumber: randomUUID(),
        holderName: prefix,
        balance: "0.00",
      })
      .returning();
    for (const [tenantId, bankAccountId] of [
      [INSTANCE_TENANT_ID, accountId],
      [foreign.id, foreignBank.id],
    ] as const) {
      await db.insert(cashTransaction).values([
        {
          tenantId,
          bankAccountId,
          type: "INFLOW",
          category: "client_payment",
          referenceType: "client_payment",
          amount: "100.25",
          description: prefix,
          createdAt: new Date("2026-09-30T17:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "OUTFLOW",
          category: "vendor_payment",
          referenceType: "vendor_payment",
          amount: "30.11",
          description: prefix,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "OUTFLOW",
          category: "bank_transfer_out",
          referenceType: "bank_transfer",
          amount: "10.12",
          description: prefix,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "INFLOW",
          category: "bank_transfer_in",
          referenceType: "bank_transfer",
          amount: "10.12",
          description: prefix,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "INFLOW",
          category: "opening_balance",
          referenceType: "opening_balance",
          amount: "200.99",
          description: prefix,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "OUTFLOW",
          category: "cash_adjustment",
          referenceType: null,
          amount: "1.01",
          description: prefix,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        {
          tenantId,
          bankAccountId,
          type: "OUTFLOW",
          category: "other",
          referenceType: null,
          amount: "999.00",
          description: prefix,
          createdAt: new Date(asOf),
        },
      ]);
    }
  });
  test("full project aggregates include rows beyond 20 and honor exact month/time boundaries", async () => {
    const value = financialHistoryOutputSchema.parse(
      await readFinancialHistory(
        ctx(owner, `Bandingkan pengeluaran ${projectName} bulan ini dan bulan lalu`),
        { projectId: ownProjectId },
      ),
    );
    expect(value.scope.projectId).toBe(ownProjectId);
    expect(value.periods[0].expenses).toMatchObject({
      recordedExpenseAmount: "400000.49",
      recordedCount: 25,
      pendingAmount: "11.12",
      excludedAmount: "1000000.07",
    });
    expect(value.periods[1].expenses?.recordedExpenseAmount).toBe("3.11");
  });
  test("omitted model filter auto-binds original exact named project without broad totals", async () => {
    const value = financialHistoryOutputSchema.parse(
      await readFinancialHistory(ctx(owner, `Pengeluaran ${projectName} bulan ini`), {}),
    );
    expect(value.scope.projectId).toBe(ownProjectId);
    expect(value.periods[0].expenses?.recordedExpenseAmount).toBe("400000.49");
  });
  test("assigned PM sees only own records; custom Owner label NONE has no expense access", async () => {
    const denied = await readFinancialHistory(ctx(pm, `Pengeluaran ${prefix} Proyek B bulan ini`), {
      projectId: otherProjectId,
    });
    expect("error" in denied).toBe(true);
    const foreign = await readFinancialHistory(
      ctx(owner, `Pengeluaran ${prefix} Proyek foreign bulan ini`),
      { projectId: foreignProjectId },
    );
    expect("error" in foreign).toBe(true);
    const value = financialHistoryOutputSchema.parse(
      await readFinancialHistory(
        ctx({ ...owner, roleName: "Owner", dataScope: "NONE" }, "Pengeluaran bulan ini"),
        {},
      ),
    );
    expect(value.periods[0].expenses).toBeUndefined();
    expect(value.issues.join(" ")).toContain("cakupan");
  });
  test("company/account cash uses ledger date, includes inactive account history, excludes transfers/opening/adjustments", async () => {
    const value = financialHistoryOutputSchema.parse(
      await readFinancialHistory(ctx(owner, `Arus kas ${bankName} bulan ini`), {
        bankAccountId: accountId,
      }),
    );
    expect(value.periods[0].cash).toMatchObject({
      cashIn: "100.25",
      cashOut: "30.11",
      net: "70.14",
      transactionCount: 2,
      exclusions: {
        transfer: { amount: "20.24", count: 2 },
        opening: { amount: "200.99", count: 1 },
        adjustment: { amount: "1.01", count: 1 },
      },
    });
  });
  test("bank permission plus global data scope is required; missing original question or model dates rejected", async () => {
    const value = financialHistoryOutputSchema.parse(
      await readFinancialHistory(ctx(pm, "Arus kas bulan ini"), {}),
    );
    expect(value.periods[0].cash).toBeUndefined();
    expect(value.issues.join(" ")).toContain("global");
    const noBank = financialHistoryOutputSchema.parse(
      await readFinancialHistory(
        ctx({ ...owner, permissions: ["use:ai_chat", "view:cost"] }, "Arus kas bulan ini"),
        {},
      ),
    );
    expect(noBank.periods[0].cash).toBeUndefined();
    expect("error" in (await readFinancialHistory({ ...owner, userQuestion: undefined }, {}))).toBe(
      true,
    );
    expect(
      financialHistoryInputSchema.safeParse({ start: "2026-01-01", end: "2026-01-02" }).success,
    ).toBe(false);
  });
  test("unbound model target and unsupported project cash/past snapshots are not substituted", async () => {
    expect(
      "error" in
        (await readFinancialHistory(ctx(owner, `Pengeluaran ${projectName} bulan ini`), {
          projectId: otherProjectId,
        })),
    ).toBe(true);
    const cash = financialHistoryOutputSchema.parse(
      await readFinancialHistory(ctx(owner, `Arus kas ${projectName} bulan ini`), {}),
    );
    expect(cash.periods[0].cash).toBeUndefined();
    expect(cash.issues.join(" ")).toContain("per proyek");
    expect("error" in (await readFinancialHistory(ctx(owner, "Saldo bulan lalu"), {}))).toBe(true);
  });
});
