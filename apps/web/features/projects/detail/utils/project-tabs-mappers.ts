import { calculateQuotationTotal } from "@atria/core/project/quotation-total";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import type {
  ChangeOrderHistoryView,
  ProjectCategoryPlanItemView,
  RabEstimateView,
  RabRevisionHistoryView,
  RapItemView,
  RapView,
} from "../types/rap-rab-types";
import type { ProjectTabsProps } from "../types/project-tabs-types";

type ProjectRap = ProjectTabsProps["project"]["raps"][number];
type ProjectRapItem = ProjectRap["items"][number];
type ProjectRabEstimate = ProjectTabsProps["project"]["rabEstimates"][number];

export function buildCategoryPlanItemForManager(
  item: ProjectTabsProps["project"]["categoryPlanItems"][number],
  costs: ProjectTabsProps["costs"],
): ProjectCategoryPlanItemView {
  const actualCost = costs
    .filter(
      (expense) =>
        expense.projectCategoryPlanItemId === item.id &&
        ["APPROVED", "PAID"].includes(expense.status),
    )
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  return {
    id: item.id,
    projectBudgetCategoryId: item.projectBudgetCategoryId,
    expenseCategoryCode: item.expenseCategory?.code || "LAIN_LAIN",
    expenseCategoryName: item.expenseCategory?.name || "Lain-lain",
    vendorId: item.vendorId,
    vendorName: item.vendor?.name ?? null,
    name: item.name,
    scopeDescription: item.scopeDescription || "",
    area: item.area,
    quantity: item.quantity,
    unit: item.unit,
    estimatedUnitCost: item.estimatedUnitCost,
    estimatedTotalCost: item.estimatedTotalCost,
    status: item.status,
    internalNote: item.internalNote || "",
    displayOrder: item.displayOrder || 0,
    actualCost,
    variance: actualCost - Number(item.estimatedTotalCost),
  };
}

export function buildRapForManager(
  activeRap: ProjectRap | null,
  costs: ProjectTabsProps["costs"],
): RapView | null {
  if (!activeRap) return null;

  return {
    id: activeRap.id,
    status: activeRap.status,
    revision: activeRap.revision,
    notes: activeRap.notes,
    setupStage: activeRap.setupStage,
    tukangScopeSkipped: activeRap.tukangScopeSkipped,
    subconScopeSkipped: activeRap.subconScopeSkipped,
    setupUpdatedById: activeRap.setupUpdatedById,
    items: activeRap.items.map((item) => buildRapItemForManager(item, costs)),
  };
}

export function buildRabEstimateForManager(
  latestRabEstimate: ProjectRabEstimate | null,
): RabEstimateView | null {
  if (!latestRabEstimate) return null;

  return {
    id: latestRabEstimate.id,
    sourceProjectRapId: latestRabEstimate.sourceProjectRapId,
    supersedesRabEstimateId: latestRabEstimate.supersedesRabEstimateId,
    status: latestRabEstimate.status,
    revision: latestRabEstimate.revision,
    title: latestRabEstimate.title,
    clientNotes: latestRabEstimate.clientNotes,
    approvedValue: latestRabEstimate.approvedValue,
    items: latestRabEstimate.items.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceProjectRapItemId: item.sourceProjectRapItemId,
      sourceProjectCategoryPlanItemId: item.sourceProjectCategoryPlanItemId,
      clientLabel: item.clientLabel,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      displayOrder: item.displayOrder,
      isHidden: item.isHidden,
      isBundle: item.isBundle,
      bundleId: item.bundleId,
      sourceRevision: item.sourceRevision,
      sourceUpdatedAt: item.sourceUpdatedAt,
    })),
    bundles: latestRabEstimate.bundles.map((bundle) => ({
      ...bundle,
      itemIds: bundle.items.map((item) => item.id),
    })),
  };
}

export function buildRabRevisionHistoryItem(estimate: ProjectRabEstimate): RabRevisionHistoryView {
  return {
    id: estimate.id,
    revision: estimate.revision,
    status: estimate.status,
    value: calculateQuotationTotal(estimate.items, estimate.bundles),
    voidReason: estimate.voidReason,
    voidedAt: estimate.voidedAt,
    voidedByName: estimate.voidedBy?.name ?? null,
  };
}

export function buildStaleSourceLabels(
  lines: RabEstimateView["items"],
  project: ProjectTabsProps["project"],
): readonly string[] {
  return lines.flatMap((line) => {
    if (line.sourceProjectRapItemId) {
      const source = project.raps
        .flatMap((rap) => rap.items.map((item) => ({ item, revision: rap.revision })))
        .find((row) => row.item.id === line.sourceProjectRapItemId);
      if (
        source &&
        (line.sourceRevision !== source.revision ||
          !line.sourceUpdatedAt ||
          source.item.updatedAt > line.sourceUpdatedAt)
      )
        return [line.clientLabel];
    }

    if (line.sourceProjectCategoryPlanItemId) {
      const source = project.categoryPlanItems.find(
        (item) => item.id === line.sourceProjectCategoryPlanItemId,
      );
      if (
        source &&
        (line.sourceRevision !== source.revision ||
          !line.sourceUpdatedAt ||
          source.updatedAt > line.sourceUpdatedAt)
      )
        return [line.clientLabel];
    }

    return [];
  });
}

export function buildChangeOrderHistoryItem(
  order: ProjectTabsProps["project"]["changeOrders"][number],
): ChangeOrderHistoryView {
  return {
    id: order.id,
    status: order.status,
    reason: order.reason,
    scopeSummary: order.scopeSummary,
    previousContractValue: order.previousContractValue,
    valueDelta: order.valueDelta,
    revisedContractValue: order.revisedContractValue,
    clientConfirmedAt: order.clientConfirmedAt,
    clientConfirmationReference: order.clientConfirmationReference,
    createdAt: order.createdAt,
    approvedAt: order.approvedAt,
    createdByName: order.createdBy.name,
    approvedByName: order.approvedBy?.name ?? null,
    baseRevision: order.baseRab.revision,
    revisedRevision: order.revisedRab.revision,
    sourceRevisionSummary:
      [
        order.revisedRab.sourceRap ? `RAP R${order.revisedRab.sourceRap.revision}` : null,
        ...Array.from(
          new Set(
            order.revisedRab.items
              .filter((item) => item.sourceType === "CATEGORY_PLAN" && item.sourceRevision)
              .map((item) => `Package R${item.sourceRevision}`),
          ),
        ),
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · ") || "Commercial-only revision",
  };
}

function buildRapItemForManager(
  item: ProjectRapItem,
  costs: ProjectTabsProps["costs"],
): RapItemView {
  const availableStock =
    item.material?.inventory?.reduce((sum, inventory) => {
      return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
    }, 0) ?? 0;
  const materialProjection = projectMaterialProjection(
    item.stockMovements ?? [],
    Number(item.totalQuantity),
  );
  const actualMaterialCost = costs
    .filter(
      (expense) =>
        expense.projectRapItemId === item.id && ["APPROVED", "PAID"].includes(expense.status),
    )
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  return {
    id: item.id,
    materialId: item.materialId,
    materialName: item.material?.name ?? "Manual item",
    area: item.area,
    name: item.name,
    description: item.description,
    requiredQuantity: item.requiredQuantity,
    bufferQuantity: item.bufferQuantity,
    totalQuantity: item.totalQuantity,
    unit: item.unit,
    estimatedUnitCost: item.estimatedUnitCost,
    estimatedTotalCost: item.estimatedTotalCost,
    source: item.source,
    status:
      item.status === "PLANNED" || item.status === "DRAFT"
        ? item.status
        : materialProjection.needToBuy > 0
          ? "SHORTAGE"
          : "READY",
    internalNote: item.internalNote,
    availableStock,
    needToBuy: materialProjection.needToBuy,
    reservedQuantity: materialProjection.reservedQuantity,
    boughtQuantity: materialProjection.boughtQuantity,
    usedQuantity: materialProjection.usedQuantity,
    leftoverQuantity: materialProjection.leftoverQuantity,
    securedQuantity: materialProjection.securedQuantity,
    returnedQuantity: materialProjection.returnedQuantity,
    wasteQuantity: materialProjection.wasteQuantity,
    actualMaterialCost,
    costVariance: actualMaterialCost - Number(item.estimatedTotalCost),
  };
}
