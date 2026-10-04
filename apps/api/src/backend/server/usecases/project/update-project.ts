import { actorCan } from "@backend/lib/auth/permissions";
import { db } from "@backend/db";
import { auditLog, project, projectBudgets } from "@backend/db/schema";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { Actor } from "@backend/server/actor";

import type { ActionResponse } from "@atria/core/types/action-response";
import { updateProjectSchema, type UpdateProjectInput } from "@atria/core/validations/project";
import { eq } from "drizzle-orm";

/** Memperbarui identitas proyek setelah izin dan scope actor ditegakkan server. */
export async function updateProjectUseCase(
  actor: Actor,
  input: UpdateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const validation = updateProjectSchema.safeParse(input);
  if (!validation.success) {
    console.error("VALIDATION FAILED in updateProjectUseCase:", {
      input,
      errors: validation.error.format(),
    });
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message || "Validasi data pembaruan proyek gagal.",
      },
    };
  }

  if (!actorCan(actor, "update:budget")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Peran Anda tidak diizinkan untuk memperbarui proyek.",
      },
    };
  }

  const data = validation.data;
  try {
    await assertProjectAccess(data.id, actor.userId, actor.roleName);
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Anda hanya dapat memperbarui proyek yang berada dalam cakupan Anda.",
      },
    };
  }

  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.project.findFirst({
        where: eq(project.id, data.id),
      });

      if (!existing) {
        throw new Error("Proyek tidak ditemukan.");
      }
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        throw new Error("Proyek yang sudah selesai atau dibatalkan tidak dapat diedit langsung.");
      }
      if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
        throw new Error(
          "Status COMPLETED hanya dapat ditetapkan melalui Project Closing Checklist.",
        );
      }

      // 1. Update project details
      await tx
        .update(project)
        .set({
          name: data.name,
          clientId: data.clientId,
          projectManagerId: data.projectManagerId,
          status: data.status,
          financialHealth: data.financialHealth,
          totalContractValue:
            data.totalContractValue !== undefined
              ? data.totalContractValue.toFixed(2)
              : existing.totalContractValue,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location || null,
          roomArea: data.roomArea || null,
          projectType: data.projectType || null,
          coverImageUrl: data.coverImageUrl || null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(project.id, data.id));

      // 2. If contract value changed, sync with draft budget if available
      const currentBudget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, data.id),
      });

      if (
        data.totalContractValue !== undefined &&
        currentBudget &&
        currentBudget.status === "DRAFT"
      ) {
        const ratio = Number(currentBudget.budgetCapRatio);
        const internalBudget = data.totalContractValue * ratio;
        const targetGrossAmount = data.totalContractValue - internalBudget;

        await tx
          .update(projectBudgets)
          .set({
            contractValue: data.totalContractValue.toFixed(2),
            internalBudget: internalBudget.toFixed(2),
            targetGrossAmount: targetGrossAmount.toFixed(2),
            targetGrossPercentage:
              data.totalContractValue > 0
                ? ((targetGrossAmount / data.totalContractValue) * 100).toFixed(4)
                : "0.0000",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, currentBudget.id));
      }

      // 3. Write audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: actor.userId,
        action: "UPDATE_PROJECT",
        targetTable: "project",
        targetId: data.id,
        newState: JSON.stringify(data),
        createdAt: new Date(),
      });
    });

    return { success: true, data: { id: data.id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat memperbarui proyek.",
      },
    };
  }
}
