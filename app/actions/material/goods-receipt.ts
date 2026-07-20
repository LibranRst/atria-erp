"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  goodsReceipt,
  goodsReceiptItem,
  materialInventory,
  projectRapItem,
  stockMovement,
  vendorBill,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess, assertProjectIsOperational } from "@/lib/auth/scoping";
import type { ActionResponse } from "@/lib/types/action-response";
import { createGoodsReceiptSchema } from "@/lib/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
type GoodsReceipt = typeof goodsReceipt.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

export async function postGoodsReceipt(input: unknown): Promise<ActionResponse<GoodsReceipt>> {
  const validation = createGoodsReceiptSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.issues[0]?.message ?? "Goods Receipt tidak valid." } };
  }
  const user = await getSessionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(user, "create:stock_movement");
    const roleName = await resolveRoleName(user.roleId ?? "");
    if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN" && roleName !== "PURCHASING") {
      await assertProjectAccess(validation.data.projectId, user.id, roleName);
    }
    await assertProjectIsOperational(validation.data.projectId);
    const posted = await db.transaction(async (tx) => {
      const lockedBill = validation.data.vendorBillId
        ? (await tx.select().from(vendorBill).where(eq(vendorBill.id, validation.data.vendorBillId)).for("update"))[0]
        : null;
      if (validation.data.vendorBillId && (!lockedBill || lockedBill.projectId !== validation.data.projectId)) {
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
          .where(and(
            eq(stockMovement.vendorBillId, lockedBill.id),
            inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
          ));
        const existingValue = existingBillMovements.reduce((sum, movement) => {
          const value = Number(movement.quantity) * Number(movement.unitCost);
          return movement.movementType === "GOODS_RECEIPT_REVERSAL" ? sum - value : sum + value;
        }, 0);
        const incomingValue = validation.data.items.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0,
        );
        if (existingValue + incomingValue > Number(lockedBill.amount) + 0.01) {
          throw new Error("GOODS_RECEIPT_EXCEEDS_VENDOR_BILL");
        }
      }

      const duplicate = await tx.query.goodsReceipt.findFirst({ where: eq(goodsReceipt.receiptNumber, validation.data.receiptNumber) });
      if (duplicate) throw new Error("Nomor Goods Receipt sudah dipakai.");
      const [receipt] = await tx.insert(goodsReceipt).values({
        vendorBillId: validation.data.vendorBillId ?? null,
        projectId: validation.data.projectId,
        inventoryLocationId: validation.data.inventoryLocationId,
        receiptNumber: validation.data.receiptNumber,
        status: "POSTED",
        receivedAt: validation.data.receivedAt,
        note: validation.data.note ?? null,
        receivedById: user.id,
      }).returning();

      for (const [index, item] of validation.data.items.entries()) {
        if (item.projectRapItemId) {
          const [rapItem] = await tx.select().from(projectRapItem).where(eq(projectRapItem.id, item.projectRapItemId)).for("update");
          if (!rapItem) throw new Error("GOODS_RECEIPT_RAP_ITEM_MISMATCH");
          const rap = await tx.query.projectRap.findFirst({ where: (table, { eq: equal }) => equal(table.id, rapItem.projectRapId) });
          if (!rap || rap.projectId !== validation.data.projectId || rapItem.materialId !== item.materialId) {
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
            .where(and(
              eq(stockMovement.projectRapItemId, item.projectRapItemId),
              inArray(stockMovement.movementType, ["GOODS_RECEIPT", "GOODS_RECEIPT_REVERSAL"]),
            ));
          const alreadyReceived = existingRapMovements.reduce(
            (sum, movement) => movement.movementType === "GOODS_RECEIPT_REVERSAL"
              ? sum - Number(movement.quantity)
              : sum + Number(movement.quantity),
            0,
          );
          if (alreadyReceived + item.quantity > Number(rapItem.totalQuantity) + 0.001) {
            throw new Error("GOODS_RECEIPT_EXCEEDS_RAP_QUANTITY");
          }
        } else if (lockedBill?.projectRapItemId || (lockedBill?.materialId && lockedBill.materialId !== item.materialId)) {
          throw new Error("GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH");
        }
        const [inventory] = await tx.select().from(materialInventory).where(and(
          eq(materialInventory.materialId, item.materialId),
          eq(materialInventory.locationId, validation.data.inventoryLocationId),
        )).for("update");
        if (!inventory) throw new Error("Inventory default material belum tersedia di lokasi penerimaan.");
        const currentQuantity = Number(inventory.currentStock);
        const nextQuantity = currentQuantity + item.quantity;
        const weightedAverageCost = nextQuantity > 0
          ? ((currentQuantity * Number(inventory.averageCost)) + (item.quantity * item.unitCost)) / nextQuantity
          : item.unitCost;
        const [updatedInventory] = await tx.update(materialInventory).set({
          currentStock: nextQuantity.toFixed(2),
          averageCost: weightedAverageCost.toFixed(2),
          lastPurchasePrice: item.unitCost.toFixed(2),
          updatedAt: new Date(),
        }).where(eq(materialInventory.id, inventory.id)).returning();
        const [movement] = await tx.insert(stockMovement).values({
          materialId: item.materialId,
          inventoryLocationId: validation.data.inventoryLocationId,
          projectId: validation.data.projectId,
          projectRapItemId: item.projectRapItemId ?? null,
          vendorBillId: validation.data.vendorBillId ?? null,
          movementType: "GOODS_RECEIPT",
          movementDirection: "IN",
          referenceType: "GOODS_RECEIPT",
          referenceId: receipt.id,
          quantity: item.quantity.toFixed(2),
          unitCost: item.unitCost.toFixed(2),
          note: item.note ?? validation.data.note ?? `Goods Receipt ${validation.data.receiptNumber}`,
          createdById: user.id,
        }).returning();
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
          userId: user.id,
          action: "POST_GOODS_RECEIPT_INVENTORY",
          targetTable: "material_inventory",
          targetId: inventory.id,
          originalState: JSON.stringify(inventory),
          newState: JSON.stringify({ ...updatedInventory, stockMovementId: movement.id, line: index + 1 }),
        });
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "POST_GOODS_RECEIPT",
        targetTable: "goods_receipt",
        targetId: receipt.id,
        newState: JSON.stringify({ ...receipt, items: validation.data.items }),
      });
      return receipt;
    });

    revalidatePath("/materials");
    revalidatePath(`/projects/${posted.projectId}`);
    return { success: true, data: posted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal posting Goods Receipt.";
    const businessMessages: Record<string, string> = {
      GOODS_RECEIPT_VENDOR_BILL_MISMATCH: "Tagihan vendor tidak sesuai dengan proyek penerimaan.",
      GOODS_RECEIPT_VENDOR_BILL_ITEM_MISMATCH: "Material atau item RAP tidak sesuai dengan tagihan vendor.",
      GOODS_RECEIPT_RAP_ITEM_MISMATCH: "Item RAP tidak sesuai dengan proyek atau material penerimaan.",
      GOODS_RECEIPT_EXCEEDS_VENDOR_BILL: "Total nilai penerimaan melebihi sisa nilai tagihan vendor.",
      GOODS_RECEIPT_EXCEEDS_RAP_QUANTITY: "Jumlah penerimaan melebihi sisa kebutuhan item RAP.",
    };
    if (businessMessages[message]) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: businessMessages[message] } };
    }
    if (message.includes("FORBIDDEN") || message.includes("Akses")) return { success: false, error: { code: "FORBIDDEN", message } };
    return { success: false, error: { code: "TRANSACTION_FAILED", message } };
  }
}
