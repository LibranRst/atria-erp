"use client";

import React from "react";
import { RapRabManager } from "./shared/rap-rab-manager";
import { ProjectInvoices } from "./invoices/project-invoices";
import { ExpenseList } from "@/features/expenses/components/expense-list";
import { useProjectState } from "./project-state-context";
import { ProjectIdentityHeader, ProjectOverview } from "./overview/project-overview";
import { ProjectDetailNavigation } from "./project-detail-navigation";
import { LockedTabState, RabPrerequisiteState } from "./project-tab-states";
import { StockControlPanel } from "./stock/stock-control-panel";
import { ProfitabilityPanel } from "./overview/profitability-panel";
import { toTabId, type ProjectTabsProps, type TabId } from "./project-tabs-types";
import { buildProjectTabsViewModel } from "./project-tabs-view-model";
import { updateBrowserUrl, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { resolveEffectiveProjectHealth } from "@/lib/project/effective-health";
import { getProjectActivationReadiness } from "@/lib/project/activation-readiness";
import { ProjectActivationSheet } from "./project-activation-sheet";

export type { ProjectData, ProjectTabsProps, StockMovement, TabId } from "./project-tabs-types";

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
  const isLocked = !projectBudgetDashboard || projectBudgetDashboard.status !== "APPROVED";
  const { setProjectState } = useProjectState();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScrollPositionRef = React.useRef<number | null>(null);
  const [contentMinHeight, setContentMinHeight] = React.useState<number | null>(null);

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

  React.useLayoutEffect(() => {
    const pendingScrollPosition = pendingScrollPositionRef.current;
    if (pendingScrollPosition === null) return;
    pendingScrollPositionRef.current = null;
    window.scrollTo({ top: pendingScrollPosition, behavior: "auto" });
  }, [activeTab]);

  React.useEffect(() => {
    if (contentMinHeight === null) return;

    const releasePreservedHeight = (): void => {
      if (window.scrollY <= 80) setContentMinHeight(null);
    };

    window.addEventListener("scroll", releasePreservedHeight, {
      passive: true,
    });
    return () => window.removeEventListener("scroll", releasePreservedHeight);
  }, [contentMinHeight]);

  const health = resolveEffectiveProjectHealth({
    storedHealth: project.financialHealth,
    remainingBudget: projectBudgetDashboard?.remainingBudget ?? 0,
    usedPercentage: projectBudgetDashboard?.usedPercentage ?? 0,
    categoryStatuses: projectBudgetDashboard?.categories.map((category) => category.status),
    projectedMarginPercentage: projectBudgetDashboard?.projectedMarginPercentage,
    targetMarginPercentage: projectBudgetDashboard?.targetGrossPercentage,
  });
  const activationReadiness = getProjectActivationReadiness({
    projectStatus: project.status,
    budgetStatus: projectBudgetDashboard?.status,
    raps: project.raps,
    rabEstimates: project.rabEstimates,
  });
  const canActivateProject = userRole === "OWNER" || userRole === "FINANCE_ADMIN";

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

  function selectProjectTab(tabId: TabId): void {
    if (tabId === activeTab) return;
    const currentScrollY = window.scrollY;
    const currentContentRect = contentRef.current?.getBoundingClientRect();
    if (currentScrollY > 80 && currentContentRect) {
      const contentTop = currentContentRect.top + currentScrollY;
      const viewportRequiredHeight = Math.max(0, currentScrollY + window.innerHeight - contentTop);
      setContentMinHeight((current) =>
        Math.max(current ?? 0, currentContentRect.height, viewportRequiredHeight),
      );
    } else {
      setContentMinHeight(null);
    }
    pendingScrollPositionRef.current = currentScrollY;
    const defaultTab = isLocked ? "rap" : "overview";
    const params = new URLSearchParams(window.location.search);
    if (tabId === defaultTab) params.delete("tab");
    else params.set("tab", tabId);
    const query = params.toString();
    updateBrowserUrl(`${window.location.pathname}${query ? `?${query}` : ""}`, "replace");
  }

  return (
    <div className="space-y-md">
      <ProjectIdentityHeader
        project={project}
        effectiveHealth={health.effectiveHealth}
        healthReasons={health.healthReasons}
      />
      <ProjectActivationSheet
        key={`${project.id}-${project.status}-${activationReadiness.isReady}`}
        projectId={project.id}
        projectName={project.name}
        canActivate={canActivateProject}
        readiness={activationReadiness}
      />

      <ProjectDetailNavigation
        activeTab={activeTab}
        isLocked={isLocked}
        onTabChange={selectProjectTab}
      />

      <div
        ref={contentRef}
        className="min-h-[400px] [overflow-anchor:none]"
        style={
          contentMinHeight === null
            ? undefined
            : { minHeight: `${Math.max(400, contentMinHeight)}px` }
        }
      >
        {activeTab === "overview" && (
          <ProjectOverview
            budget={projectBudgetDashboard}
            userRole={userRole}
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
              tabLabel="Pengeluaran"
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
              tabLabel="Pembayaran"
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
