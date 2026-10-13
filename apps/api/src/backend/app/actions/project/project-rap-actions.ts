import { applyRapSetupStepTx } from "@backend/server/usecases/project/rap-setup-writer";
import { resolveActor } from "@backend/server/actor";
import {
  createProjectRapTx,
  addProjectRapItemsTx,
  updateProjectRapItemTx,
  deleteProjectRapItemTx,
} from "@backend/server/usecases/material/rap-writer";

import { db } from "@backend/db";
import { projectRap, projectRapItem } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  addProjectRapItemSchema,
  createProjectRapSchema,
  deleteProjectRapItemSchema,
  lockProjectRapSchema,
  updateProjectRapItemSchema,
  type AddProjectRapItemInput,
  type CreateProjectRapInput,
  type UpdateProjectRapItemInput,
} from "@atria/core/validations/rap-rab";
import { getSessionUser, toError } from "./rap-rab-utils";

export async function createProjectRap(
  input: CreateProjectRapInput,
): Promise<ActionResponse<typeof projectRap.$inferSelect>> {
  const validation = createProjectRapSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data RAP tidak valid." },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) =>
      createProjectRapTx(tx, actor, validation.data),
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Gagal membuat RAP proyek.");
  }
}

export async function addProjectRapItem(
  input: AddProjectRapItemInput,
): Promise<ActionResponse<typeof projectRapItem.$inferSelect>> {
  const validation = addProjectRapItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data item RAP tidak valid." },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(
      async (tx) =>
        (await addProjectRapItemsTx(tx, actor, validation.data.projectRapId, [validation.data]))[0],
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Gagal menambahkan item RAP.");
  }
}

export async function updateProjectRapItem(
  input: UpdateProjectRapItemInput,
): Promise<ActionResponse<typeof projectRapItem.$inferSelect>> {
  const validation = updateProjectRapItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data item RAP tidak valid." },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) =>
      updateProjectRapItemTx(tx, actor, validation.data),
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Gagal mengubah item RAP.");
  }
}

export async function deleteProjectRapItem(
  projectRapItemId: string,
): Promise<ActionResponse<{ readonly deletedId: string }>> {
  const validation = deleteProjectRapItemSchema.safeParse({ projectRapItemId });
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID item RAP tidak valid." },
    };
  }
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) =>
      deleteProjectRapItemTx(tx, actor, validation.data.projectRapItemId),
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Gagal menghapus item RAP.");
  }
}

export async function lockProjectRap(
  projectRapId: string,
): Promise<ActionResponse<typeof projectRap.$inferSelect>> {
  const validation = lockProjectRapSchema.safeParse({ projectRapId });
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "ID RAP tidak valid." } };
  }
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const actor = await resolveActor();
    if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
    const result = await db.transaction((tx) =>
      applyRapSetupStepTx(tx, actor, validation.data.projectRapId, { action: "FINALIZE" }),
    );
    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal mengunci RAP.");
  }
}
