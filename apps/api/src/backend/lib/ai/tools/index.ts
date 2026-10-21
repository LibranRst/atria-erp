import { buildQuickStartTools } from "./quick-start-tools";
import { buildOwnProfileTools } from "./own-profile-tools";
import { buildStockCorrectionTools } from "./stock-correction-tools";
import { buildBudgetSyncTools } from "./budget-sync-tools";
import { buildRabExportTools } from "./rab-export-tools";
import { buildAdministrationTools } from "./administration-tools";
import { buildOperationalSettingsTools } from "./operational-settings-tools";
import { buildBankReconciliationTools } from "./bank-reconciliation-tools";
import { buildWarehouseIntakeTools } from "./warehouse-intake-tools";
import { buildVendorBillCorrectionTools } from "./vendor-bill-correction-tools";
import { buildBankCashTools } from "./bank-cash-tools";
import { buildExpenseBatchTools } from "./expense-batch-tools";
import { buildFinancialHistoryTools } from "./financial-history-tools";
import { buildVendorPaymentWorkflowTools } from "./vendor-payment-workflow-tools";
import { buildFinanceInputTools } from "./finance-input-tools";
import { buildProjectManagementTools } from "./project-management-tools";
import { buildCatalogSettingsTools } from "./catalog-settings-tools";
import { buildProcurementWarehouseTools } from "./procurement-warehouse-tools";
import { buildProjectStockTools } from "./project-stock-tools";
import { buildRabDraftTools } from "./rab-draft-tools";
import { buildRabWorkflowTools } from "./rab-workflow-tools";
import { buildRapLifecycleTools } from "./rap-lifecycle-tools";
import { buildRapFinalizationTools } from "./rap-finalization-tools";
import { buildCategoryPlanTools } from "./category-plan-tools";
import { buildRapChangeTools } from "./rap-change-tools";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  AI_CAPABILITIES,
  capabilityAvailable,
  availableAiCapabilities,
  aiCapabilityReport,
} from "./capability-catalog";
import { buildMaterialMasterTools } from "./material-master-tools";
import { buildMaterialEditTools } from "./material-edit-tools";
import { buildRapDraftTools } from "./rap-draft-tools";
import { buildFinanceProposalTools } from "./finance-proposal-tools";
import { buildFinanceTools } from "./finance-tools";
import { buildCompanyBudgetTools } from "./company-budget-tools";
import { createInputRequestTools } from "./input-request-tools";
import { buildLookupTools } from "./lookup-tools";
import { buildMaterialProposalTools } from "./material-proposal-tools";
import { buildOperationsTools } from "./operations-tools";
import { buildProjectProposalTools } from "./project-proposal-tools";
import { buildProjectTools } from "./project-tools";
import { buildProposalTools } from "./proposal-tools";
import { buildRoleTools } from "./role-tools";
import { buildSuggestionTools } from "./suggestion-tools";
import type { AiToolContext } from "./context";

/**
 * Registry tool untuk AI chat agent.
 *
 * Semua tool di sini WAJIB read-only. Tidak satupun boleh menulis ke database —
 * `read-only.test.ts` menggagalkan suite kalau ada yang melanggar. Penulisan
 * hanya terjadi lewat Server Action ber-RBAC setelah dikonfirmasi manusia.
 */
export function buildAiTools(context: AiToolContext): ToolSet {
  const all: ToolSet = {
    ...buildProjectTools(context),
    ...buildFinanceTools(context),
    ...buildFinanceInputTools(context),
    ...buildOperationalSettingsTools(context),
    ...buildAdministrationTools(context),
    ...buildBankCashTools(context),
    ...buildBankReconciliationTools(context),
    ...buildExpenseBatchTools(context),
    ...buildFinancialHistoryTools(context),
    ...buildVendorPaymentWorkflowTools(context),
    ...buildCompanyBudgetTools(context),
    ...buildOperationsTools(context),
    ...buildLookupTools(context),
    ...buildRoleTools(context),
    ...buildProposalTools(context),
    ...buildProjectProposalTools(context),
    ...buildFinanceProposalTools(context),
    ...buildMaterialProposalTools(context),
    ...buildMaterialMasterTools(context),
    ...buildMaterialEditTools(context),
    ...buildRapDraftTools(context),
    ...buildRapChangeTools(context),
    ...buildCategoryPlanTools(context),
    ...buildRapFinalizationTools(context),
    ...buildRapLifecycleTools(context),
    ...buildRabDraftTools(context),
    ...buildRabWorkflowTools(context),
    ...buildRabExportTools(context),
    ...buildBudgetSyncTools(context),
    ...buildQuickStartTools(context),
    ...buildOwnProfileTools(context),
    ...buildStockCorrectionTools(context),
    ...buildProjectStockTools(context),
    ...buildProcurementWarehouseTools(context),
    ...buildWarehouseIntakeTools(context),
    ...buildVendorBillCorrectionTools(context),
    ...buildCatalogSettingsTools(context),
    ...buildProjectManagementTools(context),
    getAvailableActions: tool({
      description:
        "Authoritative list of what THIS AI assistant can do for the current authenticated user: read-only lookups, proposals requiring a user button, and ERP workflows that remain manual. Always call this for 'what can you help me do?' questions. ERP permissions or Owner access do not mean all ERP actions are implemented in chat.",
      inputSchema: z.object({}),
      execute: async () => ({
        actions: availableAiCapabilities(context),
        ...aiCapabilityReport(context),
        instruction:
          "Pisahkan bantuan baca, usulan yang perlu tombol konfirmasi, dan aksi yang masih manual. Jangan menjanjikan eksekusi untuk izin ERP yang tidak memiliki tool proposal. projectCreation menjelaskan akses proyek reguler: bila available false, jelaskan reason sebagai batas izin, bukan fitur yang belum dibuat.",
      }),
    }),
    ...buildSuggestionTools(),
    ...createInputRequestTools(context),
  };
  const enabled: ToolSet = {};
  for (const [name, value] of Object.entries(all)) {
    const capability = AI_CAPABILITIES[name];
    if (capability && capabilityAvailable(context, capability)) enabled[name] = value;
  }
  return enabled;
}

export type AiToolSet = ReturnType<typeof buildAiTools>;
