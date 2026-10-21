import { db } from "@backend/db";
import { stockTransfer } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { createStockTransferTx } from "@backend/server/usecases/material/warehouse-transfer-writer";
import { createStockTransferSchema } from "@atria/core/validations/warehouse";
import type { ActionResponse } from "@atria/core/types/action-response";
import { refreshWarehouse, warehouseFailure } from "./warehouse-action-utils";
export async function createStockTransfer(
  input: unknown,
): Promise<ActionResponse<typeof stockTransfer.$inferSelect>> {
  const parsed = createStockTransferSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Transfer tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => createStockTransferTx(tx, actor, parsed.data));
    refreshWarehouse();
    return { success: true, data: result };
  } catch (error: unknown) {
    return warehouseFailure(error, "Gagal transfer stok.");
  }
}
