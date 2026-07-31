"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, materialInventory, stockMovement } from "@/db/schema";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import type { ActionResponse } from "@/lib/types/action-response";
import { emergencyAdjustmentSchema } from "@/lib/validations/warehouse";
import {
  getWarehouseUser as user,
  refreshWarehouse as refresh,
  warehouseFailure as failure,
} from "./warehouse-action-utils";
export async function emergencyAdjustStock(
  input: unknown,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const parsed = emergencyAdjustmentSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Adjustment tidak valid.",
      },
    };
  const actor = await user();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await assertPermission(actor, "adjust:stock");
    const role = await resolveRoleName(actor.roleId ?? "");
    if (role !== "OWNER") throw new Error("FORBIDDEN: Emergency adjustment hanya untuk Owner.");
    const result = await db.transaction(async (tx) => {
      const [inventory] = await tx
        .select()
        .from(materialInventory)
        .where(
          and(
            eq(materialInventory.materialId, parsed.data.materialId),
            eq(materialInventory.locationId, parsed.data.inventoryLocationId),
          ),
        )
        .for("update");
      if (!inventory) throw new Error("Inventory tidak ditemukan.");
      const signed =
        parsed.data.direction === "INCREASE" ? parsed.data.quantity : -parsed.data.quantity;
      const next = Number(inventory.currentStock) + signed;
      if (next < Number(inventory.reservedStock))
        throw new Error("Adjustment membuat stock lebih kecil dari reservation.");
      await tx
        .update(materialInventory)
        .set({ currentStock: next.toFixed(2), updatedAt: new Date() })
        .where(eq(materialInventory.id, inventory.id));
      const [movement] = await tx
        .insert(stockMovement)
        .values({
          materialId: parsed.data.materialId,
          inventoryLocationId: parsed.data.inventoryLocationId,
          movementType: "EMERGENCY_ADJUSTMENT",
          movementDirection: signed > 0 ? "IN" : "OUT",
          quantity: parsed.data.quantity.toFixed(2),
          unitCost: inventory.averageCost,
          note: parsed.data.note,
          createdById: actor.id,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "EMERGENCY_STOCK_ADJUSTMENT",
        targetTable: "material_inventory",
        targetId: inventory.id,
        originalState: JSON.stringify(inventory),
        newState: JSON.stringify({ currentStock: next, movementId: movement.id }),
      });
      return movement;
    });
    refresh();
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Gagal emergency adjustment.");
  }
}
