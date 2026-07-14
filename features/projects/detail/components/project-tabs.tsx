"use client";

import React from "react";
import {
  RapRabManager,
} from "./shared/rap-rab-manager";
import { ProjectInvoices } from "./invoices/project-invoices";
import {
  ExpenseList,
} from "@/features/expenses/components/expense-list";
import { useProjectState } from "./project-state-context";
import {
  ProjectIdentityHeader,
  ProjectOverview,
} from "./overview/project-overview";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  LockedTabState,
  RabPrerequisiteState,
} from "./project-tab-states";
import { StockControlPanel } from "./stock/stock-control-panel";
import { ProfitabilityPanel } from "./overview/profitability-panel";
import {
  TABS,
  toTabId,
  type ProjectTabsProps,
  type TabId,
} from "./project-tabs-types";
import { buildProjectTabsViewModel } from "./project-tabs-view-model";
import {
  updateBrowserUrl,
  useUrlSearchParam,
} from "@/lib/utils/use-url-search-param";
import { resolveEffectiveProjectHealth } from "@/lib/project/effective-health";

export type {
  ProjectData,
  ProjectTabsProps,
  StockMovement,
  TabId,
} from "./project-tabs-types";

export function ProjectTabs({
  project,
  userRole,
  bankAccounts,
  costs,
  vendorBills,
  vendorPayments,
  vendors,
  projectsForForms,
  stockMovements,
  invoices,
  projectBudgetDashboard,
  materialMasterCatalog,
  pricingTemplateCatalog,
}: ProjectTabsProps): React.JSX.Element {
  const tabParam = useUrlSearchParam("tab");
  const isLocked =
    !projectBudgetDashboard || projectBudgetDashboard.status !== "APPROVED";
  const { setProjectState } = useProjectState();

  React.useEffect(() => {
    setProjectState({
      projectId: project.id,
      isLocked,
    });
    return () => {
      setProjectState({
        projectId: null,
        isLocked: false,
      });
    };
  }, [project.id, isLocked, setProjectState]);

  const activeTab = toTabId(tabParam, isLocked);

  const health = resolveEffectiveProjectHealth({
    storedHealth: project.financialHealth,
    remainingBudget: projectBudgetDashboard?.remainingBudget ?? 0,
    usedPercentage: projectBudgetDashboard?.usedPercentage ?? 0,
    categoryStatuses: projectBudgetDashboard?.categories.map((category) => category.status),
    projectedMarginPercentage: projectBudgetDashboard?.projectedMarginPercentage,
    targetMarginPercentage: projectBudgetDashboard?.targetGrossPercentage,
  });

  const {
    contractValue,
    totalAllocated,
    totalSpent,
    totalReceived,
    totalRemaining,
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
    nextSetupTab,
    nextSetupLabel,
    nextSetupIcon,
    readiness,
    overviewActions,
  } = buildProjectTabsViewModel({
    project,
    costs,
    invoices,
    vendorBills,
    vendors,
    projectBudgetDashboard,
    materialMasterCatalog,
  });

  const isTabLocked = (tabId: TabId): boolean =>
    isLocked && tabId !== "overview" && tabId !== "rab" && tabId !== "rap";

  function selectProjectTab(tabId: TabId): void {
    const defaultTab = isLocked ? "rap" : "overview";
    const params = new URLSearchParams(window.location.search);
    if (tabId === defaultTab) params.delete("tab");
    else params.set("tab", tabId);
    const query = params.toString();
    updateBrowserUrl(
      `${window.location.pathname}${query ? `?${query}` : ""}`,
      "replace",
    );
  }

  return (
    <div className="space-y-md">
      <ProjectIdentityHeader
        project={project}
        effectiveHealth={health.effectiveHealth}
        healthReasons={health.healthReasons}
      />

      <SegmentedTabs
        value={activeTab}
        onChange={selectProjectTab}
        ariaLabel="Project detail tabs"
        scrollable
        options={TABS.map((tab) => {
          const locked = isTabLocked(tab.id);
          return {
            value: tab.id,
            label: tab.label,
            icon: (
              <span className="material-symbols-outlined text-[16px]">
                {locked ? "lock" : tab.icon}
              </span>
            ),
          };
        })}
      />

      {/* Tab Contents */}
      <div className="min-h-[400px] transition-all duration-200">
        {activeTab === "overview" && (
          <ProjectOverview
            budget={projectBudgetDashboard}
            contractValue={contractValue}
            actions={overviewActions}
            readiness={readiness}
            onNavigate={selectProjectTab}
          />
        )}
        {activeTab === "rab" &&
          (rapForManager ? (
            <RapRabManager
              key={`rab-${rapForManager.id}-${rabEstimateForManager?.id ?? "none"}`}
              projectId={project.id}
              rap={rapForManager}
              rabEstimate={rabEstimateForManager}
              materials={materialOptions}
              userRole={userRole}
              budgetCategories={planBudgetCategories}
              categoryPlanItems={categoryPlanItemsForManager}
              vendors={vendorOptions}
              pricingTemplates={pricingTemplateCatalog}
              baselineApprovedRabId={baselineApprovedRabId}
              changeOrders={changeOrderHistory}
              revisionHistory={rabRevisionHistory}
              staleSourceLabels={staleSourceLabels}
              mode="rab"
            />
          ) : (
            <RabPrerequisiteState onGoToRap={() => selectProjectTab("rap")} />
          ))}

        {activeTab === "rap" && (
          <RapRabManager
            key={`rap-${rapForManager?.id ?? "none"}-${rabEstimateForManager?.id ?? "none"}`}
            projectId={project.id}
            rap={rapForManager}
            rabEstimate={rabEstimateForManager}
            materials={materialOptions}
            userRole={userRole}
            budgetCategories={planBudgetCategories}
            categoryPlanItems={categoryPlanItemsForManager}
            vendors={vendorOptions}
            pricingTemplates={pricingTemplateCatalog}
            baselineApprovedRabId={baselineApprovedRabId}
            changeOrders={changeOrderHistory}
            revisionHistory={rabRevisionHistory}
            staleSourceLabels={staleSourceLabels}
            mode="rap"
          />
        )}

        {activeTab === "stok" && (
          <StockControlPanel
            projectId={project.id}
            rap={rapForManager}
            materials={materialOptions}
            stockMovements={stockMovements}
            userRole={userRole}
            isLocked={isLocked}
            nextSetupTab={nextSetupTab}
            nextSetupLabel={nextSetupLabel}
            nextSetupIcon={nextSetupIcon}
            setActiveTab={selectProjectTab}
          />
        )}

        {activeTab === "expenses" &&
          (isLocked ? (
            <LockedTabState
              tabLabel="Expenses"
              actionLabel={nextSetupLabel}
              actionIcon={nextSetupIcon}
              onAction={() => selectProjectTab(nextSetupTab)}
            />
          ) : (
            <div className="space-y-sm">
              <ExpenseList
                projectId={project.id}
                initialCosts={costs}
                bankAccounts={bankAccounts}
                userRole={userRole}
                vendorBills={vendorBills}
                vendorPayments={vendorPayments}
                vendors={vendors}
                projects={projectsForForms}
              />
            </div>
          ))}

        {activeTab === "payments" &&
          (isLocked ? (
            <LockedTabState
              tabLabel="Payments"
              actionLabel={nextSetupLabel}
              actionIcon={nextSetupIcon}
              onAction={() => selectProjectTab(nextSetupTab)}
            />
          ) : (
            <ProjectInvoices
              projectId={project.id}
              invoices={invoices}
              bankAccounts={bankAccounts}
              userRole={userRole}
              contractValue={contractValue}
            />
          ))}

        {activeTab === "profitability" && (
          <ProfitabilityPanel
            projectId={project.id}
            projectStatus={project.status}
            userRole={userRole}
            contractValue={contractValue}
            totalAllocated={totalAllocated}
            projectedGrossProfit={projectedGrossProfit}
            projectedGrossMargin={projectedGrossMargin}
            totalRemaining={totalRemaining}
            totalReceived={totalReceived}
            totalSpent={totalSpent}
            cashPosition={cashPosition}
            isLocked={isLocked}
            nextSetupTab={nextSetupTab}
            nextSetupLabel={nextSetupLabel}
            nextSetupIcon={nextSetupIcon}
            setActiveTab={selectProjectTab}
          />
        )}
      </div>
    </div>
  );
}
