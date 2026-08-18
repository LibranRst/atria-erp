"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { materialInventory, stockMovement } from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import { fromCents, parseNumericToCents } from "@/lib/finance/balance-mutation";
import { ActionResponse } from "@atria/core/types/action-response";
import {
  AdjustMaterialStockInput,
  RecordStockInInput,
  ReserveMaterialInput,
  ReturnMaterialInput,
  UseMaterialInput,
  WasteMaterialInput,
  adjustMaterialStockSchema,
  recordStockInSchema,
  reserveMaterialSchema,
} from "@atria/core/validations/material";
import {
  assertProjectScopeForMaterialAction,
  ensureNonNegativeStock,
  findLockedInventory,
  getSessionUser,
  insertStockMovement,
  mapStockError,
  toDecimal,
  writeStockMovementAuditTx,
} from "./inventory-utils";
import {
  returnMaterialFromProject as recordMaterialReturnFromProject,
  useMaterialForProject as recordMaterialUsageForProject,
  wasteMaterialForProject as recordMaterialWasteForProject,
} from "./inventory-project-movements";

export async function recordStockIn(
  input: RecordStockInInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = recordStockInSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data stock in tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "create:stock_movement");
    await assertProjectScopeForMaterialAction(
      validation.data.projectId,
      sessionResult.data.user.id,
      sessionResult.data.roleName,
    );

    const result = await db.transaction(async (tx) => {
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const oldCurrent = parseNumericToCents(inventory.currentStock);
      const oldAverageCost = Number(inventory.averageCost);
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const nextCurrent = oldCurrent + quantity;
      const unitCost = validation.data.unitCost ?? 0;
      const currentQty = Number(inventory.currentStock);
      const nextQty = Number(fromCents(nextCurrent));
      const weightedAverageCost =
        nextQty > 0
          ? (currentQty * oldAverageCost + validation.data.quantity * unitCost) / nextQty
          : unitCost;

      const [updated] = await tx
        .update(materialInventory)
        .set({
          currentStock: fromCents(nextCurrent),
          averageCost: weightedAverageCost.toFixed(2),
          lastPurchasePrice: unitCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id))
        .returning();

      const movement = await insertStockMovement(tx, {
        ...validation.data,
        movementType: "STOCK_IN",
        quantity: toDecimal(validation.data.quantity),
        unitCost: unitCost.toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "RECORD_STOCK_IN",
        inventoryId: inventory.id,
        originalState: { currentStock: inventory.currentStock, averageCost: inventory.averageCost },
        newState: {
          currentStock: updated.currentStock,
          averageCost: updated.averageCost,
          stockMovementId: movement.id,
        },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal mencatat stock in.");
  }
}

export async function reserveMaterialForProject(
  input: ReserveMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = reserveMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data reservasi material tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "reserve:stock");
    await assertProjectScopeForMaterialAction(
      validation.data.projectId,
      sessionResult.data.user.id,
      sessionResult.data.roleName,
    );

    const result = await db.transaction(async (tx) => {
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const currentStock = parseNumericToCents(inventory.currentStock);
      const reservedStock = parseNumericToCents(inventory.reservedStock);
      const availableStock = currentStock - reservedStock;

      if (quantity > availableStock) {
        throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
      }

      const nextReserved = reservedStock + quantity;
      const [updated] = await tx
        .update(materialInventory)
        .set({
          reservedStock: fromCents(nextReserved),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id))
        .returning();

      const movement = await insertStockMovement(tx, {
        ...validation.data,
        movementType: "RESERVE",
        quantity: toDecimal(validation.data.quantity),
        unitCost: (validation.data.unitCost ?? Number(inventory.averageCost)).toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "RESERVE_MATERIAL",
        inventoryId: inventory.id,
        originalState: { reservedStock: inventory.reservedStock },
        newState: { reservedStock: updated.reservedStock, stockMovementId: movement.id },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal melakukan reservasi material.");
  }
}

export async function wasteMaterialForProject(
  input: WasteMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  return recordMaterialWasteForProject(input);
}

export async function useMaterialForProject(
  input: UseMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  return recordMaterialUsageForProject(input);
}

export async function returnMaterialFromProject(
  input: ReturnMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  return recordMaterialReturnFromProject(input);
}

export async function adjustMaterialStock(
  input: AdjustMaterialStockInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = adjustMaterialStockSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data adjustment stock tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "adjust:stock");

    const result = await db.transaction(async (tx) => {
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const currentStock = parseNumericToCents(inventory.currentStock);
      const nextCurrent =
        validation.data.direction === "INCREASE"
          ? currentStock + quantity
          : currentStock - quantity;

      ensureNonNegativeStock(nextCurrent, "INSUFFICIENT_CURRENT_STOCK");
      if (nextCurrent < parseNumericToCents(inventory.reservedStock)) {
        throw new Error("STOCK_RESERVED_FOR_OTHER_PROJECTS");
      }

      const [updated] = await tx
        .update(materialInventory)
        .set({
          currentStock: fromCents(nextCurrent),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id))
        .returning();

      const movement = await insertStockMovement(tx, {
        ...validation.data,
        movementType: "ADJUSTMENT",
        quantity: toDecimal(validation.data.quantity),
        unitCost: (validation.data.unitCost ?? Number(inventory.averageCost)).toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "ADJUST_MATERIAL_STOCK",
        inventoryId: inventory.id,
        originalState: { currentStock: inventory.currentStock, note: validation.data.note },
        newState: {
          currentStock: updated.currentStock,
          direction: validation.data.direction,
          stockMovementId: movement.id,
        },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal melakukan adjustment stock.");
  }
}
