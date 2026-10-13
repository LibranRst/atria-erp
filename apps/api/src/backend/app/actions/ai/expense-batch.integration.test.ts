import { beforeAll, beforeEach, afterAll, expect, test, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, count } from "drizzle-orm";
import { db } from "@backend/db";
import {
  role,
  rolePermission,
  user,
  client,
  project,
  projectBudgets,
  projectBudgetCategory,
  formDraft,
  materialMaster,
  inventoryLocation,
  materialInventory,
  projectCost,
  stockMovement,
  cashTransaction,
  auditLog,
  attachment,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  INSTANCE_TENANT_ID,
  tenant,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { withTestRequest } from "@backend/lib/testing/request";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { prepareExpenseBatch } from "@backend/server/usecases/ai/expense-batch-context";
import { prepareExpenseBatchAction } from "@backend/server/usecases/ai/expense-batch-action-context";
import * as batchWriter from "@backend/server/usecases/finance/submit-expense-batch";
import * as payWriter from "@backend/server/usecases/finance/pay-field-request";
import { saveExpenseDraftUseCase } from "@backend/server/usecases/finance/save-expense-draft";
import { submitExpenseDraft } from "@backend/app/actions/finance/expense-draft-submit";
import {
  startAiExpenseBatchReview,
  getAiExpenseBatchReview,
  patchAiExpenseBatchReview,
  submitAiExpenseBatchReview,
  discardAiExpenseBatchReview,
} from "./expense-batch";
import { getAiExpenseBatchAction, confirmAiExpenseBatchAction } from "./expense-batch-action";
import type { ExpenseBatchRequest, ExpenseBatchActionInput } from "@atria/core/ai/expense-batch";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `EXPB-${randomUUID().slice(0, 8)}`;
const grants: PermissionKey[] = [
  "use:ai_chat",
  "view:project",
  "view:budget",
  "view:material",
  "view:cost",
  "create:cost",
  "create:stock_movement",
  "verify:cost",
  "update:cost",
  "approve:cost",
  "pay:cost",
  "view:bank_account",
];
type Person = typeof user.$inferSelect;
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
let maker: Person,
  checker: Person,
  assigned: Person,
  none: Person,
  limited: Person,
  projectId: string,
  categoryIds: Record<string, string>,
  materialId: string,
  locationId: string,
  inventoryId: string,
  bankId: string;
function as(p: Person): void {
  api.getSession = async () => ({
    user: p,
    session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("No Actor");
  return a;
}
async function person(
  scope: RoleDataScope,
  permissions: readonly PermissionKey[] = grants,
): Promise<Person> {
  const r = (
    await db
      .insert(role)
      .values({ name: prefix + randomUUID(), dataScope: scope })
      .returning()
  )[0];
  await db
    .insert(rolePermission)
    .values(permissions.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  return (
    await db
      .insert(user)
      .values({
        name: r.name,
        email: randomUUID() + "@fixture.invalid",
        roleId: r.id,
        isActive: true,
        mustChangePassword: false,
      })
      .returning()
  )[0];
}
function row(index = 0, amount = 100000) {
  return {
    key: `row-${index}`,
    projectBudgetCategoryId: categoryIds.OPERASIONAL,
    description: `Transport lapangan ${index}`,
    quantity: 1,
    unitPrice: amount,
    amount,
    stockHandling: "EXPENSE_ONLY" as const,
  };
}
async function proof(request: ExpenseBatchRequest) {
  const proposal = await prepareExpenseBatch(await actor(), request);
  const conv = (
    await db
      .insert(aiConversation)
      .values({ userId: (await actor()).userId, title: prefix })
      .returning()
  )[0];
  const toolCallId = randomUUID();
  const message = (
    await db
      .insert(aiMessage)
      .values({
        conversationId: conv.id,
        role: "assistant",
        parts: [
          {
            type: "tool-proposeExpenseBatch",
            toolCallId,
            state: "output-available",
            output: { proposal },
          },
        ],
      })
      .returning()
  )[0];
  return { proposal, identity: { conversationId: conv.id, toolCallId }, messageId: message.id };
}
async function actionProof(input: ExpenseBatchActionInput) {
  const proposal = await prepareExpenseBatchAction(await actor(), input);
  const conv = (
    await db
      .insert(aiConversation)
      .values({ userId: (await actor()).userId, title: prefix })
      .returning()
  )[0];
  const toolCallId = randomUUID(),
    name =
      input.action === "VERIFY"
        ? "proposeExpenseBatchVerify"
        : input.action === "PAY"
          ? "proposeExpenseBatchPayment"
          : "proposeExpenseBatchDecision";
  await db.insert(aiMessage).values({
    conversationId: conv.id,
    role: "assistant",
    parts: [{ type: `tool-${name}`, toolCallId, state: "output-available", output: { proposal } }],
  });
  return { proposal, identity: { conversationId: conv.id, toolCallId } };
}
const start = withTestRequest(startAiExpenseBatchReview),
  read = withTestRequest(getAiExpenseBatchReview),
  patch = withTestRequest(patchAiExpenseBatchReview),
  save = withTestRequest(submitAiExpenseBatchReview),
  discard = withTestRequest(discardAiExpenseBatchReview),
  decide = withTestRequest(confirmAiExpenseBatchAction),
  readAction = withTestRequest(getAiExpenseBatchAction);
async function totals(): Promise<readonly number[]> {
  return Promise.all(
    [projectCost, stockMovement, cashTransaction, aiProposalConfirmation].map(async (table) =>
      Number((await db.select({ n: count() }).from(table))[0].n),
    ),
  );
}
describeIntegration("AI full expense batch workflow", () => {
  beforeAll(async () => {
    maker = await person("GLOBAL");
    checker = await person("GLOBAL");
    assigned = await person("ASSIGNED");
    none = await person("NONE");
    limited = await person(
      "GLOBAL",
      grants.filter((p) => p !== "create:stock_movement"),
    );
  });
  beforeEach(async () => {
    as(maker);
    const c = (
      await db
        .insert(client)
        .values({ name: prefix, email: randomUUID() + "@fixture.invalid", phone: "08123456789" })
        .returning()
    )[0];
    projectId = (
      await db
        .insert(project)
        .values({
          name: prefix,
          clientId: c.id,
          projectManagerId: assigned.id,
          totalContractValue: "200000000",
          status: "ACTIVE",
        })
        .returning()
    )[0].id;
    const budget = (
      await db
        .insert(projectBudgets)
        .values({
          projectId,
          contractValue: "200000000",
          internalBudget: "180000000",
          status: "APPROVED",
        })
        .returning()
    )[0];
    categoryIds = {};
    for (const cat of await db.query.expenseCategory.findMany({
      where: (t, { eq }) => eq(t.tenantId, INSTANCE_TENANT_ID),
    })) {
      categoryIds[cat.code] = (
        await db
          .insert(projectBudgetCategory)
          .values({
            projectBudgetId: budget.id,
            expenseCategoryId: cat.id,
            allocatedAmount: "100000000",
            remainingAmount: "100000000",
          })
          .returning()
      )[0].id;
    }
    const matCategory = await db.query.materialCategory.findFirst();
    if (!matCategory) throw new Error("Missing seed material category");
    const m = (
      await db
        .insert(materialMaster)
        .values({
          categoryId: matCategory.id,
          name: prefix + randomUUID(),
          unit: "lembar",
          isActive: true,
        })
        .returning()
    )[0];
    materialId = m.id;
    locationId = (
      await db
        .insert(inventoryLocation)
        .values({ name: prefix + randomUUID(), isActive: true })
        .returning()
    )[0].id;
    inventoryId = (
      await db
        .insert(materialInventory)
        .values({
          materialId,
          locationId,
          currentStock: "10",
          reservedStock: "2",
          minimumStock: "0",
          averageCost: "10000",
          lastPurchasePrice: "10000",
        })
        .returning()
    )[0].id;
    const { bankAccount } = await import("@backend/db/schema");
    bankId = (
      await db
        .insert(bankAccount)
        .values({
          name: prefix,
          bankName: "BCA",
          accountNumber: randomUUID(),
          holderName: prefix,
          balance: "30000000",
          isActive: true,
        })
        .returning()
    )[0].id;
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("metadata, partial repeated saves and token replay retain remaining draft and zero cash", async () => {
    const before = await totals(),
      p = await proof({ projectId, rows: [row(0), row(1), row(2)] });
    let v = ok(await start(p.identity));
    expect(await totals()).toEqual(before);
    expect(v.state.selectedKeys).toHaveLength(3);
    v = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        payload: v.state.payload,
        selectedKeys: ["row-0"],
      }),
    );
    const token = randomUUID();
    const [a, b] = await Promise.all([
      save({ ...p.identity, expectedRevision: v.revision, token }),
      save({ ...p.identity, expectedRevision: v.revision, token }),
    ]);
    expect(a.success && b.success).toBe(true);
    v = ok(await read(p.identity));
    expect(v.status).toBe("ACTIVE");
    expect(v.state.submitted).toHaveLength(1);
    expect(v.state.selectedKeys).toHaveLength(0);
    v = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        payload: v.state.payload,
        selectedKeys: ["row-1", "row-2"],
      }),
    );
    ok(await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }));
    v = ok(await read(p.identity));
    expect(v.status).toBe("COMPLETE");
    expect(v.state.submitted).toHaveLength(3);
    const after = await totals();
    expect(after[0]).toBe(before[0] + 3);
    expect(after.slice(1, 3)).toEqual(before.slice(1, 3));
  });
  test("resumes ordinary draft with corrections and removes only submitted keys atomically", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] });
    const source = ok(
      await saveExpenseDraftUseCase(await actor(), { payload: p.proposal.payload }),
    );
    const resumed = await proof({ sourceDraftId: source.id });
    let v = ok(await start(resumed.identity));
    v = ok(
      await patch({
        ...resumed.identity,
        expectedRevision: v.revision,
        payload: {
          ...v.state.payload,
          lines: v.state.payload.lines.map((l) =>
            l.key === "row-0"
              ? { ...l, description: "Transport dikoreksi", amount: 125000, unitPrice: 125000 }
              : l,
          ),
        },
        selectedKeys: ["row-0"],
      }),
    );
    ok(await save({ ...resumed.identity, expectedRevision: v.revision, token: randomUUID() }));
    const manual = await db.query.formDraft.findFirst({ where: eq(formDraft.id, source.id) });
    expect(manual?.status).toBe("ACTIVE");
    expect(manual?.revision).toBe(source.revision + 1);
    expect((manual?.payload as { lines: { key: string }[] }).lines.map((l) => l.key)).toEqual([
      "row-1",
    ]);
  });
  test("conversational correction updates same review, retains submitted rows and rejects concurrent revision", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] });
    let v = ok(await start(p.identity));
    v = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        payload: v.state.payload,
        selectedKeys: ["row-0"],
      }),
    );
    ok(await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }));
    v = ok(await read(p.identity));
    const correction = await proof({
      reviewDraftId: v.reviewId,
      expectedRevision: v.revision,
      rows: [{ ...row(1), description: "Transport sisa dikoreksi" }],
    });
    const updated = ok(await start(correction.identity));
    expect(updated.reviewId).toBe(v.reviewId);
    expect(updated.state.submitted).toHaveLength(1);
    expect(updated.state.payload.lines.find((l) => l.key === "row-1")?.description).toBe(
      "Transport sisa dikoreksi",
    );
    expect(ok(await read(correction.identity)).status).toBe("ACTIVE");
    expect(
      (
        await patch({
          ...p.identity,
          expectedRevision: v.revision,
          payload: v.state.payload,
          selectedKeys: [],
        })
      ).success,
    ).toBe(false);
  });
  test("Material stock in/direct-use/reserve share exact audit/movement rules and no cash", async () => {
    const rows: NonNullable<ExpenseBatchRequest["rows"]> = [
      "STOCK_IN",
      "DIRECT_USE",
      "RESERVE_FOR_PROJECT",
    ].map((mode, i) => ({
      ...row(i, 20000),
      projectBudgetCategoryId: categoryIds.MATERIAL,
      materialId,
      inventoryLocationId: locationId,
      quantity: 2,
      unitPrice: 10000,
      stockHandling: mode as "STOCK_IN" | "DIRECT_USE" | "RESERVE_FOR_PROJECT",
    }));
    const p = await proof({ projectId, rows }),
      v = ok(await start(p.identity)),
      before = await totals();
    expect(v.rows.map((r) => r.stockAfter)).toEqual([12, 12, 14]);
    ok(await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }));
    const inv = await db.query.materialInventory.findFirst({
      where: eq(materialInventory.id, inventoryId),
    });
    expect(inv?.currentStock).toBe("14.00");
    expect(inv?.reservedStock).toBe("4.00");
    expect((await totals())[1]).toBe(before[1] + 5);
    expect((await totals())[2]).toBe(before[2]);
    expect(
      await db.query.auditLog.findFirst({ where: eq(auditLog.action, "EXPENSE_STOCK_IN") }),
    ).toBeDefined();
  });
  test("stock rights, category links, inactive references and amount mismatch block entire subset", async () => {
    as(limited);
    const p = await proof({
        projectId,
        rows: [
          {
            ...row(0),
            projectBudgetCategoryId: categoryIds.MATERIAL,
            materialId,
            inventoryLocationId: locationId,
            stockHandling: "STOCK_IN",
          },
        ],
      }),
      v = ok(await start(p.identity));
    expect(v.rows[0].issues.length).toBeGreaterThan(0);
    expect(
      (await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() })).success,
    ).toBe(false);
    as(maker);
    const bad = await proof({
      projectId,
      rows: [{ ...row(0), materialId, inventoryLocationId: locationId, stockHandling: "STOCK_IN" }],
    });
    expect(ok(await start(bad.identity)).rows[0].issues.join(" ")).toContain("Material");
  });
  test("expiry, ownership, foreign tenant, permission revocation and assignment fail closed", async () => {
    const p = await proof({ projectId, rows: [row()] }),
      v = ok(await start(p.identity));
    as(checker);
    expect((await read(p.identity)).success).toBe(false);
    as(none);
    await expect(proof({ projectId, rows: [row()] })).rejects.toThrow("Akses");
    as(maker);
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, maker.roleId),
          eq(rolePermission.permissionKey, "create:cost"),
        ),
      );
    expect(
      (await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() })).success,
    ).toBe(false);
    await db.insert(rolePermission).values({ roleId: maker.roleId, permissionKey: "create:cost" });
    await db
      .update(formDraft)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(formDraft.id, v.reviewId));
    expect(ok(await read(p.identity)).status).toBe("EXPIRED");
    as(assigned);
    const scoped = await proof({ projectId, rows: [row()] });
    const sv = ok(await start(scoped.identity));
    await db.update(project).set({ projectManagerId: checker.id }).where(eq(project.id, projectId));
    expect(
      (await save({ ...scoped.identity, expectedRevision: sv.revision, token: randomUUID() }))
        .success,
    ).toBe(false);
  });
  test("budget and inventory drift require a refreshed applied review, rollback after real writes retains draft", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] }),
      v = ok(await start(p.identity));
    await db
      .update(projectBudgetCategory)
      .set({ allocatedAmount: "90000000" })
      .where(eq(projectBudgetCategory.id, categoryIds.OPERASIONAL));
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect(
      (await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() })).success,
    ).toBe(false);
    const current = ok(
        await patch({
          ...p.identity,
          expectedRevision: v.revision,
          payload: v.state.payload,
          selectedKeys: v.state.selectedKeys,
        }),
      ),
      before = await totals();
    const real = batchWriter.submitExpenseBatchTx;
    const injected = spyOn(batchWriter, "submitExpenseBatchTx").mockImplementation(
      async (tx, a, input, g) => {
        await real(tx, a, input, g);
        throw new Error("injected late failure");
      },
    );
    try {
      expect(
        (await save({ ...p.identity, expectedRevision: current.revision, token: randomUUID() }))
          .success,
      ).toBe(false);
    } finally {
      injected.mockRestore();
    }
    expect(await totals()).toEqual(before);
    expect(ok(await read(p.identity)).state.submitted).toHaveLength(0);
  });
  test("ordinary manual submit racing AI continuation produces one group only", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] }),
      source = ok(await saveExpenseDraftUseCase(await actor(), { payload: p.proposal.payload })),
      ai = await proof({ sourceDraftId: source.id }),
      v = ok(await start(ai.identity));
    const results = await Promise.all([
      save({ ...ai.identity, expectedRevision: v.revision, token: randomUUID() }),
      withTestRequest(submitExpenseDraft)({
        draftId: source.id,
        expectedRevision: source.revision,
      }),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(
      await db.query.projectCost.findMany({ where: eq(projectCost.projectId, projectId) }),
    ).toHaveLength(2);
  });
  test("owned chat image is adopted for project-scoped proof; foreign/wrong-project receipts cannot submit", async () => {
    const image = (
      await db
        .insert(attachment)
        .values({
          fileName: "nota-qa.jpg",
          fileUrl: "https://example.invalid/nota.jpg",
          storageFileId: randomUUID(),
          fileSize: 100,
          mimeType: "image/jpeg",
          uploadedById: maker.id,
          referenceType: "private_ai_chat",
          referenceId: randomUUID(),
        })
        .returning()
    )[0];
    const p = await proof({ projectId, receiptAttachmentId: image.id, rows: [row()] }),
      v = ok(await start(p.identity));
    const receipt = ok(
      await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }),
    );
    const cost = await db.query.projectCost.findFirst({
      where: eq(projectCost.id, receipt.costIds[0]),
    });
    expect(cost?.receiptImageUrl).not.toBe(v.state.payload.receipt?.url);
    expect(
      await db.query.attachment.findFirst({ where: eq(attachment.id, image.id) }),
    ).toBeDefined();
    as(checker);
    await expect(
      proof({ projectId, receiptAttachmentId: image.id, rows: [row()] }),
    ).rejects.toThrow("bukan milik");
  });
  test("50 accepted,51 rejected and invalid rows retain selectable valid rows", async () => {
    const request = { projectId, rows: Array.from({ length: 50 }, (_, i) => row(i, 100)) };
    const p = await proof(request);
    const v = ok(await start(p.identity));
    expect(v.rows).toHaveLength(50);
    await expect(proof({ ...request, rows: [...request.rows, row(51, 100)] })).rejects.toThrow();
    const partial = await proof({
      projectId,
      rows: [
        row(0),
        { ...row(1), amount: null, unitPrice: null, projectBudgetCategoryId: undefined },
      ],
    });
    const pv = ok(await start(partial.identity));
    expect(pv.state.selectedKeys).toEqual(["row-0"]);
    expect(pv.rows[1].issues.length).toBeGreaterThan(0);
  });
  test("discard retains submitted business rows and foreign-tenant projects cannot prepare", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] });
    let v = ok(await start(p.identity));
    v = ok(
      await patch({
        ...p.identity,
        expectedRevision: v.revision,
        payload: v.state.payload,
        selectedKeys: ["row-0"],
      }),
    );
    ok(await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }));
    const before = await totals();
    ok(await discard(p.identity));
    expect(await totals()).toEqual(before);
    expect(ok(await read(p.identity)).status).toBe("DISCARDED");
    const foreign = (
      await db.insert(tenant).values({ name: prefix, slug: randomUUID() }).returning()
    )[0];
    await db.update(project).set({ tenantId: foreign.id }).where(eq(project.id, projectId));
    await expect(proof({ projectId, rows: [row()] })).rejects.toThrow("akses");
  });
  test("verify, independent approval/rejection and payment are separate atomic stages with replay", async () => {
    const p = await proof({ projectId, rows: [row(0, 6000000), row(1, 100000)] }),
      v = ok(await start(p.identity)),
      ids = ok(
        await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }),
      ).costIds;
    as(checker);
    const verify = await actionProof({ action: "VERIFY", projectId, costIds: [...ids] });
    ok(await decide(verify.identity));
    expect(
      (await db.query.projectCost.findFirst({ where: eq(projectCost.id, ids[0]) }))?.status,
    ).toBe("VERIFIED");
    expect(
      (await db.query.projectCost.findFirst({ where: eq(projectCost.id, ids[1]) }))?.status,
    ).toBe("APPROVED");
    as(maker);
    await expect(
      actionProof({ action: "APPROVE", projectId, costIds: [ids[0]], notes: "Setujui sendiri" }),
    ).rejects.toThrow("Pengaju");
    as(checker);
    const approve = await actionProof({
      action: "APPROVE",
      projectId,
      costIds: [ids[0]],
      notes: "Dokumen diperiksa",
    });
    ok(await decide(approve.identity));
    const before = await totals();
    const pay = await actionProof({
      action: "PAY",
      projectId,
      costIds: [...ids],
      bankAccountId: bankId,
      references: ids.map((costId, i) => ({ costId, referenceNumber: `${prefix}-PAY-${i}` })),
    });
    const results = await Promise.all([decide(pay.identity), decide(pay.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(ok(await readAction(pay.identity)).status).toBe("CONFIRMED");
    expect((await totals())[2]).toBe(before[2] + 2);
    expect((await totals())[1]).toBe(before[1]);
  });
  test("rejection is independent, changes no cash/stock and rejected claims cannot be paid", async () => {
    const p = await proof({ projectId, rows: [row(0, 6000000)] }),
      v = ok(await start(p.identity)),
      ids = ok(
        await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }),
      ).costIds;
    as(checker);
    ok(
      await decide(
        (await actionProof({ action: "VERIFY", projectId, costIds: [...ids] })).identity,
      ),
    );
    const before = await totals(),
      rejected = await actionProof({
        action: "REJECT",
        projectId,
        costIds: [...ids],
        notes: "Dokumen perlu dikoreksi",
      });
    ok(await decide(rejected.identity));
    expect((await totals()).slice(1, 3)).toEqual(before.slice(1, 3));
    expect(
      (await db.query.projectCost.findFirst({ where: eq(projectCost.id, ids[0]) }))?.status,
    ).toBe("REJECTED");
    await expect(
      actionProof({
        action: "PAY",
        projectId,
        costIds: [...ids],
        bankAccountId: bankId,
        references: [{ costId: ids[0], referenceNumber: "REJECTED-REF" }],
      }),
    ).rejects.toThrow("harus");
  });
  test("payment requires current grant, fresh account/source and unique reference before any row writes", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] }),
      v = ok(await start(p.identity)),
      ids = ok(
        await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }),
      ).costIds;
    as(checker);
    ok(
      await decide(
        (await actionProof({ action: "VERIFY", projectId, costIds: [...ids] })).identity,
      ),
    );
    const pay = await actionProof({
      action: "PAY",
      projectId,
      costIds: [...ids],
      bankAccountId: bankId,
      references: ids.map((costId, i) => ({ costId, referenceNumber: `${prefix}-CURRENT-${i}` })),
    });
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, checker.roleId),
          eq(rolePermission.permissionKey, "pay:cost"),
        ),
      );
    expect((await decide(pay.identity)).success).toBe(false);
    await db.insert(rolePermission).values({ roleId: checker.roleId, permissionKey: "pay:cost" });
    const { bankAccount } = await import("@backend/db/schema");
    await db.update(bankAccount).set({ balance: "1" }).where(eq(bankAccount.id, bankId));
    expect(ok(await readAction(pay.identity)).status).toBe("STALE");
    expect((await decide(pay.identity)).success).toBe(false);
    expect(
      (await db.query.projectCost.findMany({ where: eq(projectCost.projectId, projectId) })).every(
        (c) => c.status === "APPROVED",
      ),
    ).toBe(true);
  });
  test("payment source drift and post-write failure roll back every cash/receipt record", async () => {
    const p = await proof({ projectId, rows: [row(0), row(1)] }),
      v = ok(await start(p.identity)),
      ids = ok(
        await save({ ...p.identity, expectedRevision: v.revision, token: randomUUID() }),
      ).costIds;
    as(checker);
    ok(
      await decide(
        (await actionProof({ action: "VERIFY", projectId, costIds: [...ids] })).identity,
      ),
    );
    const pay = await actionProof({
        action: "PAY",
        projectId,
        costIds: [...ids],
        bankAccountId: bankId,
        references: ids.map((costId, i) => ({ costId, referenceNumber: `${prefix}-ROLL-${i}` })),
      }),
      before = await totals();
    const real = payWriter.payFieldRequestTx;
    let calls = 0;
    const injected = spyOn(payWriter, "payFieldRequestTx").mockImplementation(
      async (tx, a, input) => {
        const result = await real(tx, a, input);
        if (++calls === 2) throw new Error("late payment failure");
        return result;
      },
    );
    try {
      expect((await decide(pay.identity)).success).toBe(false);
    } finally {
      injected.mockRestore();
    }
    expect(await totals()).toEqual(before);
    expect(
      (await db.query.projectCost.findMany({ where: eq(projectCost.projectId, projectId) })).every(
        (c) => c.status === "APPROVED",
      ),
    ).toBe(true);
  });
});
