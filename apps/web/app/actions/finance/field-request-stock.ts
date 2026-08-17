"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, materialInventory, stockMovement } from "@/db/schema";

export type FieldRequestTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StockHandling = "EXPENSE_ONLY" | "STOCK_IN" | "DIRECT_USE" | "RESERVE_FOR_PROJECT";

function toDecimal(value: number): string {
  return value.toFixed(2);
}

async function findOrCreateInventoryForExpense(input: {
  readonly tx: FieldRequestTx;
  readonly materialId: string;
  readonly inventoryLocationId: string;
  readonly unitPrice: number;
}): Promise<typeof materialInventory.$inferSelect> {
  const existing = await input.tx.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.materialId, input.materialId),
      eq(materialInventory.locationId, input.inventoryLocationId),
    ),
  });

  if (existing) return existing;

  const [created] = await input.tx
    .insert(materialInventory)
    .values({
      materialId: input.materialId,
      locationId: input.inventoryLocationId,
      currentStock: "0.00",
      reservedStock: "0.00",
      minimumStock: "0.00",
      averageCost: input.unitPrice.toFixed(2),
      lastPurchasePrice: input.unitPrice.toFixed(2),
    })
    .returning();

  return created;
}

async function writeExpenseStockAudit(input: {
  readonly tx: FieldRequestTx;
  readonly userId: string;
  readonly action: string;
  readonly inventoryId: string;
  readonly originalState: object;
  readonly newState: object;
}): Promise<void> {
  await input.tx.insert(auditLog).values({
    userId: input.userId,
    action: input.action,
    targetTable: "material_inventory",
    targetId: input.inventoryId,
    originalState: JSON.stringify(input.originalState),
    newState: JSON.stringify(input.newState),
    createdAt: new Date(),
  });
}

export async function applyExpenseStockHandling(input: {
  readonly tx: FieldRequestTx;
  readonly stockHandling: StockHandling;
  readonly materialId?: string | null;
  readonly inventoryLocationId?: string | null;
  readonly projectId: string;
  readonly projectRapItemId?: string | null;
  readonly projectCostId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly description: string;
  readonly userId: string;
}): Promise<string | null> {
  if (input.stockHandling === "EXPENSE_ONLY") return null;
  if (!input.materialId) throw new Error("MATERIAL_REQUIRED_FOR_STOCK_HANDLING");
  if (!input.inventoryLocationId) {
    throw new Error("INVENTORY_LOCATION_REQUIRED_FOR_STOCK_HANDLING");
  }

  const inventory = await findOrCreateInventoryForExpense({
    tx: input.tx,
    materialId: input.materialId,
    inventoryLocationId: input.inventoryLocationId,
    unitPrice: input.unitPrice,
  });

  const currentStock = Number(inventory.currentStock);
  const reservedStock = Number(inventory.reservedStock);
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const nextCurrentAfterStockIn = currentStock + quantity;
  const averageCost =
    nextCurrentAfterStockIn > 0
      ? (currentStock * Number(inventory.averageCost) + quantity * unitPrice) /
        nextCurrentAfterStockIn
      : unitPrice;

  const [stockInInventory] = await input.tx
    .update(materialInventory)
    .set({
      currentStock: toDecimal(nextCurrentAfterStockIn),
      averageCost: averageCost.toFixed(2),
      lastPurchasePrice: unitPrice.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, inventory.id))
    .returning();

  const [stockInMovement] = await input.tx
    .insert(stockMovement)
    .values({
      materialId: input.materialId,
      inventoryLocationId: input.inventoryLocationId,
      projectId: input.projectId,
      projectRapItemId: input.projectRapItemId ?? null,
      projectCostId: input.projectCostId,
      movementType: "STOCK_IN",
      quantity: toDecimal(quantity),
      unitCost: unitPrice.toFixed(2),
      note: `Expense stock in: ${input.description}`,
      createdById: input.userId,
    })
    .returning();

  await writeExpenseStockAudit({
    tx: input.tx,
    userId: input.userId,
    action: "EXPENSE_STOCK_IN",
    inventoryId: inventory.id,
    originalState: {
      currentStock: inventory.currentStock,
      averageCost: inventory.averageCost,
    },
    newState: {
      currentStock: stockInInventory.currentStock,
      averageCost: stockInInventory.averageCost,
      stockMovementId: stockInMovement.id,
    },
  });

  if (input.stockHandling === "STOCK_IN") {
    return stockInMovement.id;
  }

  if (input.stockHandling === "RESERVE_FOR_PROJECT") {
    const nextReserved = reservedStock + quantity;
    const [reservedInventory] = await input.tx
      .update(materialInventory)
      .set({
        reservedStock: toDecimal(nextReserved),
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, inventory.id))
      .returning();

    const [reserveMovement] = await input.tx
      .insert(stockMovement)
      .values({
        materialId: input.materialId,
        inventoryLocationId: input.inventoryLocationId,
        projectId: input.projectId,
        projectRapItemId: input.projectRapItemId ?? null,
        projectCostId: input.projectCostId,
        movementType: "RESERVE",
        quantity: toDecimal(quantity),
        unitCost: unitPrice.toFixed(2),
        note: `Expense reserve: ${input.description}`,
        createdById: input.userId,
      })
      .returning();

    await writeExpenseStockAudit({
      tx: input.tx,
      userId: input.userId,
      action: "EXPENSE_RESERVE_MATERIAL",
      inventoryId: inventory.id,
      originalState: { reservedStock: inventory.reservedStock },
      newState: {
        reservedStock: reservedInventory.reservedStock,
        stockMovementId: reserveMovement.id,
      },
    });

    return reserveMovement.id;
  }

  const currentAfterUse = nextCurrentAfterStockIn - quantity;
  const [usedInventory] = await input.tx
    .update(materialInventory)
    .set({
      currentStock: toDecimal(currentAfterUse),
      reservedStock: toDecimal(reservedStock),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, inventory.id))
    .returning();

  const [useMovement] = await input.tx
    .insert(stockMovement)
    .values({
      materialId: input.materialId,
      inventoryLocationId: input.inventoryLocationId,
      projectId: input.projectId,
      projectRapItemId: input.projectRapItemId ?? null,
      projectCostId: input.projectCostId,
      movementType: "USE",
      quantity: toDecimal(quantity),
      unitCost: unitPrice.toFixed(2),
      note: `Expense direct use: ${input.description}`,
      createdById: input.userId,
    })
    .returning();

  await writeExpenseStockAudit({
    tx: input.tx,
    userId: input.userId,
    action: "EXPENSE_DIRECT_USE_MATERIAL",
    inventoryId: inventory.id,
    originalState: {
      currentStock: stockInInventory.currentStock,
      reservedStock: inventory.reservedStock,
    },
    newState: {
      currentStock: usedInventory.currentStock,
      reservedStock: usedInventory.reservedStock,
      stockMovementId: useMovement.id,
    },
  });

  return useMovement.id;
}
