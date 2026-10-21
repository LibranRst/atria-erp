import {
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  auditLog,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { lockProjectRapTx } from "../material/rap-writer";
import { changePackageStatusTx } from "./category-plan-writer";
import { readSetupRecords } from "./rap-setup-reader";
import {
  simulateSetupStep,
  setupStepPermission,
  type SetupStep,
} from "@atria/core/ai/rap-finalization";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import { actorCan } from "@backend/lib/auth/permissions";

export async function lockSetupRowsTx(
  tx: FinanceTransaction,
  actor: Actor,
  rapId: string,
  permission: "update:rap" | "update:budget" | "lock:rap",
): Promise<typeof projectRap.$inferSelect> {
  const rap = await lockProjectRapTx(tx, actor, rapId, permission);
  const latest = await tx.query.projectRap.findFirst({
    where: and(
      eq(projectRap.projectId, rap.projectId),
      eq(projectRap.tenantId, INSTANCE_TENANT_ID),
    ),
    orderBy: [desc(projectRap.revision), desc(projectRap.createdAt)],
  });
  if (latest?.id !== rap.id) throw new Error("RAP memiliki revisi yang lebih baru.");
  await tx
    .select({ id: projectRapItem.id })
    .from(projectRapItem)
    .where(eq(projectRapItem.projectRapId, rap.id))
    .orderBy(asc(projectRapItem.id))
    .for("share");
  await tx
    .select({ id: projectCategoryPlanItem.id })
    .from(projectCategoryPlanItem)
    .where(
      and(
        eq(projectCategoryPlanItem.projectId, rap.projectId),
        eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .orderBy(asc(projectCategoryPlanItem.id))
    .for("update");
  return rap;
}
export async function applyRapSetupStepTx(
  tx: FinanceTransaction,
  actor: Actor,
  rapId: string,
  step: SetupStep,
): Promise<typeof projectRap.$inferSelect> {
  const initial = await tx.query.projectRap.findFirst({
    where: and(eq(projectRap.id, rapId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!initial) throw new Error("RAP_NOT_FOUND");
  const permission =
    step.action === "FINALIZE"
      ? "lock:rap"
      : step.action === "ADVANCE" && initial.setupStage === "MATERIAL"
        ? "update:rap"
        : "update:budget";
  const rap = await lockSetupRowsTx(tx, actor, rapId, permission),
    records = await readSetupRecords(rap.id, tx);
  const actualPermission = setupStepPermission(step, records.state);
  if (!actorCan(actor, actualPermission))
    throw new Error("FORBIDDEN: Izin tindakan RAP tidak tersedia.");
  const after = simulateSetupStep(records.state, step);
  if (step.action === "READY_PACKAGES") {
    for (const id of step.itemIds) await changePackageStatusTx(tx, actor, id, "ACTIVE");
    return rap;
  }
  const changes =
    step.action === "SET_SCOPE"
      ? step.category === "TUKANG"
        ? { tukangScopeSkipped: step.skipped }
        : { subconScopeSkipped: step.skipped }
      : step.action === "ADVANCE"
        ? { setupStage: after.stage }
        : {
            status: after.status,
            setupStage: after.stage,
            lockedById: actor.userId,
            lockedAt: new Date(),
          };
  const [updated] = await tx
    .update(projectRap)
    .set({
      ...changes,
      setupUpdatedById: actor.userId,
      updatedAt: new Date(Math.max(Date.now(), rap.updatedAt.getTime() + 1)),
    })
    .where(eq(projectRap.id, rap.id))
    .returning();
  const action =
    step.action === "FINALIZE"
      ? "FINALIZE_PROJECT_INTERNAL_PLAN"
      : step.action === "ADVANCE"
        ? "ADVANCE_RAP_SETUP"
        : step.skipped
          ? "SKIP_RAP_SCOPE"
          : "RESTORE_RAP_SCOPE";
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action,
    targetTable: "project_rap",
    targetId: rap.id,
    originalState: JSON.stringify(rap),
    newState: JSON.stringify({ ...updated, decision: step }),
  });
  if (step.action === "FINALIZE")
    await recordNotificationEvent(tx, {
      referenceType: "rap",
      referenceId: updated.id,
      projectId: updated.projectId,
      stage: "LOCKED",
      title: "Rencana pelaksanaan dikunci",
      message: "Rencana internal proyek siap digunakan.",
      permission: "view:rap",
      actionUrl: `/projects/${updated.projectId}?tab=materials`,
      actorId: actor.userId,
    });
  return updated;
}
