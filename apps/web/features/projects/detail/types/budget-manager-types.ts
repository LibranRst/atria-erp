export interface BudgetItem {
  readonly id: string;
  readonly name: string;
  readonly budgetCategory: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly allocatedAmount: string;
  readonly actualSpent: string;
  readonly costCategoryId: string;
  readonly costCategory?: {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
  } | null;
}

export interface BudgetHeader {
  readonly id: string;
  readonly projectId: string;
  readonly status: string;
  readonly notes: string | null;
  readonly items?: readonly BudgetItem[];
}

export interface CostCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

export interface BudgetItemFormState {
  readonly itemName: string;
  readonly budgetCategory: string;
  readonly selectedCategoryId: string;
  readonly quantity: number | "";
  readonly unit: string;
  readonly unitPrice: number | "";
}

export interface BudgetItemFormSetters {
  readonly setItemName: (value: string) => void;
  readonly setBudgetCategory: (value: string) => void;
  readonly setSelectedCategoryId: (value: string) => void;
  readonly setQuantity: (value: number | "") => void;
  readonly setUnit: (value: string) => void;
  readonly setUnitPrice: (value: number | "") => void;
}
