import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
} from "@backend/server/usecases/project/project-management-writer";
import { copyRapTemplateTx } from "@backend/server/usecases/material/rap-template-writer";
import { copyPackageTemplateTx } from "@backend/server/usecases/project/category-plan-writer";
import { resolveActor } from "@backend/server/actor";

import { cookies } from "@runtime/request-context";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRapItem,
  projectRap,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  copyTemplateToCategoryPlanSchema,
  copyTemplateToRapSchema,
  reallocateProjectBudgetSchema,
} from "@atria/core/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };
type RapItem = typeof projectRapItem.$inferSelect;
type CategoryPlanItem = typeof projectCategoryPlanItem.$inferSelect;

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  return session?.user ? (session.user as SessionUser) : null;
}

function toFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND"))
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

export async function copyPricingTemplateToRap(input: unknown): Promise<ActionResponse<RapItem>> {
  const validation = copyTemplateToRapSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Template RAP tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const actor = await resolveActor();
      if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
      const created = await copyRapTemplateTx(tx, actor, validation.data);
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, created.projectRapId),
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      return { created, projectId: rap.projectId };
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result.created };
  } catch (error) {
    return toFailure(error, "Gagal menyalin template ke RAP.");
  }
}

export async function copyPricingTemplateToCategoryPlan(
  input: unknown,
): Promise<ActionResponse<CategoryPlanItem>> {
  const validation = copyTemplateToCategoryPlanSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Template package tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const actor = await resolveActor();
      if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
      return copyPackageTemplateTx(tx, actor, validation.data);
    });
    revalidatePath(`/projects/${validation.data.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return toFailure(error, "Gagal menyalin template package ke proyek.");
  }
}

export async function reallocateProjectBudget(input: unknown): Promise<
  ActionResponse<{
    readonly projectBudgetId: string;
    readonly totalAllocationRatio: number;
    readonly unallocatedBufferRatio: number;
  }>
> {
  const parsed = reallocateProjectBudgetSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Alokasi tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const budget = await db.query.projectBudgets.findFirst({
    where: eq(projectBudgets.id, parsed.data.projectBudgetId),
  });
  if (!budget)
    return { success: false, error: { code: "NOT_FOUND", message: "Budget tidak ditemukan." } };
  try {
    const data = await db.transaction(async (tx) => {
      const proposal = await prepareProjectManagementTx(tx, actor, {
        action: "REALLOCATE_BUDGET",
        projectId: budget.projectId,
        ...parsed.data,
        reason:
          parsed.data.reason ||
          (budget.status === "APPROVED" ? "" : "Koreksi alokasi pada draft budget proyek."),
      });
      await writeProjectManagementTx(tx, actor, proposal);
      const all = await tx.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, budget.id),
      });
      const total = all.reduce((sum, c) => sum + Number(c.ratioPercentage), 0);
      return {
        projectBudgetId: budget.id,
        totalAllocationRatio: total,
        unallocatedBufferRatio: Math.max(0, 1 - total),
      };
    });
    revalidatePath(`/projects/${budget.projectId}`);
    return { success: true, data };
  } catch (error: unknown) {
    return toFailure(error, "Gagal merealokasi budget proyek.");
  }
}
