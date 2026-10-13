import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  expenseCategory,
  projectBudgets,
  projectBudgetCategory,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  projectRap,
  projectRapItem,
  projectCost,
  projectExpenses,
  stockMovement,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor, type Actor } from "@backend/server/actor";
import { prepareProjectStockProposal } from "@backend/server/usecases/ai/project-stock-context";
import * as writers from "@backend/server/usecases/material/project-stock-writer";
import {
  reserveMaterialForProject,
  useMaterialForProject,
  returnMaterialFromProject,
} from "@backend/app/actions/material/inventory-movements";
import { buildProjectStockTools } from "@backend/lib/ai/tools/project-stock-tools";
import { getAiProjectStockProposal, confirmAiProjectStockProposal } from "./project-stock";
import {
  projectStockInputSchema,
  type ProjectStockInput,
  type ProjectStockProposal,
} from "@atria/core/ai/project-stock";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
const prefix = `STOCKAI-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:material",
  "view:budget",
  "reserve:stock",
  "use:stock",
  "waste:stock",
  "create:stock_movement",
  "view:cost",
  "view:vendor_bill",
];
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
type Fixture = {
  projectId: string;
  budgetId: string;
  categoryId: string;
  materialId: string;
  locationId: string;
  inventoryId: string;
  rapItemId: string;
};
let owner: Person,
  assigned: Person,
  warehouse: Person,
  clientId: string,
  expenseId: string,
  materialCategoryId: string;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
function as(person: Person | null): void {
  api.getSession = async () =>
    person
      ? {
          user: person,
          session: {
            id: randomUUID(),
            userId: person.id,
            expiresAt: new Date(Date.now() + 3600000),
          },
        }
      : null;
}
function ok<T>(result: ActionResponse<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
async function actor(): Promise<Actor> {
  const value = await withTestRequest(resolveActor)();
  if (!value) throw new Error("No actor");
  return value;
}
const read = withTestRequest(getAiProjectStockProposal),
  save = withTestRequest(confirmAiProjectStockProposal),
  reserve = withTestRequest(reserveMaterialForProject),
  use = withTestRequest(useMaterialForProject),
  returnStock = withTestRequest(returnMaterialFromProject);
async function person(
  scope: "GLOBAL" | "ASSIGNED" | "NONE",
  permissions: readonly PermissionKey[] = grants,
): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  const [u] = await db
    .insert(user)
    .values({
      name: r.name,
      email: `${r.name}@fixture.invalid`,
      roleId: r.id,
      isActive: true,
      mustChangePassword: false,
    })
    .returning();
  return {
    id: u.id,
    roleId: r.id,
    name: u.name,
    email: u.email,
    isActive: true,
    mustChangePassword: false,
  };
}
async function fixture(stock = "100.00"): Promise<Fixture> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix}-${randomUUID().slice(0, 6)}`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: "10000.00",
    })
    .returning();
  const [b] = await db
    .insert(projectBudgets)
    .values({
      projectId: p.id,
      contractValue: "10000.00",
      internalBudget: "8000.00",
      budgetCapRatio: "0.8000",
      targetGrossPercentage: "20.00",
    })
    .returning();
  const [c] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: b.id,
      expenseCategoryId: expenseId,
      ratioPercentage: "0.5000",
      allocatedAmount: "4000.00",
      actualAmount: "0.00",
      remainingAmount: "4000.00",
    })
    .returning();
  const [m] = await db
    .insert(materialMaster)
    .values({
      name: `${prefix} Panel ${randomUUID().slice(0, 4)}`,
      categoryId: materialCategoryId,
      unit: "lembar",
    })
    .returning();
  const [l] = await db
    .insert(inventoryLocation)
    .values({ name: `${prefix} gudang ${randomUUID().slice(0, 4)}` })
    .returning();
  const [i] = await db
    .insert(materialInventory)
    .values({
      materialId: m.id,
      locationId: l.id,
      currentStock: stock,
      reservedStock: "0.00",
      averageCost: "10.00",
    })
    .returning();
  const [r] = await db
    .insert(projectRap)
    .values({ projectId: p.id, status: "LOCKED", setupStage: "COMPLETE" })
    .returning();
  const [ri] = await db
    .insert(projectRapItem)
    .values({
      projectRapId: r.id,
      materialId: m.id,
      name: "Panel dapur",
      area: "Dapur",
      requiredQuantity: "20.00",
      bufferQuantity: "0.00",
      totalQuantity: "20.00",
      unit: "lembar",
      estimatedUnitCost: "10.00",
      estimatedTotalCost: "200.00",
    })
    .returning();
  await db.insert(stockMovement).values({
    materialId: m.id,
    inventoryLocationId: l.id,
    movementType: "STOCK_IN",
    movementDirection: "IN",
    quantity: stock,
    unitCost: "10.00",
    createdById: owner.id,
    note: "Synthetic opening stock",
  });
  return {
    projectId: p.id,
    budgetId: b.id,
    categoryId: c.id,
    materialId: m.id,
    locationId: l.id,
    inventoryId: i.id,
    rapItemId: ri.id,
  };
}
function input(
  f: Fixture,
  action: ProjectStockInput["action"],
  quantity = 10,
): z.input<typeof projectStockInputSchema> {
  return {
    projectId: f.projectId,
    action,
    rows: [
      {
        materialId: f.materialId,
        inventoryLocationId: f.locationId,
        projectRapItemId: f.rapItemId,
        quantity,
        note: "Permintaan stok proyek",
      },
    ],
  };
}
async function proof(raw: z.input<typeof projectStockInputSchema>): Promise<{
  identity: { conversationId: string; toolCallId: string };
  proposal: ProjectStockProposal;
  messageId: string;
}> {
  const a = await actor(),
    proposal = await prepareProjectStockProposal(a, raw),
    toolCallId = randomUUID();
  const [conversation] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  const [message] = await db
    .insert(aiMessage)
    .values({
      conversationId: conversation.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeProjectStock",
          state: "output-available",
          toolCallId,
          output: { proposal },
        },
      ],
    })
    .returning();
  return {
    identity: { conversationId: conversation.id, toolCallId },
    proposal,
    messageId: message.id,
  };
}
async function inventory(f: Fixture) {
  return (await db.query.materialInventory.findFirst({
    where: eq(materialInventory.id, f.inventoryId),
  }))!;
}
async function actual(f: Fixture): Promise<number> {
  return Number(
    (
      await db.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, f.categoryId),
      })
    )?.actualAmount,
  );
}
async function receipts(id: string): Promise<number> {
  return Number(
    (
      await db
        .select({ n: count() })
        .from(aiProposalConfirmation)
        .where(eq(aiProposalConfirmation.conversationId, id))
    )[0].n,
  );
}
describeIntegration("AI project stock actions", () => {
  beforeAll(async () => {
    const [cl] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "000000" })
      .returning();
    clientId = cl.id;
    const e = await db.query.expenseCategory.findFirst({
      where: eq(expenseCategory.code, "MATERIAL"),
    });
    if (!e) throw new Error("Seeded Material category missing");
    expenseId = e.id;
    const [m] = await db.insert(materialCategory).values({ name: prefix }).returning();
    materialCategoryId = m.id;
    owner = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    warehouse = await person(
      "NONE",
      grants.filter((p) => p !== "view:budget" && p !== "view:cost" && p !== "view:vendor_bill"),
    );
  });
  beforeEach(() => as(owner));
  afterAll(() => {
    api.getSession = original;
  });
  test("reserve/use/return preserve exact own quota, noncash actuals, audit, direction and zero cash", async () => {
    const f = await fixture(),
      cashBefore = Number((await db.select({ n: count() }).from(cashTransaction))[0].n);
    const r = await proof(input(f, "RESERVE", 20));
    expect(ok(await read(r.identity)).status).toBe("READY");
    ok(await save(r.identity));
    expect((await inventory(f)).currentStock).toBe("100.00");
    expect((await inventory(f)).reservedStock).toBe("20.00");
    expect(await actual(f)).toBe(0);
    const u = await proof(input(f, "USE", 12));
    expect(u.proposal.budget?.costDelta).toBe(120);
    ok(await save(u.identity));
    expect((await inventory(f)).currentStock).toBe("88.00");
    expect((await inventory(f)).reservedStock).toBe("8.00");
    expect(await actual(f)).toBe(120);
    const back = await proof(input(f, "RETURN", 4));
    expect(back.proposal.budget?.costDelta).toBe(-40);
    ok(await save(back.identity));
    expect((await inventory(f)).currentStock).toBe("92.00");
    expect((await inventory(f)).reservedStock).toBe("8.00");
    expect(await actual(f)).toBe(80);
    const moves = await db.query.stockMovement.findMany({
      where: eq(stockMovement.projectId, f.projectId),
      orderBy: stockMovement.createdAt,
    });
    expect(moves.map((m) => m.movementType)).toEqual(["RESERVE", "USE", "RETURN"]);
    expect(moves.map((m) => m.movementDirection)).toEqual(["NEUTRAL", "OUT", "IN"]);
    expect(
      Number(
        (
          await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, f.inventoryId))
        )[0].n,
      ),
    ).toBe(3);
    expect(Number((await db.select({ n: count() }).from(cashTransaction))[0].n)).toBe(cashBefore);
    const expenses = await db.query.projectExpenses.findMany({
      where: eq(projectExpenses.projectId, f.projectId),
    });
    expect(expenses.every((e) => !e.isCashImpact && e.paymentStatus === "NON_CASH")).toBe(true);
  });
  test("manual actions share writer; unreserved use protects another project's reserved stock and return net usage", async () => {
    const f = await fixture(),
      other = await fixture();
    ok(
      await reserve({
        ...input(f, "RESERVE", 80).rows[0],
        projectId: other.projectId,
        projectRapItemId: null,
      }),
    );
    await expect(prepareProjectStockProposal(await actor(), input(f, "USE", 21))).rejects.toThrow(
      "STOCK_RESERVED_FOR_OTHER_PROJECTS",
    );
    ok(await use({ ...input(f, "USE", 10).rows[0], projectId: f.projectId }));
    expect((await inventory(f)).reservedStock).toBe("80.00");
    expect((await inventory(f)).currentStock).toBe("90.00");
    await expect(
      prepareProjectStockProposal(await actor(), input(f, "RETURN", 11)),
    ).rejects.toThrow("RETURN_EXCEEDS_PROJECT_USAGE");
    ok(await returnStock({ ...input(f, "RETURN", 2).rows[0], projectId: f.projectId }));
    expect((await inventory(f)).currentStock).toBe("92.00");
  });
  test("linked paid Material source is counted once, credited on return and restored on reuse", async () => {
    const f = await fixture();
    const [cost] = await db
      .insert(projectCost)
      .values({
        projectId: f.projectId,
        projectBudgetCategoryId: f.categoryId,
        materialId: f.materialId,
        projectRapItemId: f.rapItemId,
        requestedById: owner.id,
        quantity: "10.00",
        unitPrice: "10.00",
        amount: "100.00",
        description: "Paid synthetic Material",
        status: "PAID",
      })
      .returning();
    await db.insert(projectExpenses).values({
      projectId: f.projectId,
      projectBudgetId: f.budgetId,
      projectBudgetCategoryId: f.categoryId,
      expenseCategoryId: expenseId,
      legacyProjectCostId: cost.id,
      materialId: f.materialId,
      projectRapItemId: f.rapItemId,
      requestedById: owner.id,
      quantity: "10.00",
      unitCost: "10.00",
      amount: "100.00",
      description: "Paid synthetic Material",
      status: "PAID",
      sourceType: "CASH_EXPENSE",
      paymentStatus: "PAID",
    });
    await db
      .update(projectBudgetCategory)
      .set({ actualAmount: "100.00", paidAmount: "100.00", remainingAmount: "3900.00" })
      .where(eq(projectBudgetCategory.id, f.categoryId));
    async function linked(action: ProjectStockInput["action"], quantity: number): Promise<number> {
      const raw = input(f, action, quantity);
      raw.rows[0].projectCostId = cost.id;
      const p = await proof(raw);
      ok(await save(p.identity));
      return p.proposal.budget?.costDelta ?? 0;
    }
    expect(await linked("USE", 4)).toBe(0);
    expect(await actual(f)).toBe(100);
    expect(await linked("RETURN", 2)).toBe(-20);
    expect(await actual(f)).toBe(80);
    expect(await linked("USE", 2)).toBe(20);
    expect(await actual(f)).toBe(100);
  });
  test("fresh proof/receipt checks ownership, scope, expiry, live revocation and rejects client mutation fields", async () => {
    const f = await fixture(),
      p = await proof(input(f, "RESERVE"));
    as(assigned);
    expect((await save(p.identity)).success).toBe(false);
    as(owner);
    expect((await save({ ...p.identity, quantity: 50 })).success).toBe(false);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "reserve:stock"),
        ),
      );
    expect((await save(p.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: owner.roleId, permissionKey: "reserve:stock" });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p.messageId));
    expect(ok(await read(p.identity)).status).toBe("EXPIRED");
    expect((await save(p.identity)).success).toBe(false);
    expect((await inventory(f)).reservedStock).toBe("0.00");
  });
  test("Purchasing-style NONE warehouse rights stay domain-only; ASSIGNED never escapes assignment", async () => {
    const f = await fixture();
    as(warehouse);
    const p = await proof(input(f, "RESERVE"));
    expect(p.proposal.budget).toBeNull();
    ok(await save(p.identity));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, warehouse.roleId),
          eq(rolePermission.permissionKey, "create:stock_movement"),
        ),
      );
    expect((await read(p.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: warehouse.roleId, permissionKey: "create:stock_movement" });
    as(assigned);
    const q = await proof(input(f, "RESERVE", 2));
    ok(await save(q.identity));
    const foreign = await fixture();
    await db
      .update(project)
      .set({ projectManagerId: owner.id })
      .where(eq(project.id, foreign.projectId));
    await expect(
      prepareProjectStockProposal(await actor(), input(foreign, "RESERVE")),
    ).rejects.toThrow("Proyek di luar akses Anda");
  });
  test("concurrent confirmation/double click replays exactly one batch receipt", async () => {
    const f = await fixture(),
      p = await proof(input(f, "RESERVE", 10));
    const results = await Promise.all([save(p.identity), save(p.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map((r) => ok(r).alreadyConfirmed).sort()).toEqual([false, true]);
    expect(await receipts(p.identity.conversationId)).toBe(1);
    expect((await inventory(f)).reservedStock).toBe("10.00");
  });
  test("manual change after preview makes AI stale without a stock write", async () => {
    const f = await fixture(),
      p = await proof(input(f, "RESERVE", 10));
    ok(await reserve({ ...input(f, "RESERVE", 3).rows[0], projectId: f.projectId }));
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    expect((await inventory(f)).reservedStock).toBe("3.00");
    expect(await receipts(p.identity.conversationId)).toBe(0);
  });
  test("concurrent manual stock write holds the project lock; AI resumes only to reject stale preview", async () => {
    const f = await fixture(),
      p = await proof(input(f, "RESERVE", 10)),
      a = await actor();
    const latch: { ready?: () => void; release?: () => void } = {};
    const ready = new Promise<void>((resolve) => {
        latch.ready = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        latch.release = resolve;
      });
    const manual = db.transaction(async (tx) => {
      await writers.writeProjectStockRowTx(
        tx,
        a,
        f.projectId,
        "RESERVE",
        input(f, "RESERVE", 3).rows[0],
      );
      latch.ready?.();
      await gate;
    });
    await ready;
    let finished = false;
    const pending = save(p.identity).then((result) => {
      finished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(finished).toBe(false);
    latch.release?.();
    await manual;
    expect((await pending).success).toBe(false);
    expect((await inventory(f)).reservedStock).toBe("3.00");
    expect(await receipts(p.identity.conversationId)).toBe(0);
  });
  test("later write failure rolls back every stock/audit/expense and permits an idempotent retry", async () => {
    const f = await fixture(),
      g = await fixture();
    const raw = input(f, "USE", 3);
    raw.rows.push({ ...input(g, "USE", 4).rows[0], projectRapItemId: null });
    const p = await proof(raw),
      originalWrite = writers.writeProjectStockRowTx;
    let calls = 0;
    const mock = spyOn(writers, "writeProjectStockRowTx").mockImplementation(async (...args) => {
      if (++calls === 2) throw new Error("Injected later failure");
      return originalWrite(...args);
    });
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      mock.mockRestore();
    }
    expect((await inventory(f)).currentStock).toBe("100.00");
    expect((await inventory(g)).currentStock).toBe("100.00");
    expect(await actual(f)).toBe(0);
    expect(await receipts(p.identity.conversationId)).toBe(0);
    expect(
      Number(
        (
          await db.select({ n: count() }).from(auditLog).where(eq(auditLog.targetId, f.inventoryId))
        )[0].n,
      ),
    ).toBe(0);
    ok(await save(p.identity));
    expect(await receipts(p.identity.conversationId)).toBe(1);
    expect((await inventory(f)).currentStock).toBe("97.00");
    expect((await inventory(g)).currentStock).toBe("96.00");
  });
  test("lookup scopes and financial masks; changed average cost/budget permission require a new exact preview", async () => {
    const f = await fixture(),
      p = await proof(input(f, "USE", 2));
    await db
      .update(materialInventory)
      .set({ averageCost: "12.00" })
      .where(eq(materialInventory.id, f.inventoryId));
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    const q = await proof(input(f, "USE", 2));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "view:budget"),
        ),
      );
    const view = ok(await read(q.identity));
    expect(view.proposal.budget).toBeNull();
    expect(view.status).toBe("STALE");
    expect((await save(q.identity)).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: owner.roleId, permissionKey: "view:budget" });
    as(warehouse);
    const a = await actor(),
      tools = buildProjectStockTools({ ...a, roleName: "CUSTOM" });
    const lookup = tools.getProjectStockContext;
    if (!lookup.execute) throw new Error("No tool");
    const result = await lookup.execute(
      { projectId: f.projectId, materialId: f.materialId, offset: 0 },
      { toolCallId: randomUUID(), messages: [], abortSignal: undefined, context: {} },
    );
    expect(JSON.stringify(result)).toContain(f.materialId);
    expect(JSON.stringify(result)).toContain('"budget":null');
  });
  test("release and waste share manual writers, preserve other quotas/cash and create auditable noncash waste", async () => {
    const f = await fixture(),
      cashBefore = Number((await db.select({ n: count() }).from(cashTransaction))[0].n);
    ok(await save((await proof(input(f, "RESERVE", 20))).identity));
    const released = await proof(input(f, "RELEASE_RESERVATION", 7));
    expect(released.proposal.costEffect).toBe("NONE");
    const result = ok(await save(released.identity));
    expect(ok(await save(released.identity)).alreadyConfirmed).toBe(true);
    expect((await inventory(f)).reservedStock).toBe("13.00");
    expect((await inventory(f)).currentStock).toBe("100.00");
    expect(await actual(f)).toBe(0);
    const movement = await db.query.stockMovement.findFirst({
      where: eq(stockMovement.id, result.resultId),
    });
    expect(movement?.movementType).toBe("RELEASE_RESERVATION");
    expect(movement?.movementDirection).toBe("NEUTRAL");
    await expect(proof(input(f, "RELEASE_RESERVATION", 14))).rejects.toThrow();
    const waste = await proof(input(f, "WASTE", 5));
    expect(waste.proposal.budget?.costDelta).toBe(50);
    ok(await save(waste.identity));
    expect((await inventory(f)).currentStock).toBe("95.00");
    expect((await inventory(f)).reservedStock).toBe("8.00");
    expect(await actual(f)).toBe(50);
    await expect(proof(input(f, "RETURN", 1))).rejects.toThrow();
    const manual = await import("@backend/app/actions/material/inventory-project-movements");
    const row = input(f, "RELEASE_RESERVATION", 2).rows[0];
    ok(
      await withTestRequest(manual.releaseMaterialReservation)({ ...row, projectId: f.projectId }),
    );
    const stale = await proof(input(f, "WASTE", 1));
    ok(
      await withTestRequest(manual.wasteMaterialForProject)({
        ...row,
        projectId: f.projectId,
        quantity: 1,
      }),
    );
    expect((await save(stale.identity)).success).toBe(false);
    expect((await inventory(f)).reservedStock).toBe("5.00");
    expect(Number((await db.select({ n: count() }).from(cashTransaction))[0].n)).toBe(cashBefore);
    const audits = await db.query.auditLog.findMany({
      where: eq(auditLog.targetId, f.inventoryId),
    });
    expect(audits.some((a) => a.action === "WASTE_MATERIAL")).toBe(true);
    expect(audits.some((a) => a.action === "RELEASE_MATERIAL_RESERVATION")).toBe(true);
  });
  test("release does not consume another RAP reservation and revoked waste rights prevent confirmation", async () => {
    const f = await fixture();
    ok(await save((await proof(input(f, "RESERVE", 10))).identity));
    const wrong = input(f, "RELEASE_RESERVATION", 1);
    wrong.rows[0].projectRapItemId = null;
    await expect(proof(wrong)).rejects.toThrow();
    const w = await proof(input(f, "WASTE", 1));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, owner.roleId),
          eq(rolePermission.permissionKey, "waste:stock"),
        ),
      );
    try {
      expect((await save(w.identity)).success).toBe(false);
      expect((await inventory(f)).currentStock).toBe("100.00");
    } finally {
      await db
        .insert(rolePermission)
        .values({ roleId: owner.roleId, permissionKey: "waste:stock" });
    }
  });
});
