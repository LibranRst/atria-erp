import {
  refreshRabLinkedSourcesTx,
  createProjectChangeOrderTx,
  confirmChangeOrderClientTx,
  voidRabRevisionTx,
} from "@backend/server/usecases/project/rab-workflow-writer";
import { resolveActor } from "@backend/server/actor";
import {
  createRapRevisionTx,
  createPackageRevisionTx,
  lockRevisionContextTx,
} from "@backend/server/usecases/project/rap-revision-writer";

import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  projectCategoryPlanItem,
  projectChangeOrder,
  projectRap,
  rabEstimate,
} from "@backend/db/schema";

import type { ActionResponse } from "@atria/core/types/action-response";
import {
  confirmChangeOrderClientSchema,
  createCategoryPlanRevisionSchema,
  createChangeOrderSchema,
  createRapRevisionSchema,
  refreshRabSourcesSchema,
  voidRabRevisionSchema,
} from "@atria/core/validations/workflow-governance";
import { getRevisionActionUser, revisionActionFailure } from "./revision-change-order-utils";
import { approveProjectChangeOrder as approveProjectChangeOrderWrite } from "./revision-change-order-approval";

type Rap = typeof projectRap.$inferSelect;
type CategoryPlan = typeof projectCategoryPlanItem.$inferSelect;
type ChangeOrder = typeof projectChangeOrder.$inferSelect;

export async function createRapRevision(input: unknown): Promise<ActionResponse<Rap>> {
  const validation = createRapRevisionSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Revision RAP tidak valid.",
      },
    };
  const user = await getRevisionActionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const actor = await resolveActor();
      if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
      return createRapRevisionTx(tx, actor, validation.data.projectRapId, validation.data.reason);
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membuat revision RAP.");
  }
}

export async function createCategoryPlanRevision(
  input: unknown,
): Promise<ActionResponse<CategoryPlan>> {
  const validation = createCategoryPlanRevisionSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Revision package tidak valid.",
      },
    };
  const user = await getRevisionActionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const actor = await resolveActor();
      if (!actor) throw new Error("FORBIDDEN: Sesi tidak valid.");
      const source = await tx.query.projectCategoryPlanItem.findFirst({
        where: eq(projectCategoryPlanItem.id, validation.data.projectCategoryPlanItemId),
      });
      if (!source) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
      const rap = await lockRevisionContextTx(tx, actor, source.projectId, "update:budget");
      if (rap.status === "LOCKED")
        await createRapRevisionTx(tx, actor, rap.id, validation.data.reason);
      return createPackageRevisionTx(tx, actor, source.id, validation.data.reason);
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal membuat revision package.");
  }
}

export async function refreshRabLinkedSources(
  input: unknown,
): Promise<ActionResponse<{ readonly rabEstimateId: string; readonly refreshedCount: number }>> {
  const validation = refreshRabSourcesSchema.safeParse(input);
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
      refreshRabLinkedSourcesTx(tx, actor, validation.data),
    );
    const estimate = await db.query.rabEstimate.findFirst({
      where: eq(rabEstimate.id, result.rabEstimateId),
    });
    if (estimate) revalidatePath(`/projects/${estimate.projectId}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function createProjectChangeOrder(
  input: unknown,
): Promise<ActionResponse<ChangeOrder>> {
  const validation = createChangeOrderSchema.safeParse(input);
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
      createProjectChangeOrderTx(tx, actor, validation.data),
    );
    revalidatePath(`/projects/${result.projectId ?? ""}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function confirmChangeOrderClient(
  input: unknown,
): Promise<ActionResponse<ChangeOrder>> {
  const validation = confirmChangeOrderClientSchema.safeParse(input);
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
      confirmChangeOrderClientTx(tx, actor, validation.data),
    );
    revalidatePath(`/projects/${result.projectId ?? ""}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function voidRabRevision(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = voidRabRevisionSchema.safeParse(input);
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
    const result = await db.transaction((tx) => voidRabRevisionTx(tx, actor, validation.data));
    revalidatePath(`/projects/${result.projectId ?? ""}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    return revisionActionFailure(error, "Tindakan RAB belum dapat disimpan.");
  }
}

export async function approveProjectChangeOrder(
  input: unknown,
): Promise<ActionResponse<ChangeOrder>> {
  return approveProjectChangeOrderWrite(input);
}
