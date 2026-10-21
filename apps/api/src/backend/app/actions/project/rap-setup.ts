import { changePackageStatusTx } from "@backend/server/usecases/project/category-plan-writer";
import { cookies } from "@runtime/request-context";
import { resolveActor } from "@backend/server/actor";
import { applyRapSetupStepTx } from "@backend/server/usecases/project/rap-setup-writer";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { projectCategoryPlanItem, projectRap } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  advanceProjectRapSetupSchema,
  finalizeProjectInternalPlanSchema,
  markProjectCategoryPlanItemDraftSchema,
  setProjectRapScopeSkippedSchema,
} from "@atria/core/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
type Rap = typeof projectRap.$inferSelect;
type Package = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

function failure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN") || message.includes("Akses"))
    return { success: false, error: { code: "FORBIDDEN", message } };
  if (message.includes("NOT_FOUND"))
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

async function assertScoped(
  user: SessionUser,
  projectId: string,
  permission: "update:rap" | "update:budget" | "lock:rap",
): Promise<string> {
  await assertPermission(user, permission);
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
  return roleName;
}

export async function advanceProjectRapSetup(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = advanceProjectRapSetupSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Tahap RAP tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) =>
      applyRapSetupStepTx(tx, actor, parsed.data.projectRapId, {
        action: "ADVANCE",
        targetStage: parsed.data.targetStage,
      }),
    );
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return failure(error, "Gagal melanjutkan tahap RAP.");
  }
}
export async function setProjectRapScopeSkipped(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = setProjectRapScopeSkippedSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keputusan scope tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) =>
      applyRapSetupStepTx(tx, actor, parsed.data.projectRapId, {
        action: "SET_SCOPE",
        category: parsed.data.categoryCode,
        skipped: parsed.data.skipped,
      }),
    );
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return failure(error, "Gagal memperbarui scope RAP.");
  }
}

export async function markProjectCategoryPlanItemDraft(
  input: unknown,
): Promise<ActionResponse<Package>> {
  const parsed = markProjectCategoryPlanItemDraftSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Package tidak valid." } };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const item = await db.query.projectCategoryPlanItem.findFirst({
      where: eq(projectCategoryPlanItem.id, parsed.data.projectCategoryPlanItemId),
    });
    if (!item) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
    if (item.status !== "ACTIVE") throw new Error("Hanya package Siap yang dapat diedit lagi.");
    await assertScoped(user, item.projectId, "update:budget");
    const actor = await resolveActor();
    if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
    const updated = await db.transaction((tx) =>
      changePackageStatusTx(tx, actor, item.id, "DRAFT"),
    );
    revalidatePath(`/projects/${item.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    return failure(error, "Gagal membuka package untuk diedit.");
  }
}

export async function finalizeProjectInternalPlan(input: unknown): Promise<ActionResponse<Rap>> {
  const parsed = finalizeProjectInternalPlanSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: { code: "VALIDATION_ERROR", message: "RAP tidak valid." } };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) =>
      applyRapSetupStepTx(tx, actor, parsed.data.projectRapId, { action: "FINALIZE" }),
    );
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return failure(error, "Gagal finalisasi RAP.");
  }
}
