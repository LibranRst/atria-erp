import { and, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  auditLog,
  materialInventory,
  stockMovement,
  stockTransfer,
  stockTransferItem,
} from "@backend/db/schema";
import { assertPermission } from "@backend/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { calculateTransferDestinationAverage } from "@atria/core/material/stock-valuation";
import { assertOperationalStockReadiness } from "@backend/lib/material/operational-readiness";
import { createStockTransferSchema } from "@atria/core/validations/warehouse";
import {
  getWarehouseUser as user,
  refreshWarehouse as refresh,
  warehouseFailure as failure,
} from "./warehouse-action-utils";

type Transfer = typeof stockTransfer.$inferSelect;
export async function createStockTransfer(input: unknown): Promise<ActionResponse<Transfer>> {
  const parsed = createStockTransferSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Transfer tidak valid.",
      },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "transfer:stock");
    await assertOperationalStockReadiness();
    const result = await db.transaction(async (tx) => {
      const duplicate = await tx.query.stockTransfer.findFirst({
        where: eq(stockTransfer.transferNumber, parsed.data.transferNumber),
      });
      if (duplicate) throw new Error("Nomor transfer sudah dipakai.");
      const [header] = await tx
        .insert(stockTransfer)
        .values({
          transferNumber: parsed.data.transferNumber,
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          transferredAt: parsed.data.transferredAt,
          note: parsed.data.note,
          createdById: actor.id,
        })
        .returning();
      for (const item of [...parsed.data.items].sort((a, b) =>
        a.materialId.localeCompare(b.materialId),
      )) {
        const rows = await tx
          .select()
          .from(materialInventory)
          .where(
            and(
              eq(materialInventory.materialId, item.materialId),
              inArray(materialInventory.locationId, [
                parsed.data.fromLocationId,
                parsed.data.toLocationId,
              ]),
            ),
          )
          .for("update");
        const source = rows.find((row) => row.locationId === parsed.data.fromLocationId);
        const destination = rows.find((row) => row.locationId === parsed.data.toLocationId);
        if (!source || !destination)
          throw new Error("Inventory source/destination material belum tersedia.");
        if (Number(source.currentStock) - item.quantity < Number(source.reservedStock))
          throw new Error("Transfer akan memakai stock yang sudah di-reserve.");
        const unitCost = Number(source.averageCost);
        const destinationQty = Number(destination.currentStock) + item.quantity;
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
            note: parsed.data.note,
            createdById: actor.id,
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
            note: parsed.data.note,
            createdById: actor.id,
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
        userId: actor.id,
        action: "POST_STOCK_TRANSFER",
        targetTable: "stock_transfer",
        targetId: header.id,
        newState: JSON.stringify({ ...header, items: parsed.data.items }),
      });
      return header;
    });
    refresh();
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal transfer stock.");
  }
}
