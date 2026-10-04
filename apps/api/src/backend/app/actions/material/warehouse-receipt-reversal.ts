import { getRoleDataScopeFromDb, roleNameHasPermission } from "@backend/lib/auth/role-access";
import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { and, eq } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import {
  auditLog,
  goodsReceipt,
  goodsReceiptItem,
  materialInventory,
  stockMovement,
} from "@backend/db/schema";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  receiptReversalDecisionSchema,
  receiptReversalRequestSchema,
} from "@atria/core/validations/warehouse";
import {
  getWarehouseUser as user,
  refreshWarehouse as refresh,
  warehouseFailure as failure,
} from "./warehouse-action-utils";

type Receipt = typeof goodsReceipt.$inferSelect;
type ReceiptTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function assertAssignedReceiptScope(
  tx: ReceiptTransaction,
  receipt: Receipt,
  userId: string,
  assigned: boolean,
): Promise<void> {
  if (!assigned) return;
  const scopedProject = await tx.query.project.findFirst({
    where: (table, { and: all, eq: equal }) =>
      all(equal(table.id, receipt.projectId), equal(table.projectManagerId, userId)),
    columns: { id: true },
  });
  if (!scopedProject) throw new Error("FORBIDDEN: Proyek penerimaan di luar penugasan Anda.");
}

export async function requestGoodsReceiptReversal(
  input: unknown,
): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Request tidak valid.",
      },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "request:goods_receipt_reversal");
    const assigned = (await getRoleDataScopeFromDb(actor.roleId ?? "")) === "ASSIGNED";
    const [updated] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(goodsReceipt)
        .where(eq(goodsReceipt.id, parsed.data.goodsReceiptId))
        .for("update");
      if (existing) await assertAssignedReceiptScope(tx, existing, actor.id, assigned);
      if (
        existing?.status === "REVERSAL_REQUESTED" &&
        existing.reversalRequestedById === actor.id &&
        existing.reversalReason === parsed.data.reason
      ) {
        return [existing];
      }
      if (!existing || existing.status !== "POSTED")
        throw new Error("Hanya receipt POSTED yang dapat diminta reversal.");
      const rows = await tx
        .update(goodsReceipt)
        .set({
          status: "REVERSAL_REQUESTED",
          reversalReason: parsed.data.reason,
          reversalRequestedById: actor.id,
          reversalRequestedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(goodsReceipt.id, existing.id), eq(goodsReceipt.status, "POSTED")))
        .returning();
      if (!rows[0]) throw new Error("Status penerimaan telah berubah. Muat ulang data.");
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "REQUEST_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(rows[0]),
      });
      await recordNotificationEvent(tx, {
        referenceType: "goods_receipt",
        referenceId: rows[0].id,
        projectId: rows[0].projectId,
        stage: `${rows[0].status}:${rows[0].updatedAt.toISOString()}`,
        title:
          rows[0].status === "REVERSAL_REQUESTED"
            ? "Pembatalan penerimaan menunggu persetujuan"
            : "Pembatalan penerimaan ditolak",
        message: "Periksa penerimaan material terkait.",
        permission:
          rows[0].status === "REVERSAL_REQUESTED"
            ? "approve:goods_receipt_reversal"
            : "view:material",
        actionRequired: rows[0].status === "REVERSAL_REQUESTED",
        actionUrl: "/materials",
        actorId: actor.id,
      });
      return rows;
    });
    refresh();
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal meminta reversal receipt.");
  }
}

export async function approveGoodsReceiptReversal(
  input: unknown,
): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalDecisionSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Receipt tidak valid." } };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "approve:goods_receipt_reversal");
    const roleName = await resolveRoleName(actor.roleId ?? "");
    const canEmergencyOverride = await roleNameHasPermission(roleName, "override:self_approval");
    const assigned = (await getRoleDataScopeFromDb(actor.roleId ?? "")) === "ASSIGNED";
    const result = await db.transaction(async (tx) => {
      // Lock the header before checking status or reading items. Another approver
      // must see the committed REVERSED state before it can touch inventory.
      const [receipt] = await tx
        .select()
        .from(goodsReceipt)
        .where(eq(goodsReceipt.id, parsed.data.goodsReceiptId))
        .for("update");
      if (receipt) await assertAssignedReceiptScope(tx, receipt, actor.id, assigned);
      if (receipt?.status === "REVERSED") return receipt;
      if (!receipt || receipt.status !== "REVERSAL_REQUESTED")
        throw new Error("Receipt belum memiliki request reversal.");
      const selfApproval = receipt.reversalRequestedById === actor.id;
      if (
        selfApproval &&
        !(canEmergencyOverride && parsed.data.emergencyOverride && parsed.data.reason)
      )
        throw new Error(
          "MAKER_CHECKER_REQUIRED: Reversal receipt harus disetujui user lain. Owner dapat memakai emergency override dengan alasan.",
        );
      const items = await tx.query.goodsReceiptItem.findMany({
        where: eq(goodsReceiptItem.goodsReceiptId, receipt.id),
        orderBy: (table, { asc }) => [asc(table.materialId), asc(table.id)],
      });
      if (items.length === 0) throw new Error("Item penerimaan tidak ditemukan.");
      for (const item of items) {
        if (item.reversalStockMovementId)
          throw new Error("Item penerimaan sudah memiliki pembatalan stok.");
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(
            and(
              eq(materialInventory.materialId, item.materialId),
              eq(materialInventory.locationId, receipt.inventoryLocationId),
            ),
          )
          .for("update");
        if (!inventory || Number(inventory.currentStock) < Number(item.quantity))
          throw new Error("Stock tersisa tidak cukup untuk reversal receipt.");
        const nextQty = Number(inventory.currentStock) - Number(item.quantity);
        if (nextQty < Number(inventory.reservedStock))
          throw new Error("Reversal akan memakai stock yang sudah direservasi.");
        const nextValue =
          Number(inventory.currentStock) * Number(inventory.averageCost) -
          Number(item.quantity) * Number(item.unitCost);
        if (nextValue < -0.01)
          throw new Error("Nilai inventory tidak cukup untuk reversal receipt.");
        const nextAverage = nextQty > 0 ? Math.max(0, nextValue / nextQty) : 0;
        await tx
          .update(materialInventory)
          .set({
            currentStock: nextQty.toFixed(2),
            averageCost: nextAverage.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(materialInventory.id, inventory.id));
        const [movement] = await tx
          .insert(stockMovement)
          .values({
            materialId: item.materialId,
            inventoryLocationId: receipt.inventoryLocationId,
            projectId: receipt.projectId,
            projectRapItemId: item.projectRapItemId,
            vendorBillId: receipt.vendorBillId,
            movementType: "GOODS_RECEIPT_REVERSAL",
            movementDirection: "OUT",
            referenceType: "GOODS_RECEIPT",
            referenceId: receipt.id,
            quantity: item.quantity,
            unitCost: item.unitCost,
            note: receipt.reversalReason ?? "Goods Receipt reversal",
            createdById: actor.id,
          })
          .returning();
        await tx
          .update(goodsReceiptItem)
          .set({ reversalStockMovementId: movement.id })
          .where(eq(goodsReceiptItem.id, item.id));
      }
      const [updated] = await tx
        .update(goodsReceipt)
        .set({
          status: "REVERSED",
          reversedById: actor.id,
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(goodsReceipt.id, receipt.id), eq(goodsReceipt.status, "REVERSAL_REQUESTED")))
        .returning();
      if (!updated) throw new Error("Status penerimaan telah berubah. Muat ulang data.");
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: selfApproval
          ? "EMERGENCY_SELF_APPROVE_GOODS_RECEIPT_REVERSAL"
          : "APPROVE_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: receipt.id,
        originalState: JSON.stringify({ ...receipt, items }),
        newState: JSON.stringify({
          ...updated,
          emergencyReason: selfApproval ? parsed.data.reason : null,
        }),
      });
      await recordNotificationEvent(tx, {
        referenceType: "goods_receipt",
        referenceId: updated.id,
        projectId: updated.projectId,
        stage: "REVERSED",
        title: "Penerimaan material dibatalkan",
        message: "Stok telah dikoreksi sesuai pembatalan penerimaan.",
        permission: "view:material",
        actionUrl: "/materials",
        actorId: actor.id,
      });
      return updated;
    });
    refresh();
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal reverse Goods Receipt.");
  }
}

export async function rejectGoodsReceiptReversal(input: unknown): Promise<ActionResponse<Receipt>> {
  const parsed = receiptReversalDecisionSchema.safeParse(input);
  if (!parsed.success || !parsed.data.reason)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Alasan penolakan wajib diisi." },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "approve:goods_receipt_reversal");
    const assigned = (await getRoleDataScopeFromDb(actor.roleId ?? "")) === "ASSIGNED";
    const [updated] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(goodsReceipt)
        .where(eq(goodsReceipt.id, parsed.data.goodsReceiptId))
        .for("update");
      if (existing) await assertAssignedReceiptScope(tx, existing, actor.id, assigned);
      if (!existing || existing.status !== "REVERSAL_REQUESTED")
        throw new Error("Receipt belum memiliki request reversal.");
      const rows = await tx
        .update(goodsReceipt)
        .set({
          status: "POSTED",
          reversalRequestedById: null,
          reversalRequestedAt: null,
          reversalReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(goodsReceipt.id, existing.id), eq(goodsReceipt.status, "REVERSAL_REQUESTED")))
        .returning();
      if (!rows[0]) throw new Error("Status penerimaan telah berubah. Muat ulang data.");
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "REJECT_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify({ ...rows[0], rejectionReason: parsed.data.reason }),
      });
      await recordNotificationEvent(tx, {
        referenceType: "goods_receipt",
        referenceId: rows[0].id,
        projectId: rows[0].projectId,
        stage: `${rows[0].status}:${rows[0].updatedAt.toISOString()}`,
        title:
          rows[0].status === "REVERSAL_REQUESTED"
            ? "Pembatalan penerimaan menunggu persetujuan"
            : "Pembatalan penerimaan ditolak",
        message: "Periksa penerimaan material terkait.",
        permission:
          rows[0].status === "REVERSAL_REQUESTED"
            ? "approve:goods_receipt_reversal"
            : "view:material",
        actionRequired: rows[0].status === "REVERSAL_REQUESTED",
        actionUrl: "/materials",
        actorId: actor.id,
      });
      return rows;
    });
    refresh();
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal reject reversal.");
  }
}
