export type SettingsPermissionState = {
  readonly canManageBudgetSettings: boolean;
  readonly canManageExpenseCategories: boolean;
  readonly canManageItemLibrary: boolean;
  readonly canManageMaterialSettings: boolean;
  readonly canManageUsers: boolean;
  readonly canManageVendors: boolean;
};

export type BudgetAllocationSettingRow = {
  readonly id: string;
  readonly name: string;
  readonly budgetCapRatio: number;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly categories: readonly BudgetAllocationCategoryRow[];
};

export type BudgetAllocationCategoryRow = {
  readonly id: string;
  readonly expenseCategoryId: string;
  readonly code: string;
  readonly name: string;
  readonly ratioPercentage: number;
  readonly isEnabled: boolean;
  readonly sortOrder: number;
};

export type ExpenseCategorySettingRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly defaultRatio: number;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly isCore: boolean;
};

export type ItemPriceLibraryRow = {
  readonly id: string;
  readonly expenseCategoryId: string;
  readonly expenseCategoryCode: string;
  readonly materialId: string | null;
  readonly materialName: string | null;
  readonly code: string | null;
  readonly itemType: string;
  readonly itemCategory: string;
  readonly name: string;
  readonly description: string | null;
  readonly unit: string;
  readonly defaultClientPrice: number;
  readonly defaultInternalCost: number;
  readonly isActive: boolean;
};

export type MaterialSettingRow = {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly defaultVendorId: string | null;
  readonly defaultVendorName: string | null;
  readonly name: string;
  readonly specification: string | null;
  readonly brand: string | null;
  readonly code: string | null;
  readonly color: string | null;
  readonly unit: string;
  readonly isActive: boolean;
  readonly inventory: readonly MaterialInventorySettingRow[];
};

export type MaterialInventorySettingRow = {
  readonly id: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly minimumStock: number;
  readonly averageCost: number;
  readonly lastPurchasePrice: number;
};

export type SettingsOverview = {
  readonly roleName: string;
  readonly permissions: SettingsPermissionState;
  readonly budgetAllocationSetting: BudgetAllocationSettingRow | null;
  readonly expenseCategories: readonly ExpenseCategorySettingRow[];
  readonly itemLibrary: readonly ItemPriceLibraryRow[];
  readonly materialCategories: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly vendors: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly inventoryLocations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly materials: readonly MaterialSettingRow[];
};

export type SettingsContext = {
  readonly roleName: string;
  readonly permissions: SettingsPermissionState;
};

export type SettingsHubOverview = SettingsContext & {
  readonly budgetCapRatio: number;
  readonly categoryAllocationRatio: number;
  readonly unallocatedBufferRatio: number;
  readonly activeCategoryCount: number;
  readonly activeItemCount: number;
  readonly activeMaterialCount: number;
};

export type BudgetSettingsData = SettingsContext & {
  readonly budgetAllocationSetting: BudgetAllocationSettingRow | null;
};

export type ExpenseCategorySettingsData = SettingsContext & {
  readonly expenseCategories: readonly ExpenseCategorySettingRow[];
};

export type ItemLibrarySettingsData = SettingsContext & {
  readonly expenseCategories: readonly ExpenseCategorySettingRow[];
  readonly materials: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly isActive: boolean;
  }>;
  readonly vendors: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly itemLibrary: readonly ItemPriceLibraryRow[];
};

export type MaterialSettingsData = SettingsContext & {
  readonly materialCategories: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly vendors: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly inventoryLocations: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly materials: readonly MaterialSettingRow[];
};
