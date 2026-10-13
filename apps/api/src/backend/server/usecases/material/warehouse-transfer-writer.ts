import { and, asc, eq, inArray } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  inventoryLocation,
  materialMaster,
  auditLog,
  materialInventory,
  stockMovement,
  stockTransfer,
  stockTransferItem,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import type { CreateStockTransferInput } from "@atria/core/validations/warehouse";
import { calculateTransferDestinationAverage } from "@atria/core/material/stock-valuation";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { createStockTransferSchema } from "@atria/core/validations/warehouse";

type Transfer = typeof stockTransfer.$inferSelect;
export async function createStockTransferTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: CreateStockTransferInput,
): Promise<Transfer> {
  if (!actorCan(actor, "transfer:stock"))
    throw new Error("FORBIDDEN: Tidak memiliki izin transfer stok.");
  const input = createStockTransferSchema.parse(raw);
  await assertOperationalStockReadiness(tx);
  await tx
    .select()
    .from(materialMaster)
    .where(
      and(
        eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        inArray(
          materialMaster.id,
          input.items.map((i) => i.materialId),
        ),
      ),
    )
    .orderBy(asc(materialMaster.id))
    .for("update");
  const locations = await tx
    .select()
    .from(inventoryLocation)
    .where(
      and(
        eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
        inArray(inventoryLocation.id, [input.fromLocationId, input.toLocationId]),
      ),
    )
    .orderBy(asc(inventoryLocation.id))
    .for("update");
  if (locations.length !== 2 || locations.some((r) => !r.isActive))
    throw new Error("Lokasi tidak tersedia.");
  const materials = await tx.query.materialMaster.findMany({
    where: and(
      eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
      inArray(
        materialMaster.id,
        input.items.map((i) => i.materialId),
      ),
    ),
  });
  if (materials.length !== input.items.length || materials.some((m) => !m.isActive))
    throw new Error("Material tidak tersedia.");

  const duplicate = await tx.query.stockTransfer.findFirst({
    where: and(
      eq(stockTransfer.transferNumber, input.transferNumber),
      eq(stockTransfer.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (duplicate) throw new Error("Nomor transfer sudah dipakai.");
  const [header] = await tx
    .insert(stockTransfer)
    .values({
      transferNumber: input.transferNumber,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      transferredAt: input.transferredAt,
      note: input.note,
      createdById: actor.userId,
    })
    .returning();
  for (const item of [...input.items].sort((a, b) => a.materialId.localeCompare(b.materialId))) {
    const rows = await tx
      .select()
      .from(materialInventory)
      .where(
        and(
          eq(materialInventory.materialId, item.materialId),
          inArray(materialInventory.locationId, [input.fromLocationId, input.toLocationId]),
        ),
      )
      .orderBy(asc(materialInventory.id))
      .for("update");
    const source = rows.find((row) => row.locationId === input.fromLocationId);
    const destination = rows.find((row) => row.locationId === input.toLocationId);
    if (
      !source ||
      !destination ||
      source.tenantId !== INSTANCE_TENANT_ID ||
      destination.tenantId !== INSTANCE_TENANT_ID
    )
      throw new Error("Inventory source/destination material belum tersedia.");
    if (Number(source.currentStock) - item.quantity < Number(source.reservedStock))
      throw new Error("Transfer akan memakai stock yang sudah di-reserve.");
    const unitCost = Number(source.averageCost);
    const destinationQty = Number(destination.currentStock) + item.quantity;
    if (destinationQty > 9_999_999_999.99) throw new Error("Stok tujuan melewati batas.");
    const destinationAverage = calculateTransferDestinationAverage({
      destinationQuantity: Number(destination.currentStock),
      destinationAverageCost: Number(destination.averageCost),
      transferQuantity: item.quantity,
      sourceAverageCost: unitCost,
    });
    await tx
      .update(materialInventory)
      .set({
        currentStock: (Number(source.currentStock) - item.quantity).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, source.id));
    await tx
      .update(materialInventory)
      .set({
        currentStock: destinationQty.toFixed(2),
        averageCost: destinationAverage.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(materialInventory.id, destination.id));
    const [out] = await tx
      .insert(stockMovement)
      .values({
        materialId: item.materialId,
        inventoryLocationId: source.locationId,
        movementType: "TRANSFER_OUT",
        movementDirection: "OUT",
        referenceType: "STOCK_TRANSFER",
        referenceId: header.id,
        quantity: item.quantity.toFixed(2),
        unitCost: unitCost.toFixed(2),
        note: input.note,
        createdById: actor.userId,
      })
      .returning();
    const [inside] = await tx
      .insert(stockMovement)
      .values({
        materialId: item.materialId,
        inventoryLocationId: destination.locationId,
        movementType: "TRANSFER_IN",
        movementDirection: "IN",
        referenceType: "STOCK_TRANSFER",
        referenceId: header.id,
        quantity: item.quantity.toFixed(2),
        unitCost: unitCost.toFixed(2),
        note: input.note,
        createdById: actor.userId,
      })
      .returning();
    await tx.insert(stockTransferItem).values({
      stockTransferId: header.id,
      materialId: item.materialId,
      quantity: item.quantity.toFixed(2),
      unitCost: unitCost.toFixed(2),
      outMovementId: out.id,
      inMovementId: inside.id,
    });
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "POST_STOCK_TRANSFER",
    targetTable: "stock_transfer",
    targetId: header.id,
    newState: JSON.stringify({ ...header, items: input.items }),
  });
  return header;
}
