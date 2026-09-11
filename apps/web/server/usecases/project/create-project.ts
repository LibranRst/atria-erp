import { actorHasPermission } from "@atria/core/auth/permissions";
import "server-only";
import { recordNotificationEvent } from "@/server/services/notification-events";

import { getBudgetAllocationDefault } from "@/app/actions/project/excel-budget-utils";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { insertProjectWithCanonicalBudgetTx } from "@/server/usecases/project/project-creation-write";
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

  if (!actorHasPermission(actor.roleName, "create:project")) {
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
    const allocationDefault = await getBudgetAllocationDefault();
    const result = await db.transaction(async (tx) => {
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
    });

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
