import { db } from "@backend/db";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  assignProjectManagerSchema,
  type AssignProjectManagerInput,
} from "@atria/core/validations/project";
import {
  prepareProjectManagementTx,
  writeProjectManagementTx,
  assertProjectManagementRights,
  ProjectManagementError,
} from "./project-management-writer";
export type AssignProjectManagerResult = {
  readonly projectId: string;
  readonly projectManagerId: string;
  readonly pmName: string;
};

export async function assignProjectManagerUseCase(
  actor: Actor,
  input: AssignProjectManagerInput,
): Promise<ActionResponse<AssignProjectManagerResult>> {
  const parsed = assignProjectManagerSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Penugasan tidak valid.",
      },
    };
  try {
    assertProjectManagementRights(actor, { action: "ASSIGN_PM", ...parsed.data });
    const data = await db.transaction(async (tx) => {
      const proposal = await prepareProjectManagementTx(tx, actor, {
        action: "ASSIGN_PM",
        ...parsed.data,
      });
      await writeProjectManagementTx(tx, actor, proposal);
      return {
        projectId: parsed.data.projectId,
        projectManagerId: parsed.data.projectManagerId,
        pmName: String(proposal.rows[0].details[1].value),
      };
    });
    return { success: true, data };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: error instanceof ProjectManagementError ? error.code : "INTERNAL_SERVER_ERROR",
        message:
          error instanceof ProjectManagementError
            ? error.message
            : "Gagal menugaskan Project Manager.",
      },
    };
  }
}
