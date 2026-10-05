// Explicit compatibility allowlist. Only the API executes these functions.
import { resolveActor } from "@backend/server/actor";
import { getServerSession } from "@backend/lib/server/session";
import { WebRpcAuthorizationError } from "@runtime/web-rpc-errors";
import {
  isDeveloperAccountSimulationEnabled,
  canUseTemporaryPasswordDuringDeveloperSimulation,
} from "@atria/core/auth/developer-account-simulation";

const passwordGateExemptions = new Set<string>([
  "app/actions/administration-staff.changeTemporaryPassword",
  "app/actions/profile/change-own-password.changeOwnPassword",
  "app/actions/auth-navigation.getPostLoginRedirectDestination",
  "server/actor.resolveActor",
]);

async function enforceSessionGate(operation: string): Promise<void> {
  const session = await getServerSession();
  if (!session) return; // Original action guards preserve their unauthorized response contracts.
  if (!session.user.isActive) {
    throw new WebRpcAuthorizationError("UNAUTHORIZED", "Akun tidak aktif.");
  }
  const simulationAllowsPassword = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
    developerActorUserId: session.session.developerActorUserId,
    effectiveRoleId: session.user.roleId,
  });
  if (
    session.user.mustChangePassword &&
    !simulationAllowsPassword &&
    !passwordGateExemptions.has(operation)
  ) {
    throw new WebRpcAuthorizationError(
      "FORBIDDEN",
      "MUST_CHANGE_PASSWORD: Ganti kata sandi sementara terlebih dahulu.",
    );
  }
}

import * as module0 from "@backend/app/actions/onboarding-overview";
import * as module1 from "@backend/app/actions/settings/approval-thresholds";
import * as module2 from "@backend/app/actions/settings/system-materials";
import * as module3 from "@backend/app/actions/settings/pricing-library";
import * as module4 from "@backend/app/actions/settings/material-import";
import * as module5 from "@backend/app/actions/settings/system-item-library";
import * as module6 from "@backend/app/actions/settings/system-budget-expense";
import * as module7 from "@backend/app/actions/settings/system-read";
import * as module8 from "@backend/app/actions/settings/system";
import * as module9 from "@backend/app/actions/auth-navigation";
import * as module10 from "@backend/app/actions/quick-start";
import * as module11 from "@backend/app/actions/onboarding-progress";
import * as module12 from "@backend/app/actions/activity-detail";
import * as module13 from "@backend/app/actions/administration-bootstrap";
import * as module14 from "@backend/app/actions/onboarding-bank-accounts";
import * as module15 from "@backend/app/actions/administration-queries";
import * as module16 from "@backend/app/actions/organization-setup";
import * as module17 from "@backend/app/actions/project/crud";
import * as module18 from "@backend/app/actions/project/category-plan";
import * as module19 from "@backend/app/actions/project/revision-change-order";
import * as module20 from "@backend/app/actions/project/excel-budget";
import * as module21 from "@backend/app/actions/project/workflow-governance";
import * as module22 from "@backend/app/actions/project/rap-setup";
import * as module23 from "@backend/app/actions/project/activation";
import * as module24 from "@backend/app/actions/project/budget-expense-options";
import * as module25 from "@backend/app/actions/project/rap-rab-bundles";
import * as module26 from "@backend/app/actions/project/budget";
import * as module27 from "@backend/app/actions/project/closing";
import * as module28 from "@backend/app/actions/project/project-rap-actions";
import * as module29 from "@backend/app/actions/project/rap-rab-generation";
import * as module30 from "@backend/app/actions/project/rap-rab-approval";
import * as module31 from "@backend/app/actions/project/rab-item-actions";
import * as module32 from "@backend/app/actions/project/revision-change-order-approval";
import * as module33 from "@backend/app/actions/profile/change-own-password";
import * as module34 from "@backend/app/actions/profile/update-own-profile";
import * as module35 from "@backend/app/actions/ai/chat-history";
import * as module36 from "@backend/app/actions/ai/confirm-finance-proposal";
import * as module37 from "@backend/app/actions/ai/process-receipt";
import * as module38 from "@backend/app/actions/ai/confirm-expense-proposal";
import * as module39 from "@backend/app/actions/ai/confirm-material-proposal";
import * as module40 from "@backend/app/actions/ai/confirm-create-user-batch-proposal";
import * as module41 from "@backend/app/actions/ai/confirm-bank-reconciliation-proposal";
import * as module42 from "@backend/app/actions/ai/preferences";
import * as module43 from "@backend/app/actions/ai/confirm-create-role-proposal";
import * as module44 from "@backend/app/actions/ai/confirm-project-proposal";
import * as module45 from "@backend/app/actions/ai/confirm-role-proposal";
import * as module46 from "@backend/app/actions/ai/confirm-create-user-proposal";
import * as module47 from "@backend/app/actions/administration-roles";
import * as module48 from "@backend/app/actions/onboarding-review";
import * as module49 from "@backend/app/actions/administration-staff";
import * as module50 from "@backend/app/actions/finance/vendor-bill-drafts";
import * as module51 from "@backend/app/actions/finance/reconcile-cash-transaction";
import * as module52 from "@backend/app/actions/finance/analyze-bank-statement";
import * as module53 from "@backend/app/actions/finance/field-request-stock";
import * as module54 from "@backend/app/actions/finance/field-requests";
import * as module55 from "@backend/app/actions/finance/get-dashboard-stats";
import * as module56 from "@backend/app/actions/finance/generate-invoice-schedule";
import * as module57 from "@backend/app/actions/finance/reconciliation-statement-actions";
import * as module58 from "@backend/app/actions/finance/schedule-vendor-bill";
import * as module59 from "@backend/app/actions/finance/field-request-payment";
import * as module60 from "@backend/app/actions/finance/field-request-auth";
import * as module61 from "@backend/app/actions/finance/expense-draft-submit";
import * as module62 from "@backend/app/actions/finance/dashboard-overview";
import * as module63 from "@backend/app/actions/finance/expense-draft-storage";
import * as module64 from "@backend/app/actions/finance/pay-vendor-bill";
import * as module65 from "@backend/app/actions/finance/get-invoice-prefill-context";
import * as module66 from "@backend/app/actions/finance/submit-vendor-bill";
import * as module67 from "@backend/app/actions/finance/record-client-payment";
import * as module68 from "@backend/app/actions/finance/bank-account-movements";
import * as module69 from "@backend/app/actions/finance/reconciliation-workspace-query";
import * as module70 from "@backend/app/actions/finance/field-request-review";
import * as module71 from "@backend/app/actions/finance/create-client-invoice";
import * as module72 from "@backend/app/actions/finance/bank-account-management";
import * as module73 from "@backend/app/actions/administration-vendors";
import * as module74 from "@backend/app/actions/developer-account-simulation";
import * as module75 from "@backend/app/actions/material/inventory";
import * as module76 from "@backend/app/actions/material/warehouse-adjustment";
import * as module77 from "@backend/app/actions/material/warehouse-stock-count";
import * as module78 from "@backend/app/actions/material/operations-dashboard";
import * as module79 from "@backend/app/actions/material/inventory-project-movements";
import * as module80 from "@backend/app/actions/material/inventory-movements";
import * as module81 from "@backend/app/actions/material/warehouse-transfer";
import * as module82 from "@backend/app/actions/material/warehouse-receipt-reversal";
import * as module83 from "@backend/app/actions/material/opening-inventory-mutations";
import * as module84 from "@backend/app/actions/material/opening-inventory-queries";
import * as module85 from "@backend/app/actions/material/warehouse";
import * as module86 from "@backend/app/actions/material/goods-receipt";
import * as module87 from "@backend/app/actions/notifications/push-token";
import * as module88 from "@backend/app/actions/notifications/open-notification";
import * as module89 from "@backend/app/actions/notifications/list-notifications";
import * as module90 from "@backend/app/actions/notifications/mark-read";
import * as module91 from "@backend/app/actions/notifications/get-notifications";
import * as module92 from "@backend/app/actions/media/sign-imagekit";
import * as module93 from "@backend/features/settings/server/get-settings-page-data";
import * as module94 from "@backend/features/expenses/server/get-expenses-page-data";
import * as module95 from "@backend/features/expenses/server/get-new-expense-page-data";
import * as module96 from "@backend/features/projects/detail/server/get-project-detail-data";
import * as module97 from "@backend/features/projects/list/server/get-project-list-page-data";
import * as module98 from "@backend/features/finance-dashboard/server/get-finance-dashboard-page-data";
import * as module99 from "@backend/features/navigation/server/home-destination";
import * as module100 from "@backend/features/profile/server/get-profile-page-data";
import * as module101 from "@backend/features/approvals/server/get-approvals-page-data";
import * as module102 from "@backend/features/onboarding/server/get-onboarding-review-page-data";
import * as module103 from "@backend/features/onboarding/server/get-quick-start-workspace-data";
import * as module104 from "@backend/server/actor";

const operations = {
  "app/actions/onboarding-overview.getOwnerOnboardingOverview": module0.getOwnerOnboardingOverview,
  "app/actions/settings/approval-thresholds.getApprovalThresholdSettings":
    module1.getApprovalThresholdSettings,
  "app/actions/settings/approval-thresholds.updateApprovalThresholds":
    module1.updateApprovalThresholds,
  "app/actions/settings/system-materials.updateMaterial": module2.updateMaterial,
  "app/actions/settings/system-materials.updateMaterialInventoryDefaults":
    module2.updateMaterialInventoryDefaults,
  "app/actions/settings/system-materials.archiveMaterial": module2.archiveMaterial,
  "app/actions/settings/system-materials.createMaterialWithInventoryDefaults":
    module2.createMaterialWithInventoryDefaults,
  "app/actions/settings/system-materials.updateMaterialSettingDefaults":
    module2.updateMaterialSettingDefaults,
  "app/actions/settings/system-materials.setMaterialActive": module2.setMaterialActive,
  "app/actions/settings/system-materials.createMaterialCategorySetting":
    module2.createMaterialCategorySetting,
  "app/actions/settings/pricing-library.getPricingTemplates": module3.getPricingTemplates,
  "app/actions/settings/pricing-library.upsertPricingTemplate": module3.upsertPricingTemplate,
  "app/actions/settings/material-import.previewMaterialImport": module4.previewMaterialImport,
  "app/actions/settings/material-import.commitMaterialImport": module4.commitMaterialImport,
  "app/actions/settings/system-item-library.createItemPriceLibraryItem":
    module5.createItemPriceLibraryItem,
  "app/actions/settings/system-item-library.updateItemPriceLibraryItem":
    module5.updateItemPriceLibraryItem,
  "app/actions/settings/system-item-library.archiveItemPriceLibraryItem":
    module5.archiveItemPriceLibraryItem,
  "app/actions/settings/system-item-library.setItemPriceLibraryItemActive":
    module5.setItemPriceLibraryItemActive,
  "app/actions/settings/system-budget-expense.updateBudgetAllocationDefaults":
    module6.updateBudgetAllocationDefaults,
  "app/actions/settings/system-budget-expense.updateBudgetAllocationSetting":
    module6.updateBudgetAllocationSetting,
  "app/actions/settings/system-budget-expense.updateBudgetAllocationCategoryRatio":
    module6.updateBudgetAllocationCategoryRatio,
  "app/actions/settings/system-budget-expense.updateExpenseCategorySetting":
    module6.updateExpenseCategorySetting,
  "app/actions/settings/system-budget-expense.updateExpenseCategoryDetails":
    module6.updateExpenseCategoryDetails,
  "app/actions/settings/system-read.getItemPriceLibrary": module7.getItemPriceLibrary,
  "app/actions/settings/system-read.getSettingsHubOverview": module7.getSettingsHubOverview,
  "app/actions/settings/system-read.getBudgetSettings": module7.getBudgetSettings,
  "app/actions/settings/system-read.getExpenseCategorySettings": module7.getExpenseCategorySettings,
  "app/actions/settings/system-read.getItemLibrarySettings": module7.getItemLibrarySettings,
  "app/actions/settings/system-read.getMaterialSettings": module7.getMaterialSettings,
  "app/actions/settings/system-read.getSettingsOverview": module7.getSettingsOverview,
  "app/actions/settings/system.getItemPriceLibrary": module8.getItemPriceLibrary,
  "app/actions/settings/system.getSettingsHubOverview": module8.getSettingsHubOverview,
  "app/actions/settings/system.getBudgetSettings": module8.getBudgetSettings,
  "app/actions/settings/system.getExpenseCategorySettings": module8.getExpenseCategorySettings,
  "app/actions/settings/system.getItemLibrarySettings": module8.getItemLibrarySettings,
  "app/actions/settings/system.getMaterialSettings": module8.getMaterialSettings,
  "app/actions/settings/system.getSettingsOverview": module8.getSettingsOverview,
  "app/actions/settings/system.updateBudgetAllocationDefaults":
    module8.updateBudgetAllocationDefaults,
  "app/actions/settings/system.updateBudgetAllocationSetting":
    module8.updateBudgetAllocationSetting,
  "app/actions/settings/system.updateBudgetAllocationCategoryRatio":
    module8.updateBudgetAllocationCategoryRatio,
  "app/actions/settings/system.updateExpenseCategorySetting": module8.updateExpenseCategorySetting,
  "app/actions/settings/system.updateExpenseCategoryDetails": module8.updateExpenseCategoryDetails,
  "app/actions/settings/system.createItemPriceLibraryItem": module8.createItemPriceLibraryItem,
  "app/actions/settings/system.updateItemPriceLibraryItem": module8.updateItemPriceLibraryItem,
  "app/actions/settings/system.archiveItemPriceLibraryItem": module8.archiveItemPriceLibraryItem,
  "app/actions/settings/system.setItemPriceLibraryItemActive":
    module8.setItemPriceLibraryItemActive,
  "app/actions/settings/system.updateMaterial": module8.updateMaterial,
  "app/actions/settings/system.updateMaterialInventoryDefaults":
    module8.updateMaterialInventoryDefaults,
  "app/actions/settings/system.archiveMaterial": module8.archiveMaterial,
  "app/actions/settings/system.createMaterialWithInventoryDefaults":
    module8.createMaterialWithInventoryDefaults,
  "app/actions/settings/system.updateMaterialSettingDefaults":
    module8.updateMaterialSettingDefaults,
  "app/actions/settings/system.setMaterialActive": module8.setMaterialActive,
  "app/actions/settings/system.createMaterialCategorySetting":
    module8.createMaterialCategorySetting,
  "app/actions/auth-navigation.getPostLoginRedirectDestination":
    module9.getPostLoginRedirectDestination,
  "app/actions/quick-start.advanceQuickStart": module10.advanceQuickStart,
  "app/actions/quick-start.pauseQuickStart": module10.pauseQuickStart,
  "app/actions/quick-start.createFirstProjectQuickStart": module10.createFirstProjectQuickStart,
  "app/actions/quick-start.setInitialStockReadinessDecision":
    module10.setInitialStockReadinessDecision,
  "app/actions/quick-start.recordQuickStartRetry": module10.recordQuickStartRetry,
  "app/actions/onboarding-progress.advanceOwnerOnboardingStep": module11.advanceOwnerOnboardingStep,
  "app/actions/onboarding-progress.pauseOwnerOnboarding": module11.pauseOwnerOnboarding,
  "app/actions/onboarding-progress.completeOwnerOnboarding": module11.completeOwnerOnboarding,
  "app/actions/activity-detail.getActivityDetail": module12.getActivityDetail,
  "app/actions/administration-bootstrap.getBootstrapStatus": module13.getBootstrapStatus,
  "app/actions/administration-bootstrap.bootstrapFirstOwner": module13.bootstrapFirstOwner,
  "app/actions/onboarding-bank-accounts.getOwnerOnboardingBankAccounts":
    module14.getOwnerOnboardingBankAccounts,
  "app/actions/administration-queries.getAdministrationOverview":
    module15.getAdministrationOverview,
  "app/actions/administration-queries.getProductionReadiness": module15.getProductionReadiness,
  "app/actions/organization-setup.getOrganizationSetupOverview":
    module16.getOrganizationSetupOverview,
  "app/actions/project/crud.createProjectAction": module17.createProjectAction,
  "app/actions/project/crud.updateProjectAction": module17.updateProjectAction,
  "app/actions/project/crud.assignProjectManagerAction": module17.assignProjectManagerAction,
  "app/actions/project/crud.getProjectFormData": module17.getProjectFormData,
  "app/actions/project/category-plan.createProjectCategoryPlanItem":
    module18.createProjectCategoryPlanItem,
  "app/actions/project/category-plan.updateProjectCategoryPlanItem":
    module18.updateProjectCategoryPlanItem,
  "app/actions/project/category-plan.markProjectCategoryPlanItemActive":
    module18.markProjectCategoryPlanItemActive,
  "app/actions/project/category-plan.deleteProjectCategoryPlanItem":
    module18.deleteProjectCategoryPlanItem,
  "app/actions/project/category-plan.getProjectCategoryPlanItems":
    module18.getProjectCategoryPlanItems,
  "app/actions/project/revision-change-order.createRapRevision": module19.createRapRevision,
  "app/actions/project/revision-change-order.createCategoryPlanRevision":
    module19.createCategoryPlanRevision,
  "app/actions/project/revision-change-order.refreshRabLinkedSources":
    module19.refreshRabLinkedSources,
  "app/actions/project/revision-change-order.createProjectChangeOrder":
    module19.createProjectChangeOrder,
  "app/actions/project/revision-change-order.confirmChangeOrderClient":
    module19.confirmChangeOrderClient,
  "app/actions/project/revision-change-order.voidRabRevision": module19.voidRabRevision,
  "app/actions/project/revision-change-order.approveProjectChangeOrder":
    module19.approveProjectChangeOrder,
  "app/actions/project/excel-budget.createProjectBudgetFromRatios":
    module20.createProjectBudgetFromRatios,
  "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation":
    module20.updateProjectBudgetCategoryAllocation,
  "app/actions/project/excel-budget.submitProjectBudget": module20.submitProjectBudget,
  "app/actions/project/excel-budget.approveProjectBudget": module20.approveProjectBudget,
  "app/actions/project/excel-budget.rejectProjectBudget": module20.rejectProjectBudget,
  "app/actions/project/excel-budget.recalculateProjectBudgetCategories":
    module20.recalculateProjectBudgetCategories,
  "app/actions/project/excel-budget.getProjectBudgetDashboard": module20.getProjectBudgetDashboard,
  "app/actions/project/excel-budget.getOwnerBudgetDashboard": module20.getOwnerBudgetDashboard,
  "app/actions/project/workflow-governance.copyPricingTemplateToRap":
    module21.copyPricingTemplateToRap,
  "app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan":
    module21.copyPricingTemplateToCategoryPlan,
  "app/actions/project/workflow-governance.reallocateProjectBudget":
    module21.reallocateProjectBudget,
  "app/actions/project/rap-setup.advanceProjectRapSetup": module22.advanceProjectRapSetup,
  "app/actions/project/rap-setup.setProjectRapScopeSkipped": module22.setProjectRapScopeSkipped,
  "app/actions/project/rap-setup.markProjectCategoryPlanItemDraft":
    module22.markProjectCategoryPlanItemDraft,
  "app/actions/project/rap-setup.finalizeProjectInternalPlan": module22.finalizeProjectInternalPlan,
  "app/actions/project/activation.activateProjectAction": module23.activateProjectAction,
  "app/actions/project/budget-expense-options.getActiveProjectsForExpense":
    module24.getActiveProjectsForExpense,
  "app/actions/project/rap-rab-bundles.addRabManualItem": module25.addRabManualItem,
  "app/actions/project/rap-rab-bundles.createRabBundle": module25.createRabBundle,
  "app/actions/project/rap-rab-bundles.updateRabBundle": module25.updateRabBundle,
  "app/actions/project/rap-rab-bundles.deleteRabBundle": module25.deleteRabBundle,
  "app/actions/project/budget.createProjectBudget": module26.createProjectBudget,
  "app/actions/project/budget.createBudgetItem": module26.createBudgetItem,
  "app/actions/project/budget.submitBudgetForApproval": module26.submitBudgetForApproval,
  "app/actions/project/budget.approveBudget": module26.approveBudget,
  "app/actions/project/budget.rejectBudget": module26.rejectBudget,
  "app/actions/project/budget.getActiveProjectsForExpense": module26.getActiveProjectsForExpense,
  "app/actions/project/closing.getProjectClosingChecklist": module27.getProjectClosingChecklist,
  "app/actions/project/closing.completeProject": module27.completeProject,
  "app/actions/project/project-rap-actions.createProjectRap": module28.createProjectRap,
  "app/actions/project/project-rap-actions.addProjectRapItem": module28.addProjectRapItem,
  "app/actions/project/project-rap-actions.updateProjectRapItem": module28.updateProjectRapItem,
  "app/actions/project/project-rap-actions.deleteProjectRapItem": module28.deleteProjectRapItem,
  "app/actions/project/project-rap-actions.lockProjectRap": module28.lockProjectRap,
  "app/actions/project/rap-rab-generation.generateRabFromRap": module29.generateRabFromRap,
  "app/actions/project/rap-rab-generation.generateRabFromSelectedSources":
    module29.generateRabFromSelectedSources,
  "app/actions/project/rap-rab-approval.approveRabEstimate": module30.approveRabEstimate,
  "app/actions/project/rab-item-actions.updateRabEstimateItem": module31.updateRabEstimateItem,
  "app/actions/project/revision-change-order-approval.approveProjectChangeOrder":
    module32.approveProjectChangeOrder,
  "app/actions/profile/change-own-password.changeOwnPassword": module33.changeOwnPassword,
  "app/actions/profile/update-own-profile.updateOwnProfile": module34.updateOwnProfile,
  "app/actions/ai/chat-history.getLatestAiConversation": module35.getLatestAiConversation,
  "app/actions/ai/chat-history.getAiConversation": module35.getAiConversation,
  "app/actions/ai/chat-history.listAiConversations": module35.listAiConversations,
  "app/actions/ai/chat-history.renameAiConversation": module35.renameAiConversation,
  "app/actions/ai/chat-history.deleteAiConversation": module35.deleteAiConversation,
  "app/actions/ai/chat-history.startAiConversation": module35.startAiConversation,
  "app/actions/ai/confirm-finance-proposal.confirmAiPayVendorBillProposal":
    module36.confirmAiPayVendorBillProposal,
  "app/actions/ai/confirm-finance-proposal.confirmAiRecordClientPaymentProposal":
    module36.confirmAiRecordClientPaymentProposal,
  "app/actions/ai/process-receipt.processReceipt": module37.processReceipt,
  "app/actions/ai/confirm-expense-proposal.confirmAiExpenseProposal":
    module38.confirmAiExpenseProposal,
  "app/actions/ai/confirm-expense-proposal.confirmAiExpenseReviewProposal":
    module38.confirmAiExpenseReviewProposal,
  "app/actions/ai/confirm-expense-proposal.confirmAiDisburseExpenseProposal":
    module38.confirmAiDisburseExpenseProposal,
  "app/actions/ai/confirm-material-proposal.confirmAiGoodsReceiptProposal":
    module39.confirmAiGoodsReceiptProposal,
  "app/actions/ai/confirm-create-user-batch-proposal.confirmAiCreateUserBatchProposal":
    module40.confirmAiCreateUserBatchProposal,
  "app/actions/ai/confirm-bank-reconciliation-proposal.confirmAiBankReconciliationProposal":
    module41.confirmAiBankReconciliationProposal,
  "app/actions/ai/preferences.getAiPreference": module42.getAiPreference,
  "app/actions/ai/preferences.saveAiPreference": module42.saveAiPreference,
  "app/actions/ai/preferences.resetAiPreference": module42.resetAiPreference,
  "app/actions/ai/confirm-create-role-proposal.confirmAiCreateRoleProposal":
    module43.confirmAiCreateRoleProposal,
  "app/actions/ai/confirm-project-proposal.confirmAiCreateProjectProposal":
    module44.confirmAiCreateProjectProposal,
  "app/actions/ai/confirm-project-proposal.confirmAiSetupBudgetProposal":
    module44.confirmAiSetupBudgetProposal,
  "app/actions/ai/confirm-role-proposal.confirmAiRoleChangeProposal":
    module45.confirmAiRoleChangeProposal,
  "app/actions/ai/confirm-create-user-proposal.confirmAiCreateUserProposal":
    module46.confirmAiCreateUserProposal,
  "app/actions/administration-roles.listManagedRoles": module47.listManagedRoles,
  "app/actions/administration-roles.createRole": module47.createRole,
  "app/actions/administration-roles.updateRolePermissions": module47.updateRolePermissions,
  "app/actions/administration-roles.updateRoleDetails": module47.updateRoleDetails,
  "app/actions/administration-roles.deleteRole": module47.deleteRole,
  "app/actions/onboarding-review.hasPendingOnboardingSetupApproval":
    module48.hasPendingOnboardingSetupApproval,
  "app/actions/onboarding-review.getOnboardingReviewState": module48.getOnboardingReviewState,
  "app/actions/administration-staff.createStaffUser": module49.createStaffUser,
  "app/actions/administration-staff.updateStaffUser": module49.updateStaffUser,
  "app/actions/administration-staff.changeTemporaryPassword": module49.changeTemporaryPassword,
  "app/actions/finance/vendor-bill-drafts.listVendorBillDrafts": module50.listVendorBillDrafts,
  "app/actions/finance/vendor-bill-drafts.getVendorBillDraft": module50.getVendorBillDraft,
  "app/actions/finance/vendor-bill-drafts.saveVendorBillDraft": module50.saveVendorBillDraft,
  "app/actions/finance/vendor-bill-drafts.discardVendorBillDraft": module50.discardVendorBillDraft,
  "app/actions/finance/vendor-bill-drafts.submitVendorBillDraft": module50.submitVendorBillDraft,
  "app/actions/finance/reconcile-cash-transaction.reconcileCashTransaction":
    module51.reconcileCashTransaction,
  "app/actions/finance/reconcile-cash-transaction.markReconciliationException":
    module51.markReconciliationException,
  "app/actions/finance/reconcile-cash-transaction.clearReconciliationException":
    module51.clearReconciliationException,
  "app/actions/finance/analyze-bank-statement.analyzeBankStatement": module52.analyzeBankStatement,
  "app/actions/finance/field-request-stock.applyExpenseStockHandling":
    module53.applyExpenseStockHandling,
  "app/actions/finance/field-requests.submitFieldRequest": module54.submitFieldRequest,
  "app/actions/finance/field-requests.submitFieldRequests": module54.submitFieldRequests,
  "app/actions/finance/field-requests.verifyFieldRequest": module54.verifyFieldRequest,
  "app/actions/finance/field-requests.approveFieldRequest": module54.approveFieldRequest,
  "app/actions/finance/field-requests.payFieldRequest": module54.payFieldRequest,
  "app/actions/finance/field-requests.approveVendorPayment": module54.approveVendorPayment,
  "app/actions/finance/get-dashboard-stats.getDashboardStats": module55.getDashboardStats,
  "app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule":
    module56.generateClientInvoiceSchedule,
  "app/actions/finance/reconciliation-statement-actions.recordBankStatementRow":
    module57.recordBankStatementRow,
  "app/actions/finance/reconciliation-statement-actions.importBankStatementCsv":
    module57.importBankStatementCsv,
  "app/actions/finance/reconciliation-statement-actions.importParsedBankStatementRows":
    module57.importParsedBankStatementRows,
  "app/actions/finance/schedule-vendor-bill.scheduleVendorBillPayment":
    module58.scheduleVendorBillPayment,
  "app/actions/finance/field-request-payment.payFieldRequest": module59.payFieldRequest,
  "app/actions/finance/field-request-auth.authorizeFieldRequestAction":
    module60.authorizeFieldRequestAction,
  "app/actions/finance/field-request-auth.authorizeOwnerVendorApproval":
    module60.authorizeOwnerVendorApproval,
  "app/actions/finance/expense-draft-submit.submitExpenseDraft": module61.submitExpenseDraft,
  "app/actions/finance/dashboard-overview.getFinanceDashboardOverview":
    module62.getFinanceDashboardOverview,
  "app/actions/finance/expense-draft-storage.listExpenseDrafts": module63.listExpenseDrafts,
  "app/actions/finance/expense-draft-storage.getExpenseDraft": module63.getExpenseDraft,
  "app/actions/finance/expense-draft-storage.saveExpenseDraft": module63.saveExpenseDraft,
  "app/actions/finance/expense-draft-storage.discardExpenseDraft": module63.discardExpenseDraft,
  "app/actions/finance/pay-vendor-bill.payVendorBill": module64.payVendorBill,
  "app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext":
    module65.getInvoicePrefillContext,
  "app/actions/finance/submit-vendor-bill.submitVendorBill": module66.submitVendorBill,
  "app/actions/finance/submit-vendor-bill.getVendorBillFormData": module66.getVendorBillFormData,
  "app/actions/finance/record-client-payment.recordClientPayment": module67.recordClientPayment,
  "app/actions/finance/bank-account-movements.postManualCashMovement":
    module68.postManualCashMovement,
  "app/actions/finance/bank-account-movements.transferBetweenBankAccounts":
    module68.transferBetweenBankAccounts,
  "app/actions/finance/reconciliation-workspace-query.getReconciliationWorkspace":
    module69.getReconciliationWorkspace,
  "app/actions/finance/field-request-review.verifyFieldRequest": module70.verifyFieldRequest,
  "app/actions/finance/field-request-review.approveFieldRequest": module70.approveFieldRequest,
  "app/actions/finance/field-request-review.approveVendorPayment": module70.approveVendorPayment,
  "app/actions/finance/create-client-invoice.createClientInvoice": module71.createClientInvoice,
  "app/actions/finance/bank-account-management.createBankAccount": module72.createBankAccount,
  "app/actions/finance/bank-account-management.updateBankAccount": module72.updateBankAccount,
  "app/actions/finance/bank-account-management.setBankAccountActive": module72.setBankAccountActive,
  "app/actions/administration-vendors.saveVendor": module73.saveVendor,
  "app/actions/administration-vendors.setVendorActive": module73.setVendorActive,
  "app/actions/developer-account-simulation.getDeveloperAccountSimulationState":
    module74.getDeveloperAccountSimulationState,
  "app/actions/developer-account-simulation.startDeveloperAccountSimulation":
    module74.startDeveloperAccountSimulation,
  "app/actions/developer-account-simulation.stopDeveloperAccountSimulation":
    module74.stopDeveloperAccountSimulation,
  "app/actions/material/inventory.createMaterialCategory": module75.createMaterialCategory,
  "app/actions/material/inventory.createMaterial": module75.createMaterial,
  "app/actions/material/inventory.getMaterialInventory": module75.getMaterialInventory,
  "app/actions/material/inventory.recordStockIn": module75.recordStockIn,
  "app/actions/material/inventory.reserveMaterialForProject": module75.reserveMaterialForProject,
  "app/actions/material/inventory.wasteMaterialForProject": module75.wasteMaterialForProject,
  "app/actions/material/inventory.useMaterialForProject": module75.useMaterialForProject,
  "app/actions/material/inventory.returnMaterialFromProject": module75.returnMaterialFromProject,
  "app/actions/material/inventory.adjustMaterialStock": module75.adjustMaterialStock,
  "app/actions/material/inventory.getMaterialShortages": module75.getMaterialShortages,
  "app/actions/material/warehouse-adjustment.emergencyAdjustStock": module76.emergencyAdjustStock,
  "app/actions/material/warehouse-stock-count.saveStockCount": module77.saveStockCount,
  "app/actions/material/warehouse-stock-count.submitStockCount": module77.submitStockCount,
  "app/actions/material/warehouse-stock-count.approveStockCount": module77.approveStockCount,
  "app/actions/material/warehouse-stock-count.rejectStockCount": module77.rejectStockCount,
  "app/actions/material/operations-dashboard.getMaterialMovementPage":
    module78.getMaterialMovementPage,
  "app/actions/material/operations-dashboard.getMaterialOperationsDashboard":
    module78.getMaterialOperationsDashboard,
  "app/actions/material/inventory-project-movements.wasteMaterialForProject":
    module79.wasteMaterialForProject,
  "app/actions/material/inventory-project-movements.useMaterialForProject":
    module79.useMaterialForProject,
  "app/actions/material/inventory-project-movements.returnMaterialFromProject":
    module79.returnMaterialFromProject,
  "app/actions/material/inventory-movements.recordStockIn": module80.recordStockIn,
  "app/actions/material/inventory-movements.reserveMaterialForProject":
    module80.reserveMaterialForProject,
  "app/actions/material/inventory-movements.wasteMaterialForProject":
    module80.wasteMaterialForProject,
  "app/actions/material/inventory-movements.useMaterialForProject": module80.useMaterialForProject,
  "app/actions/material/inventory-movements.returnMaterialFromProject":
    module80.returnMaterialFromProject,
  "app/actions/material/inventory-movements.adjustMaterialStock": module80.adjustMaterialStock,
  "app/actions/material/warehouse-transfer.createStockTransfer": module81.createStockTransfer,
  "app/actions/material/warehouse-receipt-reversal.requestGoodsReceiptReversal":
    module82.requestGoodsReceiptReversal,
  "app/actions/material/warehouse-receipt-reversal.approveGoodsReceiptReversal":
    module82.approveGoodsReceiptReversal,
  "app/actions/material/warehouse-receipt-reversal.rejectGoodsReceiptReversal":
    module82.rejectGoodsReceiptReversal,
  "app/actions/material/opening-inventory-mutations.createInventoryOpening":
    module83.createInventoryOpening,
  "app/actions/material/opening-inventory-mutations.decideInventoryOpening":
    module83.decideInventoryOpening,
  "app/actions/material/opening-inventory-mutations.reverseInventoryOpening":
    module83.reverseInventoryOpening,
  "app/actions/material/opening-inventory-queries.getInitialStockCandidates":
    module84.getInitialStockCandidates,
  "app/actions/material/opening-inventory-queries.previewInitialStockImport":
    module84.previewInitialStockImport,
  "app/actions/material/opening-inventory-queries.getInventoryOpeningBatches":
    module84.getInventoryOpeningBatches,
  "app/actions/material/warehouse.createInventoryLocation": module85.createInventoryLocation,
  "app/actions/material/goods-receipt.postGoodsReceipt": module86.postGoodsReceipt,
  "app/actions/notifications/push-token.registerPushTokenAction": module87.registerPushTokenAction,
  "app/actions/notifications/push-token.unregisterPushTokenAction":
    module87.unregisterPushTokenAction,
  "app/actions/notifications/open-notification.openNotificationAction":
    module88.openNotificationAction,
  "app/actions/notifications/list-notifications.listNotificationsAction":
    module89.listNotificationsAction,
  "app/actions/notifications/mark-read.markNotificationReadAction":
    module90.markNotificationReadAction,
  "app/actions/notifications/mark-read.markAllNotificationsReadAction":
    module90.markAllNotificationsReadAction,
  "app/actions/notifications/get-notifications.getNotificationsAction":
    module91.getNotificationsAction,
  "app/actions/media/sign-imagekit.signImagekit": module92.signImagekit,
  "features/settings/server/get-settings-page-data.getSettingsPageData":
    module93.getSettingsPageData,
  "features/expenses/server/get-expenses-page-data.getExpensesPageData":
    module94.getExpensesPageData,
  "features/expenses/server/get-new-expense-page-data.getNewExpensePageData":
    module95.getNewExpensePageData,
  "features/projects/detail/server/get-project-detail-data.getProjectDetailData":
    module96.getProjectDetailData,
  "features/projects/list/server/get-project-list-page-data.getProjectListPageData":
    module97.getProjectListPageData,
  "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData":
    module98.getFinanceDashboardPageData,
  "features/navigation/server/home-destination.resolveHomeDestination":
    module99.resolveHomeDestination,
  "features/profile/server/get-profile-page-data.getProfilePageData": module100.getProfilePageData,
  "features/approvals/server/get-approvals-page-data.getApprovalsPageData":
    module101.getApprovalsPageData,
  "features/onboarding/server/get-onboarding-review-page-data.getOnboardingReviewPageData":
    module102.getOnboardingReviewPageData,
  "features/onboarding/server/get-quick-start-workspace-data.getQuickStartWorkspaceData":
    module103.getQuickStartWorkspaceData,
  "server/actor.resolveActor": module104.resolveActor,
};

export type WebRpcOperation = keyof typeof operations;
export type WebRpcArgs<K extends WebRpcOperation> = Parameters<(typeof operations)[K]>;
export type WebRpcResult<K extends WebRpcOperation> = Awaited<ReturnType<(typeof operations)[K]>>;

export function isWebOperation(operation: string): operation is WebRpcOperation {
  return Object.hasOwn(operations, operation);
}

export async function invokeWebOperation(
  operation: string,
  args: readonly unknown[],
): Promise<unknown> {
  if (!isWebOperation(operation)) throw new Error("NOT_FOUND: Operasi tidak tersedia.");
  await enforceSessionGate(operation);
  switch (operation) {
    case "app/actions/onboarding-overview.getOwnerOnboardingOverview": {
      const parameters = [...args] as Parameters<typeof module0.getOwnerOnboardingOverview>;
      return module0.getOwnerOnboardingOverview(...parameters);
    }
    case "app/actions/settings/approval-thresholds.getApprovalThresholdSettings": {
      const parameters = [...args] as Parameters<typeof module1.getApprovalThresholdSettings>;
      return module1.getApprovalThresholdSettings(...parameters);
    }
    case "app/actions/settings/approval-thresholds.updateApprovalThresholds": {
      const parameters = [...args] as Parameters<typeof module1.updateApprovalThresholds>;
      return module1.updateApprovalThresholds(...parameters);
    }
    case "app/actions/settings/system-materials.updateMaterial": {
      const parameters = [...args] as Parameters<typeof module2.updateMaterial>;
      return module2.updateMaterial(...parameters);
    }
    case "app/actions/settings/system-materials.updateMaterialInventoryDefaults": {
      const parameters = [...args] as Parameters<typeof module2.updateMaterialInventoryDefaults>;
      return module2.updateMaterialInventoryDefaults(...parameters);
    }
    case "app/actions/settings/system-materials.archiveMaterial": {
      const parameters = [...args] as Parameters<typeof module2.archiveMaterial>;
      return module2.archiveMaterial(...parameters);
    }
    case "app/actions/settings/system-materials.createMaterialWithInventoryDefaults": {
      const parameters = [...args] as Parameters<
        typeof module2.createMaterialWithInventoryDefaults
      >;
      return module2.createMaterialWithInventoryDefaults(...parameters);
    }
    case "app/actions/settings/system-materials.updateMaterialSettingDefaults": {
      const parameters = [...args] as Parameters<typeof module2.updateMaterialSettingDefaults>;
      return module2.updateMaterialSettingDefaults(...parameters);
    }
    case "app/actions/settings/system-materials.setMaterialActive": {
      const parameters = [...args] as Parameters<typeof module2.setMaterialActive>;
      return module2.setMaterialActive(...parameters);
    }
    case "app/actions/settings/system-materials.createMaterialCategorySetting": {
      const parameters = [...args] as Parameters<typeof module2.createMaterialCategorySetting>;
      return module2.createMaterialCategorySetting(...parameters);
    }
    case "app/actions/settings/pricing-library.getPricingTemplates": {
      const parameters = [...args] as Parameters<typeof module3.getPricingTemplates>;
      return module3.getPricingTemplates(...parameters);
    }
    case "app/actions/settings/pricing-library.upsertPricingTemplate": {
      const parameters = [...args] as Parameters<typeof module3.upsertPricingTemplate>;
      return module3.upsertPricingTemplate(...parameters);
    }
    case "app/actions/settings/material-import.previewMaterialImport": {
      const parameters = [...args] as Parameters<typeof module4.previewMaterialImport>;
      return module4.previewMaterialImport(...parameters);
    }
    case "app/actions/settings/material-import.commitMaterialImport": {
      const parameters = [...args] as Parameters<typeof module4.commitMaterialImport>;
      return module4.commitMaterialImport(...parameters);
    }
    case "app/actions/settings/system-item-library.createItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module5.createItemPriceLibraryItem>;
      return module5.createItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system-item-library.updateItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module5.updateItemPriceLibraryItem>;
      return module5.updateItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system-item-library.archiveItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module5.archiveItemPriceLibraryItem>;
      return module5.archiveItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system-item-library.setItemPriceLibraryItemActive": {
      const parameters = [...args] as Parameters<typeof module5.setItemPriceLibraryItemActive>;
      return module5.setItemPriceLibraryItemActive(...parameters);
    }
    case "app/actions/settings/system-budget-expense.updateBudgetAllocationDefaults": {
      const parameters = [...args] as Parameters<typeof module6.updateBudgetAllocationDefaults>;
      return module6.updateBudgetAllocationDefaults(...parameters);
    }
    case "app/actions/settings/system-budget-expense.updateBudgetAllocationSetting": {
      const parameters = [...args] as Parameters<typeof module6.updateBudgetAllocationSetting>;
      return module6.updateBudgetAllocationSetting(...parameters);
    }
    case "app/actions/settings/system-budget-expense.updateBudgetAllocationCategoryRatio": {
      const parameters = [...args] as Parameters<
        typeof module6.updateBudgetAllocationCategoryRatio
      >;
      return module6.updateBudgetAllocationCategoryRatio(...parameters);
    }
    case "app/actions/settings/system-budget-expense.updateExpenseCategorySetting": {
      const parameters = [...args] as Parameters<typeof module6.updateExpenseCategorySetting>;
      return module6.updateExpenseCategorySetting(...parameters);
    }
    case "app/actions/settings/system-budget-expense.updateExpenseCategoryDetails": {
      const parameters = [...args] as Parameters<typeof module6.updateExpenseCategoryDetails>;
      return module6.updateExpenseCategoryDetails(...parameters);
    }
    case "app/actions/settings/system-read.getItemPriceLibrary": {
      const parameters = [...args] as Parameters<typeof module7.getItemPriceLibrary>;
      return module7.getItemPriceLibrary(...parameters);
    }
    case "app/actions/settings/system-read.getSettingsHubOverview": {
      const parameters = [...args] as Parameters<typeof module7.getSettingsHubOverview>;
      return module7.getSettingsHubOverview(...parameters);
    }
    case "app/actions/settings/system-read.getBudgetSettings": {
      const parameters = [...args] as Parameters<typeof module7.getBudgetSettings>;
      return module7.getBudgetSettings(...parameters);
    }
    case "app/actions/settings/system-read.getExpenseCategorySettings": {
      const parameters = [...args] as Parameters<typeof module7.getExpenseCategorySettings>;
      return module7.getExpenseCategorySettings(...parameters);
    }
    case "app/actions/settings/system-read.getItemLibrarySettings": {
      const parameters = [...args] as Parameters<typeof module7.getItemLibrarySettings>;
      return module7.getItemLibrarySettings(...parameters);
    }
    case "app/actions/settings/system-read.getMaterialSettings": {
      const parameters = [...args] as Parameters<typeof module7.getMaterialSettings>;
      return module7.getMaterialSettings(...parameters);
    }
    case "app/actions/settings/system-read.getSettingsOverview": {
      const parameters = [...args] as Parameters<typeof module7.getSettingsOverview>;
      return module7.getSettingsOverview(...parameters);
    }
    case "app/actions/settings/system.getItemPriceLibrary": {
      const parameters = [...args] as Parameters<typeof module8.getItemPriceLibrary>;
      return module8.getItemPriceLibrary(...parameters);
    }
    case "app/actions/settings/system.getSettingsHubOverview": {
      const parameters = [...args] as Parameters<typeof module8.getSettingsHubOverview>;
      return module8.getSettingsHubOverview(...parameters);
    }
    case "app/actions/settings/system.getBudgetSettings": {
      const parameters = [...args] as Parameters<typeof module8.getBudgetSettings>;
      return module8.getBudgetSettings(...parameters);
    }
    case "app/actions/settings/system.getExpenseCategorySettings": {
      const parameters = [...args] as Parameters<typeof module8.getExpenseCategorySettings>;
      return module8.getExpenseCategorySettings(...parameters);
    }
    case "app/actions/settings/system.getItemLibrarySettings": {
      const parameters = [...args] as Parameters<typeof module8.getItemLibrarySettings>;
      return module8.getItemLibrarySettings(...parameters);
    }
    case "app/actions/settings/system.getMaterialSettings": {
      const parameters = [...args] as Parameters<typeof module8.getMaterialSettings>;
      return module8.getMaterialSettings(...parameters);
    }
    case "app/actions/settings/system.getSettingsOverview": {
      const parameters = [...args] as Parameters<typeof module8.getSettingsOverview>;
      return module8.getSettingsOverview(...parameters);
    }
    case "app/actions/settings/system.updateBudgetAllocationDefaults": {
      const parameters = [...args] as Parameters<typeof module8.updateBudgetAllocationDefaults>;
      return module8.updateBudgetAllocationDefaults(...parameters);
    }
    case "app/actions/settings/system.updateBudgetAllocationSetting": {
      const parameters = [...args] as Parameters<typeof module8.updateBudgetAllocationSetting>;
      return module8.updateBudgetAllocationSetting(...parameters);
    }
    case "app/actions/settings/system.updateBudgetAllocationCategoryRatio": {
      const parameters = [...args] as Parameters<
        typeof module8.updateBudgetAllocationCategoryRatio
      >;
      return module8.updateBudgetAllocationCategoryRatio(...parameters);
    }
    case "app/actions/settings/system.updateExpenseCategorySetting": {
      const parameters = [...args] as Parameters<typeof module8.updateExpenseCategorySetting>;
      return module8.updateExpenseCategorySetting(...parameters);
    }
    case "app/actions/settings/system.updateExpenseCategoryDetails": {
      const parameters = [...args] as Parameters<typeof module8.updateExpenseCategoryDetails>;
      return module8.updateExpenseCategoryDetails(...parameters);
    }
    case "app/actions/settings/system.createItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module8.createItemPriceLibraryItem>;
      return module8.createItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system.updateItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module8.updateItemPriceLibraryItem>;
      return module8.updateItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system.archiveItemPriceLibraryItem": {
      const parameters = [...args] as Parameters<typeof module8.archiveItemPriceLibraryItem>;
      return module8.archiveItemPriceLibraryItem(...parameters);
    }
    case "app/actions/settings/system.setItemPriceLibraryItemActive": {
      const parameters = [...args] as Parameters<typeof module8.setItemPriceLibraryItemActive>;
      return module8.setItemPriceLibraryItemActive(...parameters);
    }
    case "app/actions/settings/system.updateMaterial": {
      const parameters = [...args] as Parameters<typeof module8.updateMaterial>;
      return module8.updateMaterial(...parameters);
    }
    case "app/actions/settings/system.updateMaterialInventoryDefaults": {
      const parameters = [...args] as Parameters<typeof module8.updateMaterialInventoryDefaults>;
      return module8.updateMaterialInventoryDefaults(...parameters);
    }
    case "app/actions/settings/system.archiveMaterial": {
      const parameters = [...args] as Parameters<typeof module8.archiveMaterial>;
      return module8.archiveMaterial(...parameters);
    }
    case "app/actions/settings/system.createMaterialWithInventoryDefaults": {
      const parameters = [...args] as Parameters<
        typeof module8.createMaterialWithInventoryDefaults
      >;
      return module8.createMaterialWithInventoryDefaults(...parameters);
    }
    case "app/actions/settings/system.updateMaterialSettingDefaults": {
      const parameters = [...args] as Parameters<typeof module8.updateMaterialSettingDefaults>;
      return module8.updateMaterialSettingDefaults(...parameters);
    }
    case "app/actions/settings/system.setMaterialActive": {
      const parameters = [...args] as Parameters<typeof module8.setMaterialActive>;
      return module8.setMaterialActive(...parameters);
    }
    case "app/actions/settings/system.createMaterialCategorySetting": {
      const parameters = [...args] as Parameters<typeof module8.createMaterialCategorySetting>;
      return module8.createMaterialCategorySetting(...parameters);
    }
    case "app/actions/auth-navigation.getPostLoginRedirectDestination": {
      const parameters = [...args] as Parameters<typeof module9.getPostLoginRedirectDestination>;
      return module9.getPostLoginRedirectDestination(...parameters);
    }
    case "app/actions/quick-start.advanceQuickStart": {
      const parameters = [...args] as Parameters<typeof module10.advanceQuickStart>;
      return module10.advanceQuickStart(...parameters);
    }
    case "app/actions/quick-start.pauseQuickStart": {
      const parameters = [...args] as Parameters<typeof module10.pauseQuickStart>;
      return module10.pauseQuickStart(...parameters);
    }
    case "app/actions/quick-start.createFirstProjectQuickStart": {
      const parameters = [...args] as Parameters<typeof module10.createFirstProjectQuickStart>;
      return module10.createFirstProjectQuickStart(...parameters);
    }
    case "app/actions/quick-start.setInitialStockReadinessDecision": {
      const parameters = [...args] as Parameters<typeof module10.setInitialStockReadinessDecision>;
      return module10.setInitialStockReadinessDecision(...parameters);
    }
    case "app/actions/quick-start.recordQuickStartRetry": {
      const parameters = [...args] as Parameters<typeof module10.recordQuickStartRetry>;
      return module10.recordQuickStartRetry(...parameters);
    }
    case "app/actions/onboarding-progress.advanceOwnerOnboardingStep": {
      const parameters = [...args] as Parameters<typeof module11.advanceOwnerOnboardingStep>;
      return module11.advanceOwnerOnboardingStep(...parameters);
    }
    case "app/actions/onboarding-progress.pauseOwnerOnboarding": {
      const parameters = [...args] as Parameters<typeof module11.pauseOwnerOnboarding>;
      return module11.pauseOwnerOnboarding(...parameters);
    }
    case "app/actions/onboarding-progress.completeOwnerOnboarding": {
      const parameters = [...args] as Parameters<typeof module11.completeOwnerOnboarding>;
      return module11.completeOwnerOnboarding(...parameters);
    }
    case "app/actions/activity-detail.getActivityDetail": {
      const parameters = [...args] as Parameters<typeof module12.getActivityDetail>;
      return module12.getActivityDetail(...parameters);
    }
    case "app/actions/administration-bootstrap.getBootstrapStatus": {
      const parameters = [...args] as Parameters<typeof module13.getBootstrapStatus>;
      return module13.getBootstrapStatus(...parameters);
    }
    case "app/actions/administration-bootstrap.bootstrapFirstOwner": {
      const parameters = [...args] as Parameters<typeof module13.bootstrapFirstOwner>;
      return module13.bootstrapFirstOwner(...parameters);
    }
    case "app/actions/onboarding-bank-accounts.getOwnerOnboardingBankAccounts": {
      const parameters = [...args] as Parameters<typeof module14.getOwnerOnboardingBankAccounts>;
      return module14.getOwnerOnboardingBankAccounts(...parameters);
    }
    case "app/actions/administration-queries.getAdministrationOverview": {
      const parameters = [...args] as Parameters<typeof module15.getAdministrationOverview>;
      return module15.getAdministrationOverview(...parameters);
    }
    case "app/actions/administration-queries.getProductionReadiness": {
      const parameters = [...args] as Parameters<typeof module15.getProductionReadiness>;
      return module15.getProductionReadiness(...parameters);
    }
    case "app/actions/organization-setup.getOrganizationSetupOverview": {
      const parameters = [...args] as Parameters<typeof module16.getOrganizationSetupOverview>;
      return module16.getOrganizationSetupOverview(...parameters);
    }
    case "app/actions/project/crud.createProjectAction": {
      const parameters = [...args] as Parameters<typeof module17.createProjectAction>;
      return module17.createProjectAction(...parameters);
    }
    case "app/actions/project/crud.updateProjectAction": {
      const parameters = [...args] as Parameters<typeof module17.updateProjectAction>;
      return module17.updateProjectAction(...parameters);
    }
    case "app/actions/project/crud.assignProjectManagerAction": {
      const parameters = [...args] as Parameters<typeof module17.assignProjectManagerAction>;
      return module17.assignProjectManagerAction(...parameters);
    }
    case "app/actions/project/crud.getProjectFormData": {
      const parameters = [...args] as Parameters<typeof module17.getProjectFormData>;
      return module17.getProjectFormData(...parameters);
    }
    case "app/actions/project/category-plan.createProjectCategoryPlanItem": {
      const parameters = [...args] as Parameters<typeof module18.createProjectCategoryPlanItem>;
      return module18.createProjectCategoryPlanItem(...parameters);
    }
    case "app/actions/project/category-plan.updateProjectCategoryPlanItem": {
      const parameters = [...args] as Parameters<typeof module18.updateProjectCategoryPlanItem>;
      return module18.updateProjectCategoryPlanItem(...parameters);
    }
    case "app/actions/project/category-plan.markProjectCategoryPlanItemActive": {
      const parameters = [...args] as Parameters<typeof module18.markProjectCategoryPlanItemActive>;
      return module18.markProjectCategoryPlanItemActive(...parameters);
    }
    case "app/actions/project/category-plan.deleteProjectCategoryPlanItem": {
      const parameters = [...args] as Parameters<typeof module18.deleteProjectCategoryPlanItem>;
      return module18.deleteProjectCategoryPlanItem(...parameters);
    }
    case "app/actions/project/category-plan.getProjectCategoryPlanItems": {
      const parameters = [...args] as Parameters<typeof module18.getProjectCategoryPlanItems>;
      return module18.getProjectCategoryPlanItems(...parameters);
    }
    case "app/actions/project/revision-change-order.createRapRevision": {
      const parameters = [...args] as Parameters<typeof module19.createRapRevision>;
      return module19.createRapRevision(...parameters);
    }
    case "app/actions/project/revision-change-order.createCategoryPlanRevision": {
      const parameters = [...args] as Parameters<typeof module19.createCategoryPlanRevision>;
      return module19.createCategoryPlanRevision(...parameters);
    }
    case "app/actions/project/revision-change-order.refreshRabLinkedSources": {
      const parameters = [...args] as Parameters<typeof module19.refreshRabLinkedSources>;
      return module19.refreshRabLinkedSources(...parameters);
    }
    case "app/actions/project/revision-change-order.createProjectChangeOrder": {
      const parameters = [...args] as Parameters<typeof module19.createProjectChangeOrder>;
      return module19.createProjectChangeOrder(...parameters);
    }
    case "app/actions/project/revision-change-order.confirmChangeOrderClient": {
      const parameters = [...args] as Parameters<typeof module19.confirmChangeOrderClient>;
      return module19.confirmChangeOrderClient(...parameters);
    }
    case "app/actions/project/revision-change-order.voidRabRevision": {
      const parameters = [...args] as Parameters<typeof module19.voidRabRevision>;
      return module19.voidRabRevision(...parameters);
    }
    case "app/actions/project/revision-change-order.approveProjectChangeOrder": {
      const parameters = [...args] as Parameters<typeof module19.approveProjectChangeOrder>;
      return module19.approveProjectChangeOrder(...parameters);
    }
    case "app/actions/project/excel-budget.createProjectBudgetFromRatios": {
      const parameters = [...args] as Parameters<typeof module20.createProjectBudgetFromRatios>;
      return module20.createProjectBudgetFromRatios(...parameters);
    }
    case "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation": {
      const parameters = [...args] as Parameters<
        typeof module20.updateProjectBudgetCategoryAllocation
      >;
      return module20.updateProjectBudgetCategoryAllocation(...parameters);
    }
    case "app/actions/project/excel-budget.submitProjectBudget": {
      const parameters = [...args] as Parameters<typeof module20.submitProjectBudget>;
      return module20.submitProjectBudget(...parameters);
    }
    case "app/actions/project/excel-budget.approveProjectBudget": {
      const parameters = [...args] as Parameters<typeof module20.approveProjectBudget>;
      return module20.approveProjectBudget(...parameters);
    }
    case "app/actions/project/excel-budget.rejectProjectBudget": {
      const parameters = [...args] as Parameters<typeof module20.rejectProjectBudget>;
      return module20.rejectProjectBudget(...parameters);
    }
    case "app/actions/project/excel-budget.recalculateProjectBudgetCategories": {
      const parameters = [...args] as Parameters<
        typeof module20.recalculateProjectBudgetCategories
      >;
      return module20.recalculateProjectBudgetCategories(...parameters);
    }
    case "app/actions/project/excel-budget.getProjectBudgetDashboard": {
      const parameters = [...args] as Parameters<typeof module20.getProjectBudgetDashboard>;
      return module20.getProjectBudgetDashboard(...parameters);
    }
    case "app/actions/project/excel-budget.getOwnerBudgetDashboard": {
      const parameters = [...args] as Parameters<typeof module20.getOwnerBudgetDashboard>;
      return module20.getOwnerBudgetDashboard(...parameters);
    }
    case "app/actions/project/workflow-governance.copyPricingTemplateToRap": {
      const parameters = [...args] as Parameters<typeof module21.copyPricingTemplateToRap>;
      return module21.copyPricingTemplateToRap(...parameters);
    }
    case "app/actions/project/workflow-governance.copyPricingTemplateToCategoryPlan": {
      const parameters = [...args] as Parameters<typeof module21.copyPricingTemplateToCategoryPlan>;
      return module21.copyPricingTemplateToCategoryPlan(...parameters);
    }
    case "app/actions/project/workflow-governance.reallocateProjectBudget": {
      const parameters = [...args] as Parameters<typeof module21.reallocateProjectBudget>;
      return module21.reallocateProjectBudget(...parameters);
    }
    case "app/actions/project/rap-setup.advanceProjectRapSetup": {
      const parameters = [...args] as Parameters<typeof module22.advanceProjectRapSetup>;
      return module22.advanceProjectRapSetup(...parameters);
    }
    case "app/actions/project/rap-setup.setProjectRapScopeSkipped": {
      const parameters = [...args] as Parameters<typeof module22.setProjectRapScopeSkipped>;
      return module22.setProjectRapScopeSkipped(...parameters);
    }
    case "app/actions/project/rap-setup.markProjectCategoryPlanItemDraft": {
      const parameters = [...args] as Parameters<typeof module22.markProjectCategoryPlanItemDraft>;
      return module22.markProjectCategoryPlanItemDraft(...parameters);
    }
    case "app/actions/project/rap-setup.finalizeProjectInternalPlan": {
      const parameters = [...args] as Parameters<typeof module22.finalizeProjectInternalPlan>;
      return module22.finalizeProjectInternalPlan(...parameters);
    }
    case "app/actions/project/activation.activateProjectAction": {
      const parameters = [...args] as Parameters<typeof module23.activateProjectAction>;
      return module23.activateProjectAction(...parameters);
    }
    case "app/actions/project/budget-expense-options.getActiveProjectsForExpense": {
      const parameters = [...args] as Parameters<typeof module24.getActiveProjectsForExpense>;
      return module24.getActiveProjectsForExpense(...parameters);
    }
    case "app/actions/project/rap-rab-bundles.addRabManualItem": {
      const parameters = [...args] as Parameters<typeof module25.addRabManualItem>;
      return module25.addRabManualItem(...parameters);
    }
    case "app/actions/project/rap-rab-bundles.createRabBundle": {
      const parameters = [...args] as Parameters<typeof module25.createRabBundle>;
      return module25.createRabBundle(...parameters);
    }
    case "app/actions/project/rap-rab-bundles.updateRabBundle": {
      const parameters = [...args] as Parameters<typeof module25.updateRabBundle>;
      return module25.updateRabBundle(...parameters);
    }
    case "app/actions/project/rap-rab-bundles.deleteRabBundle": {
      const parameters = [...args] as Parameters<typeof module25.deleteRabBundle>;
      return module25.deleteRabBundle(...parameters);
    }
    case "app/actions/project/budget.createProjectBudget": {
      const parameters = [...args] as Parameters<typeof module26.createProjectBudget>;
      return module26.createProjectBudget(...parameters);
    }
    case "app/actions/project/budget.createBudgetItem": {
      const parameters = [...args] as Parameters<typeof module26.createBudgetItem>;
      return module26.createBudgetItem(...parameters);
    }
    case "app/actions/project/budget.submitBudgetForApproval": {
      const parameters = [...args] as Parameters<typeof module26.submitBudgetForApproval>;
      return module26.submitBudgetForApproval(...parameters);
    }
    case "app/actions/project/budget.approveBudget": {
      const parameters = [...args] as Parameters<typeof module26.approveBudget>;
      return module26.approveBudget(...parameters);
    }
    case "app/actions/project/budget.rejectBudget": {
      const parameters = [...args] as Parameters<typeof module26.rejectBudget>;
      return module26.rejectBudget(...parameters);
    }
    case "app/actions/project/budget.getActiveProjectsForExpense": {
      const parameters = [...args] as Parameters<typeof module26.getActiveProjectsForExpense>;
      return module26.getActiveProjectsForExpense(...parameters);
    }
    case "app/actions/project/closing.getProjectClosingChecklist": {
      const parameters = [...args] as Parameters<typeof module27.getProjectClosingChecklist>;
      return module27.getProjectClosingChecklist(...parameters);
    }
    case "app/actions/project/closing.completeProject": {
      const parameters = [...args] as Parameters<typeof module27.completeProject>;
      return module27.completeProject(...parameters);
    }
    case "app/actions/project/project-rap-actions.createProjectRap": {
      const parameters = [...args] as Parameters<typeof module28.createProjectRap>;
      return module28.createProjectRap(...parameters);
    }
    case "app/actions/project/project-rap-actions.addProjectRapItem": {
      const parameters = [...args] as Parameters<typeof module28.addProjectRapItem>;
      return module28.addProjectRapItem(...parameters);
    }
    case "app/actions/project/project-rap-actions.updateProjectRapItem": {
      const parameters = [...args] as Parameters<typeof module28.updateProjectRapItem>;
      return module28.updateProjectRapItem(...parameters);
    }
    case "app/actions/project/project-rap-actions.deleteProjectRapItem": {
      const parameters = [...args] as Parameters<typeof module28.deleteProjectRapItem>;
      return module28.deleteProjectRapItem(...parameters);
    }
    case "app/actions/project/project-rap-actions.lockProjectRap": {
      const parameters = [...args] as Parameters<typeof module28.lockProjectRap>;
      return module28.lockProjectRap(...parameters);
    }
    case "app/actions/project/rap-rab-generation.generateRabFromRap": {
      const parameters = [...args] as Parameters<typeof module29.generateRabFromRap>;
      return module29.generateRabFromRap(...parameters);
    }
    case "app/actions/project/rap-rab-generation.generateRabFromSelectedSources": {
      const parameters = [...args] as Parameters<typeof module29.generateRabFromSelectedSources>;
      return module29.generateRabFromSelectedSources(...parameters);
    }
    case "app/actions/project/rap-rab-approval.approveRabEstimate": {
      const parameters = [...args] as Parameters<typeof module30.approveRabEstimate>;
      return module30.approveRabEstimate(...parameters);
    }
    case "app/actions/project/rab-item-actions.updateRabEstimateItem": {
      const parameters = [...args] as Parameters<typeof module31.updateRabEstimateItem>;
      return module31.updateRabEstimateItem(...parameters);
    }
    case "app/actions/project/revision-change-order-approval.approveProjectChangeOrder": {
      const parameters = [...args] as Parameters<typeof module32.approveProjectChangeOrder>;
      return module32.approveProjectChangeOrder(...parameters);
    }
    case "app/actions/profile/change-own-password.changeOwnPassword": {
      const parameters = [...args] as Parameters<typeof module33.changeOwnPassword>;
      return module33.changeOwnPassword(...parameters);
    }
    case "app/actions/profile/update-own-profile.updateOwnProfile": {
      const parameters = [...args] as Parameters<typeof module34.updateOwnProfile>;
      return module34.updateOwnProfile(...parameters);
    }
    case "app/actions/ai/chat-history.getLatestAiConversation": {
      const parameters = [...args] as Parameters<typeof module35.getLatestAiConversation>;
      return module35.getLatestAiConversation(...parameters);
    }
    case "app/actions/ai/chat-history.getAiConversation": {
      const parameters = [...args] as Parameters<typeof module35.getAiConversation>;
      return module35.getAiConversation(...parameters);
    }
    case "app/actions/ai/chat-history.listAiConversations": {
      const parameters = [...args] as Parameters<typeof module35.listAiConversations>;
      return module35.listAiConversations(...parameters);
    }
    case "app/actions/ai/chat-history.renameAiConversation": {
      const parameters = [...args] as Parameters<typeof module35.renameAiConversation>;
      return module35.renameAiConversation(...parameters);
    }
    case "app/actions/ai/chat-history.deleteAiConversation": {
      const parameters = [...args] as Parameters<typeof module35.deleteAiConversation>;
      return module35.deleteAiConversation(...parameters);
    }
    case "app/actions/ai/chat-history.startAiConversation": {
      const parameters = [...args] as Parameters<typeof module35.startAiConversation>;
      return module35.startAiConversation(...parameters);
    }
    case "app/actions/ai/confirm-finance-proposal.confirmAiPayVendorBillProposal": {
      const parameters = [...args] as Parameters<typeof module36.confirmAiPayVendorBillProposal>;
      return module36.confirmAiPayVendorBillProposal(...parameters);
    }
    case "app/actions/ai/confirm-finance-proposal.confirmAiRecordClientPaymentProposal": {
      const parameters = [...args] as Parameters<
        typeof module36.confirmAiRecordClientPaymentProposal
      >;
      return module36.confirmAiRecordClientPaymentProposal(...parameters);
    }
    case "app/actions/ai/process-receipt.processReceipt": {
      const parameters = [...args] as Parameters<typeof module37.processReceipt>;
      return module37.processReceipt(...parameters);
    }
    case "app/actions/ai/confirm-expense-proposal.confirmAiExpenseProposal": {
      const parameters = [...args] as Parameters<typeof module38.confirmAiExpenseProposal>;
      return module38.confirmAiExpenseProposal(...parameters);
    }
    case "app/actions/ai/confirm-expense-proposal.confirmAiExpenseReviewProposal": {
      const parameters = [...args] as Parameters<typeof module38.confirmAiExpenseReviewProposal>;
      return module38.confirmAiExpenseReviewProposal(...parameters);
    }
    case "app/actions/ai/confirm-expense-proposal.confirmAiDisburseExpenseProposal": {
      const parameters = [...args] as Parameters<typeof module38.confirmAiDisburseExpenseProposal>;
      return module38.confirmAiDisburseExpenseProposal(...parameters);
    }
    case "app/actions/ai/confirm-material-proposal.confirmAiGoodsReceiptProposal": {
      const parameters = [...args] as Parameters<typeof module39.confirmAiGoodsReceiptProposal>;
      return module39.confirmAiGoodsReceiptProposal(...parameters);
    }
    case "app/actions/ai/confirm-create-user-batch-proposal.confirmAiCreateUserBatchProposal": {
      const parameters = [...args] as Parameters<typeof module40.confirmAiCreateUserBatchProposal>;
      return module40.confirmAiCreateUserBatchProposal(...parameters);
    }
    case "app/actions/ai/confirm-bank-reconciliation-proposal.confirmAiBankReconciliationProposal": {
      const parameters = [...args] as Parameters<
        typeof module41.confirmAiBankReconciliationProposal
      >;
      return module41.confirmAiBankReconciliationProposal(...parameters);
    }
    case "app/actions/ai/preferences.getAiPreference": {
      const parameters = [...args] as Parameters<typeof module42.getAiPreference>;
      return module42.getAiPreference(...parameters);
    }
    case "app/actions/ai/preferences.saveAiPreference": {
      const parameters = [...args] as Parameters<typeof module42.saveAiPreference>;
      return module42.saveAiPreference(...parameters);
    }
    case "app/actions/ai/preferences.resetAiPreference": {
      const parameters = [...args] as Parameters<typeof module42.resetAiPreference>;
      return module42.resetAiPreference(...parameters);
    }
    case "app/actions/ai/confirm-create-role-proposal.confirmAiCreateRoleProposal": {
      const parameters = [...args] as Parameters<typeof module43.confirmAiCreateRoleProposal>;
      return module43.confirmAiCreateRoleProposal(...parameters);
    }
    case "app/actions/ai/confirm-project-proposal.confirmAiCreateProjectProposal": {
      const parameters = [...args] as Parameters<typeof module44.confirmAiCreateProjectProposal>;
      return module44.confirmAiCreateProjectProposal(...parameters);
    }
    case "app/actions/ai/confirm-project-proposal.confirmAiSetupBudgetProposal": {
      const parameters = [...args] as Parameters<typeof module44.confirmAiSetupBudgetProposal>;
      return module44.confirmAiSetupBudgetProposal(...parameters);
    }
    case "app/actions/ai/confirm-role-proposal.confirmAiRoleChangeProposal": {
      const parameters = [...args] as Parameters<typeof module45.confirmAiRoleChangeProposal>;
      return module45.confirmAiRoleChangeProposal(...parameters);
    }
    case "app/actions/ai/confirm-create-user-proposal.confirmAiCreateUserProposal": {
      const parameters = [...args] as Parameters<typeof module46.confirmAiCreateUserProposal>;
      return module46.confirmAiCreateUserProposal(...parameters);
    }
    case "app/actions/administration-roles.listManagedRoles": {
      const parameters = [...args] as Parameters<typeof module47.listManagedRoles>;
      return module47.listManagedRoles(...parameters);
    }
    case "app/actions/administration-roles.createRole": {
      const parameters = [...args] as Parameters<typeof module47.createRole>;
      return module47.createRole(...parameters);
    }
    case "app/actions/administration-roles.updateRolePermissions": {
      const parameters = [...args] as Parameters<typeof module47.updateRolePermissions>;
      return module47.updateRolePermissions(...parameters);
    }
    case "app/actions/administration-roles.updateRoleDetails": {
      const parameters = [...args] as Parameters<typeof module47.updateRoleDetails>;
      return module47.updateRoleDetails(...parameters);
    }
    case "app/actions/administration-roles.deleteRole": {
      const parameters = [...args] as Parameters<typeof module47.deleteRole>;
      return module47.deleteRole(...parameters);
    }
    case "app/actions/onboarding-review.hasPendingOnboardingSetupApproval": {
      const parameters = [...args] as Parameters<typeof module48.hasPendingOnboardingSetupApproval>;
      return module48.hasPendingOnboardingSetupApproval(...parameters);
    }
    case "app/actions/onboarding-review.getOnboardingReviewState": {
      const parameters = [...args] as Parameters<typeof module48.getOnboardingReviewState>;
      return module48.getOnboardingReviewState(...parameters);
    }
    case "app/actions/administration-staff.createStaffUser": {
      const parameters = [...args] as Parameters<typeof module49.createStaffUser>;
      return module49.createStaffUser(...parameters);
    }
    case "app/actions/administration-staff.updateStaffUser": {
      const parameters = [...args] as Parameters<typeof module49.updateStaffUser>;
      return module49.updateStaffUser(...parameters);
    }
    case "app/actions/administration-staff.changeTemporaryPassword": {
      const parameters = [...args] as Parameters<typeof module49.changeTemporaryPassword>;
      return module49.changeTemporaryPassword(...parameters);
    }
    case "app/actions/finance/vendor-bill-drafts.listVendorBillDrafts": {
      const parameters = [...args] as Parameters<typeof module50.listVendorBillDrafts>;
      return module50.listVendorBillDrafts(...parameters);
    }
    case "app/actions/finance/vendor-bill-drafts.getVendorBillDraft": {
      const parameters = [...args] as Parameters<typeof module50.getVendorBillDraft>;
      return module50.getVendorBillDraft(...parameters);
    }
    case "app/actions/finance/vendor-bill-drafts.saveVendorBillDraft": {
      const parameters = [...args] as Parameters<typeof module50.saveVendorBillDraft>;
      return module50.saveVendorBillDraft(...parameters);
    }
    case "app/actions/finance/vendor-bill-drafts.discardVendorBillDraft": {
      const parameters = [...args] as Parameters<typeof module50.discardVendorBillDraft>;
      return module50.discardVendorBillDraft(...parameters);
    }
    case "app/actions/finance/vendor-bill-drafts.submitVendorBillDraft": {
      const parameters = [...args] as Parameters<typeof module50.submitVendorBillDraft>;
      return module50.submitVendorBillDraft(...parameters);
    }
    case "app/actions/finance/reconcile-cash-transaction.reconcileCashTransaction": {
      const parameters = [...args] as Parameters<typeof module51.reconcileCashTransaction>;
      return module51.reconcileCashTransaction(...parameters);
    }
    case "app/actions/finance/reconcile-cash-transaction.markReconciliationException": {
      const parameters = [...args] as Parameters<typeof module51.markReconciliationException>;
      return module51.markReconciliationException(...parameters);
    }
    case "app/actions/finance/reconcile-cash-transaction.clearReconciliationException": {
      const parameters = [...args] as Parameters<typeof module51.clearReconciliationException>;
      return module51.clearReconciliationException(...parameters);
    }
    case "app/actions/finance/analyze-bank-statement.analyzeBankStatement": {
      const parameters = [...args] as Parameters<typeof module52.analyzeBankStatement>;
      return module52.analyzeBankStatement(...parameters);
    }
    case "app/actions/finance/field-request-stock.applyExpenseStockHandling": {
      const parameters = [...args] as Parameters<typeof module53.applyExpenseStockHandling>;
      return module53.applyExpenseStockHandling(...parameters);
    }
    case "app/actions/finance/field-requests.submitFieldRequest": {
      const parameters = [...args] as Parameters<typeof module54.submitFieldRequest>;
      return module54.submitFieldRequest(...parameters);
    }
    case "app/actions/finance/field-requests.submitFieldRequests": {
      const parameters = [...args] as Parameters<typeof module54.submitFieldRequests>;
      return module54.submitFieldRequests(...parameters);
    }
    case "app/actions/finance/field-requests.verifyFieldRequest": {
      const parameters = [...args] as Parameters<typeof module54.verifyFieldRequest>;
      return module54.verifyFieldRequest(...parameters);
    }
    case "app/actions/finance/field-requests.approveFieldRequest": {
      const parameters = [...args] as Parameters<typeof module54.approveFieldRequest>;
      return module54.approveFieldRequest(...parameters);
    }
    case "app/actions/finance/field-requests.payFieldRequest": {
      const parameters = [...args] as Parameters<typeof module54.payFieldRequest>;
      return module54.payFieldRequest(...parameters);
    }
    case "app/actions/finance/field-requests.approveVendorPayment": {
      const parameters = [...args] as Parameters<typeof module54.approveVendorPayment>;
      return module54.approveVendorPayment(...parameters);
    }
    case "app/actions/finance/get-dashboard-stats.getDashboardStats": {
      const parameters = [...args] as Parameters<typeof module55.getDashboardStats>;
      return module55.getDashboardStats(...parameters);
    }
    case "app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule": {
      const parameters = [...args] as Parameters<typeof module56.generateClientInvoiceSchedule>;
      return module56.generateClientInvoiceSchedule(...parameters);
    }
    case "app/actions/finance/reconciliation-statement-actions.recordBankStatementRow": {
      const parameters = [...args] as Parameters<typeof module57.recordBankStatementRow>;
      return module57.recordBankStatementRow(...parameters);
    }
    case "app/actions/finance/reconciliation-statement-actions.importBankStatementCsv": {
      const parameters = [...args] as Parameters<typeof module57.importBankStatementCsv>;
      return module57.importBankStatementCsv(...parameters);
    }
    case "app/actions/finance/reconciliation-statement-actions.importParsedBankStatementRows": {
      const parameters = [...args] as Parameters<typeof module57.importParsedBankStatementRows>;
      return module57.importParsedBankStatementRows(...parameters);
    }
    case "app/actions/finance/schedule-vendor-bill.scheduleVendorBillPayment": {
      const parameters = [...args] as Parameters<typeof module58.scheduleVendorBillPayment>;
      return module58.scheduleVendorBillPayment(...parameters);
    }
    case "app/actions/finance/field-request-payment.payFieldRequest": {
      const parameters = [...args] as Parameters<typeof module59.payFieldRequest>;
      return module59.payFieldRequest(...parameters);
    }
    case "app/actions/finance/field-request-auth.authorizeFieldRequestAction": {
      const parameters = [...args] as Parameters<typeof module60.authorizeFieldRequestAction>;
      return module60.authorizeFieldRequestAction(...parameters);
    }
    case "app/actions/finance/field-request-auth.authorizeOwnerVendorApproval": {
      const parameters = [...args] as Parameters<typeof module60.authorizeOwnerVendorApproval>;
      return module60.authorizeOwnerVendorApproval(...parameters);
    }
    case "app/actions/finance/expense-draft-submit.submitExpenseDraft": {
      const parameters = [...args] as Parameters<typeof module61.submitExpenseDraft>;
      return module61.submitExpenseDraft(...parameters);
    }
    case "app/actions/finance/dashboard-overview.getFinanceDashboardOverview": {
      const parameters = [...args] as Parameters<typeof module62.getFinanceDashboardOverview>;
      return module62.getFinanceDashboardOverview(...parameters);
    }
    case "app/actions/finance/expense-draft-storage.listExpenseDrafts": {
      const parameters = [...args] as Parameters<typeof module63.listExpenseDrafts>;
      return module63.listExpenseDrafts(...parameters);
    }
    case "app/actions/finance/expense-draft-storage.getExpenseDraft": {
      const parameters = [...args] as Parameters<typeof module63.getExpenseDraft>;
      return module63.getExpenseDraft(...parameters);
    }
    case "app/actions/finance/expense-draft-storage.saveExpenseDraft": {
      const parameters = [...args] as Parameters<typeof module63.saveExpenseDraft>;
      return module63.saveExpenseDraft(...parameters);
    }
    case "app/actions/finance/expense-draft-storage.discardExpenseDraft": {
      const parameters = [...args] as Parameters<typeof module63.discardExpenseDraft>;
      return module63.discardExpenseDraft(...parameters);
    }
    case "app/actions/finance/pay-vendor-bill.payVendorBill": {
      const parameters = [...args] as Parameters<typeof module64.payVendorBill>;
      return module64.payVendorBill(...parameters);
    }
    case "app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext": {
      const parameters = [...args] as Parameters<typeof module65.getInvoicePrefillContext>;
      return module65.getInvoicePrefillContext(...parameters);
    }
    case "app/actions/finance/submit-vendor-bill.submitVendorBill": {
      const parameters = [...args] as Parameters<typeof module66.submitVendorBill>;
      return module66.submitVendorBill(...parameters);
    }
    case "app/actions/finance/submit-vendor-bill.getVendorBillFormData": {
      const parameters = [...args] as Parameters<typeof module66.getVendorBillFormData>;
      return module66.getVendorBillFormData(...parameters);
    }
    case "app/actions/finance/record-client-payment.recordClientPayment": {
      const parameters = [...args] as Parameters<typeof module67.recordClientPayment>;
      return module67.recordClientPayment(...parameters);
    }
    case "app/actions/finance/bank-account-movements.postManualCashMovement": {
      const parameters = [...args] as Parameters<typeof module68.postManualCashMovement>;
      return module68.postManualCashMovement(...parameters);
    }
    case "app/actions/finance/bank-account-movements.transferBetweenBankAccounts": {
      const parameters = [...args] as Parameters<typeof module68.transferBetweenBankAccounts>;
      return module68.transferBetweenBankAccounts(...parameters);
    }
    case "app/actions/finance/reconciliation-workspace-query.getReconciliationWorkspace": {
      const parameters = [...args] as Parameters<typeof module69.getReconciliationWorkspace>;
      return module69.getReconciliationWorkspace(...parameters);
    }
    case "app/actions/finance/field-request-review.verifyFieldRequest": {
      const parameters = [...args] as Parameters<typeof module70.verifyFieldRequest>;
      return module70.verifyFieldRequest(...parameters);
    }
    case "app/actions/finance/field-request-review.approveFieldRequest": {
      const parameters = [...args] as Parameters<typeof module70.approveFieldRequest>;
      return module70.approveFieldRequest(...parameters);
    }
    case "app/actions/finance/field-request-review.approveVendorPayment": {
      const parameters = [...args] as Parameters<typeof module70.approveVendorPayment>;
      return module70.approveVendorPayment(...parameters);
    }
    case "app/actions/finance/create-client-invoice.createClientInvoice": {
      const parameters = [...args] as Parameters<typeof module71.createClientInvoice>;
      return module71.createClientInvoice(...parameters);
    }
    case "app/actions/finance/bank-account-management.createBankAccount": {
      const parameters = [...args] as Parameters<typeof module72.createBankAccount>;
      return module72.createBankAccount(...parameters);
    }
    case "app/actions/finance/bank-account-management.updateBankAccount": {
      const parameters = [...args] as Parameters<typeof module72.updateBankAccount>;
      return module72.updateBankAccount(...parameters);
    }
    case "app/actions/finance/bank-account-management.setBankAccountActive": {
      const parameters = [...args] as Parameters<typeof module72.setBankAccountActive>;
      return module72.setBankAccountActive(...parameters);
    }
    case "app/actions/administration-vendors.saveVendor": {
      const parameters = [...args] as Parameters<typeof module73.saveVendor>;
      return module73.saveVendor(...parameters);
    }
    case "app/actions/administration-vendors.setVendorActive": {
      const parameters = [...args] as Parameters<typeof module73.setVendorActive>;
      return module73.setVendorActive(...parameters);
    }
    case "app/actions/developer-account-simulation.getDeveloperAccountSimulationState": {
      const parameters = [...args] as Parameters<
        typeof module74.getDeveloperAccountSimulationState
      >;
      return module74.getDeveloperAccountSimulationState(...parameters);
    }
    case "app/actions/developer-account-simulation.startDeveloperAccountSimulation": {
      const parameters = [...args] as Parameters<typeof module74.startDeveloperAccountSimulation>;
      return module74.startDeveloperAccountSimulation(...parameters);
    }
    case "app/actions/developer-account-simulation.stopDeveloperAccountSimulation": {
      const parameters = [...args] as Parameters<typeof module74.stopDeveloperAccountSimulation>;
      return module74.stopDeveloperAccountSimulation(...parameters);
    }
    case "app/actions/material/inventory.createMaterialCategory": {
      const parameters = [...args] as Parameters<typeof module75.createMaterialCategory>;
      return module75.createMaterialCategory(...parameters);
    }
    case "app/actions/material/inventory.createMaterial": {
      const parameters = [...args] as Parameters<typeof module75.createMaterial>;
      return module75.createMaterial(...parameters);
    }
    case "app/actions/material/inventory.getMaterialInventory": {
      const parameters = [...args] as Parameters<typeof module75.getMaterialInventory>;
      return module75.getMaterialInventory(...parameters);
    }
    case "app/actions/material/inventory.recordStockIn": {
      const parameters = [...args] as Parameters<typeof module75.recordStockIn>;
      return module75.recordStockIn(...parameters);
    }
    case "app/actions/material/inventory.reserveMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module75.reserveMaterialForProject>;
      return module75.reserveMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory.wasteMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module75.wasteMaterialForProject>;
      return module75.wasteMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory.useMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module75.useMaterialForProject>;
      return module75.useMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory.returnMaterialFromProject": {
      const parameters = [...args] as Parameters<typeof module75.returnMaterialFromProject>;
      return module75.returnMaterialFromProject(...parameters);
    }
    case "app/actions/material/inventory.adjustMaterialStock": {
      const parameters = [...args] as Parameters<typeof module75.adjustMaterialStock>;
      return module75.adjustMaterialStock(...parameters);
    }
    case "app/actions/material/inventory.getMaterialShortages": {
      const parameters = [...args] as Parameters<typeof module75.getMaterialShortages>;
      return module75.getMaterialShortages(...parameters);
    }
    case "app/actions/material/warehouse-adjustment.emergencyAdjustStock": {
      const parameters = [...args] as Parameters<typeof module76.emergencyAdjustStock>;
      return module76.emergencyAdjustStock(...parameters);
    }
    case "app/actions/material/warehouse-stock-count.saveStockCount": {
      const parameters = [...args] as Parameters<typeof module77.saveStockCount>;
      return module77.saveStockCount(...parameters);
    }
    case "app/actions/material/warehouse-stock-count.submitStockCount": {
      const parameters = [...args] as Parameters<typeof module77.submitStockCount>;
      return module77.submitStockCount(...parameters);
    }
    case "app/actions/material/warehouse-stock-count.approveStockCount": {
      const parameters = [...args] as Parameters<typeof module77.approveStockCount>;
      return module77.approveStockCount(...parameters);
    }
    case "app/actions/material/warehouse-stock-count.rejectStockCount": {
      const parameters = [...args] as Parameters<typeof module77.rejectStockCount>;
      return module77.rejectStockCount(...parameters);
    }
    case "app/actions/material/operations-dashboard.getMaterialMovementPage": {
      const parameters = [...args] as Parameters<typeof module78.getMaterialMovementPage>;
      return module78.getMaterialMovementPage(...parameters);
    }
    case "app/actions/material/operations-dashboard.getMaterialOperationsDashboard": {
      const parameters = [...args] as Parameters<typeof module78.getMaterialOperationsDashboard>;
      return module78.getMaterialOperationsDashboard(...parameters);
    }
    case "app/actions/material/inventory-project-movements.wasteMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module79.wasteMaterialForProject>;
      return module79.wasteMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory-project-movements.useMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module79.useMaterialForProject>;
      return module79.useMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory-project-movements.returnMaterialFromProject": {
      const parameters = [...args] as Parameters<typeof module79.returnMaterialFromProject>;
      return module79.returnMaterialFromProject(...parameters);
    }
    case "app/actions/material/inventory-movements.recordStockIn": {
      const parameters = [...args] as Parameters<typeof module80.recordStockIn>;
      return module80.recordStockIn(...parameters);
    }
    case "app/actions/material/inventory-movements.reserveMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module80.reserveMaterialForProject>;
      return module80.reserveMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory-movements.wasteMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module80.wasteMaterialForProject>;
      return module80.wasteMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory-movements.useMaterialForProject": {
      const parameters = [...args] as Parameters<typeof module80.useMaterialForProject>;
      return module80.useMaterialForProject(...parameters);
    }
    case "app/actions/material/inventory-movements.returnMaterialFromProject": {
      const parameters = [...args] as Parameters<typeof module80.returnMaterialFromProject>;
      return module80.returnMaterialFromProject(...parameters);
    }
    case "app/actions/material/inventory-movements.adjustMaterialStock": {
      const parameters = [...args] as Parameters<typeof module80.adjustMaterialStock>;
      return module80.adjustMaterialStock(...parameters);
    }
    case "app/actions/material/warehouse-transfer.createStockTransfer": {
      const parameters = [...args] as Parameters<typeof module81.createStockTransfer>;
      return module81.createStockTransfer(...parameters);
    }
    case "app/actions/material/warehouse-receipt-reversal.requestGoodsReceiptReversal": {
      const parameters = [...args] as Parameters<typeof module82.requestGoodsReceiptReversal>;
      return module82.requestGoodsReceiptReversal(...parameters);
    }
    case "app/actions/material/warehouse-receipt-reversal.approveGoodsReceiptReversal": {
      const parameters = [...args] as Parameters<typeof module82.approveGoodsReceiptReversal>;
      return module82.approveGoodsReceiptReversal(...parameters);
    }
    case "app/actions/material/warehouse-receipt-reversal.rejectGoodsReceiptReversal": {
      const parameters = [...args] as Parameters<typeof module82.rejectGoodsReceiptReversal>;
      return module82.rejectGoodsReceiptReversal(...parameters);
    }
    case "app/actions/material/opening-inventory-mutations.createInventoryOpening": {
      const parameters = [...args] as Parameters<typeof module83.createInventoryOpening>;
      return module83.createInventoryOpening(...parameters);
    }
    case "app/actions/material/opening-inventory-mutations.decideInventoryOpening": {
      const parameters = [...args] as Parameters<typeof module83.decideInventoryOpening>;
      return module83.decideInventoryOpening(...parameters);
    }
    case "app/actions/material/opening-inventory-mutations.reverseInventoryOpening": {
      const parameters = [...args] as Parameters<typeof module83.reverseInventoryOpening>;
      return module83.reverseInventoryOpening(...parameters);
    }
    case "app/actions/material/opening-inventory-queries.getInitialStockCandidates": {
      const parameters = [...args] as Parameters<typeof module84.getInitialStockCandidates>;
      return module84.getInitialStockCandidates(...parameters);
    }
    case "app/actions/material/opening-inventory-queries.previewInitialStockImport": {
      const parameters = [...args] as Parameters<typeof module84.previewInitialStockImport>;
      return module84.previewInitialStockImport(...parameters);
    }
    case "app/actions/material/opening-inventory-queries.getInventoryOpeningBatches": {
      const parameters = [...args] as Parameters<typeof module84.getInventoryOpeningBatches>;
      return module84.getInventoryOpeningBatches(...parameters);
    }
    case "app/actions/material/warehouse.createInventoryLocation": {
      const parameters = [...args] as Parameters<typeof module85.createInventoryLocation>;
      return module85.createInventoryLocation(...parameters);
    }
    case "app/actions/material/goods-receipt.postGoodsReceipt": {
      const parameters = [...args] as Parameters<typeof module86.postGoodsReceipt>;
      return module86.postGoodsReceipt(...parameters);
    }
    case "app/actions/notifications/push-token.registerPushTokenAction": {
      const parameters = [...args] as Parameters<typeof module87.registerPushTokenAction>;
      return module87.registerPushTokenAction(...parameters);
    }
    case "app/actions/notifications/push-token.unregisterPushTokenAction": {
      const parameters = [...args] as Parameters<typeof module87.unregisterPushTokenAction>;
      return module87.unregisterPushTokenAction(...parameters);
    }
    case "app/actions/notifications/open-notification.openNotificationAction": {
      const parameters = [...args] as Parameters<typeof module88.openNotificationAction>;
      return module88.openNotificationAction(...parameters);
    }
    case "app/actions/notifications/list-notifications.listNotificationsAction": {
      const parameters = [...args] as Parameters<typeof module89.listNotificationsAction>;
      return module89.listNotificationsAction(...parameters);
    }
    case "app/actions/notifications/mark-read.markNotificationReadAction": {
      const parameters = [...args] as Parameters<typeof module90.markNotificationReadAction>;
      return module90.markNotificationReadAction(...parameters);
    }
    case "app/actions/notifications/mark-read.markAllNotificationsReadAction": {
      const parameters = [...args] as Parameters<typeof module90.markAllNotificationsReadAction>;
      return module90.markAllNotificationsReadAction(...parameters);
    }
    case "app/actions/notifications/get-notifications.getNotificationsAction": {
      const parameters = [...args] as Parameters<typeof module91.getNotificationsAction>;
      return module91.getNotificationsAction(...parameters);
    }
    case "app/actions/media/sign-imagekit.signImagekit": {
      const parameters = [...args] as Parameters<typeof module92.signImagekit>;
      return module92.signImagekit(...parameters);
    }
    case "features/settings/server/get-settings-page-data.getSettingsPageData": {
      const parameters = [...args] as Parameters<typeof module93.getSettingsPageData>;
      return module93.getSettingsPageData(...parameters);
    }
    case "features/expenses/server/get-expenses-page-data.getExpensesPageData": {
      const parameters = [...args] as Parameters<typeof module94.getExpensesPageData>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module94.getExpensesPageData(...parameters);
    }
    case "features/expenses/server/get-new-expense-page-data.getNewExpensePageData": {
      const parameters = [...args] as Parameters<typeof module95.getNewExpensePageData>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module95.getNewExpensePageData(...parameters);
    }
    case "features/projects/detail/server/get-project-detail-data.getProjectDetailData": {
      const parameters = [...args] as Parameters<typeof module96.getProjectDetailData>;
      return module96.getProjectDetailData(...parameters);
    }
    case "features/projects/list/server/get-project-list-page-data.getProjectListPageData": {
      const parameters = [...args] as Parameters<typeof module97.getProjectListPageData>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module97.getProjectListPageData(...parameters);
    }
    case "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData": {
      const parameters = [...args] as Parameters<typeof module98.getFinanceDashboardPageData>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module98.getFinanceDashboardPageData(...parameters);
    }
    case "features/navigation/server/home-destination.resolveHomeDestination": {
      const parameters = [...args] as Parameters<typeof module99.resolveHomeDestination>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module99.resolveHomeDestination(...parameters);
    }
    case "features/profile/server/get-profile-page-data.getProfilePageData": {
      const parameters = [...args] as Parameters<typeof module100.getProfilePageData>;
      return module100.getProfilePageData(...parameters);
    }
    case "features/approvals/server/get-approvals-page-data.getApprovalsPageData": {
      const parameters = [...args] as Parameters<typeof module101.getApprovalsPageData>;
      const actor = await resolveActor();
      if (!actor) throw new Error("UNAUTHORIZED: Sesi tidak valid.");
      parameters[0] = actor;
      return module101.getApprovalsPageData(...parameters);
    }
    case "features/onboarding/server/get-onboarding-review-page-data.getOnboardingReviewPageData": {
      const parameters = [...args] as Parameters<typeof module102.getOnboardingReviewPageData>;
      return module102.getOnboardingReviewPageData(...parameters);
    }
    case "features/onboarding/server/get-quick-start-workspace-data.getQuickStartWorkspaceData": {
      const parameters = [...args] as Parameters<typeof module103.getQuickStartWorkspaceData>;
      return module103.getQuickStartWorkspaceData(...parameters);
    }
    case "server/actor.resolveActor": {
      const parameters = [...args] as Parameters<typeof module104.resolveActor>;
      return module104.resolveActor(...parameters);
    }
    default:
      throw new Error("NOT_FOUND: Operasi tidak tersedia.");
  }
}
