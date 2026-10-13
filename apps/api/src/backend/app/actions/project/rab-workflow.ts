import { db } from "@backend/db";
import { rabEstimate, projectChangeOrder } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  createRabRevisionTx,
  rejectChangeOrderTx,
  updateRabHeaderTx,
} from "@backend/server/usecases/project/rab-workflow-writer";
import {
  createRabRevisionSchema,
  rejectChangeOrderSchema,
  updateRabHeaderSchema,
} from "@atria/core/validations/workflow-governance";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revisionActionFailure } from "./revision-change-order-utils";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";

export async function createRabRevision(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const parsed = createRabRevisionSchema.safeParse(input),
    actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Identitas baseline dan alasan revisi wajib diisi.",
      },
    };
  try {
    const data = await db.transaction((tx) => createRabRevisionTx(tx, actor, parsed.data));
    revalidateWorkspacePath(`/projects/${data.projectId}`);
    return { success: true, data };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Revisi RAB belum dapat dibuat.");
  }
}
export async function rejectChangeOrder(
  input: unknown,
): Promise<ActionResponse<typeof projectChangeOrder.$inferSelect>> {
  const parsed = rejectChangeOrderSchema.safeParse(input),
    actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Identitas Change Order dan alasan penolakan wajib diisi.",
      },
    };
  try {
    const data = await db.transaction((tx) => rejectChangeOrderTx(tx, actor, parsed.data));
    revalidateWorkspacePath(`/projects/${data.projectId}`);
    return { success: true, data };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Penolakan belum dapat disimpan.");
  }
}
export async function updateRabEstimateHeader(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const parsed = updateRabHeaderSchema.safeParse(input),
    actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Judul atau catatan klien tidak valid." },
    };
  try {
    const data = await db.transaction((tx) => updateRabHeaderTx(tx, actor, parsed.data));
    revalidateWorkspacePath(`/projects/${data.projectId}`);
    return { success: true, data };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Koreksi RAB belum tersimpan.");
  }
}
