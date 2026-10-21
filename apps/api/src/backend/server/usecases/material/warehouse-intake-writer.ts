import { and, eq } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  auditLog,
  inventoryLocation,
  materialMaster,
  materialInventory,
  stockMovement,
  project,
  warehouseIntake,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { validateStockMovementLinksTx } from "@backend/lib/material/stock-movement-links";
import type { FinanceTransaction } from "../finance/mutation-access";
import { recordStockInSchema, type RecordStockInInput } from "@atria/core/validations/material";
import {
  warehouseIntakeInputSchema,
  stockQuantitySchema,
  invoiceMoneySchema,
  type WarehouseIntakeInput,
} from "@atria/core/ai/procurement-warehouse";
import { calculateTransferDestinationAverage } from "@atria/core/material/stock-valuation";

export class WarehouseIntakeError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}

export async function assertIntakeInventoryTx(
  tx: FinanceTransaction,
  actor: Actor,
  materialId: string,
  locationId: string,
): Promise<typeof materialInventory.$inferSelect> {
  if (!actor.isActive || !actorCan(actor, "create:stock_movement"))
    throw new WarehouseIntakeError("FORBIDDEN", "Izin menerima material tidak tersedia.");
  const location = await tx.query.inventoryLocation.findFirst({
    where: and(
      eq(inventoryLocation.id, locationId),
      eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
      eq(inventoryLocation.isActive, true),
    ),
  });
  const [material] = await tx
    .select()
    .from(materialMaster)
    .where(
      and(
        eq(materialMaster.id, materialId),
        eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        eq(materialMaster.isActive, true),
      ),
    )
    .for("update");
  if (!material || !location)
    throw new WarehouseIntakeError("NOT_FOUND", "Material atau lokasi aktif tidak tersedia.");
  const [inventory] = await tx
    .select()
    .from(materialInventory)
    .where(
      and(
        eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        eq(materialInventory.materialId, materialId),
        eq(materialInventory.locationId, locationId),
      ),
    )
    .for("update");
  if (!inventory) {
    const [created] = await tx
      .insert(materialInventory)
      .values({ materialId, locationId })
      .onConflictDoNothing()
      .returning();
    if (!created)
      throw new WarehouseIntakeError(
        "CONFLICT",
        "Inventory lokasi ini baru dibuat oleh proses lain. Minta preview terbaru.",
      );
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "CREATE_RECEIVING_INVENTORY",
      targetTable: "material_inventory",
      targetId: created.id,
      newState: JSON.stringify(created),
    });
    return created;
  }
  return inventory;
}

export async function recordStockInTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: RecordStockInInput,
  referenceId?: string,
): Promise<typeof stockMovement.$inferSelect> {
  const input = recordStockInSchema.parse(raw);
  stockQuantitySchema.positive().parse(input.quantity);
  invoiceMoneySchema.parse(input.unitCost ?? 0);
  await assertOperationalStockReadiness(tx);
  if (input.projectId) {
    const [p] = await tx
      .select()
      .from(project)
      .where(
        and(
          eq(project.id, input.projectId),
          eq(project.tenantId, INSTANCE_TENANT_ID),
          actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
        ),
      )
      .for("update");
    if (!p) throw new WarehouseIntakeError("FORBIDDEN", "Proyek di luar akses Anda.");
    assertProjectStatusIsOperational(p.status);
  }
  await validateStockMovementLinksTx(tx, input);
  const inventory = await assertIntakeInventoryTx(
    tx,
    actor,
    input.materialId,
    input.inventoryLocationId,
  );
  const nextQuantity = stockQuantitySchema.parse(
    Number((Number(inventory.currentStock) + input.quantity).toFixed(2)),
  );
  const unitCost = input.unitCost ?? 0;
  const nextAverage = calculateTransferDestinationAverage({
    destinationQuantity: Number(inventory.currentStock),
    destinationAverageCost: Number(inventory.averageCost),
    transferQuantity: input.quantity,
    sourceAverageCost: unitCost,
  });
  const [updated] = await tx
    .update(materialInventory)
    .set({
      currentStock: nextQuantity.toFixed(2),
      averageCost: nextAverage.toFixed(2),
      lastPurchasePrice: unitCost.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(materialInventory.id, inventory.id))
    .returning();
  const [movement] = await tx
    .insert(stockMovement)
    .values({
      materialId: input.materialId,
      inventoryLocationId: input.inventoryLocationId,
      projectId: input.projectId ?? null,
      projectRapItemId: input.projectRapItemId ?? null,
      projectCostId: input.projectCostId ?? null,
      vendorBillId: input.vendorBillId ?? null,
      movementType: "STOCK_IN",
      movementDirection: "IN",
      referenceType: referenceId ? "WAREHOUSE_INTAKE" : null,
      referenceId: referenceId ?? null,
      quantity: input.quantity.toFixed(2),
      unitCost: unitCost.toFixed(2),
      note: input.note,
      createdById: actor.userId,
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "RECORD_STOCK_IN",
    targetTable: "material_inventory",
    targetId: inventory.id,
    originalState: JSON.stringify(inventory),
    newState: JSON.stringify({ ...updated, stockMovementId: movement.id }),
  });
  return movement;
}

export async function createWarehouseIntakeTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: Extract<WarehouseIntakeInput, { action: "WAREHOUSE_STOCK_IN" }>,
): Promise<typeof warehouseIntake.$inferSelect> {
  const input = warehouseIntakeInputSchema.parse(raw);
  if (input.action !== "WAREHOUSE_STOCK_IN")
    throw new WarehouseIntakeError("VALIDATION_ERROR", "Tindakan stok masuk tidak valid.");
  if (!actor.isActive || !actorCan(actor, "create:stock_movement"))
    throw new WarehouseIntakeError("FORBIDDEN", "Izin menerima material tidak tersedia.");
  await assertOperationalStockReadiness(tx);
  const [document] = await tx
    .insert(warehouseIntake)
    .values({
      inventoryLocationId: input.inventoryLocationId,
      referenceNumber: input.referenceNumber,
      receivedAt: new Date(input.receivedAt + "T00:00:00Z"),
      note: input.note,
      receivedById: actor.userId,
    })
    .returning();
  for (const item of input.items.toSorted((a, b) => a.materialId.localeCompare(b.materialId))) {
    await recordStockInTx(
      tx,
      actor,
      { ...item, inventoryLocationId: input.inventoryLocationId, note: input.note },
      document.id,
    );
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "POST_WAREHOUSE_INTAKE",
    targetTable: "warehouse_intake",
    targetId: document.id,
    newState: JSON.stringify({ ...document, items: input.items }),
  });
  return document;
}
