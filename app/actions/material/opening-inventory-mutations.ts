"use server";

import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  materialInventory,
  stockMovement,
} from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  createInventoryOpeningSchema,
  decideInventoryOpeningSchema,
  reverseInventoryOpeningSchema,
  type CreateInventoryOpeningInput,
  type DecideInventoryOpeningInput,
  type ReverseInventoryOpeningInput,
} from "@/lib/validations/material";
import { getSessionUser } from "./inventory-utils";
import {
  openingInventoryFailure as failure,
  refreshOpeningInventory as refresh,
} from "./opening-inventory-action-utils";
import type { OpeningBatch } from "./opening-inventory-types";

export async function createInventoryOpening(
  input: CreateInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = createInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Saldo awal stok tidak valid.",
      },
    };
  }
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "create:opening_inventory");
    const created = await db.transaction(async (tx) => {
      const batchNumber =
        validation.data.batchNumber?.trim() ||
        `SA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const duplicate = await tx.query.inventoryOpeningBatch.findFirst({
        where: eq(inventoryOpeningBatch.batchNumber, batchNumber),
      });
      if (duplicate) throw new Error("Referensi saldo awal sudah digunakan. Coba ajukan kembali.");
      const inventoryIds = validation.data.items.map((item) => item.materialInventoryId).toSorted();
      for (const inventoryId of inventoryIds) {
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, inventoryId))
          .for("update");
        if (!inventory) throw new Error("Inventory material tidak ditemukan.");
        const priorMovement = await tx.query.stockMovement.findFirst({
          where: and(
            eq(stockMovement.materialId, inventory.materialId),
            eq(stockMovement.inventoryLocationId, inventory.locationId),
          ),
        });
        if (
          Number(inventory.currentStock) !== 0 ||
          Number(inventory.reservedStock) !== 0 ||
          priorMovement
        ) {
          throw new Error("INVENTORY_ALREADY_ACTIVE");
        }
        const [pendingOpening] = await tx
          .select({ id: inventoryOpeningItem.id })
          .from(inventoryOpeningItem)
          .innerJoin(
            inventoryOpeningBatch,
            eq(inventoryOpeningBatch.id, inventoryOpeningItem.batchId),
          )
          .where(
            and(
              eq(inventoryOpeningItem.materialInventoryId, inventoryId),
              eq(inventoryOpeningBatch.status, "PENDING_APPROVAL"),
            ),
          )
          .limit(1);
        if (pendingOpening) throw new Error("OPENING_ALREADY_PENDING");
      }
      const [batch] = await tx
        .insert(inventoryOpeningBatch)
        .values({
          batchNumber,
          cutoverDate: validation.data.cutoverDate,
          status: "PENDING_APPROVAL",
          note: validation.data.note,
          referenceNumber: validation.data.referenceNumber?.trim() || null,
          requestedById: session.data.user.id,
        })
        .returning();
      await tx.insert(inventoryOpeningItem).values(
        validation.data.items.map((item) => ({
          batchId: batch.id,
          materialInventoryId: item.materialInventoryId,
          quantity: item.quantity.toFixed(2),
          unitCost: item.unitCost.toFixed(2),
        })),
      );
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "REQUEST_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: batch.id,
        newState: JSON.stringify({ ...batch, items: validation.data.items }),
      });
      return batch;
    });
    refresh();
    return { success: true, data: created };
  } catch (error) {
    return failure(error, "Gagal mengajukan saldo awal stok.");
  }
}

export async function decideInventoryOpening(
  input: DecideInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = decideInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Keputusan tidak valid.",
      },
    };
  }
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "approve:opening_inventory");
    const decided = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(inventoryOpeningBatch)
        .where(eq(inventoryOpeningBatch.id, validation.data.batchId))
        .for("update");
      if (!locked) throw new Error("OPENING_NOT_FOUND");
      if (locked.status !== "PENDING_APPROVAL") {
        throw new Error("Batch saldo awal sudah diputuskan.");
      }
      if (validation.data.decision === "REJECT") {
        const [rejected] = await tx
          .update(inventoryOpeningBatch)
          .set({
            status: "REJECTED",
            decisionReason: validation.data.reason,
            rejectedReason: validation.data.reason,
            approvedById: session.data.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(inventoryOpeningBatch.id, locked.id))
          .returning();
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
          action: "REJECT_INVENTORY_OPENING",
          targetTable: "inventory_opening_batch",
          targetId: locked.id,
          originalState: JSON.stringify(locked),
          newState: JSON.stringify(rejected),
        });
        return rejected;
      }
      if (locked.requestedById === session.data.user.id) {
        throw new Error("MAKER_CHECKER_REQUIRED");
      }
      const items = await tx.query.inventoryOpeningItem.findMany({
        where: eq(inventoryOpeningItem.batchId, locked.id),
        orderBy: [asc(inventoryOpeningItem.createdAt)],
      });
      for (const item of items) {
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, item.materialInventoryId))
          .for("update");
        if (!inventory) throw new Error("Inventory material tidak ditemukan.");
        const priorMovement = await tx.query.stockMovement.findFirst({
          where: and(
            eq(stockMovement.materialId, inventory.materialId),
            eq(stockMovement.inventoryLocationId, inventory.locationId),
          ),
        });
        if (
          Number(inventory.currentStock) !== 0 ||
          Number(inventory.reservedStock) !== 0 ||
          priorMovement
        ) {
          throw new Error("INVENTORY_ALREADY_ACTIVE");
        }
        await tx
          .update(materialInventory)
          .set({
            currentStock: item.quantity,
            averageCost: item.unitCost,
            lastPurchasePrice: item.unitCost,
            updatedAt: new Date(),
          })
          .where(eq(materialInventory.id, inventory.id));
        const [movement] = await tx
          .insert(stockMovement)
          .values({
            materialId: inventory.materialId,
            inventoryLocationId: inventory.locationId,
            movementType: "OPENING_BALANCE",
            movementDirection: "IN",
            referenceType: "INVENTORY_OPENING",
            referenceId: locked.id,
            quantity: item.quantity,
            unitCost: item.unitCost,
            note: locked.note,
            createdById: session.data.user.id,
          })
          .returning();
        await tx
          .update(inventoryOpeningItem)
          .set({ stockMovementId: movement.id })
          .where(eq(inventoryOpeningItem.id, item.id));
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
          action: "POST_INVENTORY_OPENING_ITEM",
          targetTable: "material_inventory",
          targetId: inventory.id,
          originalState: JSON.stringify(inventory),
          newState: JSON.stringify({
            currentStock: item.quantity,
            averageCost: item.unitCost,
            stockMovementId: movement.id,
          }),
        });
      }
      const [posted] = await tx
        .update(inventoryOpeningBatch)
        .set({
          status: "POSTED",
          decisionReason: validation.data.reason,
          approvedById: session.data.user.id,
          approvedAt: new Date(),
          postedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventoryOpeningBatch.id, locked.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "APPROVE_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: locked.id,
        originalState: JSON.stringify(locked),
        newState: JSON.stringify({ ...posted, decisionReason: validation.data.reason }),
      });
      return posted;
    });
    refresh(false);
    return { success: true, data: decided };
  } catch (error) {
    return failure(error, "Gagal memutus saldo awal stok.");
  }
}

export async function reverseInventoryOpening(
  input: ReverseInventoryOpeningInput,
): Promise<ActionResponse<OpeningBatch>> {
  const validation = reverseInventoryOpeningSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Reversal tidak valid.",
      },
    };
  }
  const session = await getSessionUser();
  if (!session.success) return session;
  try {
    await assertPermission(session.data.user, "reverse:opening_inventory");
    const reversed = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(inventoryOpeningBatch)
        .where(eq(inventoryOpeningBatch.id, validation.data.batchId))
        .for("update");
      if (!locked) throw new Error("OPENING_NOT_FOUND");
      if (locked.status !== "POSTED") {
        throw new Error("Hanya saldo awal berstatus sudah diposting yang dapat dibalik.");
      }
      const items = await tx.query.inventoryOpeningItem.findMany({
        where: eq(inventoryOpeningItem.batchId, locked.id),
        with: { stockMovement: true },
      });
      for (const item of items) {
        if (!item.stockMovement) throw new Error("Pergerakan saldo awal tidak ditemukan.");
        const later = await tx.query.stockMovement.findFirst({
          where: and(
            eq(stockMovement.materialId, item.stockMovement.materialId),
            eq(stockMovement.inventoryLocationId, item.stockMovement.inventoryLocationId),
            gt(stockMovement.createdAt, item.stockMovement.createdAt),
          ),
        });
        if (later) throw new Error("REVERSAL_HAS_LATER_MOVEMENT");
        const [inventory] = await tx
          .select()
          .from(materialInventory)
          .where(eq(materialInventory.id, item.materialInventoryId))
          .for("update");
        if (
          !inventory ||
          Number(inventory.currentStock) !== Number(item.quantity) ||
          Number(inventory.reservedStock) !== 0
        ) {
          throw new Error("Saldo inventory sudah berubah dan tidak aman untuk reversal.");
        }
        await tx
          .update(materialInventory)
          .set({
            currentStock: "0.00",
            averageCost: "0.00",
            lastPurchasePrice: "0.00",
            updatedAt: new Date(),
          })
          .where(eq(materialInventory.id, inventory.id));
        const [movement] = await tx
          .insert(stockMovement)
          .values({
            materialId: inventory.materialId,
            inventoryLocationId: inventory.locationId,
            movementType: "OPENING_BALANCE_REVERSAL",
            movementDirection: "OUT",
            referenceType: "INVENTORY_OPENING",
            referenceId: locked.id,
            quantity: item.quantity,
            unitCost: item.unitCost,
            note: validation.data.reason,
            createdById: session.data.user.id,
          })
          .returning();
        await tx
          .update(inventoryOpeningItem)
          .set({ reversalStockMovementId: movement.id })
          .where(eq(inventoryOpeningItem.id, item.id));
        await tx.insert(auditLog).values({
          userId: session.data.user.id,
          action: "REVERSE_INVENTORY_OPENING_ITEM",
          targetTable: "material_inventory",
          targetId: inventory.id,
          originalState: JSON.stringify(inventory),
          newState: JSON.stringify({
            currentStock: 0,
            averageCost: 0,
            reversalStockMovementId: movement.id,
          }),
        });
      }
      const [updated] = await tx
        .update(inventoryOpeningBatch)
        .set({
          status: "REVERSED",
          reversedById: session.data.user.id,
          reversedAt: new Date(),
          reversalReason: validation.data.reason,
          updatedAt: new Date(),
        })
        .where(eq(inventoryOpeningBatch.id, locked.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: session.data.user.id,
        action: "REVERSE_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: locked.id,
        originalState: JSON.stringify(locked),
        newState: JSON.stringify(updated),
      });
      return updated;
    });
    refresh();
    return { success: true, data: reversed };
  } catch (error) {
    return failure(error, "Gagal membalik saldo awal stok.");
  }
}
