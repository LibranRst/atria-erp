import { createInventoryLocationTx } from "@backend/server/usecases/material/reference-writer";
import { db } from "@backend/db";
import { inventoryLocation } from "@backend/db/schema";
import { assertPermission } from "@backend/lib/auth/permissions";
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
    const created = await db.transaction(async (tx) =>
      createInventoryLocationTx(tx, actor.id, parsed.data),
    );
    refreshWarehouse();
    return { success: true, data: created };
  } catch (error) {
    return warehouseFailure(error, "Gagal membuat inventory location.");
  }
}
