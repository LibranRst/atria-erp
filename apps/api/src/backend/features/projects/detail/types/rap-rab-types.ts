export interface MaterialOption {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly lastPurchasePrice: string;
  readonly availableStock: number;
  readonly categoryName: string;
  readonly inventories: readonly {
    readonly inventoryId: string;
    readonly locationId: string;
    readonly locationName: string;
    readonly currentStock: number;
    readonly reservedStock: number;
    readonly availableStock: number;
    readonly averageCost: number;
  }[];
}

export interface PricingTemplateOption {
  readonly id: string;
  readonly itemType: string;
  readonly expenseCategoryId: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly unit: string;
  readonly internalCost: number;
  readonly suggestedClientPrice: number;
}
