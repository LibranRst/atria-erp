import {
  validateStockMovementLinksTx,
  stockCostAttributionTx,
} from "@backend/lib/material/stock-movement-links";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { materialInventory, stockMovement } from "@backend/db/schema";
import { assertPermission } from "@backend/lib/auth/permissions";
import { fromCents, parseNumericToCents } from "@backend/lib/finance/balance-mutation";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  exceedsProjectUsage,
  reservedAfterOwnRelease,
  violatesOtherProjectReservation,
} from "@atria/core/material/stock-guards";
import {
  type ReturnMaterialInput,
  type UseMaterialInput,
  type WasteMaterialInput,
  returnMaterialSchema,
  useMaterialSchema,
  wasteMaterialSchema,
} from "@atria/core/validations/material";
import {
  assertProjectScopeForMaterialAction,
  calculateOutstandingProjectReservations,
  ensureNonNegativeStock,
  findLockedInventory,
  getSessionUser,
  insertStockMovement,
  mapStockError,
  recordStandaloneStockProjectCostTx,
  toDecimal,
  writeStockMovementAuditTx,
} from "./inventory-utils";

export async function wasteMaterialForProject(
  input: WasteMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = wasteMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data waste tidak valid.",
      },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "waste:stock");
    await assertOperationalStockReadiness();
    await assertProjectScopeForMaterialAction(
      validation.data.projectId,
      sessionResult.data.user.id,
      sessionResult.data.roleName,
    );

    const result = await db.transaction(async (tx) => {
      const links = await validateStockMovementLinksTx(tx, validation.data);
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const projectMovements = await tx.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.projectId, validation.data.projectId),
          eq(stockMovement.materialId, validation.data.materialId),
          eq(stockMovement.inventoryLocationId, validation.data.inventoryLocationId),
        ),
        orderBy: [asc(stockMovement.createdAt), asc(stockMovement.id)],
      });
      const matchingMovements = validation.data.projectRapItemId
        ? projectMovements.filter(
            (movement) => movement.projectRapItemId === validation.data.projectRapItemId,
          )
        : projectMovements.filter((movement) => !movement.projectRapItemId);
      const outstandingReservation = calculateOutstandingProjectReservations(matchingMovements);
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const current = parseNumericToCents(inventory.currentStock);
      const reserved = parseNumericToCents(inventory.reservedStock);
      const nextCurrent = current - quantity;

      ensureNonNegativeStock(nextCurrent, "INSUFFICIENT_CURRENT_STOCK");

      const ownReserved = parseNumericToCents(toDecimal(outstandingReservation));
      const nextReserved = reservedAfterOwnRelease({ reserved, ownReserved, quantity });
      if (violatesOtherProjectReservation({ nextCurrent, reserved, ownReserved, quantity }))
        throw new Error("STOCK_RESERVED_FOR_OTHER_PROJECTS");
      const attribution = await stockCostAttributionTx(tx, links, {
        movementType: "WASTE",
        materialId: validation.data.materialId,
        quantity: validation.data.quantity,
        unitCost: validation.data.unitCost ?? Number(inventory.averageCost),
      });
      const [updated] = await tx
        .update(materialInventory)
        .set({
          currentStock: fromCents(nextCurrent),
          reservedStock: fromCents(nextReserved),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id))
        .returning();

      const movement = await insertStockMovement(tx, {
        ...validation.data,
        movementType: "WASTE",
        quantity: toDecimal(validation.data.quantity),
        unitCost: (validation.data.unitCost ?? Number(inventory.averageCost)).toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      await recordStandaloneStockProjectCostTx(tx, {
        movement,
        projectId: validation.data.projectId,
        requestedById: sessionResult.data.user.id,
        quantity: Math.abs(attribution.quantity),
        unitCost: Number(movement.unitCost),
        amount: attribution.amount,
        description: `Waste material proyek: ${validation.data.note}`,
        sourceType: "STOCK_WASTE",
        sign: 1,
      });

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "WASTE_MATERIAL",
        inventoryId: inventory.id,
        originalState: {
          currentStock: inventory.currentStock,
          reservedStock: inventory.reservedStock,
        },
        newState: {
          currentStock: updated.currentStock,
          reservedStock: updated.reservedStock,
          stockMovementId: movement.id,
          note: validation.data.note,
        },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal mencatat waste material.");
  }
}

export async function useMaterialForProject(
  input: UseMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = useMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data pemakaian material tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "use:stock");
    await assertOperationalStockReadiness();
    await assertProjectScopeForMaterialAction(
      validation.data.projectId,
      sessionResult.data.user.id,
      sessionResult.data.roleName,
    );

    const result = await db.transaction(async (tx) => {
      const links = await validateStockMovementLinksTx(tx, validation.data);
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const projectMovements = await tx.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.projectId, validation.data.projectId),
          eq(stockMovement.materialId, validation.data.materialId),
          eq(stockMovement.inventoryLocationId, validation.data.inventoryLocationId),
        ),
        orderBy: [asc(stockMovement.createdAt), asc(stockMovement.id)],
      });
      const matchingMovements = validation.data.projectRapItemId
        ? projectMovements.filter(
            (movement) => movement.projectRapItemId === validation.data.projectRapItemId,
          )
        : projectMovements.filter((movement) => !movement.projectRapItemId);
      const outstandingReservation = calculateOutstandingProjectReservations(matchingMovements);
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const currentStock = parseNumericToCents(inventory.currentStock);
      const reservedStock = parseNumericToCents(inventory.reservedStock);
      const nextCurrent = currentStock - quantity;
      const ownReserved = parseNumericToCents(toDecimal(outstandingReservation));
      const nextReserved = reservedAfterOwnRelease({
        reserved: reservedStock,
        ownReserved,
        quantity,
      });

      ensureNonNegativeStock(nextCurrent, "INSUFFICIENT_CURRENT_STOCK");
      if (
        violatesOtherProjectReservation({
          nextCurrent,
          reserved: reservedStock,
          ownReserved,
          quantity,
        })
      )
        throw new Error("STOCK_RESERVED_FOR_OTHER_PROJECTS");

      const attribution = await stockCostAttributionTx(tx, links, {
        movementType: "USE",
        materialId: validation.data.materialId,
        quantity: validation.data.quantity,
        unitCost: validation.data.unitCost ?? Number(inventory.averageCost),
      });
      const [updated] = await tx
        .update(materialInventory)
        .set({
          currentStock: fromCents(nextCurrent),
          reservedStock: fromCents(nextReserved),
          updatedAt: new Date(),
        })
        .where(eq(materialInventory.id, inventory.id))
        .returning();

      const movement = await insertStockMovement(tx, {
        ...validation.data,
        movementType: "USE",
        quantity: toDecimal(validation.data.quantity),
        unitCost: (validation.data.unitCost ?? Number(inventory.averageCost)).toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      if (attribution.amount !== 0) {
        await recordStandaloneStockProjectCostTx(tx, {
          movement,
          projectId: validation.data.projectId,
          requestedById: sessionResult.data.user.id,
          quantity: Math.abs(attribution.quantity),
          unitCost: Number(movement.unitCost),
          amount: attribution.amount,
          description: `Pemakaian stock existing untuk proyek: ${validation.data.note ?? "material project"}`,
          sourceType: "STOCK_USAGE",
          sign: 1,
        });
      }

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "USE_MATERIAL",
        inventoryId: inventory.id,
        originalState: {
          currentStock: inventory.currentStock,
          reservedStock: inventory.reservedStock,
        },
        newState: {
          currentStock: updated.currentStock,
          reservedStock: updated.reservedStock,
          stockMovementId: movement.id,
        },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal mencatat pemakaian material.");
  }
}

export async function returnMaterialFromProject(
  input: ReturnMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = returnMaterialSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data leftover material tidak valid." },
    };
  }

  const sessionResult = await getSessionUser();
  if (!sessionResult.success) return sessionResult;

  try {
    await assertPermission(sessionResult.data.user, "use:stock");
    await assertOperationalStockReadiness();
    await assertProjectScopeForMaterialAction(
      validation.data.projectId,
      sessionResult.data.user.id,
      sessionResult.data.roleName,
    );

    const result = await db.transaction(async (tx) => {
      const links = await validateStockMovementLinksTx(tx, validation.data);
      const inventory = await findLockedInventory(
        tx,
        validation.data.materialId,
        validation.data.inventoryLocationId,
      );
      const projectMovements = await tx.query.stockMovement.findMany({
        where: and(
          eq(stockMovement.projectId, validation.data.projectId),
          eq(stockMovement.materialId, validation.data.materialId),
          eq(stockMovement.inventoryLocationId, validation.data.inventoryLocationId),
        ),
        orderBy: [asc(stockMovement.createdAt), asc(stockMovement.id)],
      });
      const matchingMovements = validation.data.projectRapItemId
        ? projectMovements.filter(
            (movement) => movement.projectRapItemId === validation.data.projectRapItemId,
          )
        : projectMovements.filter((movement) => !movement.projectRapItemId);
      if (
        exceedsProjectUsage({
          returnQuantity: validation.data.quantity,
          movements: matchingMovements.map((movement) => ({
            movementType: movement.movementType,
            quantity: Number(movement.quantity),
          })),
        })
      ) {
        throw new Error("RETURN_EXCEEDS_PROJECT_USAGE");
      }
      const quantity = parseNumericToCents(toDecimal(validation.data.quantity));
      const nextCurrent = parseNumericToCents(inventory.currentStock) + quantity;

      const attribution = await stockCostAttributionTx(tx, links, {
        movementType: "RETURN",
        materialId: validation.data.materialId,
        quantity: validation.data.quantity,
        unitCost: validation.data.unitCost ?? Number(inventory.averageCost),
      });
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
        movementType: "RETURN",
        quantity: toDecimal(validation.data.quantity),
        unitCost: (validation.data.unitCost ?? Number(inventory.averageCost)).toFixed(2),
        createdById: sessionResult.data.user.id,
      });

      await recordStandaloneStockProjectCostTx(tx, {
        movement,
        projectId: validation.data.projectId,
        requestedById: sessionResult.data.user.id,
        quantity: Math.abs(attribution.quantity),
        unitCost: Number(movement.unitCost),
        amount: attribution.amount,
        description: `Reversal biaya material yang dikembalikan dari proyek: ${validation.data.note ?? "leftover material"}`,
        sourceType: "STOCK_RETURN",
        sign: -1,
      });

      await writeStockMovementAuditTx(tx, {
        userId: sessionResult.data.user.id,
        action: "RETURN_MATERIAL",
        inventoryId: inventory.id,
        originalState: { currentStock: inventory.currentStock },
        newState: { currentStock: updated.currentStock, stockMovementId: movement.id },
      });

      return movement;
    });

    return { success: true, data: result };
  } catch (error) {
    return mapStockError(error, "Gagal mencatat leftover material.");
  }
}
