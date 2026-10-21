import { approveProjectChangeOrderTx } from "@backend/server/usecases/project/rab-workflow-writer";
import { resolveActor } from "@backend/server/actor";

import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { db } from "@backend/db";
import { projectChangeOrder } from "@backend/db/schema";

import type { ActionResponse } from "@atria/core/types/action-response";
import { approveChangeOrderSchema } from "@atria/core/validations/workflow-governance";
import { revisionActionFailure } from "./revision-change-order-utils";

type ChangeOrder = typeof projectChangeOrder.$inferSelect;

export async function approveProjectChangeOrder(
  input: unknown,
): Promise<ActionResponse<ChangeOrder>> {
  const validation = approveChangeOrderSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Isian RAB tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction((tx) =>
      approveProjectChangeOrderTx(tx, actor, validation.data),
    );
    revalidatePath(`/projects/${result.projectId ?? ""}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Tindakan RAB belum dapat disimpan.");
  }
}
