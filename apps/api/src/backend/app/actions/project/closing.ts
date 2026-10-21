import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
  lockManagedProjectTx,
  assertProjectManagementRights,
  ProjectManagementError,
} from "@backend/server/usecases/project/project-management-writer";
import {
  readProjectClosingTx,
  type ProjectClosingChecklist,
} from "@backend/server/usecases/project/project-closing-context";
import { completeProjectSchema } from "@atria/core/validations/workflow-governance";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
export type { ProjectClosingChecklist } from "@backend/server/usecases/project/project-closing-context";
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: error instanceof ProjectManagementError ? error.code : "TRANSACTION_FAILED",
      message:
        error instanceof ProjectManagementError
          ? error.message
          : "Gagal membaca atau menutup proyek.",
    },
  };
}
export async function getProjectClosingChecklist(
  projectId: string,
): Promise<ActionResponse<ProjectClosingChecklist>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    assertProjectManagementRights(actor, {
      action: "COMPLETE_PROJECT",
      projectId,
      closingNote: "Pembacaan checklist",
    });
    const data = await db.transaction(async (tx) => {
      await lockManagedProjectTx(tx, actor, projectId);
      return (await readProjectClosingTx(tx, projectId)).checklist;
    });
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function completeProject(
  input: unknown,
): Promise<ActionResponse<ProjectClosingChecklist>> {
  const parsed = completeProjectSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Data penutupan tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const data = await db.transaction(async (tx) => {
      const proposal = await prepareProjectManagementTx(tx, actor, {
        action: "COMPLETE_PROJECT",
        ...parsed.data,
      });
      const c = (await readProjectClosingTx(tx, parsed.data.projectId)).checklist;
      await writeProjectManagementTx(tx, actor, proposal);
      return c;
    });
    revalidateWorkspacePath(`/projects/${data.projectId}`);
    revalidateWorkspacePath("/projects");
    return { success: true, data };
  } catch (error: unknown) {
    return failure(error);
  }
}
