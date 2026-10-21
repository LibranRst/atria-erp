import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getRecentExpensesOutputSchema } from "@atria/core/ai/tool-output";
import { db } from "@backend/db";
import {
  tenant,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectCost,
  projectExpenses,
  role,
  rolePermission,
  user,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { getRoleAccess } from "@backend/lib/auth/role-access";
import type { AiToolContext } from "./context";
import { buildOperationsTools } from "./operations-tools";

const prefix = `EXPENSE-FACTS-${randomUUID().slice(0, 8)}`;
const options = { toolCallId: "expense-read", messages: [], context: {} };
let owner: AiToolContext, assigned: AiToolContext, ownProjectId: string, otherProjectId: string;
let canonicalExpenseId: string, fieldExpenseId: string;
type ReadInput = Parameters<
  NonNullable<ReturnType<typeof buildOperationsTools>["getRecentExpenses"]["execute"]>
>[0];
async function read(context: AiToolContext, input: Partial<ReadInput>): Promise<unknown> {
  const execute = buildOperationsTools(context).getRecentExpenses.execute;
  if (!execute) throw new Error("Expense read executor missing");
  return execute({ limit: 20, offset: 0, ...input }, options);
}

describeIntegration("current AI expense lookup scope and bounds", () => {
  beforeAll(async () => {
    const actors: AiToolContext[] = [];
    for (const scope of ["GLOBAL", "ASSIGNED"] as const) {
      const [createdRole] = await db
        .insert(role)
        .values({ name: `${prefix}-${scope}`, dataScope: scope })
        .returning();
      await db.insert(rolePermission).values(
        (["use:ai_chat", "view:project", "view:cost"] as const).map((permissionKey) => ({
          roleId: createdRole.id,
          permissionKey,
        })),
      );
      const [person] = await db
        .insert(user)
        .values({
          name: `${prefix}-${scope}`,
          email: `${randomUUID()}@fixture.invalid`,
          roleId: createdRole.id,
        })
        .returning();
      const access = await getRoleAccess(createdRole.id);
      if (!access) throw new Error("Actual expense role missing");
      actors.push({ ...access, userId: person.id });
    }
    [owner, assigned] = actors;
    const materialCategory = await db.query.expenseCategory.findFirst({
      where: and(
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        eq(expenseCategory.code, "MATERIAL"),
      ),
    });
    if (!materialCategory) throw new Error("Canonical Material fixture required");
    const [foreignTenant] = await db
      .insert(tenant)
      .values({ name: `${prefix}-foreign`, slug: prefix.toLowerCase() })
      .returning();
    const statuses = ["SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "PAID", "INVENTORY_ASSET"];
    for (const [tenantId, suffix, managerId] of [
      [INSTANCE_TENANT_ID, "own", assigned.userId],
      [INSTANCE_TENANT_ID, "other", owner.userId],
      [foreignTenant.id, "foreign", assigned.userId],
    ] as const) {
      const [customer] = await db
        .insert(client)
        .values({
          tenantId,
          name: `${prefix}-${suffix}`,
          email: `${randomUUID()}@fixture.invalid`,
          phone: "-",
        })
        .returning();
      const [proj] = await db
        .insert(project)
        .values({
          tenantId,
          name: `${prefix}-${suffix}`,
          clientId: customer.id,
          projectManagerId: managerId,
          status: "ACTIVE",
          totalContractValue: "1000000.25",
        })
        .returning();
      if (suffix === "own") ownProjectId = proj.id;
      if (suffix === "other") otherProjectId = proj.id;
      const category =
        tenantId === INSTANCE_TENANT_ID
          ? materialCategory
          : (
              await db
                .insert(expenseCategory)
                .values({ tenantId, name: "Material", code: "MATERIAL" })
                .returning()
            )[0];
      const [budget] = await db
        .insert(projectBudgets)
        .values({
          tenantId,
          projectId: proj.id,
          contractValue: "1000000.25",
          internalBudget: "900000.23",
        })
        .returning();
      const [budgetCategory] = await db
        .insert(projectBudgetCategory)
        .values({
          tenantId,
          projectBudgetId: budget.id,
          expenseCategoryId: category.id,
          allocatedAmount: "900000.23",
        })
        .returning();
      for (const [index, status] of statuses.entries()) {
        const description = index < 2 ? `${prefix} duplikat` : `${prefix} ${status}`;
        const [cost] = await db
          .insert(projectCost)
          .values({
            tenantId,
            projectId: proj.id,
            projectBudgetCategoryId: budgetCategory.id,
            requestedById: owner.userId,
            description,
            amount: "100000.25",
            status: status === "INVENTORY_ASSET" ? "PAID" : status,
          })
          .returning();
        const [recorded] = await db
          .insert(projectExpenses)
          .values({
            tenantId,
            projectId: proj.id,
            projectBudgetId: budget.id,
            projectBudgetCategoryId: budgetCategory.id,
            expenseCategoryId: category.id,
            requestedById: owner.userId,
            legacyProjectCostId: cost.id,
            description,
            amount: "100000.25",
            status,
            paymentStatus: status === "PAID" || status === "INVENTORY_ASSET" ? "PAID" : "UNPAID",
            sourceType: status === "INVENTORY_ASSET" ? "INVENTORY_PURCHASE" : "CASH_EXPENSE",
            expenseDate: new Date(
              index === 0
                ? "2026-10-12T16:59:59Z"
                : index === 1
                  ? "2026-10-12T17:00:00Z"
                  : "2026-10-13T16:59:59Z",
            ),
          })
          .returning();
        if (suffix === "own" && status === "PAID") {
          canonicalExpenseId = recorded.id;
          fieldExpenseId = cost.id;
        }
      }
      await db.insert(projectExpenses).values({
        tenantId,
        projectId: proj.id,
        projectBudgetId: budget.id,
        projectBudgetCategoryId: budgetCategory.id,
        expenseCategoryId: category.id,
        requestedById: owner.userId,
        description: `${prefix} literal_%`,
        amount: "25.05",
        status: "APPROVED",
        paymentStatus: "NON_CASH",
        sourceType: "STOCK_USAGE",
        isCashImpact: false,
        expenseDate: new Date("2026-10-14T00:00:00+07:00"),
      });
    }
  }, 30000);
  test("global lookup excludes other tenants and assigned lookup excludes unassigned projects", async () => {
    const global = getRecentExpensesOutputSchema.parse(await read(owner, { query: prefix }));
    expect(global.expenses).toHaveLength(14);
    expect(global.expenses.every((row) => row.projectName !== `${prefix}-foreign`)).toBe(true);
    const scoped = getRecentExpensesOutputSchema.parse(await read(assigned, { query: prefix }));
    expect(scoped.expenses).toHaveLength(7);
    expect(scoped.expenses.every((row) => row.projectId === ownProjectId)).toBe(true);
    expect(await read(assigned, { projectId: otherProjectId })).toMatchObject({
      error: expect.any(String),
    });
    expect(await read({ ...owner, dataScope: "NONE" }, { query: prefix })).toEqual({
      error: "Proyek tidak ditemukan atau di luar akses Anda.",
    });
    expect(await read({ ...owner, permissions: [] }, { query: prefix })).toMatchObject({
      error: expect.any(String),
    });
  });
  test("canonical and field IDs return one current exact row without substituting another status", async () => {
    for (const expenseId of [canonicalExpenseId, fieldExpenseId]) {
      const result = getRecentExpensesOutputSchema.parse(await read(owner, { expenseId }));
      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0]).toMatchObject({
        id: canonicalExpenseId,
        projectCostId: fieldExpenseId,
        status: "PAID",
        paymentStatus: "PAID",
        exactAmount: "100000.25",
        amount: { amount: 100000.25 },
        descriptionMatchesInScope: 2,
      });
      expect(
        getRecentExpensesOutputSchema.parse(
          await read(owner, { expenseId, projectId: ownProjectId }),
        ).expenses[0]?.descriptionMatchesInScope,
      ).toBe(1);
    }
    const result = getRecentExpensesOutputSchema.parse(
      await read(owner, {
        projectId: ownProjectId,
        status: "INVENTORY_ASSET",
        categoryCode: "MATERIAL",
      }),
    );
    expect(result.expenses[0]).toMatchObject({
      status: "INVENTORY_ASSET",
      sourceType: "INVENTORY_PURCHASE",
    });
  });
  test("duplicate and one-character searches require choice and pages remain explicitly bounded", async () => {
    const first = getRecentExpensesOutputSchema.parse(
      await read(owner, { query: `${prefix} duplikat`, limit: 2 }),
    );
    expect(first.requiresExpenseChoice).toBe(true);
    expect(first.matchedCount).toBe(4);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(2);
    const own = first.expenses.find((row) => row.projectId === ownProjectId);
    if (!own?.id) throw new Error("Scoped duplicate expense expected");
    const reread = getRecentExpensesOutputSchema.parse(
      await read(owner, { projectId: ownProjectId, expenseId: own.id, status: "VERIFIED" }),
    );
    expect(reread.expenses[0]?.descriptionMatchesInScope).toBe(2);
    const second = getRecentExpensesOutputSchema.parse(
      await read(owner, { query: `${prefix} duplikat`, limit: 2, offset: 2 }),
    );
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.expenses, ...second.expenses].map((row) => row.id)).size).toBe(4);
    expect(
      getRecentExpensesOutputSchema.parse(
        await read(owner, { projectId: ownProjectId, query: "d" }),
      ).requiresExpenseChoice,
    ).toBe(true);
  });
  test("inclusive Jakarta expense dates respect midnight and exclude next day", async () => {
    const result = getRecentExpensesOutputSchema.parse(
      await read(owner, { projectId: ownProjectId, dateFrom: "2026-10-13", dateTo: "2026-10-13" }),
    );
    expect(result.expenses).toHaveLength(5);
    expect(result.expenses.every((row) => row.expenseDate === "2026-10-13")).toBe(true);
    expect(result).toMatchObject({ timeZone: "Asia/Jakarta", dateBasis: "expenseDate" });
  });
  test("relative record dates use original human text/server clock, not model dates or prior status guesses", async () => {
    const result = getRecentExpensesOutputSchema.parse(
      await read(
        {
          ...owner,
          userQuestion: `Status saat ini pengeluaran kemarin pada ${prefix}-own?`,
          asOf: "2026-10-14T03:00:00Z",
        },
        { projectId: ownProjectId, dateFrom: "2026-09-01", dateTo: "2026-09-30" },
      ),
    );
    expect(result.expenses).toHaveLength(5);
    expect(result.dateRange).toMatchObject({
      start: "2026-10-12T17:00:00.000Z",
      end: "2026-10-13T17:00:00.000Z",
      isPartial: false,
    });
    expect(
      await read(
        {
          ...owner,
          userQuestion: `Status pengeluaran kemarin pada ${prefix}-own?`,
          asOf: "2026-10-14T03:00:00Z",
        },
        { projectId: ownProjectId },
      ),
    ).toMatchObject({ error: expect.stringContaining("Riwayat status persetujuan") });
  });
  test("literal wildcard search and empty result do not become broad or fake data", async () => {
    const literal = getRecentExpensesOutputSchema.parse(
      await read(owner, { query: `${prefix} literal_%` }),
    );
    expect(literal.expenses).toHaveLength(2);
    expect(literal.expenses.every((row) => row.description === `${prefix} literal_%`)).toBe(true);
    const absent = getRecentExpensesOutputSchema.parse(
      await read(owner, { query: `${prefix} nonexistent` }),
    );
    expect(absent).toMatchObject({
      expenses: [],
      matchedCount: 0,
      hasMore: false,
      nextOffset: null,
    });
  });
  test("an ID reread counts case-insensitive duplicate names in the same project", async () => {
    const source = await db.query.projectExpenses.findFirst({
      where: eq(projectExpenses.id, canonicalExpenseId),
    });
    if (!source) throw new Error("Canonical expense fixture expected");
    const description = `Case ${prefix} Alpha`;
    const created = await db
      .insert(projectExpenses)
      .values(
        [description, description.toLowerCase()].map((name) => ({
          projectId: source.projectId,
          projectBudgetId: source.projectBudgetId,
          projectBudgetCategoryId: source.projectBudgetCategoryId,
          expenseCategoryId: source.expenseCategoryId,
          requestedById: source.requestedById,
          description: name,
          amount: "25.05",
          status: "SUBMITTED",
          paymentStatus: "UNPAID",
        })),
      )
      .returning();
    const result = getRecentExpensesOutputSchema.parse(
      await read(owner, { expenseId: created[0].id, projectId: ownProjectId, query: description }),
    );
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]?.descriptionMatchesInScope).toBe(2);
  });
});
