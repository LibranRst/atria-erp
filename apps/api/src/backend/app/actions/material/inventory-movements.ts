import {
  writeStockCorrectionTx,
  StockCorrectionError,
} from "@backend/server/usecases/material/stock-correction-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import { recordStockInTx } from "@backend/server/usecases/material/warehouse-intake-writer";
import { resolveActor } from "@backend/server/actor";
import {
  writeProjectStockRowTx,
  ProjectStockError,
} from "@backend/server/usecases/material/project-stock-writer";

import { db } from "@backend/db";
import { stockMovement } from "@backend/db/schema";
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
import { mapStockError } from "./inventory-utils";
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

  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => recordStockInTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return mapStockError(error, "Gagal mencatat stok masuk.");
  }
}

export async function reserveMaterialForProject(
  input: ReserveMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = reserveMaterialSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data pergerakan stok tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const movement = await db.transaction((tx) =>
      writeProjectStockRowTx(tx, actor, validation.data.projectId, "RESERVE", validation.data),
    );
    return { success: true, data: movement };
  } catch (error: unknown) {
    if (error instanceof ProjectStockError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Pergerakan stok belum tersimpan.");
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
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data koreksi stok tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const data = validation.data;
    const movements = await db.transaction((tx) =>
      writeStockCorrectionTx(tx, actor, {
        action: "STOCK_CORRECT",
        inventoryLocationId: data.inventoryLocationId,
        projectId: data.projectId ?? null,
        reason: data.note,
        items: [
          {
            materialId: data.materialId,
            direction: data.direction,
            quantity: data.quantity,
            unitCost: data.unitCost,
            projectRapItemId: data.projectRapItemId,
            projectCostId: data.projectCostId,
            vendorBillId: data.vendorBillId,
          },
        ],
      }),
    );
    revalidateWorkspacePath("/materials");
    if (data.projectId) revalidateWorkspacePath(`/projects/${data.projectId}`);
    return { success: true, data: movements[0] };
  } catch (error: unknown) {
    if (error instanceof StockCorrectionError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Koreksi stok belum dapat disimpan. Periksa lagi.");
  }
}
