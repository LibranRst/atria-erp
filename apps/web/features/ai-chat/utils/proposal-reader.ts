import type { CreateProjectProposalData } from "../components/proposal-cards/create-project-proposal-card";
import type { SetupBudgetProposalData } from "../components/proposal-cards/setup-budget-proposal-card";
import type { VendorPaymentProposalData } from "../components/proposal-cards/vendor-payment-proposal-card";
import type { ClientPaymentProposalData } from "../components/proposal-cards/client-payment-proposal-card";
import type { GoodsReceiptProposalData } from "../components/proposal-cards/goods-receipt-proposal-card";
import type { ExpenseReviewProposalData } from "../components/proposal-cards/expense-review-proposal-card";
import type { DisburseExpenseProposalData } from "../components/proposal-cards/disburse-expense-proposal-card";
import type { ExpenseProposal } from "./expense-proposal";

export type AnyAiProposal =
  | ({ readonly kind: "FIELD_EXPENSE" } & ExpenseProposal)
  | CreateProjectProposalData
  | SetupBudgetProposalData
  | VendorPaymentProposalData
  | ClientPaymentProposalData
  | GoodsReceiptProposalData
  | ExpenseReviewProposalData
  | DisburseExpenseProposalData;

export function readAnyProposal(output: unknown): AnyAiProposal | null {
  if (typeof output !== "object" || output === null) return null;
  const proposal = (output as { proposal?: unknown }).proposal;
  if (typeof proposal !== "object" || proposal === null) return null;

  const candidate = proposal as Record<string, unknown>;
  const kind = candidate.kind as string | undefined;

  if (kind === "CREATE_PROJECT") {
    if (typeof candidate.name === "string" && typeof candidate.totalContractValue === "object") {
      return candidate as unknown as CreateProjectProposalData;
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
