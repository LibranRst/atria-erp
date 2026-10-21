import { and, eq, inArray } from "drizzle-orm";
import {
  INSTANCE_TENANT_ID,
  projectRapItem,
  projectCategoryPlanItem,
  rabEstimate,
  rabEstimateItem,
} from "@backend/db/schema";
import type { FinanceTransaction } from "../finance/mutation-access";
import { calculateRabSellingUnitPrice } from "@atria/core/project/rap-rab";
import { rabWorkflowLineFieldsSchema, type RabWorkflowLine } from "@atria/core/ai/rab-workflow";

export type RabSourceRefresh = {
  readonly source: unknown;
  readonly itemId: string;
  readonly after: RabWorkflowLine;
  readonly sourceLibraryItemId: string | null;
  readonly sourceRevision: number;
  readonly sourceUpdatedAt: Date;
};
/** Same client-safe derived values are used by immutable preview and the manual/AI writer. */
export async function readRabSourceRefresh(
  connection: Pick<FinanceTransaction, "query">,
  estimate: typeof rabEstimate.$inferSelect & { items: (typeof rabEstimateItem.$inferSelect)[] },
  targetGrossPercentage: number,
): Promise<readonly RabSourceRefresh[]> {
  const changes: RabSourceRefresh[] = [];
  const rapIds = estimate.items.flatMap((row) =>
    row.sourceProjectRapItemId ? [row.sourceProjectRapItemId] : [],
  );
  const packageIds = estimate.items.flatMap((row) =>
    row.sourceProjectCategoryPlanItemId ? [row.sourceProjectCategoryPlanItemId] : [],
  );
  const [rapRows, packageRows] = await Promise.all([
    rapIds.length
      ? connection.query.projectRapItem.findMany({
          where: and(
            inArray(projectRapItem.id, rapIds),
            eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
          ),
          with: { rap: true },
        })
      : Promise.resolve([]),
    packageIds.length
      ? connection.query.projectCategoryPlanItem.findMany({
          where: and(
            inArray(projectCategoryPlanItem.id, packageIds),
            eq(projectCategoryPlanItem.projectId, estimate.projectId),
            eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
          ),
        })
      : Promise.resolve([]),
  ]);
  const raps = new Map(rapRows.map((row) => [row.id, row]));
  const packages = new Map(packageRows.map((row) => [row.id, row]));

  for (const line of estimate.items) {
    let source: {
      quantity: number;
      unit: string;
      unitPrice: number;
      libraryId: string | null;
      revision: number;
      updatedAt: Date;
      raw: unknown;
    } | null = null;
    if (line.sourceProjectRapItemId) {
      const record = raps.get(line.sourceProjectRapItemId);
      if (
        record &&
        record.rap.projectId === estimate.projectId &&
        record.rap.tenantId === INSTANCE_TENANT_ID
      )
        source = {
          quantity: Number(record.totalQuantity),
          unit: record.unit,
          unitPrice:
            Number(record.suggestedClientUnitPrice) > 0
              ? Number(record.suggestedClientUnitPrice)
              : calculateRabSellingUnitPrice({
                  costUnitPrice: Number(record.estimatedUnitCost),
                  targetGrossPercentage,
                }),
          libraryId: record.sourceLibraryItemId,
          revision: record.rap.revision,
          updatedAt: record.updatedAt,
          raw: record,
        };
    } else if (line.sourceProjectCategoryPlanItemId) {
      const record = packages.get(line.sourceProjectCategoryPlanItemId);
      if (record)
        source = {
          quantity: Number(record.quantity),
          unit: record.unit,
          unitPrice:
            Number(record.suggestedClientUnitPrice) > 0
              ? Number(record.suggestedClientUnitPrice)
              : calculateRabSellingUnitPrice({
                  costUnitPrice: Number(record.estimatedUnitCost),
                  targetGrossPercentage,
                }),
          libraryId: record.sourceLibraryItemId,
          revision: record.revision,
          updatedAt: record.updatedAt,
          raw: record,
        };
    }
    if (!source) continue;
    const after = rabWorkflowLineFieldsSchema.parse({
      clientLabel: line.clientLabel,
      description: line.description ?? "",
      quantity: source.quantity,
      unit: source.unit,
      // Match the same two-decimal selling price persisted by RAB draft writers.
      unitPrice: Number(source.unitPrice.toFixed(2)),
      itemNature: line.itemNature,
      isHidden: line.isHidden,
    });
    changes.push({
      source: source.raw,
      itemId: line.id,
      after,
      sourceLibraryItemId: source.libraryId,
      sourceRevision: source.revision,
      sourceUpdatedAt: source.updatedAt,
    });
  }
  return changes;
}
