import { db } from "@backend/db";
import { resolveActor } from "@backend/server/actor";
import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
  ProjectManagementError,
} from "@backend/server/usecases/project/project-management-writer";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { ActionResponse } from "@atria/core/types/action-response";
import { z } from "zod";
export async function activateProjectAction(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string; readonly status: "ACTIVE" }>> {
  const parsed = z.object({ projectId: z.guid() }).safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID proyek tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const id = await db.transaction(async (tx) =>
      writeProjectManagementTx(
        tx,
        actor,
        await prepareProjectManagementTx(tx, actor, { action: "ACTIVATE_PROJECT", ...parsed.data }),
      ),
    );
    revalidateWorkspacePath(`/projects/${id}`);
    revalidateWorkspacePath("/projects");
    return { success: true, data: { id, status: "ACTIVE" } };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof ProjectManagementError ? error.code : "INTERNAL_SERVER_ERROR",
        message:
          error instanceof ProjectManagementError ? error.message : "Gagal mengaktifkan proyek.",
      },
    };
  }
}
