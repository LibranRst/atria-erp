import { resolveActor } from "@backend/server/actor";
import {
  createPackageTx,
  updatePackageTx,
  changePackageStatusTx,
  deletePackageTx,
} from "@backend/server/usecases/project/category-plan-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import { cookies } from "@runtime/request-context";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { projectCategoryPlanItem } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createProjectCategoryPlanItemSchema,
  deleteProjectCategoryPlanItemSchema,
  markProjectCategoryPlanItemActiveSchema,
  updateProjectCategoryPlanItemSchema,
  type CreateProjectCategoryPlanItemInput,
  type UpdateProjectCategoryPlanItemInput,
} from "@atria/core/validations/category-plan";

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
};

type CategoryPlanItem = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });
  return session?.user ? (session.user as SessionUser) : null;
}

function toError<T>(error: unknown, fallbackMessage: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND")) {
    return { success: false, error: { code: "NOT_FOUND", message: fallbackMessage } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

export async function createProjectCategoryPlanItem(
  input: CreateProjectCategoryPlanItemInput,
): Promise<ActionResponse<CategoryPlanItem>> {
  const parsed = createProjectCategoryPlanItemSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data paket tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction((tx) => createPackageTx(tx, actor, parsed.data));
    revalidateWorkspacePath(`/projects/${row.projectId}`);
    return { success: true, data: row };
  } catch (error: unknown) {
    return toError(error, "Gagal membuat paket.");
  }
}
export async function updateProjectCategoryPlanItem(
  input: UpdateProjectCategoryPlanItemInput,
): Promise<ActionResponse<CategoryPlanItem>> {
  const parsed = updateProjectCategoryPlanItemSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data paket tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction((tx) => updatePackageTx(tx, actor, parsed.data));
    revalidateWorkspacePath(`/projects/${row.projectId}`);
    return { success: true, data: row };
  } catch (error: unknown) {
    return toError(error, "Gagal memperbarui paket.");
  }
}
export async function markProjectCategoryPlanItemActive(
  projectCategoryPlanItemId: string,
): Promise<ActionResponse<CategoryPlanItem>> {
  const parsed = markProjectCategoryPlanItemActiveSchema.safeParse({ projectCategoryPlanItemId });
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Paket tidak valid." } };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const row = await db.transaction((tx) =>
      changePackageStatusTx(tx, actor, parsed.data.projectCategoryPlanItemId, "ACTIVE"),
    );
    revalidateWorkspacePath(`/projects/${row.projectId}`);
    return { success: true, data: row };
  } catch (error: unknown) {
    return toError(error, "Gagal menyiapkan paket.");
  }
}
export async function deleteProjectCategoryPlanItem(
  projectCategoryPlanItemId: string,
): Promise<ActionResponse<{ readonly deletedId: string }>> {
  const parsed = deleteProjectCategoryPlanItemSchema.safeParse({ projectCategoryPlanItemId });
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Paket tidak valid." } };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    await db.transaction((tx) => deletePackageTx(tx, actor, parsed.data.projectCategoryPlanItemId));
    return { success: true, data: { deletedId: parsed.data.projectCategoryPlanItemId } };
  } catch (error: unknown) {
    return toError(error, "Gagal menghapus paket.");
  }
}
export async function getProjectCategoryPlanItems(
  projectId: string,
): Promise<ActionResponse<CategoryPlanItem[]>> {
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    await assertPermission(user, "view:budget");
    const roleName = await resolveRoleName(user.roleId ?? "");
    await assertProjectAccess(projectId, user.id, roleName);

    const items = await db.query.projectCategoryPlanItem.findMany({
      where: eq(projectCategoryPlanItem.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.displayOrder), asc(table.createdAt)],
    });
    return { success: true, data: items };
  } catch (error) {
    return toError(error, "Gagal mengambil detail plan kategori.");
  }
}
