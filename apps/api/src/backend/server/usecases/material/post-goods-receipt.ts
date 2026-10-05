import type { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import type { db } from "@backend/db";
import {
  auditLog,
  goodsReceipt,
  goodsReceiptItem,
  materialInventory,
  projectRapItem,
  stockMovement,
  vendorBill,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import type { Actor } from "@backend/server/actor";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import type { createGoodsReceiptSchema } from "@atria/core/validations/workflow-governance";

export type GoodsReceiptTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type CreateGoodsReceiptInput = z.output<typeof createGoodsReceiptSchema>;
export type GoodsReceipt = typeof goodsReceipt.$inferSelect;

/** The caller owns COMMIT; receipt, stock, audit and outbox use the same transaction. */
export async function postGoodsReceiptTx(
  tx: GoodsReceiptTransaction,
  actor: Actor,
  input: CreateGoodsReceiptInput,
): Promise<GoodsReceipt> {
  if (!actorCan(actor, "create:stock_movement")) {
    throw new Error("FORBIDDEN: Peran Anda tidak memiliki izin menerima material.");
  }
  await assertOperationalStockReadiness(tx);
  const project = await tx.query.project.findFirst({
    where: (table, { eq: equal }) => equal(table.id, input.projectId),
    columns: { status: true, projectManagerId: true },
  });
  if (actor.dataScope === "ASSIGNED" && project?.projectManagerId !== actor.userId) {
    throw new Error("FORBIDDEN: Anda tidak ditugaskan pada proyek ini.");
  }
  // Warehouse permissions allow Purchasing to receive across projects;
  // assigned roles remain restricted to their own project.
  assertProjectStatusIsOperational(project?.status);
  const lockedBill = input.vendorBillId
    ? (
        await tx
          .select()
          .from(vendorBill)
          .where(eq(vendorBill.id, input.vendorBillId))
          .for("update")
      )[0]
    : null;
  if (input.vendorBillId && (!lockedBill || lockedBill.projectId !== input.projectId)) {
    throw new Error("GOODS_RECEIPT_VENDOR_BILL_MISMATCH");
  }

  if (lockedBill) {
    const existingBillMovements = await tx
      .select({
        movementType: stockMovement.movementType,
        quantity: stockMovement.quantity,
        unitCost: stockMovement.unitCost,
      })
      .from(stockMovement)
      .where(
        and(
          eq(stockMovement.vendorBillId, lockedBill.id),
          inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
        ),
      );
    const existingValue = existingBillMovements.reduce((sum, movement) => {
      const value = Number(movement.quantity) * Number(movement.unitCost);
      return movement.movementType === "GOODS_RECEIPT_REVERSAL" ? sum - value : sum + value;
    }, 0);
    const incomingValue = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    if (existingValue + incomingValue > Number(lockedBill.amount) + 0.01) {
      throw new Error("GOODS_RECEIPT_EXCEEDS_VENDOR_BILL");
    }
  }

  const duplicate = await tx.query.goodsReceipt.findFirst({
    where: eq(goodsReceipt.receiptNumber, input.receiptNumber),
  });
  if (duplicate) throw new Error("Nomor Goods Receipt sudah dipakai.");
  const [receipt] = await tx
    .insert(goodsReceipt)
    .values({
      vendorBillId: input.vendorBillId ?? null,
      projectId: input.projectId,
      inventoryLocationId: input.inventoryLocationId,
      receiptNumber: input.receiptNumber,
      status: "POSTED",
      receivedAt: input.receivedAt,
      note: input.note ?? null,
      receivedById: actor.userId,
    })
    .returning();

  for (const [index, item] of input.items.entries()) {
    await validateStockMovementLinksTx(tx, {
      materialId: item.materialId,
      projectId: input.projectId,
      projectRapItemId: item.projectRapItemId,
      vendorBillId: input.vendorBillId,
    });
    if (item.projectRapItemId) {
      const [rapItem] = await tx
        .select()
        .from(projectRapItem)
        .where(eq(projectRapItem.id, item.projectRapItemId))
        .for("update");
      if (!rapItem) throw new Error("GOODS_RECEIPT_RAP_ITEM_MISMATCH");
      const rap = await tx.query.projectRap.findFirst({
        where: (table, { eq: equal }) => equal(table.id, rapItem.projectRapId),
      });
      if (!rap || rap.projectId !== input.projectId || rapItem.materialId !== item.materialId) {
        throw new Error("GOODS_RECEIPT_RAP_ITEM_MISMATCH");
      }
      if (lockedBill?.projectRapItemId && lockedBill.projectRapItemId !== item.projectRapItemId) {
        throw new Error("GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH");
      }
      if (lockedBill?.materialId && lockedBill.materialId !== item.materialId) {
        throw new Error("GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH");
      }
      const existingRapMovements = await tx
        .select({ movementType: stockMovement.movementType, quantity: stockMovement.quantity })
        .from(stockMovement)
        .where(
          and(
            eq(stockMovement.projectRapItemId, item.projectRapItemId),
            inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
          ),
        );
      const alreadyReceived = existingRapMovements.reduce(
        (sum, movement) =>
          movement.movementType === "GOODS_RECEIPT_REVERSAL"
            ? sum - Number(movement.quantity)
            : sum + Number(movement.quantity),
        0,
      );
      if (alreadyReceived + item.quantity > Number(rapItem.totalQuantity) + 0.001) {
        throw new Error("GOODS_RECEIPT_EXCEEDS_RAP_QUANTITY");
      }
    } else if (
      lockedBill?.projectRapItemId ||
      (lockedBill?.materialId && lockedBill.materialId !== item.materialId)
    ) {
      throw new Error("GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH");
    }
    const [inventory] = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.materialId, item.materialId),
          eq(materialInventory.locationId, input.inventoryLocationId),
        ),
      )
      .for("update");
    if (!inventory)
      throw new Error("Inventory default material belum tersedia di lokasi penerimaan.");
    const currentQuantity = Number(inventory.currentStock);
    const nextQuantity = currentQuantity + item.quantity;
    const weightedAverageCost =
      nextQuantity > 0
        ? (currentQuantity * Number(inventory.averageCost) + item.quantity * item.unitCost) /
          nextQuantity
        : item.unitCost;
    const [updatedInventory] = await tx
      .update(materialInventory)
      .set({
        currentStock: nextQuantity.toFixed(2),
        averageCost: weightedAverageCost.toFixed(2),
        lastPurchasePrice: item.unitCost.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, inventory.id))
      .returning();
    const [movement] = await tx
      .insert(stockMovement)
      .values({
        materialId: item.materialId,
        inventoryLocationId: input.inventoryLocationId,
        projectId: input.projectId,
        projectRapItemId: item.projectRapItemId ?? null,
        vendorBillId: input.vendorBillId ?? null,
        movementType: "GOODS_RECEIPT",
        movementDirection: "IN",
        referenceType: "GOODS_RECEIPT",
        referenceId: receipt.id,
        quantity: item.quantity.toFixed(2),
        unitCost: item.unitCost.toFixed(2),
        note: item.note ?? input.note ?? `Goods Receipt ${input.receiptNumber}`,
        createdById: actor.userId,
      })
      .returning();
    await tx.insert(goodsReceiptItem).values({
      goodsReceiptId: receipt.id,
      materialId: item.materialId,
      projectRapItemId: item.projectRapItemId ?? null,
      stockMovementId: movement.id,
      quantity: item.quantity.toFixed(2),
      unitCost: item.unitCost.toFixed(2),
      note: item.note ?? null,
    });
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "POST_GOODS_RECEIPT_INVENTORY",
      targetTable: "material_inventory",
      targetId: inventory.id,
      originalState: JSON.stringify(inventory),
      newState: JSON.stringify({
        ...updatedInventory,
        stockMovementId: movement.id,
        line: index + 1,
      }),
    });
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "POST_GOODS_RECEIPT",
    targetTable: "goods_receipt",
    targetId: receipt.id,
    newState: JSON.stringify({ ...receipt, items: input.items }),
  });
  await recordNotificationEvent(tx, {
    referenceType: "goods_receipt",
    referenceId: receipt.id,
    projectId: receipt.projectId,
    stage: "POSTED",
    title: "Material telah diterima",
    message: "Penerimaan material sudah dicatat di gudang.",
    permission: "view:material",
    actionUrl: `/projects/${receipt.projectId}?tab=materials`,
    actorId: actor.userId,
  });
  return receipt;
}
