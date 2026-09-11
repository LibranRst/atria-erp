"use server";
import { recordNotificationEvent } from "@/server/services/notification-events";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  project,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
} from "@/db/schema";
import { assertRapCategoryReady } from "@atria/core/project/rap-setup";
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
import {
  assertProjectMutationAccess,
  buildRapItemValues,
  getSessionUser,
  toError,
} from "./rap-rab-utils";

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
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const proj = await db.query.project.findFirst({
      where: eq(project.id, validation.data.projectId),
    });
    if (!proj) throw new Error("PROJECT_NOT_FOUND");
    await assertProjectMutationAccess(user, validation.data.projectId, "create:rap");
    const existingDraft = await db.query.projectRap.findFirst({
      where: eq(projectRap.projectId, validation.data.projectId),
    });
    if (existingDraft) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "RAP proyek sudah tersedia." },
      };
    }
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(projectRap)
        .values({
          projectId: validation.data.projectId,
          status: "DRAFT",
          revision: 1,
          notes: validation.data.notes ?? null,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "CREATE_RAP_DRAFT",
        targetTable: "project_rap",
        targetId: row.id,
        newState: JSON.stringify(row),
      });
      return row;
    });
    return { success: true, data: created };
  } catch (error) {
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
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const rap = await db.query.projectRap.findFirst({
      where: eq(projectRap.id, validation.data.projectRapId),
    });
    if (!rap) throw new Error("RAP_NOT_FOUND");
    if (rap.status !== "DRAFT") throw new Error("RAP_NOT_DRAFT");
    await assertProjectMutationAccess(user, rap.projectId, "update:rap");
    const values = await buildRapItemValues(validation.data);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(projectRapItem)
        .values({ projectRapId: rap.id, ...values })
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "CREATE_RAP_ITEM_DRAFT",
        targetTable: "project_rap_item",
        targetId: row.id,
        newState: JSON.stringify(row),
      });
      return row;
    });
    return { success: true, data: created };
  } catch (error) {
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
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const item = await db.query.projectRapItem.findFirst({
      where: eq(projectRapItem.id, validation.data.projectRapItemId),
      with: { rap: true },
    });
    if (!item) throw new Error("RAP_ITEM_NOT_FOUND");
    if (item.rap.status !== "DRAFT") throw new Error("RAP_NOT_DRAFT");
    await assertProjectMutationAccess(user, item.rap.projectId, "update:rap");
    const values = await buildRapItemValues(validation.data);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(projectRapItem)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(projectRapItem.id, item.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "UPDATE_RAP_ITEM_DRAFT",
        targetTable: "project_rap_item",
        targetId: item.id,
        originalState: JSON.stringify(item),
        newState: JSON.stringify(row),
      });
      return row;
    });
    return { success: true, data: updated };
  } catch (error) {
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
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const item = await db.query.projectRapItem.findFirst({
      where: eq(projectRapItem.id, validation.data.projectRapItemId),
      with: { rap: true },
    });
    if (!item) throw new Error("RAP_ITEM_NOT_FOUND");
    if (item.rap.status !== "DRAFT") throw new Error("RAP_NOT_DRAFT");
    await assertProjectMutationAccess(user, item.rap.projectId, "update:rap");
    await db.transaction(async (tx) => {
      await tx.delete(projectRapItem).where(eq(projectRapItem.id, item.id));
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "DELETE_RAP_ITEM_DRAFT",
        targetTable: "project_rap_item",
        targetId: item.id,
        originalState: JSON.stringify(item),
      });
    });
    return { success: true, data: { deletedId: item.id } };
  } catch (error) {
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
    const result = await db.transaction(async (tx) => {
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
        with: { items: true },
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      if (rap.status !== "DRAFT") throw new Error("RAP_NOT_DRAFT");
      if (rap.items.length === 0) throw new Error("RAP_EMPTY");
      if (rap.setupStage !== "REVIEW") {
        throw new Error(
          "Selesaikan tahap Material, Tukang, Subcon, dan Review sebelum finalisasi.",
        );
      }
      await assertProjectMutationAccess(user, rap.projectId, "lock:rap");
      const packages = await tx.query.projectCategoryPlanItem.findMany({
        where: eq(projectCategoryPlanItem.projectId, rap.projectId),
        with: { expenseCategory: true },
      });
      const setupRows = packages.map((row) => ({
        categoryCode: row.expenseCategory.code,
        status: row.status,
      }));
      assertRapCategoryReady(setupRows, "TUKANG", rap.tukangScopeSkipped);
      assertRapCategoryReady(setupRows, "SUBCON", rap.subconScopeSkipped);
      const [updated] = await tx
        .update(projectRap)
        .set({
          status: "LOCKED",
          setupStage: "COMPLETE",
          setupUpdatedById: user.id,
          lockedById: user.id,
          lockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectRap.id, rap.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "FINALIZE_PROJECT_INTERNAL_PLAN",
        targetTable: "project_rap",
        targetId: rap.id,
        originalState: JSON.stringify(rap),
        newState: JSON.stringify(updated),
      });
      await recordNotificationEvent(tx, {
        referenceType: "rap",
        referenceId: updated.id,
        projectId: updated.projectId,
        stage: "LOCKED",
        title: "Rencana pelaksanaan dikunci",
        message: "Rencana internal proyek siap digunakan.",
        permission: "view:rap",
        actionUrl: `/projects/${updated.projectId}?tab=materials`,
        actorId: user.id,
      });
      return updated;
    });
    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal mengunci RAP.");
  }
}
