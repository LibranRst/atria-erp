export interface ExpenseCostItem {
  id: string;
  amount: string;
  description: string;
  receiptImageUrl: string | null;
  status: "SUBMITTED" | "VERIFIED" | "APPROVED" | "REJECTED" | "PAID";
  budgetOverrun: boolean;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  } | null;
  budgetItem: {
    id: string;
    name: string;
    allocatedAmount: string;
    actualSpent: string;
    costCategory: {
      name: string;
    } | null;
  } | null;
  requestedBy: {
    name: string;
  } | null;
}

export interface BankAccountItem {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: string;
}

export type FilterStatus =
  "ALL" | "NEEDS_VERIFICATION" | "NEEDS_APPROVAL" | "READY_TO_PAY" | "PAID" | "REJECTED";

export type ExpenseListTab = "FIELD_CLAIMS" | "VENDOR_BILLS";
