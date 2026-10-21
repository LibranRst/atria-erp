import { approveRabEstimateTx } from "@backend/server/usecases/project/rab-workflow-writer";
import { resolveActor } from "@backend/server/actor";

import { db } from "@backend/db";
import { rabEstimate } from "@backend/db/schema";

import type { ActionResponse } from "@atria/core/types/action-response";
import { approveRabEstimateSchema } from "@atria/core/validations/rap-rab";
import { toError } from "./rap-rab-utils";

export async function approveRabEstimate(
  rabEstimateId: string,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = approveRabEstimateSchema.safeParse({ rabEstimateId });
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
    const result = await db.transaction((tx) => approveRabEstimateTx(tx, actor, validation.data));
    return { success: true, data: result };
  } catch (error: unknown) {
    return toError(error, "Tindakan RAB belum dapat disimpan.");
  }
}
