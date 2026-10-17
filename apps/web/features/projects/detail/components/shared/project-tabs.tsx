"use client";

import { useCan, useCurrentUserProfile } from "@/components/auth/permissions-provider";
import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { toast } from "sonner";
import { RapRabManager } from "./rap-rab-manager";
import { ProjectInvoices } from "../invoices/project-invoices";
import { ExpenseList } from "@/features/expenses/components/lists/expense-list";
import { ExpenseDraftsReadProvider } from "@/features/expenses/components/lists/expense-drafts-read-provider";
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
import {
  DialogOptionList,
  PageState,
  SelectionDialog,
  useSheetPresenceValue,
} from "@/components/ui";
import { ProjectDrawer } from "@/features/projects/list/components/drawers/project-drawer";
import { assignProjectManagerAction } from "@/app/actions/project/crud";
import type { ProjectDrawerData } from "@/features/projects/list/components/drawers/project-drawer-types";

export type {
  ProjectData,
  ProjectTabsProps,
  StockMovement,
  TabId,
} from "../../types/project-tabs-types";

export function ProjectTabs(incomingProps: ProjectTabsProps): React.JSX.Element {
  const can = useCan();
  const user = useCurrentUserProfile();
  const router = useRouter();
  const [assignPmDialogOpen, setAssignPmDialogOpen] = React.useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [isPendingAssign, startAssignTransition] = React.useTransition();
  const [budgetWorkflowActive, setBudgetWorkflowActive] = React.useState(false);
  const [planWorkflowActive, setPlanWorkflowActive] = React.useState(false);
  const [operationsWorkflowActive, setOperationsWorkflowActive] = React.useState(false);
  const [marginWorkflowActive, setMarginWorkflowActive] = React.useState(false);
  const creatingExpense = useUrlSearchParam("new-expense") === "true";
  const creatingVendorBill = useUrlSearchParam("new-vendor-bill") === "true";
  const creatingInvoice = useUrlSearchParam("new-invoice") === "true";
  const [snapshot, setSnapshot] = React.useState(incomingProps);
  const workflowActive =
    budgetWorkflowActive ||
    planWorkflowActive ||
    operationsWorkflowActive ||
    marginWorkflowActive ||
    creatingExpense ||
    creatingVendorBill ||
    creatingInvoice ||
    assignPmDialogOpen ||
    editDrawerOpen ||
    isPendingAssign;
  if (
    snapshot.project.id !== incomingProps.project.id ||
    (!workflowActive && snapshot !== incomingProps)
  ) {
    setSnapshot(incomingProps);
  }
  const {
    project,
    userRole,
    vendorPaymentApprovalThreshold,
    bankAccounts,
    costs,
    vendorBills,
    vendorPayments,
    vendors,
    projectsForForms,
    stockMovements,
    projectStockData,
    projectExpensesSource,
    projectInvoicesSource,
    projectMarginData,
    invoices,
    projectBudgetDashboard,
    projectBudgetSource,
    materialMasterCatalog,
    pricingTemplateCatalog,
    clients = [],
    projectManagers = [],
  } = snapshot;
  const canEdit = can("create:project") || can("update:budget");
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

  function handleAssignPm(pmId: string): void {
    startAssignTransition(async () => {
      const res = await assignProjectManagerAction({
        projectId: project.id,
        projectManagerId: pmId,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Project Manager berhasil ditugaskan ke ${res.data.pmName}`);
      setAssignPmDialogOpen(false);
      router.refresh();
    });
  }

  const editProjectData: ProjectDrawerData = React.useMemo(
    () => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      projectManagerId: project.projectManagerId,
      status: (["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].includes(project.status)
        ? project.status
        : "DRAFT") as ProjectDrawerData["status"],
      financialHealth: (["HEALTHY", "WARNING", "CRITICAL"].includes(project.financialHealth)
        ? project.financialHealth
        : "HEALTHY") as ProjectDrawerData["financialHealth"],
      totalContractValue: Number(project.totalContractValue),
      startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
      endDate: project.endDate ? new Date(project.endDate).toISOString() : null,
      location: project.location,
      roomArea: project.roomArea,
      projectType: project.projectType,
      coverImageUrl: project.coverImageUrl,
      notes: project.notes,
    }),
    [project],
  );

  const editDrawerPresence = useSheetPresenceValue(
    editDrawerOpen ? editProjectData : null,
    editDrawerOpen ? editProjectData.id : null,
  );

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
    projectManagerReady: Boolean(project.projectManager),
    budgetStatus: projectBudgetDashboard?.status,
    raps: project.raps,
    rabEstimates: project.rabEstimates,
  });
  const canActivateProject = can("activate:project");

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
    updateBrowserUrl(
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      "replace",
    );
  }

  return (
    <ExpenseDraftsReadProvider generation={snapshot} projectId={project.id}>
      <div className="space-y-sm">
        <ProjectIdentityHeader
          project={project}
          budgetSource={
            projectBudgetSource ?? { status: projectBudgetDashboard ? "ready" : "missing" }
          }
          effectiveHealth={health.effectiveHealth}
          healthReasons={health.healthReasons}
          canEdit={canEdit}
          onEdit={() => setEditDrawerOpen(true)}
          onAssignPm={() => setAssignPmDialogOpen(true)}
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
              budgetSource={projectBudgetSource}
              storedHealth={project.financialHealth}
              onWorkflowActiveChange={setBudgetWorkflowActive}
              contractValue={contractValue}
              actions={overviewActions}
              readiness={readiness}
              onNavigate={(tab) => selectProjectTab(tab, { source: "action" })}
              onAssignPm={() => setAssignPmDialogOpen(true)}
            />
          )}
          {activeTab === "rab" &&
            (!can("view:rab") ? (
              <PageState
                kind="restricted"
                title="Akses RAB terbatas"
                description="Akun ini tidak memiliki izin melihat RAB proyek."
              />
            ) : rapForManager || rabEstimateForManager ? (
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
                onWorkflowActiveChange={setPlanWorkflowActive}
                exportMetadata={{
                  projectName: project.name,
                  projectAddress: project.location ?? undefined,
                  clientName: project.client?.name ?? undefined,
                  clientPhone: project.client?.phone ?? undefined,
                  clientAddress: project.client?.address ?? undefined,
                }}
              />
            ) : (
              <RabPrerequisiteState onGoToRap={() => selectProjectTab("rap")} />
            ))}

          {activeTab === "rap" &&
            (!can("view:rap") ? (
              <PageState
                kind="restricted"
                title="Akses RAP terbatas"
                description="Akun ini tidak memiliki izin melihat rencana internal proyek."
              />
            ) : (
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
                onWorkflowActiveChange={setPlanWorkflowActive}
              />
            ))}

          {activeTab === "stok" &&
            (!can("view:inventory") ? (
              <PageState
                kind="restricted"
                title="Akses stok terbatas"
                description="Akun ini tidak memiliki izin melihat stok proyek."
              />
            ) : (
              <StockControlPanel
                projectId={project.id}
                rap={rapForManager}
                stockRap={projectStockData?.rap}
                source={
                  projectStockData?.source ??
                  (!can("view:rap")
                    ? {
                        status: "restricted",
                        message: "Sumber kebutuhan material belum dapat diakses.",
                      }
                    : undefined)
                }
                materials={projectStockData?.materials ?? materialOptions}
                stockMovements={stockMovements}
                isLocked={isLocked}
                nextSetupTab={nextSetupTab}
                nextSetupLabel={nextSetupLabel}
                nextSetupIcon={nextSetupIcon}
                setActiveTab={selectProjectTab}
                onWorkflowActiveChange={setOperationsWorkflowActive}
              />
            ))}

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
                  source={projectExpensesSource}
                  assignedScope={user?.dataScope === "ASSIGNED"}
                  canViewFieldClaims={can("view:cost")}
                  onWorkflowActiveChange={setOperationsWorkflowActive}
                  vendorPaymentApprovalThreshold={vendorPaymentApprovalThreshold}
                  projectId={project.id}
                  initialCosts={costs}
                  bankAccounts={bankAccounts}
                  vendorBills={vendorBills}
                  vendorPayments={vendorPayments}
                  vendors={vendors}
                  projects={projectsForForms}
                />
              </div>
            ))}

          {activeTab === "payments" &&
            (!can("view:client_invoice") ? (
              <PageState
                kind="restricted"
                title="Akses pembayaran klien terbatas"
                description="Akun ini tidak memiliki izin melihat tagihan dan pembayaran klien proyek."
              />
            ) : isLocked ? (
              <LockedTabState
                tabLabel="Pembayaran"
                actionLabel={nextSetupLabel}
                actionIcon={nextSetupIcon}
                onAction={() => selectProjectTab(nextSetupTab)}
              />
            ) : (
              <ProjectInvoices
                projectId={project.id}
                projectName={project.name}
                clientName={project.client?.name ?? undefined}
                invoices={invoices}
                bankAccounts={bankAccounts}
                userRole={userRole}
                contractValue={contractValue}
                source={projectInvoicesSource}
                locked={project.status !== "ACTIVE"}
                onWorkflowActiveChange={setOperationsWorkflowActive}
                onNavigateClosing={() => selectProjectTab("profitability")}
              />
            ))}

          {activeTab === "profitability" &&
            (!can("view:profitability") ? (
              <PageState
                kind="restricted"
                title="Akses margin proyek terbatas"
                description="Akun ini tidak memiliki izin melihat profitabilitas proyek."
              />
            ) : (
              <ProfitabilityPanel
                key={project.id}
                projectId={project.id}
                projectStatus={project.status}
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
                budget={projectBudgetDashboard}
                marginData={projectMarginData}
                onWorkflowActiveChange={setMarginWorkflowActive}
              />
            ))}
        </div>

        <SelectionDialog
          open={assignPmDialogOpen}
          title="Tugaskan Project Manager"
          description="Pilih PM yang bertanggung jawab atas perencanaan dan pelaksanaan proyek."
          pending={isPendingAssign}
          onClose={() => setAssignPmDialogOpen(false)}
        >
          <DialogOptionList
            label="Pilih Project Manager"
            value={project.projectManagerId ?? ""}
            options={(projectManagers ?? []).map((pm) => ({
              value: pm.id,
              label: pm.name,
              description: pm.email ?? undefined,
            }))}
            emptyText="Belum ada akun Project Manager aktif"
            onSelect={(option) => handleAssignPm(option.value)}
          />
        </SelectionDialog>

        {canEdit && editDrawerPresence.presentedValue ? (
          <ProjectDrawer
            isOpen={editDrawerPresence.open}
            onClose={() => setEditDrawerOpen(false)}
            onExitComplete={() => {
              editDrawerPresence.handleExitComplete();
              if (!editDrawerOpen) router.refresh();
            }}
            clients={clients ?? []}
            users={(projectManagers ?? []).map((pm) => ({ id: pm.id, name: pm.name }))}
            editProject={editDrawerPresence.presentedValue}
          />
        ) : null}
      </div>
    </ExpenseDraftsReadProvider>
  );
}
