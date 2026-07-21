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
