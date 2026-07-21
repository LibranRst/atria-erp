import { buildProjectOverviewActions } from "@/lib/project/project-overview";
import { selectApprovedRabEstimate, selectCurrentRabEstimate } from "@/lib/project/rab-selection";
import type { ProjectReadinessItem } from "./overview/project-overview";
import type {
  ProjectCategoryPlanItemView,
  ProjectPlanBudgetCategory,
  VendorOption,
} from "./shared/rap-rab-types";
import {
  buildCategoryPlanItemForManager,
  buildChangeOrderHistoryItem,
  buildRabEstimateForManager,
  buildRabRevisionHistoryItem,
  buildRapForManager,
  buildStaleSourceLabels,
} from "./project-tabs-mappers";
import type { ProjectTabsProps, TabId } from "./project-tabs-types";
import {
  buildReadiness,
  calculateBudgetTotals,
  calculateInvoiceOutstanding,
  calculateTotalReceived,
} from "./project-tabs-view-model-utils";

type ProjectTabsViewModelInput = Pick<
  ProjectTabsProps,
  | "project"
  | "costs"
  | "invoices"
  | "vendorBills"
  | "vendors"
  | "projectBudgetDashboard"
  | "materialMasterCatalog"
>;

export function buildProjectTabsViewModel({
  project,
  costs,
  invoices,
  vendorBills,
  vendors,
  projectBudgetDashboard,
  materialMasterCatalog,
}: ProjectTabsViewModelInput): {
  readonly contractValue: number;
  readonly totalAllocated: number;
  readonly totalSpent: number;
  readonly totalReceived: number;
  readonly totalRemaining: number;
  readonly projectedGrossProfit: number;
  readonly projectedGrossMargin: number;
  readonly cashPosition: number;
  readonly rapForManager: ReturnType<typeof buildRapForManager>;
  readonly rabEstimateForManager: ReturnType<typeof buildRabEstimateForManager>;
  readonly materialOptions: ProjectTabsProps["materialMasterCatalog"];
  readonly planBudgetCategories: ProjectPlanBudgetCategory[];
  readonly categoryPlanItemsForManager: ProjectCategoryPlanItemView[];
  readonly vendorOptions: VendorOption[];
  readonly baselineApprovedRabId: string | null;
  readonly changeOrderHistory: readonly ReturnType<typeof buildChangeOrderHistoryItem>[];
  readonly rabRevisionHistory: readonly ReturnType<typeof buildRabRevisionHistoryItem>[];
  readonly staleSourceLabels: readonly string[];
  readonly hasApprovedRab: boolean;
  readonly nextSetupTab: TabId;
  readonly nextSetupLabel: string;
  readonly nextSetupIcon: string;
  readonly readiness: readonly ProjectReadinessItem[];
  readonly overviewActions: ReturnType<typeof buildProjectOverviewActions>;
} {
  const contractValue = Number(project.totalContractValue);
  const budgetTotals = calculateBudgetTotals(project, projectBudgetDashboard);
  const totalReceived = calculateTotalReceived(invoices);
  const projectedGrossProfit =
    projectBudgetDashboard?.projectedMarginAmount ?? contractValue - budgetTotals.totalAllocated;
  const projectedGrossMargin =
    projectBudgetDashboard?.projectedMarginPercentage ??
    (contractValue > 0 ? (projectedGrossProfit / contractValue) * 100 : 0);
  const cashPosition =
    totalReceived - (projectBudgetDashboard?.paidCost ?? budgetTotals.totalSpent);

  const activeRap = project.raps.slice().sort((a, b) => b.revision - a.revision)[0] ?? null;
  const planBudgetCategories = (projectBudgetDashboard?.categories ?? [])
    .filter((category) => category.code === "TUKANG" || category.code === "SUBCON")
    .map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    }));
  const vendorOptions = vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }));
  const materialOptions = materialMasterCatalog;
  const categoryPlanItemsForManager = project.categoryPlanItems.map((item) =>
    buildCategoryPlanItemForManager(item, costs),
  );
  const rapForManager = buildRapForManager(activeRap, costs);
  const latestRabEstimate = selectCurrentRabEstimate(project.rabEstimates);
  const approvedRabEstimate = selectApprovedRabEstimate(project.rabEstimates);
  const baselineApprovedRabId =
    latestRabEstimate?.status === "DRAFT" ? (approvedRabEstimate?.id ?? null) : null;
  const rabEstimateForManager = buildRabEstimateForManager(latestRabEstimate);
  const rabRevisionHistory = project.rabEstimates
    .slice()
    .sort((a, b) => b.revision - a.revision)
    .map(buildRabRevisionHistoryItem);
  const staleSourceLabels =
    rabEstimateForManager?.status === "DRAFT"
      ? buildStaleSourceLabels(rabEstimateForManager.items, project)
      : [];
  const changeOrderHistory = project.changeOrders
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(buildChangeOrderHistoryItem);

  const hasApprovedRab = Boolean(approvedRabEstimate);
  const nextSetupTab: TabId = rapForManager ? "rab" : "rap";
  const nextSetupLabel = rapForManager ? "Buka RAB" : "Buat RAP";
  const nextSetupIcon = rapForManager ? "request_quote" : "architecture";
  const shortageCount = rapForManager?.items.filter((item) => item.needToBuy > 0).length ?? 0;
  const invoiceOutstanding = calculateInvoiceOutstanding(invoices);
  const overdueInvoiceCount = invoices.filter(
    (invoice) =>
      invoice.status !== "VOID" && invoice.status !== "PAID" && invoice.dueDate < new Date(),
  ).length;
  const overdueVendorBillCount = vendorBills.filter(
    (bill) => bill.status !== "VOID" && bill.status !== "PAID" && bill.dueDate < new Date(),
  ).length;
  const criticalCategories = (projectBudgetDashboard?.categories ?? []).filter(
    (category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET",
  );
  const readiness = buildReadiness({
    latestRabEstimate,
    activeRap,
    rapForManager,
    shortageCount,
    invoiceOutstanding,
    overdueInvoiceCount,
  });
  const overviewActions = buildProjectOverviewActions({
    hasRap: Boolean(activeRap),
    rapStatus: activeRap?.status ?? null,
    rapSetupStage: activeRap?.setupStage ?? null,
    hasApprovedRab,
    hasRabDraft: latestRabEstimate?.status === "DRAFT",
    criticalCategoryNames: criticalCategories.map((category) => category.name),
    shortageCount,
    overdueInvoiceCount,
    overdueVendorBillCount,
  });

  return {
    contractValue,
    totalAllocated: budgetTotals.totalAllocated,
    totalSpent: budgetTotals.totalSpent,
    totalReceived,
    totalRemaining: budgetTotals.totalRemaining,
    projectedGrossProfit,
    projectedGrossMargin,
    cashPosition,
    rapForManager,
    rabEstimateForManager,
    materialOptions,
    planBudgetCategories,
    categoryPlanItemsForManager,
    vendorOptions,
    baselineApprovedRabId,
    changeOrderHistory,
    rabRevisionHistory,
    staleSourceLabels,
    hasApprovedRab,
    nextSetupTab,
    nextSetupLabel,
    nextSetupIcon,
    readiness,
    overviewActions,
  };
}
