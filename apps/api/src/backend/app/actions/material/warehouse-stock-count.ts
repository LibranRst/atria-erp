import { db } from "@backend/db";
import { stockCount } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import { refreshWarehouse, warehouseFailure } from "./warehouse-action-utils";
import {
  saveStockCountTx,
  submitStockCountTx,
  approveStockCountTx,
  rejectStockCountTx,
} from "@backend/server/usecases/material/warehouse-count-writer";
export async function saveStockCount(
  input: unknown,
): Promise<ActionResponse<typeof stockCount.$inferSelect>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => saveStockCountTx(tx, actor, input));
    refreshWarehouse();
    return { success: true, data: result };
  } catch (error: unknown) {
    return warehouseFailure(error, "Stock opname belum tersimpan.");
  }
}
export async function submitStockCount(
  input: unknown,
): Promise<ActionResponse<typeof stockCount.$inferSelect>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => submitStockCountTx(tx, actor, input));
    refreshWarehouse();
    return { success: true, data: result };
  } catch (error: unknown) {
    return warehouseFailure(error, "Stock opname belum tersimpan.");
  }
}
export async function approveStockCount(
  input: unknown,
): Promise<ActionResponse<typeof stockCount.$inferSelect>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => approveStockCountTx(tx, actor, input));
    refreshWarehouse();
    return { success: true, data: result };
  } catch (error: unknown) {
    return warehouseFailure(error, "Stock opname belum tersimpan.");
  }
}
export async function rejectStockCount(
  input: unknown,
): Promise<ActionResponse<typeof stockCount.$inferSelect>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => rejectStockCountTx(tx, actor, input));
    refreshWarehouse();
    return { success: true, data: result };
  } catch (error: unknown) {
    return warehouseFailure(error, "Stock opname belum tersimpan.");
  }
}
