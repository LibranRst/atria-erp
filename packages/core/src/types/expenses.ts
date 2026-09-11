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
  budgetCategory?: {
    id: string;
    expenseCategory?: {
      code: string;
      name: string;
    } | null;
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

export interface ProjectBudgetCategoryOption {
  id: string;
  code: string;
  name: string;
  allocatedAmount: string;
  pendingAmount: string;
  actualAmount: string;
  remainingAmount: string;
  usedPercentage: string;
  status: string;
  sortOrder: number;
}

export interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  availableStock: number;
}

export interface ProjectRapItemOption {
  id: string;
  materialId: string | null;
  label: string;
  area: string;
  quantity: string;
  unit: string;
  status: string;
}

export interface CategoryPlanItemOption {
  id: string;
  projectBudgetCategoryId: string;
  expenseCategoryCode: string;
  label: string;
  area: string;
  quantity: string;
  unit: string;
  estimatedTotalCost: string;
  status: string;
}

export interface InventoryLocationOption {
  id: string;
  name: string;
}

export interface ExpenseFormProject {
  id: string;
  name: string;
  canonicalBudgets?: Array<{
    id: string;
    status: string;
    categories?: ProjectBudgetCategoryOption[];
  }>;
  materialOptions?: MaterialOption[];
  rapItems?: ProjectRapItemOption[];
  categoryPlanItems?: CategoryPlanItemOption[];
}

export interface ExpenseLine {
  key: string;
  projectBudgetCategoryId: string;
  projectBudgetItemId: string;
  materialId: string;
  projectRapItemId: string;
  projectCategoryPlanItemId: string;
  stockHandling: "EXPENSE_ONLY" | "STOCK_IN" | "DIRECT_USE" | "RESERVE_FOR_PROJECT";
  inventoryLocationId: string;
  quantity: number | "";
  unitPrice: number | "";
  amount: number | "";
  description: string;
}

export interface ExpenseReceiptAttachment {
  fileId: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ExpenseDraftPayload {
  projectId: string;
  inputMode: "MANUAL" | "RECEIPT";
  receipt: ExpenseReceiptAttachment | null;
  lines: ExpenseLine[];
  ocrWarning: string | null;
}

export type ExpenseLinePatch = Partial<ExpenseLine> | keyof ExpenseLine;
