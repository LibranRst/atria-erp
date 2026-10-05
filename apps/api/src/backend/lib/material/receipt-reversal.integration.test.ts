import { afterAll, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@backend/db";
import {
  aiConversation,
  aiProposalConfirmation,
  auditLog,
  goodsReceipt,
  goodsReceiptItem,
  materialInventory,
  role,
  rolePermission,
  stockMovement,
  user as userTable,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { postGoodsReceipt } from "@backend/app/actions/material/goods-receipt";
import { confirmAiGoodsReceiptProposal } from "@backend/app/actions/ai/confirm-material-proposal";
import {
  approveGoodsReceiptReversal,
  rejectGoodsReceiptReversal,
  requestGoodsReceiptReversal,
} from "@backend/app/actions/material/warehouse-receipt-reversal";
import { resolveActor } from "@backend/server/actor";
import {
  postGoodsReceiptTx,
  type CreateGoodsReceiptInput,
  type GoodsReceiptTransaction,
} from "@backend/server/usecases/material/post-goods-receipt";
import { createGoodsReceiptSchema } from "@atria/core/validations/workflow-governance";

const OWNER = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const PURCHASING = {
  id: "33333333-3333-3333-3333-333333333333",
  roleId: "00000000-0000-0000-0000-000000000004",
  email: "agus@dekoria.com",
  name: "Agus Pratama",
};
const LED = "13131313-1313-1313-1313-131313131307";
const PU = "13131313-1313-1313-1313-131313131306";
const LOCATION = "14141414-1414-1414-1414-141414141401";
const PROJECT = "77777777-7777-7777-7777-777777777771";
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

function actAs(user: typeof OWNER): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: { id: crypto.randomUUID(), userId: user.id },
    user: { ...user, isActive: true, mustChangePassword: false },
  });
}

async function inventory(materialId: string): Promise<typeof materialInventory.$inferSelect> {
  const row = await db.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.materialId, materialId),
      eq(materialInventory.locationId, LOCATION),
    ),
  });
  if (!row) throw new Error("Seed inventory missing.");
  return row;
}

async function reversalMovements(
  receiptId: string,
): Promise<(typeof stockMovement.$inferSelect)[]> {
  return db.query.stockMovement.findMany({
    where: and(
      eq(stockMovement.referenceId, receiptId),
      eq(stockMovement.movementType, "GOODS_RECEIPT_REVERSAL"),
    ),
  });
}

async function approvalAudits(receiptId: string): Promise<(typeof auditLog.$inferSelect)[]> {
  return db.query.auditLog.findMany({
    where: and(
      eq(auditLog.targetId, receiptId),
      inArray(auditLog.action, [
        "APPROVE_GOODS_RECEIPT_REVERSAL",
        "EMERGENCY_SELF_APPROVE_GOODS_RECEIPT_REVERSAL",
      ]),
    ),
  });
}

async function pendingReceipt(
  items: ReadonlyArray<CreateGoodsReceiptInput["items"][number]> = [
    { materialId: LED, quantity: 5, unitCost: 320000 },
  ],
): Promise<string> {
  actAs(PURCHASING);
  const posted = await postGoodsReceipt({
    projectId: PROJECT,
    inventoryLocationId: LOCATION,
    receiptNumber: `GRN-RACE-${crypto.randomUUID()}`,
    receivedAt: new Date(),
    items,
  });
  expect(posted.success).toBe(true);
  if (!posted.success) throw new Error(posted.error.message);
  const requested = await requestGoodsReceiptReversal({
    goodsReceiptId: posted.data.id,
    reason: "Penerimaan duplikat pada fixture concurrency.",
  });
  expect(requested.success).toBe(true);
  if (!requested.success) throw new Error(requested.error.message);
  actAs(OWNER);
  return posted.data.id;
}

async function waitForTwoLockWaiters(): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    // Test-only inspection proves both real connections reached their contested lock.
    const result = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
    );
    if (Number(result.rows[0]?.count) >= 2) return;
    await Bun.sleep(10);
  }
  throw new Error("Both concurrent decisions did not reach PostgreSQL locks.");
}

async function whileLocked<T>(
  lock: (tx: GoodsReceiptTransaction) => Promise<unknown>,
  work: () => Promise<T>,
): Promise<T> {
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const blocker = db.transaction(async (tx): Promise<void> => {
    await lock(tx);
    held.resolve();
    await release.promise;
  });
  await held.promise;
  const pending = work();
  try {
    await waitForTwoLockWaiters();
    release.resolve();
    return await pending;
  } finally {
    release.resolve();
    await blocker;
    await pending;
  }
}

describeIntegration(
  "goods receipt reversal — concurrent decisions and transaction rollback",
  () => {
    afterAll((): void => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    });

    it(
      "a custom assigned reviewer cannot request, approve or reject another project's receipt",
      withTestRequest(async (): Promise<void> => {
        const receiptId = await pendingReceipt();
        const before = await inventory(LED);
        const [reviewerRole] = await db
          .insert(role)
          .values({
            name: `SCOPED_RECEIPT_${crypto.randomUUID().slice(0, 12)}`,
            dataScope: "ASSIGNED",
            isSystem: false,
          })
          .returning();
        if (!reviewerRole) throw new Error("Assigned role fixture missing.");
        await db.insert(rolePermission).values([
          { roleId: reviewerRole.id, permissionKey: "request:goods_receipt_reversal" },
          { roleId: reviewerRole.id, permissionKey: "approve:goods_receipt_reversal" },
        ]);
        const [reviewer] = await db
          .insert(userTable)
          .values({
            name: "Assigned receipt reviewer",
            email: `${crypto.randomUUID()}@test.invalid`,
            roleId: reviewerRole.id,
            isActive: true,
          })
          .returning();
        if (!reviewer) throw new Error("Assigned user fixture missing.");
        actAs({
          id: reviewer.id,
          roleId: reviewer.roleId,
          name: reviewer.name,
          email: reviewer.email,
        });
        const input = {
          goodsReceiptId: receiptId,
          reason: "Review fixture proyek di luar penugasan.",
        };
        const decisions = await Promise.all([
          withTestRequest(requestGoodsReceiptReversal)(input),
          withTestRequest(approveGoodsReceiptReversal)(input),
          withTestRequest(rejectGoodsReceiptReversal)(input),
        ]);
        expect(
          decisions.every((decision) => !decision.success && decision.error.code === "FORBIDDEN"),
        ).toBe(true);
        expect((await inventory(LED)).currentStock).toBe(before.currentStock);
        expect(await reversalMovements(receiptId)).toHaveLength(0);
        expect(await approvalAudits(receiptId)).toHaveLength(0);
        expect(
          (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, receiptId) }))
            ?.status,
        ).toBe("REVERSAL_REQUESTED");
      }),
    );

    it(
      "two concurrent requests create one pending state and one request audit",
      withTestRequest(async (): Promise<void> => {
        actAs(PURCHASING);
        const posted = await postGoodsReceipt({
          projectId: PROJECT,
          inventoryLocationId: LOCATION,
          receiptNumber: `GRN-REQUEST-RACE-${crypto.randomUUID()}`,
          receivedAt: new Date(),
          items: [{ materialId: LED, quantity: 5, unitCost: 320000 }],
        });
        if (!posted.success) throw new Error(posted.error.message);
        const before = await inventory(LED);
        const input = {
          goodsReceiptId: posted.data.id,
          reason: "Permintaan ulang penerimaan pada fixture concurrency.",
        };
        const requests = await whileLocked(
          async (tx): Promise<unknown> =>
            tx.select().from(goodsReceipt).where(eq(goodsReceipt.id, posted.data.id)).for("update"),
          async () =>
            Promise.all([
              withTestRequest(requestGoodsReceiptReversal)(input),
              withTestRequest(requestGoodsReceiptReversal)(input),
            ]),
        );
        expect(requests.every((request) => request.success)).toBe(true);
        expect((await inventory(LED)).currentStock).toBe(before.currentStock);
        expect(await reversalMovements(posted.data.id)).toHaveLength(0);
        expect(
          await db.query.auditLog.findMany({
            where: and(
              eq(auditLog.targetId, posted.data.id),
              eq(auditLog.action, "REQUEST_GOODS_RECEIPT_REVERSAL"),
            ),
          }),
        ).toHaveLength(1);
        expect(
          (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, posted.data.id) }))
            ?.status,
        ).toBe("REVERSAL_REQUESTED");
      }),
    );

    it(
      "two concurrent approvals and a retry consume stock and write movement/audit once",
      withTestRequest(async (): Promise<void> => {
        const receiptId = await pendingReceipt();
        const before = await inventory(LED);
        const decisions = await whileLocked(
          async (tx): Promise<unknown> =>
            tx
              .select()
              .from(materialInventory)
              .where(eq(materialInventory.id, before.id))
              .for("update"),
          async () =>
            Promise.all([
              withTestRequest(approveGoodsReceiptReversal)({ goodsReceiptId: receiptId }),
              withTestRequest(approveGoodsReceiptReversal)({ goodsReceiptId: receiptId }),
            ]),
        );
        expect(decisions.every((decision) => decision.success)).toBe(true);
        expect(Number((await inventory(LED)).currentStock)).toBe(Number(before.currentStock) - 5);
        const movements = await reversalMovements(receiptId);
        expect(movements).toHaveLength(1);
        expect(await approvalAudits(receiptId)).toHaveLength(1);
        const item = await db.query.goodsReceiptItem.findFirst({
          where: eq(goodsReceiptItem.goodsReceiptId, receiptId),
        });
        expect(item?.reversalStockMovementId).toBe(movements[0]?.id);
        expect((await approveGoodsReceiptReversal({ goodsReceiptId: receiptId })).success).toBe(
          true,
        );
        expect(await reversalMovements(receiptId)).toHaveLength(1);
        expect(await approvalAudits(receiptId)).toHaveLength(1);
      }),
    );

    it(
      "a concurrent rejection cannot restore POSTED after reversal has consumed stock",
      withTestRequest(async (): Promise<void> => {
        const receiptId = await pendingReceipt();
        const before = await inventory(LED);
        const decisions = await whileLocked(
          async (tx): Promise<unknown> =>
            tx.select().from(goodsReceipt).where(eq(goodsReceipt.id, receiptId)).for("update"),
          async () => {
            const approval = withTestRequest(approveGoodsReceiptReversal)({
              goodsReceiptId: receiptId,
            });
            // Ensure approval queues first; rejection must subsequently recheck committed state.
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline) {
              const waits = await pool.query<{ count: string }>(
                "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
              );
              if (Number(waits.rows[0]?.count) >= 1) break;
              await Bun.sleep(10);
            }
            const rejection = withTestRequest(rejectGoodsReceiptReversal)({
              goodsReceiptId: receiptId,
              reason: "Tolak keputusan stale pada fixture concurrency.",
            });
            return Promise.all([approval, rejection]);
          },
        );
        expect(decisions[0]?.success).toBe(true);
        expect(decisions[1]?.success).toBe(false);
        expect(
          (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, receiptId) }))
            ?.status,
        ).toBe("REVERSED");
        expect(Number((await inventory(LED)).currentStock)).toBe(Number(before.currentStock) - 5);
        expect(await reversalMovements(receiptId)).toHaveLength(1);
        expect(await approvalAudits(receiptId)).toHaveLength(1);
      }),
    );

    it(
      "a later insufficient-stock item rolls back earlier item inventory and reversal links",
      withTestRequest(async (): Promise<void> => {
        const receiptId = await pendingReceipt([
          { materialId: PU, quantity: 2, unitCost: 150000 },
          { materialId: LED, quantity: 5, unitCost: 320000 },
        ]);
        const firstBefore = await inventory(PU);
        const unavailable = await inventory(LED);
        await db
          .update(materialInventory)
          .set({ currentStock: "0.00", reservedStock: "0.00" })
          .where(eq(materialInventory.id, unavailable.id));
        const result = await approveGoodsReceiptReversal({ goodsReceiptId: receiptId });
        expect(result.success).toBe(false);
        expect((await inventory(PU)).currentStock).toBe(firstBefore.currentStock);
        expect((await inventory(PU)).averageCost).toBe(firstBefore.averageCost);
        expect((await inventory(LED)).currentStock).toBe("0.00");
        expect(await reversalMovements(receiptId)).toHaveLength(0);
        expect(await approvalAudits(receiptId)).toHaveLength(0);
        const items = await db.query.goodsReceiptItem.findMany({
          where: eq(goodsReceiptItem.goodsReceiptId, receiptId),
        });
        expect(items.every((item) => item.reversalStockMovementId === null)).toBe(true);
        expect(
          (await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, receiptId) }))
            ?.status,
        ).toBe("REVERSAL_REQUESTED");
      }),
    );

    it(
      "an actual AI card persistence failure rolls back stock and its retry commits once",
      withTestRequest(async (): Promise<void> => {
        actAs(PURCHASING);
        const [conversation] = await db
          .insert(aiConversation)
          .values({
            userId: PURCHASING.id,
            title: "Synthetic receipt confirmation rollback",
          })
          .returning();
        if (!conversation) throw new Error("Conversation fixture missing.");
        const input = {
          toolCallId: crypto.randomUUID(),
          conversationId: conversation.id,
          projectId: PROJECT,
          inventoryLocationId: LOCATION,
          receiptNumber: `GRN-AI-ROLLBACK-${crypto.randomUUID()}`,
          receivedAt: new Date().toISOString(),
          items: [{ materialId: PU, quantity: 2, unitCost: 150000 }],
        };
        const before = await inventory(PU);
        // Test-only fault injection rejects the last insert after business writes.
        await pool.query(
          "ALTER TABLE ai_proposal_confirmation ADD CONSTRAINT test_receipt_confirmation_failure CHECK (false) NOT VALID",
        );
        try {
          const failed = await confirmAiGoodsReceiptProposal(input);
          expect(failed.success).toBe(false);
          expect((await inventory(PU)).currentStock).toBe(before.currentStock);
          expect((await inventory(PU)).averageCost).toBe(before.averageCost);
          expect(
            await db.query.goodsReceipt.findFirst({
              where: eq(goodsReceipt.receiptNumber, input.receiptNumber),
            }),
          ).toBeUndefined();
          expect(
            await db.query.aiProposalConfirmation.findFirst({
              where: eq(aiProposalConfirmation.toolCallId, input.toolCallId),
            }),
          ).toBeUndefined();
        } finally {
          await pool.query(
            "ALTER TABLE ai_proposal_confirmation DROP CONSTRAINT test_receipt_confirmation_failure",
          );
        }
        const confirmed = await confirmAiGoodsReceiptProposal(input);
        expect(confirmed.success).toBe(true);
        if (!confirmed.success) throw new Error(confirmed.error.message);
        expect(confirmed.data.alreadyConfirmed).toBe(false);
        const repeated = await confirmAiGoodsReceiptProposal(input);
        expect(repeated.success).toBe(true);
        if (!repeated.success) throw new Error(repeated.error.message);
        expect(repeated.data.alreadyConfirmed).toBe(true);
        expect(repeated.data.receiptId).toBe(confirmed.data.receiptId);
        expect(Number((await inventory(PU)).currentStock)).toBe(Number(before.currentStock) + 2);
        expect(
          await db.query.stockMovement.findMany({
            where: and(
              eq(stockMovement.referenceId, confirmed.data.receiptId),
              eq(stockMovement.movementType, "GOODS_RECEIPT"),
            ),
          }),
        ).toHaveLength(1);
        expect(
          await db.query.aiProposalConfirmation.findMany({
            where: eq(aiProposalConfirmation.toolCallId, input.toolCallId),
          }),
        ).toHaveLength(1);
        expect(
          await db.query.auditLog.findMany({
            where: and(
              eq(auditLog.targetId, confirmed.data.receiptId),
              eq(auditLog.action, "POST_GOODS_RECEIPT"),
            ),
          }),
        ).toHaveLength(1);
      }),
    );

    it(
      "a confirmation failure rolls back receipt, inventory, movement and audit in the caller transaction",
      withTestRequest(async (): Promise<void> => {
        actAs(PURCHASING);
        const actor = await resolveActor();
        if (!actor) throw new Error("Synthetic fixture actor missing.");
        const before = await inventory(PU);
        const input = createGoodsReceiptSchema.parse({
          projectId: PROJECT,
          inventoryLocationId: LOCATION,
          receiptNumber: `GRN-ROLLBACK-${crypto.randomUUID()}`,
          receivedAt: new Date(),
          items: [{ materialId: PU, quantity: 2, unitCost: 150000 }],
        });
        let receiptId = "";
        await expect(
          db.transaction(async (tx): Promise<void> => {
            const posted = await postGoodsReceiptTx(tx, actor, input);
            receiptId = posted.id;
            throw new Error("Confirmation persistence failed.");
          }),
        ).rejects.toThrow("Confirmation persistence failed.");
        expect((await inventory(PU)).currentStock).toBe(before.currentStock);
        expect((await inventory(PU)).averageCost).toBe(before.averageCost);
        expect(
          await db.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.id, receiptId) }),
        ).toBeUndefined();
        expect(
          await db.query.stockMovement.findMany({
            where: eq(stockMovement.referenceId, receiptId),
          }),
        ).toHaveLength(0);
        expect(
          await db.query.auditLog.findMany({ where: eq(auditLog.targetId, receiptId) }),
        ).toHaveLength(0);
      }),
    );
  },
);
