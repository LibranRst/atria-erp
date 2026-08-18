"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, inventoryLocation, materialInventory, materialMaster } from "@/db/schema";
import { assertPermission } from "@/lib/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { createInventoryLocationSchema } from "@atria/core/validations/warehouse";
import { getWarehouseUser, refreshWarehouse, warehouseFailure } from "./warehouse-action-utils";

export async function createInventoryLocation(
  input: unknown,
): Promise<ActionResponse<typeof inventoryLocation.$inferSelect>> {
  const parsed = createInventoryLocationSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Location tidak valid.",
      },
    };
  const actor = await getWarehouseUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    await assertPermission(actor, "manage:material_settings");
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(inventoryLocation)
        .values({ name: parsed.data.name, description: parsed.data.description ?? null })
        .returning();
      const materials = await tx.query.materialMaster.findMany({
        where: eq(materialMaster.isActive, true),
        columns: { id: true },
      });
      if (materials.length > 0)
        await tx
          .insert(materialInventory)
          .values(materials.map((material) => ({ materialId: material.id, locationId: row.id })));
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "CREATE_INVENTORY_LOCATION",
        targetTable: "inventory_location",
        targetId: row.id,
        newState: JSON.stringify({ ...row, initializedMaterials: materials.length }),
      });
      return row;
    });
    refreshWarehouse();
    return { success: true, data: created };
  } catch (error) {
    return warehouseFailure(error, "Gagal membuat inventory location.");
  }
}
