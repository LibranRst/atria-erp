"use server";

import { roleNameHasPermission } from "@/lib/auth/role-access";
import { recordNotificationEvent } from "@/server/services/notification-events";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  auditLog,
  project,
  projectBudgets,
  projectRap,
  rabEstimate,
  user as userTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { getProjectActivationReadiness } from "@atria/core/project/activation-readiness";
import type { ActionResponse } from "@atria/core/types/action-response";

const activateProjectSchema = z.object({
  projectId: z.string().min(1, "ID proyek tidak valid."),
});

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
};

type ActivationError = {
  readonly code: "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR";
  readonly message: string;
};

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  return session?.user ? (session.user as SessionUser) : null;
}

export async function activateProjectAction(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string; readonly status: "ACTIVE" }>> {
  const parsed = activateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Aktivasi proyek tidak valid.",
      },
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const roleName = await resolveRoleName(user.roleId ?? "");
  if (!(await roleNameHasPermission(roleName, "activate:project"))) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya Owner dan Finance Admin yang dapat mengaktifkan proyek.",
      },
    };
  }

  try {
    const activated = await db.transaction(async (tx) => {
      const [projectRecord] = await tx
        .select()
        .from(project)
        .where(eq(project.id, parsed.data.projectId))
        .for("update");
      if (!projectRecord) throw new Error("PROJECT_NOT_FOUND");
      if (projectRecord.status !== "DRAFT") throw new Error("PROJECT_NOT_DRAFT");

      const projectManager = projectRecord.projectManagerId
        ? await tx.query.user.findFirst({
            where: eq(userTable.id, projectRecord.projectManagerId),
            columns: { id: true, isActive: true },
            with: { role: { columns: { name: true, dataScope: true } } },
          })
        : null;

      const budgets = await tx
        .select({ status: projectBudgets.status })
        .from(projectBudgets)
        .where(eq(projectBudgets.projectId, projectRecord.id))
        .for("update");
      const raps = await tx
        .select({ id: projectRap.id, status: projectRap.status })
        .from(projectRap)
        .where(eq(projectRap.projectId, projectRecord.id))
        .for("update");
      const rabs = await tx
        .select({
          status: rabEstimate.status,
          sourceProjectRapId: rabEstimate.sourceProjectRapId,
        })
        .from(rabEstimate)
        .where(eq(rabEstimate.projectId, projectRecord.id))
        .for("update");
      const readiness = getProjectActivationReadiness({
        projectStatus: projectRecord.status,
        projectManagerReady: Boolean(
          projectManager?.isActive && projectManager.role.dataScope === "ASSIGNED",
        ),
        budgetStatus: budgets.find((budget) => budget.status === "APPROVED")?.status,
        raps,
        rabEstimates: rabs,
      });
      if (!readiness.isReady) throw new Error("PROJECT_ACTIVATION_NOT_READY");

      const [updatedProject] = await tx
        .update(project)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(project.id, projectRecord.id))
        .returning();

      await tx.insert(auditLog).values({
        userId: user.id,
        action: "ACTIVATE_PROJECT",
        targetTable: "project",
        targetId: updatedProject.id,
        originalState: JSON.stringify({ status: projectRecord.status }),
        newState: JSON.stringify({ status: updatedProject.status, readiness }),
        createdAt: new Date(),
      });

      await recordNotificationEvent(tx, {
        referenceType: "project",
        referenceId: updatedProject.id,
        projectId: updatedProject.id,
        stage: "ACTIVE",
        title: "Proyek diaktifkan",
        message: updatedProject.name,
        permission: "view:project",
        actionUrl: `/projects/${updatedProject.id}`,
        actorId: user.id,
      });
      return updatedProject;
    });

    revalidatePath(`/projects/${activated.id}`);
    revalidatePath("/projects");
    return { success: true, data: { id: activated.id, status: "ACTIVE" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengaktifkan proyek.";
    const errors: Record<string, ActivationError> = {
      PROJECT_NOT_FOUND: { code: "NOT_FOUND", message: "Proyek tidak ditemukan." },
      PROJECT_NOT_DRAFT: {
        code: "FORBIDDEN",
        message: "Hanya proyek Draft yang dapat diaktifkan melalui langkah ini.",
      },
      PROJECT_ACTIVATION_NOT_READY: {
        code: "FORBIDDEN",
        message:
          "Proyek belum siap diaktifkan. Pastikan Project Manager aktif sudah ditugaskan, Budget disetujui, RAP terkunci, dan RAB klien disetujui.",
      },
    };
    return {
      success: false,
      error: errors[message] ?? { code: "INTERNAL_SERVER_ERROR", message },
    };
  }
}
