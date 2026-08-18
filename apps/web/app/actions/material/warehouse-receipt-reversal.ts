"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog, goodsReceipt, materialInventory, stockMovement } from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
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
    const existing = await db.query.goodsReceipt.findFirst({
      where: eq(goodsReceipt.id, parsed.data.goodsReceiptId),
    });
    if (!existing || existing.status !== "POSTED")
      throw new Error("Hanya receipt POSTED yang dapat diminta reversal.");
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(goodsReceipt)
        .set({
          status: "REVERSAL_REQUESTED",
          reversalReason: parsed.data.reason,
          reversalRequestedById: actor.id,
          reversalRequestedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(goodsReceipt.id, existing.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "REQUEST_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(rows[0]),
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
    const result = await db.transaction(async (tx) => {
      const receipt = await tx.query.goodsReceipt.findFirst({
        where: eq(goodsReceipt.id, parsed.data.goodsReceiptId),
        with: { items: true },
      });
      if (!receipt || receipt.status !== "REVERSAL_REQUESTED")
        throw new Error("Receipt belum memiliki request reversal.");
      const selfApproval = receipt.reversalRequestedById === actor.id;
      if (
        selfApproval &&
        !(roleName === "OWNER" && parsed.data.emergencyOverride && parsed.data.reason)
      )
        throw new Error(
          "MAKER_CHECKER_REQUIRED: Reversal receipt harus disetujui user lain. Owner dapat memakai emergency override dengan alasan.",
        );
      for (const item of receipt.items) {
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
          .update((await import("@/db/schema")).goodsReceiptItem)
          .set({ reversalStockMovementId: movement.id })
          .where(eq((await import("@/db/schema")).goodsReceiptItem.id, item.id));
      }
      const [updated] = await tx
        .update(goodsReceipt)
        .set({
          status: "REVERSED",
          reversedById: actor.id,
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(goodsReceipt.id, receipt.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: selfApproval
          ? "EMERGENCY_SELF_APPROVE_GOODS_RECEIPT_REVERSAL"
          : "APPROVE_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: receipt.id,
        originalState: JSON.stringify(receipt),
        newState: JSON.stringify({
          ...updated,
          emergencyReason: selfApproval ? parsed.data.reason : null,
        }),
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
    const existing = await db.query.goodsReceipt.findFirst({
      where: eq(goodsReceipt.id, parsed.data.goodsReceiptId),
    });
    if (!existing || existing.status !== "REVERSAL_REQUESTED")
      throw new Error("Receipt belum memiliki request reversal.");
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(goodsReceipt)
        .set({
          status: "POSTED",
          reversalRequestedById: null,
          reversalRequestedAt: null,
          reversalReason: null,
          updatedAt: new Date(),
        })
        .where(eq(goodsReceipt.id, existing.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "REJECT_GOODS_RECEIPT_REVERSAL",
        targetTable: "goods_receipt",
        targetId: existing.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify({ ...rows[0], rejectionReason: parsed.data.reason }),
      });
      return rows;
    });
    refresh();
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal reject reversal.");
  }
}
