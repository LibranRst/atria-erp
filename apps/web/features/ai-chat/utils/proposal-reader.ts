import { quickStartProposalSchema, type QuickStartProposal } from "@atria/core/ai/quick-start";
import { ownProfileProposalSchema, type OwnProfileProposal } from "@atria/core/ai/own-profile";
import { budgetSyncProposalSchema, type BudgetSyncProposal } from "@atria/core/ai/budget-sync";
import { rabExportProposalSchema, type RabExportProposal } from "@atria/core/ai/rab-export";
import {
  administrationProposalSchema,
  type AdministrationProposal,
} from "@atria/core/ai/administration";
import {
  reconciliationProposalSchema,
  type ReconciliationProposal,
} from "@atria/core/ai/bank-reconciliation";
import { bankCashProposalSchema, type BankCashProposal } from "@atria/core/ai/bank-cash";
import {
  expenseBatchProposalSchema,
  expenseBatchActionProposalSchema,
  type ExpenseBatchProposal,
  type ExpenseBatchActionProposal,
} from "@atria/core/ai/expense-batch";
import {
  vendorPaymentWorkflowProposalSchema,
  type VendorPaymentWorkflowProposal,
} from "@atria/core/ai/vendor-payment-workflow";
import {
  financeInputProposalSchema,
  type FinanceInputProposal,
} from "@atria/core/ai/finance-input";
import {
  projectManagementProposalSchema,
  type ProjectManagementProposal,
} from "@atria/core/ai/project-management";
import {
  catalogSettingsProposalSchema,
  type CatalogSettingsProposal,
} from "@atria/core/ai/catalog-settings";
import {
  procurementWarehouseProposalSchema,
  type ProcurementWarehouseProposal,
} from "@atria/core/ai/procurement-warehouse";
import {
  projectStockProposalSchema,
  type ProjectStockProposal,
} from "@atria/core/ai/project-stock";
import { rabDraftProposalSchema, type RabDraftProposal } from "@atria/core/ai/rab-draft";
import { rabWorkflowProposalSchema, type RabWorkflowProposal } from "@atria/core/ai/rab-workflow";
import { lifecycleProposalSchema, type LifecycleProposal } from "@atria/core/ai/rap-lifecycle";
import { setupProposalSchema, type SetupProposal } from "@atria/core/ai/rap-finalization";
import { packageProposalSchema, type PackageProposal } from "@atria/core/ai/category-plan";
import { rapChangeProposalSchema, type RapChangeProposal } from "@atria/core/ai/rap-change";
import { rapDraftProposalSchema, type RapDraftProposal } from "@atria/core/ai/rap-draft";
import { materialProposalSchema, type MaterialProposal } from "@atria/core/ai/material-import";
import {
  materialUpdateProposalSchema,
  type MaterialUpdateProposal,
} from "@atria/core/ai/material-update";
import { projectBudgetDefaultsSchema } from "@atria/core/ai/project-budget-defaults";
import type { CreateProjectProposalData } from "../components/proposal-cards/create-project-proposal-card";
import type { SetupBudgetProposalData } from "../components/proposal-cards/setup-budget-proposal-card";
import type { VendorPaymentProposalData } from "../components/proposal-cards/vendor-payment-proposal-card";
import type { ClientPaymentProposalData } from "../components/proposal-cards/client-payment-proposal-card";
import type { GoodsReceiptProposalData } from "../components/proposal-cards/goods-receipt-proposal-card";
import type { ExpenseReviewProposalData } from "../components/proposal-cards/expense-review-proposal-card";
import type { DisburseExpenseProposalData } from "../components/proposal-cards/disburse-expense-proposal-card";
import type { RoleChangeProposalData } from "../components/proposal-cards/role-change-proposal-card";
import type { CreateRoleProposalData } from "../components/proposal-cards/role-create-proposal-card";
import type { CreateUserProposalData } from "../components/proposal-cards/user-create-proposal-card";
import type { CreateUserBatchProposalData } from "../components/proposal-cards/user-batch-create-proposal-card";
import type { BankReconciliationProposalData } from "../components/proposal-cards/ai-reconciliation-proposal-card";
import type { ExpenseProposal } from "./expense-proposal";

export type AnyAiProposal =
  | QuickStartProposal
  | OwnProfileProposal
  | BudgetSyncProposal
  | RabExportProposal
  | ReconciliationProposal
  | BankCashProposal
  | ExpenseBatchProposal
  | ExpenseBatchActionProposal
  | VendorPaymentWorkflowProposal
  | AdministrationProposal
  | FinanceInputProposal
  | ProjectManagementProposal
  | CatalogSettingsProposal
  | ProcurementWarehouseProposal
  | ProjectStockProposal
  | RabWorkflowProposal
  | RabDraftProposal
  | LifecycleProposal
  | SetupProposal
  | PackageProposal
  | RapChangeProposal
  | RapDraftProposal
  | MaterialUpdateProposal
  | MaterialProposal
  | ({ readonly kind: "FIELD_EXPENSE" } & ExpenseProposal)
  | CreateProjectProposalData
  | SetupBudgetProposalData
  | VendorPaymentProposalData
  | ClientPaymentProposalData
  | GoodsReceiptProposalData
  | ExpenseReviewProposalData
  | DisburseExpenseProposalData
  | RoleChangeProposalData
  | CreateRoleProposalData
  | CreateUserProposalData
  | CreateUserBatchProposalData
  | BankReconciliationProposalData;

export function readAnyProposal(output: unknown): AnyAiProposal | null {
  if (typeof output !== "object" || output === null) return null;
  const proposal = (output as { proposal?: unknown }).proposal;
  if (typeof proposal !== "object" || proposal === null) return null;

  const candidate = proposal as Record<string, unknown>;
  const kind = candidate.kind as string | undefined;
  if (kind === "QUICK_START") {
    const p = quickStartProposalSchema.safeParse(proposal);
    return p.success ? p.data : null;
  }
  if (kind === "OWN_PROFILE") {
    const parsed = ownProfileProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "BUDGET_SYNC") {
    const parsed = budgetSyncProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "RAB_EXPORT") {
    const parsed = rabExportProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "BANK_RECONCILIATION_WORKFLOW") {
    const p = reconciliationProposalSchema.safeParse(proposal);
    return p.success ? p.data : null;
  }
  if (kind === "BANK_CASH") {
    const p = bankCashProposalSchema.safeParse(proposal);
    return p.success ? p.data : null;
  }
  if (kind === "EXPENSE_BATCH") {
    const p = expenseBatchProposalSchema.safeParse(proposal);
    return p.success ? p.data : null;
  }
  if (kind === "EXPENSE_BATCH_ACTION") {
    const p = expenseBatchActionProposalSchema.safeParse(proposal);
    return p.success ? p.data : null;
  }
  if (kind === "VENDOR_PAYMENT_WORKFLOW") {
    const parsed = vendorPaymentWorkflowProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "ADMINISTRATION") {
    const parsed = administrationProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "FINANCE_INPUT") {
    const parsed = financeInputProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "PROJECT_MANAGEMENT") {
    const parsed = projectManagementProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "CATALOG_SETTINGS") {
    const parsed = catalogSettingsProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "PROCUREMENT_WAREHOUSE") {
    const parsed = procurementWarehouseProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "PROJECT_STOCK") {
    const parsed = projectStockProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "RAB_WORKFLOW") {
    const parsed = rabWorkflowProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "RAB_DRAFT") {
    const parsed = rabDraftProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "RAP_LIFECYCLE") {
    const parsed = lifecycleProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "RAP_SETUP_ACTIONS") {
    const parsed = setupProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }
  if (kind === "CATEGORY_PLAN_PACKAGES") {
    const parsed = packageProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "RAP_MATERIAL_CHANGES") {
    const parsed = rapChangeProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "RAP_MATERIAL_DRAFT") {
    const parsed = rapDraftProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "MATERIAL_MASTER_UPDATE") {
    const parsed = materialUpdateProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "MATERIAL_MASTER_IMPORT") {
    const parsed = materialProposalSchema.safeParse(proposal);
    return parsed.success ? parsed.data : null;
  }

  if (kind === "CREATE_USER_BATCH") {
    if (typeof candidate.count === "number" && Array.isArray(candidate.users)) {
      return candidate as unknown as CreateUserBatchProposalData;
    }
  }

  if (kind === "CREATE_USER") {
    if (
      typeof candidate.name === "string" &&
      typeof candidate.email === "string" &&
      typeof candidate.roleId === "string" &&
      typeof candidate.temporaryPassword === "string"
    ) {
      return candidate as unknown as CreateUserProposalData;
    }
  }

  if (kind === "CREATE_ROLE") {
    if (
      typeof candidate.displayName === "string" &&
      typeof candidate.dataScope === "string" &&
      Array.isArray(candidate.permissions)
    ) {
      return candidate as unknown as CreateRoleProposalData;
    }
  }

  if (kind === "ROLE_PERMISSION_CHANGE") {
    if (
      typeof candidate.roleId === "string" &&
      Array.isArray(candidate.grant) &&
      Array.isArray(candidate.revoke)
    ) {
      return candidate as unknown as RoleChangeProposalData;
    }
  }

  if (kind === "CREATE_PROJECT") {
    if (typeof candidate.name === "string" && typeof candidate.totalContractValue === "object") {
      const budgetDefaults = projectBudgetDefaultsSchema.safeParse(candidate.budgetDefaults);
      return {
        ...candidate,
        budgetDefaults: budgetDefaults.success ? budgetDefaults.data : undefined,
      } as unknown as CreateProjectProposalData;
    }
  }

  if (kind === "SETUP_BUDGET") {
    if (Array.isArray(candidate.categories) && typeof candidate.internalBudget === "object") {
      return candidate as unknown as SetupBudgetProposalData;
    }
  }

  if (kind === "PAY_VENDOR_BILL") {
    if (
      typeof candidate.vendorPaymentId === "string" &&
      typeof candidate.bankBalanceBefore === "object"
    ) {
      return candidate as unknown as VendorPaymentProposalData;
    }
  }

  if (kind === "RECORD_CLIENT_PAYMENT") {
    if (
      typeof candidate.clientInvoiceId === "string" &&
      typeof candidate.bankBalanceBefore === "object"
    ) {
      return candidate as unknown as ClientPaymentProposalData;
    }
  }

  if (kind === "POST_GOODS_RECEIPT") {
    if (
      typeof candidate.materialId === "string" &&
      typeof candidate.stockOnHandBefore === "number"
    ) {
      return candidate as unknown as GoodsReceiptProposalData;
    }
  }

  if (kind === "EXPENSE_REVIEW") {
    if (typeof candidate.expenseId === "string" && typeof candidate.action === "string") {
      return candidate as unknown as ExpenseReviewProposalData;
    }
  }

  if (kind === "DISBURSE_EXPENSE") {
    if (
      typeof candidate.expenseId === "string" &&
      typeof candidate.bankBalanceBefore === "object"
    ) {
      return candidate as unknown as DisburseExpenseProposalData;
    }
  }

  if (kind === "BANK_RECONCILIATION") {
    if (typeof candidate.bankAccountId === "string" && Array.isArray(candidate.matches)) {
      return candidate as unknown as BankReconciliationProposalData;
    }
  }

  // Fallback ke ExpenseProposal biasa jika memiliki field khasnya
  if (
    typeof candidate.projectId === "string" &&
    typeof candidate.projectBudgetCategoryId === "string" &&
    typeof candidate.amount === "object"
  ) {
    return { kind: "FIELD_EXPENSE", ...(candidate as unknown as ExpenseProposal) };
  }

  return null;
}
