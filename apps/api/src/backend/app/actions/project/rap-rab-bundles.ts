import {
  addRabManualItemTx,
  createRabBundleTx,
  updateRabBundleTx,
  deleteRabBundleTx,
} from "@backend/server/usecases/project/rab-workflow-writer";
import { resolveActor } from "@backend/server/actor";

import { db } from "@backend/db";
import { rabEstimateBundle, rabEstimateItem } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  addRabManualItemSchema,
  createRabBundleSchema,
  deleteRabBundleSchema,
  updateRabBundleSchema,
  type AddRabManualItemInput,
} from "@atria/core/validations/rap-rab";
import { toError } from "./rap-rab-utils";

export async function addRabManualItem(
  input: AddRabManualItemInput,
): Promise<ActionResponse<typeof rabEstimateItem.$inferSelect>> {
  const validation = addRabManualItemSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian RAB tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => addRabManualItemTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function createRabBundle(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimateBundle.$inferSelect>> {
  const validation = createRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian RAB tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => createRabBundleTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function updateRabBundle(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimateBundle.$inferSelect>> {
  const validation = updateRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian RAB tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => updateRabBundleTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function deleteRabBundle(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = deleteRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian RAB tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) => deleteRabBundleTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}
