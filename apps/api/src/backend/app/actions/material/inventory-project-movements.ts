import { resolveActor } from "@backend/server/actor";
import {
  writeProjectStockRowTx,
  ProjectStockError,
} from "@backend/server/usecases/material/project-stock-writer";
import { db } from "@backend/db";
import { stockMovement } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  type ReturnMaterialInput,
  type UseMaterialInput,
  type WasteMaterialInput,
  type ReserveMaterialInput,
  reserveMaterialSchema,
  returnMaterialSchema,
  useMaterialSchema,
  wasteMaterialSchema,
} from "@atria/core/validations/material";
import { mapStockError } from "./inventory-utils";

export async function wasteMaterialForProject(
  input: WasteMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = wasteMaterialSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data waste tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    return {
      success: true,
      data: await db.transaction((tx) =>
        writeProjectStockRowTx(tx, actor, validation.data.projectId, "WASTE", validation.data),
      ),
    };
  } catch (error: unknown) {
    if (error instanceof ProjectStockError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Waste material belum tersimpan.");
  }
}

export async function releaseMaterialReservation(
  input: ReserveMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = reserveMaterialSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data pelepasan reservasi tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    return {
      success: true,
      data: await db.transaction((tx) =>
        writeProjectStockRowTx(
          tx,
          actor,
          validation.data.projectId,
          "RELEASE_RESERVATION",
          validation.data,
        ),
      ),
    };
  } catch (error: unknown) {
    if (error instanceof ProjectStockError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Reservasi belum dilepas.");
  }
}

export async function useMaterialForProject(
  input: UseMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = useMaterialSchema.safeParse(input);
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
      writeProjectStockRowTx(tx, actor, validation.data.projectId, "USE", validation.data),
    );
    return { success: true, data: movement };
  } catch (error: unknown) {
    if (error instanceof ProjectStockError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Pergerakan stok belum tersimpan.");
  }
}

export async function returnMaterialFromProject(
  input: ReturnMaterialInput,
): Promise<ActionResponse<typeof stockMovement.$inferSelect>> {
  const validation = returnMaterialSchema.safeParse(input);
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
      writeProjectStockRowTx(tx, actor, validation.data.projectId, "RETURN", validation.data),
    );
    return { success: true, data: movement };
  } catch (error: unknown) {
    if (error instanceof ProjectStockError)
      return { success: false, error: { code: error.code, message: error.message } };
    return mapStockError(error, "Pergerakan stok belum tersimpan.");
  }
}
