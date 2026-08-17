"use client";

import React from "react";
import { RapRabManager } from "./rap-rab-manager";
import { ProjectInvoices } from "../invoices/project-invoices";
import { ExpenseList } from "@/features/expenses/components/lists/expense-list";
import { useProjectState } from "./project-state-context";
import { ProjectIdentityHeader, ProjectOverview } from "../overview/project-overview";
import { ProjectDetailNavigation } from "../navigation/project-detail-navigation";
import { LockedTabState, RabPrerequisiteState } from "./project-tab-states";
import { StockControlPanel } from "../stock/stock-control-panel";
import { ProfitabilityPanel } from "../overview/profitability-panel";
import { toTabId, type ProjectTabsProps, type TabId } from "../../types/project-tabs-types";
import { buildProjectTabsViewModel } from "../../utils/project-tabs-view-model";
import { updateBrowserUrl, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import { getProjectActivationReadiness } from "@atria/core/project/activation-readiness";
import { ProjectActivationSheet } from "../sheets/project-activation-sheet";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";

export type {
  ProjectData,
  ProjectTabsProps,
  StockMovement,
  TabId,
} from "../../types/project-tabs-types";

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
  const activeTab = toTabId(tabParam, isLocked);
  const {
    containerRef: contentRef,
    containerStyle: contentStyle,
    preserveScrollPosition,
    jumpToOnNextContent,
  } = usePreservedScrollHeight(activeTab);

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
    totalPaid,
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

  function selectProjectTab(tabId: TabId, options?: { readonly source?: "nav" | "action" }): void {
    if (tabId === activeTab) return;
    const source = options?.source ?? "nav";

    if (source === "action") {
      const currentScrollY = window.scrollY;
      const contentTop = contentRef.current
        ? contentRef.current.getBoundingClientRect().top + currentScrollY
        : 0;
      jumpToOnNextContent(contentTop - 110);
    } else {
      preserveScrollPosition();
    }

    const defaultTab = isLocked ? "rap" : "overview";
    const params = new URLSearchParams(window.location.search);
    if (tabId === defaultTab) params.delete("tab");
    else params.set("tab", tabId);
    const query = params.toString();
    updateBrowserUrl(`${window.location.pathname}${query ? `?${query}` : ""}`, "replace");
  }

  return (
    <div className="space-y-sm">
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
        onTabChange={(tab) => selectProjectTab(tab, { source: "nav" })}
      />

      <div ref={contentRef} className="min-h-100 [overflow-anchor:none]" style={contentStyle}>
        {activeTab === "overview" && (
          <ProjectOverview
            budget={projectBudgetDashboard}
            userRole={userRole}
            contractValue={contractValue}
            actions={overviewActions}
            readiness={readiness}
            onNavigate={(tab) => selectProjectTab(tab, { source: "action" })}
          />
        )}
        {activeTab === "rab" &&
          (rapForManager || rabEstimateForManager ? (
            <RapRabManager
              key={`rab-${rapForManager?.id ?? "none"}-${rabEstimateForManager?.id ?? "none"}`}
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
            totalPaid={totalPaid}
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
