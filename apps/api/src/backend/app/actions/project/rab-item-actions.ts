import { updateRabEstimateItemTx } from "@backend/server/usecases/project/rab-workflow-writer";
import { resolveActor } from "@backend/server/actor";

import { db } from "@backend/db";
import { rabEstimateItem } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  updateRabEstimateItemSchema,
  type UpdateRabEstimateItemInput,
} from "@atria/core/validations/rap-rab";
import { toError } from "./rap-rab-utils";

export async function updateRabEstimateItem(
  input: UpdateRabEstimateItemInput,
): Promise<ActionResponse<typeof rabEstimateItem.$inferSelect>> {
  const validation = updateRabEstimateItemSchema.safeParse(input);
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
      updateRabEstimateItemTx(tx, actor, validation.data),
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}
