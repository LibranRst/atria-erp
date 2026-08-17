export interface VendorListVendor {
  readonly id: string;
  readonly name: string;
}

export interface VendorListBudgetItem {
  readonly id: string;
  readonly name: string;
  readonly allocatedAmount: string;
  readonly actualSpent: string;
}

export interface VendorListProject {
  readonly id: string;
  readonly name: string;
  readonly budget?: {
    readonly items?: VendorListBudgetItem[];
  } | null;
  readonly canonicalBudgets?: Array<{
    readonly id: string;
    readonly status: string;
    readonly categories?: Array<{
      readonly id: string;
      readonly code: string;
      readonly name: string;
      readonly allocatedAmount: string;
      readonly pendingAmount: string;
      readonly actualAmount: string;
      readonly paidAmount: string;
      readonly remainingAmount: string;
      readonly usedPercentage: string;
      readonly status: string;
      readonly sortOrder: number;
    }>;
  }>;
  readonly categoryPlanItems?: Array<{
    readonly id: string;
    readonly projectBudgetCategoryId: string;
    readonly expenseCategoryCode: string;
    readonly label: string;
    readonly area: string;
    readonly quantity: string;
    readonly unit: string;
    readonly estimatedTotalCost: string;
    readonly status: string;
  }>;
}

export interface VendorListBankAccount {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly balance: string;
}

export interface VendorListPayment {
  readonly id: string;
  readonly vendorBillId: string;
  readonly bankAccountId: string;
  readonly amountPaid: string;
  readonly status: string;
  readonly paymentDate: Date;
  readonly referenceNumber: string | null;
  readonly approvalStatus?: string;
  readonly bankAccount?: {
    readonly name: string;
  } | null;
  readonly vendorBill?: {
    readonly billNumber: string;
    readonly vendor?: {
      readonly name: string;
    } | null;
    readonly project?: {
      readonly name: string;
    } | null;
  } | null;
}

export interface VendorListBill {
  readonly id: string;
  readonly vendorId: string;
  readonly projectId: string;
  readonly projectBudgetItemId: string | null;
  readonly projectBudgetCategoryId: string;
  readonly billNumber: string;
  readonly amount: string;
  readonly status: string;
  readonly dueDate: Date;
  readonly notes: string | null;
  readonly vendor?: {
    readonly name: string;
  } | null;
  readonly project?: {
    readonly name: string;
  } | null;
  readonly budgetItem?: {
    readonly name: string;
  } | null;
  readonly payments?: VendorListPayment[];
}

export type VendorBillSubTab = "BILLS" | "PAYMENTS";
