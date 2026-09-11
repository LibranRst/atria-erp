import { recordNotificationEvent } from "@/server/services/notification-events";
import "server-only";

import { db } from "@/db";
import { auditLog, project, user } from "@/db/schema";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { Actor } from "@/server/actor";
import { actorHasPermission } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  assignProjectManagerSchema,
  type AssignProjectManagerInput,
} from "@atria/core/validations/project";
import { eq } from "drizzle-orm";

export type AssignProjectManagerResult = {
  readonly projectId: string;
  readonly projectManagerId: string;
  readonly pmName: string;
};

/** Menugaskan Project Manager ke proyek dengan audit log dan transaksi aman. */
export async function assignProjectManagerUseCase(
  actor: Actor,
  input: AssignProjectManagerInput,
): Promise<ActionResponse<AssignProjectManagerResult>> {
  const validation = assignProjectManagerSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message || "Validasi data penugasan PM gagal.",
      },
    };
  }

  if (!actorHasPermission(actor.roleName, "create:project")) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Peran Anda tidak diizinkan untuk menugaskan Project Manager.",
      },
    };
  }

  const { projectId, projectManagerId } = validation.data;
  try {
    await assertProjectAccess(projectId, actor.userId, actor.roleName);
  } catch {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Anda hanya dapat menugaskan PM pada proyek yang berada dalam cakupan Anda.",
      },
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.project.findFirst({
        where: eq(project.id, projectId),
      });

      if (!existing) {
        throw new Error("Proyek tidak ditemukan.");
      }
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        throw new Error("Proyek yang sudah selesai atau dibatalkan tidak dapat diubah.");
      }

      const targetPm = await tx.query.user.findFirst({
        where: eq(user.id, projectManagerId),
      });
      if (!targetPm) {
        throw new Error("Project Manager yang dipilih tidak ditemukan.");
      }

      await tx
        .update(project)
        .set({
          projectManagerId,
          updatedAt: new Date(),
        })
        .where(eq(project.id, projectId));

      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: actor.userId,
        action: "ASSIGN_PROJECT_MANAGER",
        targetTable: "project",
        targetId: projectId,
        originalState: JSON.stringify({ projectManagerId: existing.projectManagerId }),
        newState: JSON.stringify({ projectManagerId, projectManagerName: targetPm.name }),
        createdAt: new Date(),
      });

      if (existing.projectManagerId !== projectManagerId)
        await recordNotificationEvent(tx, {
          referenceType: "project",
          referenceId: projectId,
          projectId,
          stage: `ASSIGNED:${projectManagerId}:${crypto.randomUUID()}`,
          title: "Penugasan proyek",
          message: existing.name,
          recipients: [projectManagerId],
          permission: "view:project",
          actionUrl: `/projects/${projectId}`,
          actorId: actor.userId,
        });
      return {
        projectId,
        projectManagerId,
        pmName: targetPm.name,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menugaskan Project Manager.",
      },
    };
  }
}
