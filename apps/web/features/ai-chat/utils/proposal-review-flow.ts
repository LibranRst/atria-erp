import type { AdministrationProposal } from "@atria/core/ai/administration";
import { bankCashNeedsConfirmation, type BankCashProposal } from "@atria/core/ai/bank-cash";
import type { ExpenseBatchActionProposal } from "@atria/core/ai/expense-batch";
import type { VendorPaymentWorkflowProposal } from "@atria/core/ai/vendor-payment-workflow";
import type { FinanceInputProposal } from "@atria/core/ai/finance-input";
import type { ProjectManagementProposal } from "@atria/core/ai/project-management";
import type { CatalogSettingsProposal } from "@atria/core/ai/catalog-settings";
import type { ProcurementWarehouseProposal } from "@atria/core/ai/procurement-warehouse";
import type { ProjectStockProposal } from "@atria/core/ai/project-stock";
import type { SetupProposal } from "@atria/core/ai/rap-finalization";
import type { LifecycleProposal } from "@atria/core/ai/rap-lifecycle";
import type { RapChangeProposal } from "@atria/core/ai/rap-change";
import type { PackageProposal } from "@atria/core/ai/category-plan";
import type { RabWorkflowProposal } from "@atria/core/ai/rab-workflow";
export type AdaptiveProposal =
  | BankCashProposal
  | ExpenseBatchActionProposal
  | VendorPaymentWorkflowProposal
  | AdministrationProposal
  | FinanceInputProposal
  | ProjectManagementProposal
  | CatalogSettingsProposal
  | ProcurementWarehouseProposal
  | ProjectStockProposal
  | SetupProposal
  | LifecycleProposal
  | RapChangeProposal
  | PackageProposal
  | RabWorkflowProposal;
export type ProposalReviewFlow = {
  readonly review: "inline" | "sheet";
  readonly confirmation: "direct" | "dialog";
};
const inline = (sensitive = false): ProposalReviewFlow => ({
  review: "inline",
  confirmation: sensitive ? "dialog" : "direct",
});
const sheet = (sensitive = false): ProposalReviewFlow => ({
  review: "sheet",
  confirmation: sensitive ? "dialog" : "direct",
});
const bankFields = ["bankName", "bankAccountNumber", "bankAccountHolder"] as const;
const keys = (value: object): number => Object.keys(value).length;
function changed(before: object, after: object): number {
  return Object.keys(before).filter(
    (key) =>
      Reflect.get(before, key) !== Reflect.get(after, key) &&
      ![
        "estimatedTotalCost",
        "totalQuantity",
        "vendorName",
        "sourceLibraryItemId",
        "lineTotal",
      ].includes(key),
  ).length;
}
/** Presentation is derived from validated action/content, never a model-selected flag. */
export function proposalReviewFlow(proposal: AdaptiveProposal): ProposalReviewFlow {
  switch (proposal.kind) {
    case "BANK_CASH": {
      const sensitive =
        proposal.input.action === "EDIT_ACCOUNT"
          ? proposal.comparisons.some((c) =>
              ["Bank", "Nomor rekening", "Pemegang rekening"].includes(c.label),
            )
          : bankCashNeedsConfirmation(proposal.input);
      return proposal.input.action === "EDIT_ACCOUNT" && proposal.comparisons.length > 3
        ? sheet(sensitive)
        : inline(sensitive);
    }
    case "EXPENSE_BATCH_ACTION":
      return proposal.rows.length === 1 ? inline(true) : sheet(true);
    case "VENDOR_PAYMENT_WORKFLOW":
      return {
        review: "inline",
        confirmation: proposal.input.action === "SCHEDULE" ? "direct" : "dialog",
      };
    case "ADMINISTRATION": {
      const input = proposal.input;
      const protectedAction =
        input.action === "ROLE_DELETE" ||
        (input.action === "ROLE_DETAILS" && input.patch.dataScope !== undefined) ||
        (input.action === "STAFF_CHANGES" &&
          input.users.some((u) => u.patch.roleId !== undefined || u.patch.isActive !== undefined));
      const complex =
        proposal.rows.length > 1 ||
        proposal.rows.some((r) => r.changes.length > 3 || r.added.length + r.removed.length > 3);
      return complex ? sheet(protectedAction) : inline(protectedAction);
    }
    case "FINANCE_INPUT": {
      if (proposal.input.action === "APPROVAL_THRESHOLDS") return inline(true);
      if (proposal.input.action === "EXPENSE_CATEGORY_SETTINGS") {
        const sensitive = proposal.input.patch.defaultRatio !== undefined;
        return proposal.changes.length <= 3 ? inline(sensitive) : sheet(sensitive);
      }
      return proposal.input.action === "CREATE_INVOICE"
        ? inline()
        : proposal.input.action === "BUDGET_DEFAULTS" && proposal.changes.length <= 3
          ? inline(true)
          : sheet(proposal.input.action === "BUDGET_DEFAULTS");
    }
    case "PROJECT_MANAGEMENT": {
      const sensitive =
        (proposal.action !== "EDIT_PROJECT" && proposal.action !== "SUBMIT_BUDGET") ||
        (proposal.input.action === "EDIT_PROJECT" &&
          Object.hasOwn(proposal.input.patch, "clientId"));
      if (proposal.input.action === "EDIT_PROJECT" && Object.keys(proposal.input.patch).length > 3)
        return sheet(sensitive);
      if (proposal.input.action === "REALLOCATE_BUDGET" && proposal.input.categories.length > 2)
        return sheet(true);
      return inline(sensitive);
    }
    case "CATALOG_SETTINGS": {
      const input = proposal.input;
      switch (input.action) {
        case "VENDOR_CREATE": {
          const count = Object.values(input.payload).filter(
            (v) => v !== null && v !== undefined && v !== "",
          ).length;
          const bank = bankFields.some((k) => Boolean(input.payload[k]));
          return count <= 3 ? inline(bank) : sheet(bank);
        }
        case "VENDOR_EDIT": {
          const bank = bankFields.some((k) => Object.hasOwn(input.patch, k));
          return keys(input.patch) <= 3 ? inline(bank) : sheet(bank);
        }
        case "VENDOR_STATUS":
        case "LIBRARY_STATUS":
        case "LIBRARY_ARCHIVE":
        case "INVENTORY_DEFAULTS":
          return inline();
        case "LIBRARY_EDIT":
          return keys(input.patch) <= 3 &&
            !Object.hasOwn(input.patch, "materialId") &&
            !Object.hasOwn(input.patch, "expenseCategoryId")
            ? inline()
            : sheet();
        case "INVENTORY_VALUATION":
          return inline(true);
        case "PRICING_TEMPLATE_SAVE":
          return sheet(proposal.rows.some((r) => r.meta.includes("dihapus")));
        case "LIBRARY_CREATE":
          return sheet();
      }
    }
    case "PROJECT_STOCK": {
      const sensitive = ["USE", "RETURN", "WASTE"].includes(proposal.action);
      return proposal.rows.length === 1 ? inline(sensitive) : sheet(sensitive);
    }
    case "PROCUREMENT_WAREHOUSE": {
      if (proposal.action === "VENDOR_BILL_CORRECT") {
        const money = proposal.rows.some((row) => row.comparisons.some((c) => c.money));
        const risk = proposal.summary.some(
          (f) =>
            f.label === "Melebihi alokasi termasuk pending" &&
            typeof f.value === "number" &&
            f.value > 0,
        );
        return proposal.rows.length <= 2 && !risk ? inline(money) : sheet(money);
      }
      const metadata = [
        "STOCK_COUNT_SUBMIT",
        "STOCK_COUNT_REJECT",
        "RECEIPT_REVERSAL_REQUEST",
        "RECEIPT_REVERSAL_REJECT",
      ].includes(proposal.action);
      if (metadata) return inline();
      const sensitive = [
        "STOCK_CORRECT",
        "WAREHOUSE_TRANSFER",
        "STOCK_COUNT_APPROVE",
        "RECEIPT_REVERSAL_APPROVE",
        "VENDOR_BILL_SUBMIT",
        "PROJECT_RECEIPT",
        "WAREHOUSE_STOCK_IN",
        "OPENING_APPROVE",
        "OPENING_REVERSE",
      ].includes(proposal.action);
      const small = proposal.action.startsWith("VENDOR_BILL")
        ? proposal.rows.length <= 2
        : proposal.rows.length === 1;
      return small ? inline(sensitive) : sheet(sensitive);
    }
    case "RAP_SETUP_ACTIONS": {
      const finalize = proposal.request.steps.some((s) => s.action === "FINALIZE");
      const one =
        proposal.request.steps.length === 1 &&
        proposal.request.steps.every(
          (s) => s.action !== "READY_PACKAGES" || s.itemIds.length === 1,
        );
      const risk =
        proposal.budget.planTotal > proposal.budget.internalCap ||
        proposal.budget.categories.some((c) => c.overAllocation > 0);
      return one && !risk ? inline(finalize) : sheet(finalize);
    }
    case "RAP_LIFECYCLE": {
      const sensitive =
        proposal.request.action === "PACKAGE_CHANGES" &&
        proposal.request.rows.some((r) => r.action === "DELETE");
      return proposal.request.action === "PACKAGE_CHANGES" && proposal.rows.length === 1
        ? inline(sensitive)
        : sheet(sensitive);
    }
    case "RAP_MATERIAL_CHANGES": {
      const row = proposal.rows[0],
        sensitive = proposal.rows.some((r) => r.action === "DELETE");
      const small =
        proposal.rows.length === 1 &&
        row &&
        (row.after === null ||
          (changed(row.before, row.after) <= 3 &&
            row.before.materialId === row.after.materialId)) &&
        proposal.budget.overAllocation === 0;
      return small ? inline(sensitive) : sheet(sensitive);
    }
    case "CATEGORY_PLAN_PACKAGES": {
      const row = proposal.rows[0];
      return proposal.rows.length === 1 &&
        row?.action === "UPDATE" &&
        row.before &&
        row.after &&
        changed(row.before, row.after) <= 3 &&
        row.before.vendorId === row.after.vendorId &&
        proposal.budgets.every((b) => b.overAllocation === 0)
        ? inline()
        : sheet();
    }
    case "RAB_WORKFLOW": {
      const action = proposal.request.action;
      const protectedAction =
        [
          "APPROVE_INITIAL",
          "APPROVE_CHANGE_ORDER",
          "REJECT_CHANGE_ORDER",
          "CONFIRM_CLIENT",
          "DISSOLVE_BUNDLE",
          "VOID_REVISION",
        ].includes(action) ||
        (action === "EDIT_DRAFT" && proposal.request.rows.some((r) => r.action === "EXCLUDE"));
      const risk =
        (proposal.warning !== null && action !== "REFRESH_SOURCES") ||
        proposal.budgetImpact?.categories.some((c) => c.after < c.actual);
      if (["CONFIRM_CLIENT", "REJECT_CHANGE_ORDER"].includes(action)) return inline(true);
      if (["APPROVE_INITIAL", "APPROVE_CHANGE_ORDER"].includes(action))
        return risk ? sheet(true) : inline(true);
      if (action !== "EDIT_DRAFT" && action !== "REFRESH_SOURCES") return sheet(protectedAction);
      const row = proposal.rows[0];
      const small =
        proposal.rows.length <= 1 &&
        (!row || !row.before || !row.after || changed(row.before, row.after) <= 3) &&
        !risk;
      return small ? inline(protectedAction) : sheet(protectedAction);
    }
  }
}
