import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  bankAccount,
  tenant,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  role,
  rolePermission,
  user,
  vendor,
  materialCategory,
  materialMaster,
  materialInventory,
  inventoryLocation,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { getRoleAccess } from "@backend/lib/auth/role-access";
import { buildFinanceTools } from "./finance-tools";
import { buildLookupTools } from "./lookup-tools";
import { buildProjectTools } from "./project-tools";
import { buildAiTools } from "./index";
import { canAccessProject, accessibleProjectIds, type AiToolContext } from "./context";

const prefix = `READSCOPE-${randomUUID().slice(0, 8)}`;
const options = { toolCallId: "scope-test", messages: [], context: {} };
let owner: AiToolContext, assigned: AiToolContext, ownProjectId: string, foreignProjectId: string;
const bankResult = z.object({
  accounts: z.array(
    z.object({ accountName: z.string(), balance: z.object({ amount: z.number() }) }),
  ),
  totalAvailable: z.object({ amount: z.number() }),
});
const projectResult = z.object({
  projects: z.array(
    z.object({ projectId: z.string(), contractValue: z.object({ amount: z.number() }) }),
  ),
});

describeIntegration("AI read instance and project scope", () => {
  beforeAll(async () => {
    const [foreign] = await db
      .insert(tenant)
      .values({ name: prefix, slug: prefix.toLowerCase() })
      .returning();
    const people = [];
    for (const scope of ["GLOBAL", "ASSIGNED"] as const) {
      const [r] = await db
        .insert(role)
        .values({ name: `${prefix}-${scope}`, dataScope: scope })
        .returning();
      await db
        .insert(rolePermission)
        .values(
          (
            [
              "use:ai_chat",
              "view:project",
              "view:budget",
              "view:material",
              "view:inventory",
              "view:bank_account",
            ] as const
          ).map((permissionKey) => ({ roleId: r.id, permissionKey })),
        );
      const [p] = await db
        .insert(user)
        .values({ name: prefix, email: randomUUID() + "@fixture.invalid", roleId: r.id })
        .returning();
      const access = await getRoleAccess(r.id);
      if (!access) throw new Error("Missing actual role");
      people.push({ ...access, userId: p.id });
    }
    [owner, assigned] = people;
    for (const [tenantId, suffix, isActive] of [
      [INSTANCE_TENANT_ID, "own", true],
      [foreign.id, "foreign", true],
      [INSTANCE_TENANT_ID, "inactive", false],
    ] as const) {
      await db.insert(bankAccount).values({
        tenantId,
        name: `${prefix}-${suffix}`,
        bankName: "Bank QA",
        holderName: "QA",
        accountNumber: randomUUID(),
        balance: "125000.25",
        isActive,
      });
    }
    for (const [tenantId, suffix] of [
      [INSTANCE_TENANT_ID, "own"],
      [foreign.id, "foreign"],
    ] as const) {
      const [c] = await db
        .insert(client)
        .values({
          tenantId,
          name: `${prefix}-${suffix}`,
          email: randomUUID() + "@fixture.invalid",
          phone: "-",
        })
        .returning();
      const [p] = await db
        .insert(project)
        .values({
          tenantId,
          name: `${prefix}-${suffix}`,
          clientId: c.id,
          projectManagerId: assigned.userId,
          status: "ACTIVE",
          totalContractValue: "125000.25",
        })
        .returning();
      if (suffix === "own") ownProjectId = p.id;
      else foreignProjectId = p.id;
      await db.insert(vendor).values({
        tenantId,
        name: `${prefix}-${suffix}`,
        email: randomUUID() + "@fixture.invalid",
        phone: "-",
        address: "QA",
      });
      const [cat] = await db
        .insert(materialCategory)
        .values({ tenantId, name: `${prefix}-${suffix}` })
        .returning();
      const [m] = await db
        .insert(materialMaster)
        .values({ tenantId, name: `${prefix}-${suffix}`, categoryId: cat.id, unit: "lembar" })
        .returning();
      const [l] = await db
        .insert(inventoryLocation)
        .values({ tenantId, name: `${prefix}-${suffix}` })
        .returning();
      await db.insert(materialInventory).values({
        tenantId,
        materialId: m.id,
        locationId: l.id,
        currentStock: "6.00",
        reservedStock: "2.00",
        averageCost: "1000.25",
      });
      if (suffix === "own") {
        const [foreignLocation] = await db
          .insert(inventoryLocation)
          .values({ tenantId: foreign.id, name: `${prefix}-foreign-stock` })
          .returning();
        await db.insert(materialInventory).values({
          tenantId: foreign.id,
          materialId: m.id,
          locationId: foreignLocation.id,
          currentStock: "9999.00",
        });
      }
    }
  });
  test("bank balances never include other-company or inactive accounts, and denied grants disclose nothing", async () => {
    const read = buildFinanceTools(owner).getBankBalances.execute;
    if (!read) throw new Error("Missing balance executor");
    const result = bankResult.parse(await read({}, options));
    expect(result.accounts.find((a) => a.accountName === `${prefix}-own`)?.balance.amount).toBe(
      125000.25,
    );
    expect(
      result.accounts.some(
        (a) => a.accountName === `${prefix}-foreign` || a.accountName === `${prefix}-inactive`,
      ),
    ).toBe(false);
    const expected = await db
      .select({ balance: bankAccount.balance })
      .from(bankAccount)
      .where(and(eq(bankAccount.tenantId, INSTANCE_TENANT_ID), eq(bankAccount.isActive, true)));
    expect(result.totalAvailable.amount).toBe(
      expected.reduce((sum, r) => sum + Number(r.balance), 0),
    );
    const denied = buildFinanceTools({ ...owner, permissions: [] }).getBankBalances.execute;
    if (!denied) throw new Error("Missing balance executor");
    expect(await denied({}, options)).toMatchObject({ error: expect.any(String) });
  });
  test("GLOBAL and ASSIGNED both exclude another tenant, and NONE never inherits an assignment", async () => {
    expect(await canAccessProject(owner, ownProjectId)).toBe(true);
    expect(await canAccessProject(owner, foreignProjectId)).toBe(false);
    expect(await canAccessProject(assigned, foreignProjectId)).toBe(false);
    for (const context of [owner, assigned]) {
      const read = buildProjectTools(context).listProjects.execute;
      if (!read) throw new Error("Missing project executor");
      const result = projectResult.parse(await read({ query: prefix, limit: 20 }, options));
      expect(result.projects.map((p) => p.projectId)).toEqual([ownProjectId]);
      expect(result.projects[0].contractValue.amount).toBe(125000.25);
    }
    const none: AiToolContext = { ...assigned, roleName: "OWNER", dataScope: "NONE" };
    expect(await accessibleProjectIds(none)).toEqual([]);
    expect(await canAccessProject(none, ownProjectId)).toBe(false);
    expect(buildAiTools(none).listProjects).toBeUndefined();
  });
  test("project-scoped budget reads return the current PM name without staff-management rights", async () => {
    const [budget] = await db
      .insert(projectBudgets)
      .values({ projectId: ownProjectId, contractValue: "125000.25", internalBudget: "112500.23" })
      .returning();
    const category = await db.query.expenseCategory.findFirst({
      where: and(
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        eq(expenseCategory.code, "MATERIAL"),
      ),
    });
    if (!category) throw new Error("Canonical Material fixture required");
    await db.insert(projectBudgetCategory).values({
      projectBudgetId: budget.id,
      expenseCategoryId: category.id,
      allocatedAmount: "60000.23",
      actualAmount: "15000.11",
      paidAmount: "12500.07",
      remainingAmount: "45000.12",
    });
    const execute = buildProjectTools(assigned).getProjectBudget.execute;
    if (!execute) throw new Error("Missing budget reader");
    const result = z.object({
      projectManager: z.object({ id: z.guid(), name: z.string() }),
      categories: z.array(
        z.object({
          categoryId: z.guid(),
          actual: z.object({ amount: z.number() }),
          paid: z.object({ amount: z.number() }),
          remaining: z.object({ amount: z.number() }),
        }),
      ),
    });
    expect(assigned.permissions).not.toContain("manage:users");
    const before = result.parse(await execute({ projectId: ownProjectId }, options));
    expect(before.projectManager.id).toBe(assigned.userId);
    expect(before.categories[0].actual.amount).toBe(15000.11);
    expect(before.categories[0].paid.amount).toBe(12500.07);
    expect(before.categories[0].remaining.amount).toBe(45000.12);
    await db
      .update(user)
      .set({ name: `${prefix}-PM terbaru` })
      .where(eq(user.id, assigned.userId));
    const after = result.parse(await execute({ projectId: ownProjectId }, options));
    expect(after.projectManager.name).toBe(`${prefix}-PM terbaru`);
    expect(after.projectManager.name).not.toBe(before.projectManager.name);
    expect(await execute({ projectId: foreignProjectId }, options)).toMatchObject({
      error: expect.any(String),
    });
  });
  test("client, vendor, material and location references stay in the instance", async () => {
    const tools = buildLookupTools(owner);
    if (
      !tools.listClients.execute ||
      !tools.listVendors.execute ||
      !tools.getMaterialCatalog.execute ||
      !tools.getInventoryLocations.execute
    )
      throw new Error("Missing reference executors");
    const clients = z
      .object({ clients: z.array(z.object({ name: z.string() })) })
      .parse(await tools.listClients.execute({ query: prefix, limit: 20 }, options));
    const vendors = z
      .object({ vendors: z.array(z.object({ name: z.string() })) })
      .parse(await tools.listVendors.execute({ query: prefix, limit: 20 }, options));
    const materials = z
      .object({
        materials: z.array(
          z.object({
            name: z.string(),
            totalStockOnHand: z.number(),
            totalAvailableStock: z.number(),
          }),
        ),
      })
      .parse(await tools.getMaterialCatalog.execute({ query: prefix, limit: 20 }, options));
    const locations = z
      .object({ locations: z.array(z.object({ name: z.string() })) })
      .parse(await tools.getInventoryLocations.execute({}, options));
    expect(clients.clients.map((r) => r.name)).toEqual([`${prefix}-own`]);
    expect(vendors.vendors.map((r) => r.name)).toEqual([`${prefix}-own`]);
    expect(materials.materials).toEqual([
      { name: `${prefix}-own`, totalStockOnHand: 6, totalAvailableStock: 4 },
    ]);
    expect(locations.locations.some((r) => r.name === `${prefix}-foreign`)).toBe(false);
  });
  test("material-only grants cannot disclose stock or its cost context", async () => {
    const materialOnly = {
      ...owner,
      permissions: owner.permissions.filter((p) => p !== "view:inventory"),
    };
    expect(buildAiTools(materialOnly).getMaterialCatalog).toBeUndefined();
    const execute = buildLookupTools(materialOnly).getMaterialCatalog.execute;
    if (!execute) throw new Error("Missing catalog executor");
    expect(await execute({ query: prefix, limit: 20 }, options)).toEqual({
      error: "Peran Anda tidak memiliki akses ke katalog material dan stok.",
    });
  });
});
