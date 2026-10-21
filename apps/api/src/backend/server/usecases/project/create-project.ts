import { actorCan } from "@backend/lib/auth/permissions";

import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { readBudgetAllocationSnapshot } from "@backend/lib/budget/allocation-defaults";
import {
  projectBudgetDefaultsSchema,
  projectBudgetDefaultsMatch,
  type ProjectBudgetDefaults,
} from "@atria/core/ai/project-budget-defaults";
import { db } from "@backend/db";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { auditLog, project } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { insertProjectWithCanonicalBudgetTx } from "@backend/server/usecases/project/project-creation-write";
import type { ActionResponse } from "@atria/core/types/action-response";
import { createProjectSchema, type CreateProjectInput } from "@atria/core/validations/project";

/** Membuat proyek memakai identitas pemanggil yang telah diselesaikan server. */
export async function createProjectUseCase(
  actor: Actor,
  input: CreateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const validation = createProjectSchema.safeParse(input);
  if (!validation.success) {
    console.error("VALIDATION FAILED in createProjectUseCase:", {
      input,
      errors: validation.error.format(),
    });
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message || "Validasi data proyek gagal.",
      },
    };
  }

  if (!actorCan(actor, "create:project")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya peran Owner dan Finance Admin yang diizinkan untuk membuat proyek baru.",
      },
    };
  }

  const data = validation.data;

  try {
    const result = await db.transaction((tx) => createProjectTx(tx, actor, data));

    return { success: true, data: { id: result.id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat membuat proyek.",
      },
    };
  }
}

export async function createProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: CreateProjectInput,
  reviewedBudgetDefaults?: ProjectBudgetDefaults,
): Promise<typeof project.$inferSelect> {
  if (!actorCan(actor, "create:project"))
    throw new Error("FORBIDDEN: Tidak memiliki izin membuat proyek.");
  const data = createProjectSchema.parse(input);
  const allocationDefault = await readBudgetAllocationSnapshot(tx);
  if (reviewedBudgetDefaults) {
    const current = projectBudgetDefaultsSchema.safeParse(allocationDefault);
    if (!current.success || !projectBudgetDefaultsMatch(reviewedBudgetDefaults, current.data))
      throw new Error("PROJECT_BUDGET_DEFAULTS_CHANGED");
  }

  const created = await insertProjectWithCanonicalBudgetTx({
    tx,
    input: {
      ...data,
      projectManagerId: data.projectManagerId,
      approvedRabValue: data.totalContractValue,
    },
    allocation: allocationDefault,
  });

  await tx.insert(auditLog).values({
    id: crypto.randomUUID(),
    userId: actor.userId,
    action: "CREATE_PROJECT",
    targetTable: "project",
    targetId: created.project.id,
    newState: JSON.stringify({
      project: created.project,
      canonicalBudgetId: created.budgetId,
    }),
    createdAt: new Date(),
  });

  if (created.project.projectManagerId)
    await recordNotificationEvent(tx, {
      referenceType: "project",
      referenceId: created.project.id,
      projectId: created.project.id,
      stage: "INITIAL_ASSIGNMENT",
      title: "Penugasan proyek baru",
      message: created.project.name,
      recipients: [created.project.projectManagerId],
      permission: "view:project",
      actionUrl: `/projects/${created.project.id}`,
      actorId: actor.userId,
    });
  return created.project;
}
