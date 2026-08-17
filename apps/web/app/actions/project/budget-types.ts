export interface ProjectForExpense {
  id: string;
  name: string;
  budget?: {
    id: string;
    status: string;
    items?: Array<{
      id: string;
      name: string;
      budgetCategory: string;
      quantity: string;
      unit: string;
      unitPrice: string;
      allocatedAmount: string;
      actualSpent: string;
      costCategory?: {
        id: string;
        name: string;
        description: string | null;
      } | null;
    }>;
  } | null;
  canonicalBudgets?: Array<{
    id: string;
    status: string;
    categories?: Array<{
      id: string;
      code: string;
      name: string;
      allocatedAmount: string;
      pendingAmount: string;
      actualAmount: string;
      paidAmount: string;
      remainingAmount: string;
      usedPercentage: string;
      status: string;
      sortOrder: number;
    }>;
  }>;
  materialOptions?: Array<{
    id: string;
    name: string;
    unit: string;
    availableStock: number;
  }>;
  rapItems?: Array<{
    id: string;
    materialId: string | null;
    label: string;
    area: string;
    quantity: string;
    unit: string;
    status: string;
  }>;
  categoryPlanItems?: Array<{
    id: string;
    projectBudgetCategoryId: string;
    expenseCategoryCode: string;
    label: string;
    area: string;
    quantity: string;
    unit: string;
    estimatedTotalCost: string;
    status: string;
  }>;
  inventoryLocations?: Array<{
    id: string;
    name: string;
  }>;
}
