import type { z } from "zod";
import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  INSTANCE_TENANT_ID,
  role,
  rolePermission,
  user,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  rabEstimate,
  rabEstimateItem,
  projectChangeOrder,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  cashTransaction,
  stockMovement,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { resolveActor } from "@backend/server/actor";
import {
  readRabWorkflowContext,
  buildRabWorkflowProposal,
} from "@backend/server/usecases/ai/rab-workflow-context";
import * as writers from "@backend/server/usecases/project/rab-workflow-writer";
import { buildRabWorkflowTools } from "@backend/lib/ai/tools/rab-workflow-tools";
import { getAiRabWorkflowProposal, confirmAiRabWorkflowProposal } from "./rab-workflow";
import { updateRabEstimateItem } from "@backend/app/actions/project/rab-item-actions";
import { createRabBundle } from "@backend/app/actions/project/rap-rab-bundles";
import { approveRabEstimate } from "@backend/app/actions/project/rap-rab-approval";
import {
  rabWorkflowInputSchema,
  rabWorkflowRequestSchema,
  type RabWorkflowLine,
  type RabWorkflowProposal,
  type RabWorkflowReceipt,
} from "@atria/core/ai/rab-workflow";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";

const prefix = `RABWF-${randomUUID().slice(0, 8)}`;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:rab",
  "view:budget",
  "create:rab",
  "update:rab",
  "approve:rab",
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
  rabId: string;
  itemIds: string[];
  budgetId: string;
  manualCategoryId: string;
  packageId: string;
};
let maker: Person,
  checker: Person,
  assigned: Person,
  clientId: string,
  materialCategory: string,
  laborCategory: string;
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
const read = withTestRequest(getAiRabWorkflowProposal),
  save = withTestRequest(confirmAiRabWorkflowProposal),
  manualEdit = withTestRequest(updateRabEstimateItem),
  manualApprove = withTestRequest(approveRabEstimate),
  manualBundle = withTestRequest(createRabBundle);
async function actor(): Promise<NonNullable<Awaited<ReturnType<typeof resolveActor>>>> {
  const result = await withTestRequest(resolveActor)();
  if (!result) throw new Error("No actor");
  return result;
}
async function person(scope: "GLOBAL" | "ASSIGNED"): Promise<Person> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 6)}`, dataScope: scope })
    .returning();
  await db
    .insert(rolePermission)
    .values(grants.map((permissionKey) => ({ roleId: r.id, permissionKey })));
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
async function fixture(approved = false): Promise<Fixture> {
  const [p] = await db
    .insert(project)
    .values({
      name: `${prefix}-${randomUUID().slice(0, 6)}`,
      clientId,
      projectManagerId: assigned.id,
      status: "ACTIVE",
      totalContractValue: approved ? "250000.00" : "1000000.00",
    })
    .returning();
  const [b] = await db
    .insert(projectBudgets)
    .values({
      projectId: p.id,
      contractValue: approved ? "250000.00" : "1000000.00",
      internalBudget: approved ? "160000.00" : "800000.00",
      budgetCapRatio: "0.8000",
      targetGrossPercentage: "20.00",
    })
    .returning();
  const [mat] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: b.id,
      expenseCategoryId: materialCategory,
      ratioPercentage: "0.5000",
      allocatedAmount: approved ? "80000.00" : "400000.00",
      actualAmount: "50000.00",
      remainingAmount: approved ? "30000.00" : "350000.00",
    })
    .returning();
  const [lab] = await db
    .insert(projectBudgetCategory)
    .values({
      projectBudgetId: b.id,
      expenseCategoryId: laborCategory,
      ratioPercentage: "0.3000",
      allocatedAmount: "123456.00",
      isManualOverride: true,
    })
    .returning();
  const [rap] = await db
    .insert(projectRap)
    .values({ projectId: p.id, status: "LOCKED", setupStage: "COMPLETE" })
    .returning();
  const [source] = await db
    .insert(projectRapItem)
    .values({
      projectRapId: rap.id,
      name: "Panel dapur",
      area: "Dapur",
      unit: "lembar",
      requiredQuantity: "2.00",
      bufferQuantity: "0.00",
      totalQuantity: "2.00",
      estimatedUnitCost: "10000.00",
      estimatedTotalCost: "20000.00",
      suggestedClientUnitPrice: "100000.00",
      description: "PRIVATE_SCOPE",
      internalNote: "PRIVATE_VENDOR_MARGIN",
      source: "PURCHASE",
    })
    .returning();
  const [pkg] = await db
    .insert(projectCategoryPlanItem)
    .values({
      projectId: p.id,
      projectBudgetId: b.id,
      projectBudgetCategoryId: lab.id,
      expenseCategoryId: laborCategory,
      name: "Biaya desain",
      area: "Dapur",
      quantity: "1.00",
      unit: "paket",
      estimatedUnitCost: "1000.00",
      estimatedTotalCost: "1000.00",
      internalNote: "PRIVATE_NOTE",
      scopeDescription: "PRIVATE_SCOPE",
      status: "ACTIVE",
    })
    .returning();
  const [rab] = await db
    .insert(rabEstimate)
    .values({
      projectId: p.id,
      sourceProjectRapId: rap.id,
      title: "Penawaran dapur",
      clientNotes: "Catatan aman untuk klien",
      status: approved ? "APPROVED" : "DRAFT",
      approvedValue: approved ? "250000.00" : "0.00",
      revision: 1,
    })
    .returning();
  const lines = await db
    .insert(rabEstimateItem)
    .values([
      {
        rabEstimateId: rab.id,
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: source.id,
        clientLabel: "Panel dapur",
        description: "Finishing klien",
        quantity: "2.00",
        unit: "lembar",
        unitPrice: "100000.00",
        lineTotal: "200000.00",
        displayOrder: 1,
      },
      {
        rabEstimateId: rab.id,
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: pkg.id,
        clientLabel: "Biaya desain",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "50000.00",
        lineTotal: "50000.00",
        itemNature: "SERVICE_FEE",
        displayOrder: 2,
      },
      {
        rabEstimateId: rab.id,
        sourceType: "MANUAL",
        clientLabel: "Alternatif tersembunyi",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "500000.00",
        lineTotal: "500000.00",
        isHidden: true,
        displayOrder: 3,
      },
    ])
    .returning();
  expect(mat.actualAmount).toBe("50000.00");
  return {
    projectId: p.id,
    rabId: rab.id,
    itemIds: lines.map((row) => row.id),
    budgetId: b.id,
    manualCategoryId: lab.id,
    packageId: pkg.id,
  };
}
type Prepared = {
  conversationId: string;
  toolCallId: string;
  messageId: string;
  proposal: RabWorkflowProposal;
};
async function prepare(
  f: Fixture,
  request: z.input<typeof rabWorkflowRequestSchema>,
  who = maker,
): Promise<Prepared> {
  as(who);
  const a = await actor(),
    context = await readRabWorkflowContext(a, f.projectId, f.rabId);
  const proposal = buildRabWorkflowProposal(
    a,
    rabWorkflowInputSchema.parse({ projectId: f.projectId, rabEstimateId: f.rabId, request }),
    context,
  );
  const [c] = await db.insert(aiConversation).values({ userId: who.id }).returning(),
    toolCallId = randomUUID();
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        {
          type: "tool-proposeRabWorkflow",
          toolCallId,
          state: "output-available",
          output: { proposal },
        },
      ],
    })
    .returning();
  return { conversationId: c.id, toolCallId, messageId: m.id, proposal };
}
function identity(p: Prepared): { conversationId: string; toolCallId: string } {
  return { conversationId: p.conversationId, toolCallId: p.toolCallId };
}
async function fields(f: Fixture, index = 0): Promise<RabWorkflowLine> {
  const context = await readRabWorkflowContext(await actor(), f.projectId, f.rabId),
    row = context.items.find((item) => item.id === f.itemIds[index]);
  if (!row) throw new Error("No item");
  return {
    clientLabel: row.clientLabel,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unitPrice,
    itemNature: row.itemNature,
    isHidden: row.isHidden,
  };
}
async function invariant(): Promise<string> {
  const [cash, stock, inventory] = await Promise.all([
    db.select({ n: count() }).from(cashTransaction),
    db.select({ n: count() }).from(stockMovement),
    db.query.materialInventory.findMany({ orderBy: (t, { asc }) => [asc(t.id)] }),
  ]);
  return JSON.stringify({ cash, stock, inventory });
}
async function revision(f: Fixture): Promise<Fixture> {
  const p = await prepare(f, {
    action: "CREATE_REVISION",
    reason: "Perubahan lingkup dapur yang disepakati",
  });
  const created = ok(await save(identity(p)));
  const r = await db.query.rabEstimate.findFirst({
    where: eq(rabEstimate.id, created.resultId),
    with: { items: true },
  });
  if (!r) throw new Error("No revision");
  return {
    ...f,
    rabId: r.id,
    itemIds: r.items.sort((a, b) => a.displayOrder - b.displayOrder).map((row) => row.id),
  };
}
async function order(f: Fixture): Promise<string> {
  const p = await prepare(f, {
    action: "CREATE_CHANGE_ORDER",
    reason: "Perubahan lingkup pekerjaan yang dibutuhkan",
    scopeSummary: "Finishing dapur sesuai gambar kerja terbaru",
  });
  return ok(await save(identity(p))).resultId;
}
async function clientConfirmation(f: Fixture, changeOrderId: string): Promise<void> {
  const p = await prepare(f, {
    action: "CONFIRM_CLIENT",
    changeOrderId,
    confirmedAt: new Date(Date.now() - 86400000).toISOString(),
    confirmationReference: "Persetujuan klien REF-01",
  });
  ok(await save(identity(p)));
}

describeIntegration("AI complete existing RAB workflow", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({
        id: INSTANCE_TENANT_ID,
        name: "Disposable RAB workflow",
        slug: "disposable-rab-workflow",
      })
      .onConflictDoNothing();
    maker = await person("GLOBAL");
    checker = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    const [c] = await db
      .insert(client)
      .values({ name: prefix, email: `${prefix}@fixture.invalid`, phone: "0800000000" })
      .returning();
    clientId = c.id;
    const mat = await db.query.expenseCategory.findFirst({
        where: eq(expenseCategory.code, "MATERIAL"),
      }),
      lab = await db.query.expenseCategory.findFirst({ where: eq(expenseCategory.code, "TUKANG") });
    materialCategory =
      mat?.id ??
      (
        await db.insert(expenseCategory).values({ code: "MATERIAL", name: "Material" }).returning()
      )[0].id;
    laborCategory =
      lab?.id ??
      (await db.insert(expenseCategory).values({ code: "TUKANG", name: "Tukang" }).returning())[0]
        .id;
  });
  beforeEach(() => as(maker));
  test("default selling prices with fractional cents do not block context or initial approval", async () => {
    const f = await fixture();
    const item = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, f.itemIds[0]),
    });
    if (!item?.sourceProjectRapItemId) throw new Error("Missing linked fixture");
    await db
      .update(projectBudgets)
      .set({ targetGrossPercentage: "10.0000" })
      .where(eq(projectBudgets.id, f.budgetId));
    await db
      .update(projectRapItem)
      .set({ suggestedClientUnitPrice: "0.00", estimatedUnitCost: "100000.00" })
      .where(eq(projectRapItem.id, item.sourceProjectRapItemId));
    const unchanged = await invariant();
    const context = await readRabWorkflowContext(await actor(), f.projectId, f.rabId);
    expect(
      context.sourceRefresh?.find((change) => change.itemId === item.id)?.after.unitPrice,
    ).toBe(111111.11);
    const proposal = await prepare(f, { action: "APPROVE_INITIAL" });
    expect(proposal.proposal.request.action).toBe("APPROVE_INITIAL");
    expect(await invariant()).toBe(unchanged);
  });
  test("source refresh previews exact client-safe changes, preserves manual/bundle fields and is replay-safe", async () => {
    const f = await fixture();
    const before = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, f.itemIds[0]),
    });
    if (!before?.sourceProjectRapItemId) throw new Error("Missing linked fixture");
    await db
      .update(projectRapItem)
      .set({ totalQuantity: "4.00", suggestedClientUnitPrice: "110000.00", updatedAt: new Date() })
      .where(eq(projectRapItem.id, before.sourceProjectRapItemId));
    const p = await prepare(f, { action: "REFRESH_SOURCES" });
    expect(p.proposal.rows.find((row) => row.id === f.itemIds[0])?.after?.quantity).toBe(4);
    expect(JSON.stringify(p.proposal)).not.toContain("PRIVATE_VENDOR_MARGIN");
    expect(JSON.stringify(p.proposal)).not.toContain("PRIVATE_SCOPE");
    const unchanged = await invariant();
    const receipts = await Promise.all([save(identity(p)), save(identity(p))]);
    expect(receipts.every((result) => result.success)).toBe(true);
    expect(
      receipts.filter((result) => result.success && result.data.alreadyConfirmed),
    ).toHaveLength(1);
    const after = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, f.itemIds[0]),
    });
    expect(after?.quantity).toBe("4.00");
    expect(after?.unitPrice).toBe("110000.00");
    expect(after?.clientLabel).toBe(before.clientLabel);
    expect(after?.description).toBe(before.description);
    expect(after?.isHidden).toBe(before.isHidden);
    expect(after?.bundleId).toBe(before.bundleId);
    const manual = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, f.itemIds[2]),
    });
    expect(manual?.unitPrice).toBe("500000.00");
    expect(await invariant()).toBe(unchanged);
    expect(
      await db.query.auditLog.findFirst({
        where: and(
          eq(auditLog.targetId, f.rabId),
          eq(auditLog.action, "REFRESH_RAB_LINKED_SOURCES"),
        ),
      }),
    ).toBeDefined();
  });
  test("source changes after preview and approved RABs block refresh", async () => {
    const f = await fixture(),
      p = await prepare(f, { action: "REFRESH_SOURCES" });
    const linked = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, f.itemIds[0]),
    });
    if (!linked?.sourceProjectRapItemId) throw new Error("Missing source");
    await db
      .update(projectRapItem)
      .set({ totalQuantity: "9.00", updatedAt: new Date() })
      .where(eq(projectRapItem.id, linked.sourceProjectRapItemId));
    expect(ok(await read(identity(p))).status).toBe("STALE");
    expect((await save(identity(p))).success).toBe(false);
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toBeUndefined();
    await expect(prepare(await fixture(true), { action: "REFRESH_SOURCES" })).rejects.toThrow();
  });

  afterAll(() => {
    api.getSession = original;
  });
  test("batch corrections, hidden lines, replay and audit create no stock/cash movements", async () => {
    const f = await fixture(),
      before = await invariant(),
      values = await fields(f);
    const p = await prepare(f, {
      action: "EDIT_DRAFT",
      title: "Penawaran dapur terkoreksi",
      clientNotes: "Catatan klien baru",
      rows: [
        { action: "UPDATE", itemId: f.itemIds[0], fields: { ...values, unitPrice: 120000 } },
        { action: "EXCLUDE", itemId: f.itemIds[1] },
        {
          action: "ADD",
          fields: {
            ...values,
            clientLabel: "Aksesori tambahan",
            quantity: 1,
            unit: "paket",
            unitPrice: 10000,
          },
        },
      ],
    });
    expect(ok(await read(identity(p))).status).toBe("READY");
    expect((await save({ ...identity(p), userId: checker.id })).success).toBe(false);
    const receipts = await Promise.all([save(identity(p)), save(identity(p))]);
    expect(receipts.every((r) => r.success)).toBe(true);
    expect(receipts.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    const current = await readRabWorkflowContext(await actor(), f.projectId, f.rabId);
    expect(current.records.rab.title).toBe("Penawaran dapur terkoreksi");
    expect(current.items).toHaveLength(4);
    expect(current.items.find((row) => row.id === f.itemIds[0])?.unitPrice).toBe(120000);
    expect(current.items.find((row) => row.id === f.itemIds[1])?.isHidden).toBe(true);
    expect(await invariant()).toBe(before);
    expect(ok(await read(identity(p))).status).toBe("CONFIRMED");
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toHaveLength(1);
    expect(
      (await db.query.auditLog.findMany({ where: eq(auditLog.targetId, f.itemIds[0]) })).length,
    ).toBeGreaterThan(0);
  });
  test("bundle creation, correction and dissolution preserve members without double-counting", async () => {
    const f = await fixture(),
      before = await invariant(),
      p = await prepare(f, {
        action: "CREATE_BUNDLE",
        itemIds: f.itemIds.slice(0, 2),
        fields: {
          clientLabel: "Paket finishing",
          description: "Paket klien",
          quantity: 1,
          unit: "paket",
          unitPrice: 210000,
          isHidden: false,
        },
      });
    ok(await save(identity(p)));
    let c = await readRabWorkflowContext(await actor(), f.projectId, f.rabId);
    expect(c.bundles).toHaveLength(1);
    expect(c.items.filter((row) => row.bundleId)).toHaveLength(2);
    const bundle = c.bundles[0],
      u = await prepare(f, {
        action: "UPDATE_BUNDLE",
        bundleId: bundle.id,
        fields: {
          clientLabel: bundle.clientLabel,
          description: bundle.description,
          quantity: 1,
          unit: "paket",
          unitPrice: 220000,
          isHidden: false,
        },
      });
    ok(await save(identity(u)));
    const d = await prepare(f, { action: "DISSOLVE_BUNDLE", bundleId: bundle.id });
    ok(await save(identity(d)));
    c = await readRabWorkflowContext(await actor(), f.projectId, f.rabId);
    expect(c.bundles).toHaveLength(0);
    expect(c.items.every((row) => !row.bundleId)).toBe(true);
    expect(await invariant()).toBe(before);
  });
  test("initial approval derives contract/budget, preserves manual allocations and locks source packages", async () => {
    const f = await fixture(),
      before = await invariant(),
      p = await prepare(f, { action: "APPROVE_INITIAL" }, checker);
    expect(p.proposal.budgetImpact?.contractAfter).toBe(250000);
    expect(p.proposal.budgetImpact?.capAfter).toBe(160000);
    ok(await save(identity(p)));
    expect(
      (await db.query.project.findFirst({ where: eq(project.id, f.projectId) }))
        ?.totalContractValue,
    ).toBe("250000.00");
    expect(
      (await db.query.projectBudgets.findFirst({ where: eq(projectBudgets.id, f.budgetId) }))
        ?.internalBudget,
    ).toBe("160000.00");
    expect(
      (
        await db.query.projectBudgetCategory.findFirst({
          where: eq(projectBudgetCategory.id, f.manualCategoryId),
        })
      )?.allocatedAmount,
    ).toBe("123456.00");
    expect(
      (
        await db.query.projectCategoryPlanItem.findFirst({
          where: eq(projectCategoryPlanItem.id, f.packageId),
        })
      )?.status,
    ).toBe("LOCKED");
    expect(await invariant()).toBe(before);
    as(maker);
    expect(
      (
        await manualEdit({
          rabEstimateItemId: f.itemIds[0],
          clientLabel: "Perubahan terlarang",
          quantity: 1,
          unit: "paket",
          unitPrice: 1,
        })
      ).success,
    ).toBe(false);
    expect(
      (
        await manualBundle({
          rabEstimateId: f.rabId,
          itemIds: f.itemIds.slice(0, 2),
          clientLabel: "Paket terlarang",
          quantity: 1,
          unit: "paket",
          unitPrice: 1,
        })
      ).success,
    ).toBe(false);
  });
  test("revisions copy the full client baseline including bundles/hidden lines, and void leaves baseline intact", async () => {
    const f = await fixture();
    ok(
      await manualBundle({
        rabEstimateId: f.rabId,
        itemIds: f.itemIds.slice(0, 2),
        clientLabel: "Paket baseline",
        quantity: 1,
        unit: "paket",
        unitPrice: 210000,
      }),
    );
    ok(await manualApprove(f.rabId));
    const before = await invariant(),
      baseline = await db.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, f.rabId),
        with: { items: true, bundles: true },
      }),
      r = await revision(f);
    const copied = await db.query.rabEstimate.findFirst({
      where: eq(rabEstimate.id, r.rabId),
      with: { items: true, bundles: true },
    });
    expect(copied?.supersedesRabEstimateId).toBe(f.rabId);
    expect(copied?.items).toHaveLength(3);
    expect(copied?.bundles).toHaveLength(1);
    expect(copied?.items.filter((row) => row.bundleId)).toHaveLength(2);
    expect(copied?.items.some((row) => row.isHidden)).toBe(true);
    expect(
      await db.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, f.rabId),
        with: { items: true, bundles: true },
      }),
    ).toEqual(baseline);
    const co = await order(r),
      v = await prepare(r, {
        action: "VOID_REVISION",
        reason: "Lingkup revisi dibatalkan oleh pengguna",
      });
    ok(await save(identity(v)));
    expect(
      (await db.query.projectChangeOrder.findFirst({ where: eq(projectChangeOrder.id, co) }))
        ?.status,
    ).toBe("CANCELLED");
    expect(
      (await db.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, f.rabId) }))?.status,
    ).toBe("APPROVED");
    expect(await invariant()).toBe(before);
  });
  test("client attestation, rejection, correction/resubmission and checker approval follow the full lifecycle", async () => {
    const base = await fixture(true),
      before = await invariant(),
      r = await revision(base),
      co = await order(r);
    await clientConfirmation(r, co);
    await expect(
      prepare(r, { action: "APPROVE_CHANGE_ORDER", changeOrderId: co, emergencyOverride: false }),
    ).rejects.toThrow("pemeriksa");
    expect(
      (
        await manualEdit({
          rabEstimateItemId: r.itemIds[0],
          clientLabel: "Tidak boleh setelah konfirmasi",
          quantity: 2,
          unit: "lembar",
          unitPrice: 150000,
        })
      ).success,
    ).toBe(false);
    const rejected = await prepare(
      r,
      {
        action: "REJECT_CHANGE_ORDER",
        changeOrderId: co,
        reason: "Lingkup perlu diperjelas sebelum disetujui",
      },
      checker,
    );
    ok(await save(identity(rejected)));
    as(maker);
    const values = await fields(r),
      change = await prepare(r, {
        action: "EDIT_DRAFT",
        rows: [
          { action: "UPDATE", itemId: r.itemIds[0], fields: { ...values, unitPrice: 150000 } },
        ],
      });
    ok(await save(identity(change)));
    expect(await order(r)).toBe(co);
    await clientConfirmation(r, co);
    const approval = await prepare(
      r,
      { action: "APPROVE_CHANGE_ORDER", changeOrderId: co, emergencyOverride: false },
      checker,
    );
    expect(approval.proposal.budgetImpact?.contractAfter).toBe(350000);
    ok(await save(identity(approval)));
    expect(
      (await db.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, base.rabId) }))?.status,
    ).toBe("SUPERSEDED");
    expect(
      (await db.query.rabEstimate.findFirst({ where: eq(rabEstimate.id, r.rabId) }))?.status,
    ).toBe("APPROVED");
    expect(
      (await db.query.project.findFirst({ where: eq(project.id, r.projectId) }))
        ?.totalContractValue,
    ).toBe("350000.00");
    expect(await invariant()).toBe(before);
  });
  test("explicit emergency self-approval requires a live grant and audit reason", async () => {
    const base = await fixture(true),
      r = await revision(base),
      co = await order(r);
    await clientConfirmation(r, co);
    await db
      .insert(rolePermission)
      .values({ roleId: maker.roleId, permissionKey: "override:self_approval" });
    const p = await prepare(r, {
      action: "APPROVE_CHANGE_ORDER",
      changeOrderId: co,
      emergencyOverride: true,
      reason: "Override diminta karena pemeriksa lain tidak tersedia",
    });
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "override:self_approval"),
        ),
      );
    expect((await save(identity(p))).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: maker.roleId, permissionKey: "override:self_approval" });
    ok(await save(identity(p)));
    expect(
      (
        await db.query.auditLog.findMany({
          where: eq(auditLog.action, "EMERGENCY_SELF_APPROVE_CHANGE_ORDER"),
        })
      ).some((row) => row.newState?.includes("pemeriksa lain")),
    ).toBe(true);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "override:self_approval"),
        ),
      );
  });
  test("scope, ownership, revoked grants, expiry and manual drift fail closed", async () => {
    const f = await fixture(),
      p = await prepare(f, { action: "EDIT_DRAFT", title: "Judul koreksi" }, assigned);
    expect(ok(await read(identity(p))).status).toBe("READY");
    as(maker);
    expect((await read(identity(p))).success).toBe(false);
    as(assigned);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, assigned.roleId),
          eq(rolePermission.permissionKey, "update:rab"),
        ),
      );
    expect((await save(identity(p))).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: assigned.roleId, permissionKey: "update:rab" });
    await db.update(project).set({ projectManagerId: maker.id }).where(eq(project.id, f.projectId));
    expect((await save(identity(p))).success).toBe(false);
    as(maker);
    const p2 = await prepare(f, { action: "EDIT_DRAFT", title: "Judul berikutnya" });
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, p2.messageId));
    expect(ok(await read(identity(p2))).status).toBe("EXPIRED");
    expect((await save(identity(p2))).success).toBe(false);
    const p3 = await prepare(f, { action: "EDIT_DRAFT", title: "Judul lama" });
    ok(
      await manualEdit({
        rabEstimateItemId: f.itemIds[0],
        clientLabel: "Input manual baru",
        quantity: 2,
        unit: "lembar",
        unitPrice: 130000,
      }),
    );
    expect(ok(await read(identity(p3))).status).toBe("STALE");
    expect((await save(identity(p3))).success).toBe(false);
  });
  test("a delayed AI confirmation cannot overwrite a concurrent manual writer", async () => {
    const f = await fixture(),
      values = await fields(f),
      p = await prepare(f, {
        action: "EDIT_DRAFT",
        rows: [
          { action: "UPDATE", itemId: f.itemIds[0], fields: { ...values, unitPrice: 120000 } },
        ],
      }),
      a = await actor();
    const queued: { value?: Promise<ActionResponse<RabWorkflowReceipt>> } = {};
    await db.transaction(async (tx) => {
      await writers.updateRabEstimateItemTx(tx, a, {
        rabEstimateItemId: f.itemIds[0],
        ...values,
        unitPrice: 130000,
      });
      queued.value = save(identity(p));
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });
    if (!queued.value) throw new Error("No queued confirmation");
    expect((await queued.value).success).toBe(false);
    expect(
      (await db.query.rabEstimateItem.findFirst({ where: eq(rabEstimateItem.id, f.itemIds[0]) }))
        ?.unitPrice,
    ).toBe("130000.00");
  });
  test("failure after a real first write rolls back the entire subset and receipt; retry succeeds once", async () => {
    const f = await fixture(),
      values = await fields(f),
      p = await prepare(f, {
        action: "EDIT_DRAFT",
        rows: [
          { action: "UPDATE", itemId: f.itemIds[0], fields: { ...values, unitPrice: 120000 } },
          {
            action: "ADD",
            fields: { ...values, clientLabel: "Tambahan baru", quantity: 1, unitPrice: 10000 },
          },
        ],
      });
    const stop = spyOn(writers, "addRabManualItemTx").mockImplementation(async () => {
      throw new Error("Injected second-write failure");
    });
    try {
      expect((await save(identity(p))).success).toBe(false);
    } finally {
      stop.mockRestore();
    }
    expect(
      (await db.query.rabEstimateItem.findFirst({ where: eq(rabEstimateItem.id, f.itemIds[0]) }))
        ?.unitPrice,
    ).toBe("100000.00");
    expect(
      await db.query.aiProposalConfirmation.findMany({
        where: eq(aiProposalConfirmation.toolCallId, p.toolCallId),
      }),
    ).toHaveLength(0);
    ok(await save(identity(p)));
    expect(
      await db.query.rabEstimateItem.findMany({
        where: eq(rabEstimateItem.rabEstimateId, f.rabId),
      }),
    ).toHaveLength(4);
    expect(ok(await save(identity(p))).alreadyConfirmed).toBe(true);
  });
  test("model context and proposals expose only permitted client data", async () => {
    const f = await fixture(),
      a = await actor(),
      tools = buildRabWorkflowTools({
        userId: a.userId,
        roleId: a.roleId,
        roleName: "Custom finance",
        dataScope: a.dataScope,
        permissions: a.permissions,
      }),
      execute = tools.getRabWorkflowContext.execute;
    if (!execute) throw new Error("Missing lookup");
    const result = await execute(
      { projectId: f.projectId, rabEstimateId: f.rabId, offset: 0 },
      { toolCallId: "lookup", messages: [], context: {} },
    );
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(JSON.stringify(result)).not.toContain("estimatedUnitCost");
    expect(JSON.stringify(result)).not.toContain("internalNote");
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "view:budget"),
        ),
      );
    const p = await prepare(f, { action: "APPROVE_INITIAL" });
    expect(p.proposal.budgetImpact).toBeNull();
    await db.insert(rolePermission).values({ roleId: maker.roleId, permissionKey: "view:budget" });
  });
});
