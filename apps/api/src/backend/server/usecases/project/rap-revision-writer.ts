import { resolvePackageCategoryTx } from "./category-plan-writer";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  auditLog,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { lockRapProjectTx } from "../material/rap-writer";

/** Project lock is shared with manual planning/finalization and AI confirmation. */
export async function lockRevisionContextTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
  permission: "update:rap" | "update:budget",
): Promise<typeof projectRap.$inferSelect> {
  await lockRapProjectTx(tx, actor, projectId, permission);
  const [rap] = await tx
    .select()
    .from(projectRap)
    .where(and(eq(projectRap.projectId, projectId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)))
    .orderBy(desc(projectRap.revision), desc(projectRap.createdAt))
    .limit(1)
    .for("update");
  if (!rap) throw new Error("RAP_NOT_FOUND");
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
        eq(projectCategoryPlanItem.projectId, projectId),
        eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .orderBy(asc(projectCategoryPlanItem.id))
    .for("update");
  return rap;
}
export async function createRapRevisionTx(
  tx: FinanceTransaction,
  actor: Actor,
  sourceId: string,
  reason: string,
  nextId?: string,
): Promise<typeof projectRap.$inferSelect> {
  const found = await tx.query.projectRap.findFirst({
    where: and(eq(projectRap.id, sourceId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!found) throw new Error("RAP_NOT_FOUND");
  const source = await lockRevisionContextTx(tx, actor, found.projectId, "update:rap");
  if (source.id !== sourceId || source.status !== "LOCKED")
    throw new Error(
      "FORBIDDEN: Revisi hanya untuk RAP terkunci terbaru; periksa draft revisi yang tersedia.",
    );
  if (reason.trim().length < 10) throw new Error("Alasan revisi minimal 10 karakter.");
  const [revision] = await tx
    .insert(projectRap)
    .values({
      id: nextId,
      projectId: source.projectId,
      supersedesProjectRapId: source.id,
      status: "DRAFT",
      revision: source.revision + 1,
      notes: reason.trim(),
      tukangScopeSkipped: source.tukangScopeSkipped,
      subconScopeSkipped: source.subconScopeSkipped,
    })
    .returning();
  const items = await tx.query.projectRapItem.findMany({
    where: eq(projectRapItem.projectRapId, source.id),
    orderBy: [asc(projectRapItem.id)],
  });
  if (items.length)
    await tx.insert(projectRapItem).values(
      items.map((item) => ({
        projectRapId: revision.id,
        materialId: item.materialId,
        sourceLibraryItemId: item.sourceLibraryItemId,
        area: item.area,
        name: item.name,
        description: item.description,
        requiredQuantity: item.requiredQuantity,
        bufferQuantity: item.bufferQuantity,
        totalQuantity: item.totalQuantity,
        unit: item.unit,
        estimatedUnitCost: item.estimatedUnitCost,
        estimatedTotalCost: item.estimatedTotalCost,
        suggestedClientUnitPrice: item.suggestedClientUnitPrice,
        source: item.source,
        status: item.status,
        internalNote: item.internalNote,
      })),
    );
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_RAP_REVISION",
    targetTable: "project_rap",
    targetId: revision.id,
    originalState: JSON.stringify(source),
    newState: JSON.stringify({ ...revision, reason: reason.trim() }),
  });
  return revision;
}
export async function createPackageRevisionTx(
  tx: FinanceTransaction,
  actor: Actor,
  sourceId: string,
  reason: string,
  nextId?: string,
): Promise<typeof projectCategoryPlanItem.$inferSelect> {
  let found = await tx.query.projectCategoryPlanItem.findFirst({
    where: and(
      eq(projectCategoryPlanItem.id, sourceId),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!found) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
  const rap = await lockRevisionContextTx(tx, actor, found.projectId, "update:budget");
  found = await tx.query.projectCategoryPlanItem.findFirst({
    where: and(
      eq(projectCategoryPlanItem.id, sourceId),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!found) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");
  await resolvePackageCategoryTx(tx, found.projectId, found.projectBudgetCategoryId);
  // Packages can have been finalized while retaining Siap status; locked RAP supplies the baseline.
  const baseline =
    rap.status === "LOCKED"
      ? rap
      : rap.supersedesProjectRapId
        ? await tx.query.projectRap.findFirst({
            where: and(
              eq(projectRap.id, rap.supersedesProjectRapId),
              eq(projectRap.status, "LOCKED"),
            ),
          })
        : null;
  if (!baseline || !["ACTIVE", "LOCKED"].includes(found.status))
    throw new Error(
      "FORBIDDEN: Revisi paket membutuhkan baseline RAP terkunci dan paket Siap/terkunci.",
    );
  if (rap.status === "DRAFT" && found.createdAt > rap.createdAt)
    throw new Error("Paket bukan bagian baseline revisi ini.");
  const newer = await tx.query.projectCategoryPlanItem.findFirst({
    where: and(
      eq(projectCategoryPlanItem.supersedesProjectCategoryPlanItemId, sourceId),
      ne(projectCategoryPlanItem.status, "CANCELLED"),
    ),
  });
  if (newer) throw new Error("Paket sudah memiliki revisi lebih baru.");
  if (reason.trim().length < 10) throw new Error("Alasan revisi minimal 10 karakter.");
  const [revision] = await tx
    .insert(projectCategoryPlanItem)
    .values({
      ...found,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: nextId,
      supersedesProjectCategoryPlanItemId: sourceId,
      revision: found.revision + 1,
      status: "DRAFT",
      internalNote: reason.trim(),
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_CATEGORY_PLAN_REVISION",
    targetTable: "project_category_plan_item",
    targetId: revision.id,
    originalState: JSON.stringify(found),
    newState: JSON.stringify({ ...revision, reason: reason.trim() }),
  });
  return revision;
}
