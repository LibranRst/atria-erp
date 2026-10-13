import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  expenseCategory,
  vendor,
} from "@backend/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { setupStateSchema, type SetupState } from "@atria/core/ai/rap-finalization";

export type SetupRecords = {
  rap: typeof projectRap.$inferSelect;
  items: (typeof projectRapItem.$inferSelect)[];
  packages: (typeof projectCategoryPlanItem.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
    vendor: typeof vendor.$inferSelect | null;
  })[];
  state: SetupState;
};
export async function readSetupRecords(
  rapId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<SetupRecords> {
  const rap = await connection.query.projectRap.findFirst({
    where: and(eq(projectRap.id, rapId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!rap) throw new Error("RAP_NOT_FOUND");
  const items = await connection.query.projectRapItem.findMany({
    where: and(
      eq(projectRapItem.projectRapId, rap.id),
      eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
    ),
    orderBy: [asc(projectRapItem.id)],
  });
  const all = await connection.query.projectCategoryPlanItem.findMany({
    where: and(
      eq(projectCategoryPlanItem.projectId, rap.projectId),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
    with: { expenseCategory: true, vendor: true },
    orderBy: [asc(projectCategoryPlanItem.id)],
  });
  const superseded = new Set(
    all
      .filter((p) => p.status !== "CANCELLED")
      .flatMap((p) =>
        p.supersedesProjectCategoryPlanItemId ? [p.supersedesProjectCategoryPlanItemId] : [],
      ),
  );
  const packages = all.filter(
    (p) => !superseded.has(p.id) && !["CANCELLED", "SUPERSEDED"].includes(p.status),
  );
  const state = setupStateSchema.parse({
    stage: rap.setupStage,
    status: rap.status,
    materialCount: items.length,
    tukangSkipped: rap.tukangScopeSkipped,
    subconSkipped: rap.subconScopeSkipped,
    packages: packages
      .filter((p) => p.expenseCategory.code === "TUKANG" || p.expenseCategory.code === "SUBCON")
      .map((p) => ({
        id: p.id,
        category: p.expenseCategory.code,
        status: p.status,
        snapshot: {
          name: p.name,
          scopeDescription: p.scopeDescription,
          area: p.area,
          quantity: Number(p.quantity),
          unit: p.unit,
          estimatedUnitCost: Number(p.estimatedUnitCost),
          estimatedTotalCost: Number(p.estimatedTotalCost),
          vendorId: p.vendorId,
          vendorName: p.vendor?.name ?? null,
          sourceLibraryItemId: p.sourceLibraryItemId,
          internalNote: p.internalNote,
        },
      })),
  });
  return { rap, items, packages, state };
}
