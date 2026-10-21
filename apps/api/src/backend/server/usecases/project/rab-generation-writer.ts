import { and, asc, eq, inArray } from "drizzle-orm";
import {
  auditLog,
  project,
  projectBudgets,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import {
  buildRabCategoryPlanItemValues,
  buildRabMaterialItemValues,
} from "@backend/app/actions/project/rap-rab-utils";
import { getNextRabRevision } from "@atria/core/project/rab-selection";
import type { GenerateRabFromSelectedSourcesInput } from "@atria/core/validations/rap-rab";
import { rabClientFieldsSchema, rabLineTotal, type RabDraftRow } from "@atria/core/ai/rab-draft";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { lockRapProjectTx } from "../material/rap-writer";

/** One project lock serializes manual and AI RAB generation and stabilizes scope. */
export async function lockRabGenerationTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
  materialIds: readonly string[],
  packageIds: readonly string[],
): Promise<void> {
  await lockRapProjectTx(tx, actor, projectId, "create:rab");
  await tx
    .select({ id: projectBudgets.id })
    .from(projectBudgets)
    .where(eq(projectBudgets.projectId, projectId))
    .for("share");
  await tx
    .select({ id: projectRap.id })
    .from(projectRap)
    .where(and(eq(projectRap.projectId, projectId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)))
    .orderBy(asc(projectRap.id))
    .for("share");
  if (materialIds.length)
    await tx
      .select({ id: projectRapItem.id })
      .from(projectRapItem)
      .where(inArray(projectRapItem.id, [...materialIds]))
      .orderBy(asc(projectRapItem.id))
      .for("share");
  if (packageIds.length)
    await tx
      .select({ id: projectCategoryPlanItem.id })
      .from(projectCategoryPlanItem)
      .where(inArray(projectCategoryPlanItem.id, [...packageIds]))
      .orderBy(asc(projectCategoryPlanItem.id))
      .for("share");
  await tx
    .select({ id: rabEstimate.id })
    .from(rabEstimate)
    .where(eq(rabEstimate.projectId, projectId))
    .orderBy(asc(rabEstimate.id))
    .for("share");
}
export async function generateRabFromSelectedSourcesTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: GenerateRabFromSelectedSourcesInput,
  reviewedRows?: readonly RabDraftRow[],
): Promise<typeof rabEstimate.$inferSelect> {
  await lockRabGenerationTx(
    tx,
    actor,
    input.projectId,
    input.projectRapItemIds,
    input.projectCategoryPlanItemIds,
  );
  const proj = await tx.query.project.findFirst({
    where: eq(project.id, input.projectId),
    with: {
      rabEstimates: true,
    },
  });
  if (!proj) throw new Error("PROJECT_NOT_FOUND");

  const openEstimate = proj.rabEstimates.find((estimate) => estimate.status === "DRAFT");
  if (openEstimate) throw new Error("RAB_DRAFT_EXISTS");
  const currentApproved =
    proj.rabEstimates.find((estimate) => estimate.status === "APPROVED") ?? null;

  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, input.projectId),
  });
  const targetGrossPercentage = budget ? Number(budget.targetGrossPercentage) : 10;
  const revision = getNextRabRevision(proj.rabEstimates);

  const uniqueRapItemIds = Array.from(new Set(input.projectRapItemIds));
  const uniquePlanItemIds = Array.from(new Set(input.projectCategoryPlanItemIds));
  const rapItems =
    uniqueRapItemIds.length > 0
      ? await tx.query.projectRapItem.findMany({
          where: inArray(projectRapItem.id, uniqueRapItemIds),
          with: {
            rap: true,
          },
        })
      : [];
  const categoryPlanItems =
    uniquePlanItemIds.length > 0
      ? await tx.query.projectCategoryPlanItem.findMany({
          where: inArray(projectCategoryPlanItem.id, uniquePlanItemIds),
          with: {
            expenseCategory: true,
          },
        })
      : [];

  if (rapItems.length !== uniqueRapItemIds.length) throw new Error("RAP_ITEM_NOT_FOUND");
  if (categoryPlanItems.length !== uniquePlanItemIds.length)
    throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");

  for (const item of rapItems) {
    if (item.rap.projectId !== input.projectId) throw new Error("RAP_ITEM_PROJECT_MISMATCH");
    if (item.rap.status !== "LOCKED")
      throw new Error("Material RAP harus difinalisasi sebelum menjadi source RAB.");
  }
  for (const item of categoryPlanItems) {
    if (item.projectId !== input.projectId) throw new Error("CATEGORY_PLAN_ITEM_PROJECT_MISMATCH");
    if (item.expenseCategory.code !== "TUKANG" && item.expenseCategory.code !== "SUBCON") {
      throw new Error("CATEGORY_PLAN_ONLY_ALLOWED_FOR_TUKANG_OR_SUBCON");
    }
    if (item.status !== "ACTIVE" && item.status !== "LOCKED") {
      throw new Error("Package Tukang/Subcon harus ACTIVE sebelum dipakai sebagai source RAB.");
    }
  }

  const firstRap = rapItems[0]?.rap ?? null;
  const [estimate] = await tx
    .insert(rabEstimate)
    .values({
      projectId: input.projectId,
      sourceProjectRapId: firstRap?.id ?? null,
      supersedesRabEstimateId: currentApproved?.id ?? null,
      status: "DRAFT",
      revision,
      title: input.title ?? `Client Estimate / Quotation - ${proj.name}`,
      clientNotes:
        input.clientNotes ??
        "Draft quotation client. Review label, harga, dan item sebelum dikirim.",
    })
    .returning();

  const generatedSourceItems = [
    ...rapItems.map((item, index) =>
      buildRabMaterialItemValues({
        rabEstimateId: estimate.id,
        item: { ...item, revision: item.rap.revision },
        targetGrossPercentage,
        displayOrder: index + 1,
      }),
    ),
    ...categoryPlanItems.map((item, index) =>
      buildRabCategoryPlanItemValues({
        rabEstimateId: estimate.id,
        item,
        targetGrossPercentage,
        displayOrder: rapItems.length + index + 1,
      }),
    ),
  ];

  const baselineItems =
    !reviewedRows && currentApproved
      ? await tx.query.rabEstimateItem.findMany({
          where: eq(rabEstimateItem.rabEstimateId, currentApproved.id),
          orderBy: (table, { asc }) => [asc(table.displayOrder)],
        })
      : [];
  const baselineBundles =
    !reviewedRows && currentApproved
      ? await tx.query.rabEstimateBundle.findMany({
          where: eq(rabEstimateBundle.rabEstimateId, currentApproved.id),
          with: { items: true },
          orderBy: (table, { asc }) => [asc(table.displayOrder)],
        })
      : [];

  const mergedSourceItems = generatedSourceItems.map((generatedItem) => {
    const baselineItem = baselineItems.find((candidate) => {
      if (candidate.sourceType !== generatedItem.sourceType) return false;
      if (
        generatedItem.sourceLibraryItemId &&
        candidate.sourceLibraryItemId === generatedItem.sourceLibraryItemId
      )
        return true;
      if (
        generatedItem.sourceProjectCategoryPlanItemId &&
        candidate.sourceProjectCategoryPlanItemId === generatedItem.sourceProjectCategoryPlanItemId
      )
        return true;
      return candidate.clientLabel === generatedItem.clientLabel;
    });
    if (!baselineItem) return generatedItem;
    return {
      ...generatedItem,
      clientLabel: baselineItem.clientLabel,
      description: baselineItem.description,
      quantity: baselineItem.quantity,
      unit: baselineItem.unit,
      unitPrice: baselineItem.unitPrice,
      lineTotal: baselineItem.lineTotal,
      displayOrder: baselineItem.displayOrder,
      isHidden: baselineItem.isHidden,
      isBundle: baselineItem.isBundle,
    };
  });

  const baselineManualItems = baselineItems
    .filter(
      (item) =>
        (item.sourceType === "MANUAL" || item.sourceType === "MANUAL_CLIENT_LINE") &&
        (!input.selectedBaselineManualItemIds ||
          input.selectedBaselineManualItemIds.includes(item.id)),
    )
    .map((item) => ({
      rabEstimateId: estimate.id,
      sourceType: "MANUAL",
      itemNature: item.itemNature ?? "PRODUCTION",
      sourceProjectRapItemId: null,
      sourceProjectCategoryPlanItemId: null,
      sourceLibraryItemId: item.sourceLibraryItemId,
      sourceRevision: item.sourceRevision,
      sourceUpdatedAt: item.sourceUpdatedAt,
      clientLabel: item.clientLabel,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      displayOrder: item.displayOrder,
      isHidden: item.isHidden,
      isBundle: item.isBundle,
    }));

  const baselineManualLabels = new Set(
    baselineManualItems.map((item) => item.clientLabel.trim().toLowerCase()),
  );
  const newManualItems = input.manualLines
    .filter((item) => !baselineManualLabels.has(item.clientLabel.trim().toLowerCase()))
    .map((item, index) => ({
      rabEstimateId: estimate.id,
      sourceType: "MANUAL",
      itemNature: item.itemNature ?? "PRODUCTION",
      sourceProjectRapItemId: null,
      sourceProjectCategoryPlanItemId: null,
      sourceLibraryItemId: null,
      sourceRevision: null,
      sourceUpdatedAt: null,
      clientLabel: item.clientLabel,
      description: item.description ?? null,
      quantity: item.quantity.toFixed(2),
      unit: item.unit,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: (item.quantity * item.unitPrice).toFixed(2),
      displayOrder: mergedSourceItems.length + baselineManualItems.length + index + 1,
      isHidden: item.isHidden ?? false,
      isBundle: item.isBundle ?? false,
    }));

  const generatedItems = reviewedRows
    ? generatedSourceItems.map((generated) => {
        const sourceId =
          generated.sourceProjectRapItemId ?? generated.sourceProjectCategoryPlanItemId;
        const reviewed = reviewedRows.find((row) => row.sourceId === sourceId);
        if (!reviewed) throw new Error("Reviewed source row is missing.");
        const fields = rabClientFieldsSchema.parse({
          clientLabel: reviewed.clientLabel,
          description: reviewed.description,
          quantity: reviewed.quantity,
          unitPrice: reviewed.unitPrice,
        });
        if (reviewed.unit !== generated.unit) throw new Error("Satuan sumber RAB berubah.");
        return {
          ...generated,
          ...fields,
          displayOrder: reviewedRows.findIndex((row) => row.sourceId === sourceId) + 1,
          quantity: fields.quantity.toFixed(2),
          unitPrice: fields.unitPrice.toFixed(2),
          lineTotal: rabLineTotal(fields).toFixed(2),
        };
      })
    : [...mergedSourceItems, ...baselineManualItems, ...newManualItems];

  const insertedItems = await tx.insert(rabEstimateItem).values(generatedItems).returning();
  for (const baselineBundle of baselineBundles) {
    const [bundle] = await tx
      .insert(rabEstimateBundle)
      .values({
        rabEstimateId: estimate.id,
        clientLabel: baselineBundle.clientLabel,
        description: baselineBundle.description,
        quantity: baselineBundle.quantity,
        unit: baselineBundle.unit,
        unitPrice: baselineBundle.unitPrice,
        lineTotal: baselineBundle.lineTotal,
        displayOrder: baselineBundle.displayOrder,
        isHidden: baselineBundle.isHidden,
      })
      .returning();
    for (const oldMember of baselineBundle.items) {
      const member = insertedItems.find((candidate) => {
        if (
          oldMember.sourceProjectRapItemId &&
          candidate.sourceProjectRapItemId === oldMember.sourceProjectRapItemId
        )
          return true;
        if (
          oldMember.sourceProjectCategoryPlanItemId &&
          candidate.sourceProjectCategoryPlanItemId === oldMember.sourceProjectCategoryPlanItemId
        )
          return true;
        return (
          (oldMember.sourceType === "MANUAL" || oldMember.sourceType === "MANUAL_CLIENT_LINE") &&
          (candidate.sourceType === "MANUAL" || candidate.sourceType === "MANUAL_CLIENT_LINE") &&
          candidate.clientLabel === oldMember.clientLabel
        );
      });
      if (member)
        await tx
          .update(rabEstimateItem)
          .set({ bundleId: bundle.id, isBundle: true })
          .where(eq(rabEstimateItem.id, member.id));
    }
  }

  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "GENERATE_RAB_DRAFT_FROM_SELECTED_SOURCES",
    targetTable: "rab_estimate",
    targetId: estimate.id,
    newState: JSON.stringify({
      estimate,
      itemCount: insertedItems.length,
      sourceRapItemIds: input.projectRapItemIds,
      sourceCategoryPlanItemIds: input.projectCategoryPlanItemIds,
    }),
  });

  return estimate;
}
