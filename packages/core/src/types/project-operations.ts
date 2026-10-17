/** Read status is separate from empty collections and valid zero quantities. */
export interface ProjectOperationSource {
  readonly status: "ready" | "missing" | "restricted" | "unavailable";
  readonly message?: string;
}

/** Stock consumers need quantities and identity, not internal RAP pricing or notes. */
export interface ProjectStockItem {
  readonly id: string;
  readonly materialId: string | null;
  readonly materialName: string;
  readonly area: string;
  readonly name: string;
  readonly totalQuantity: string;
  readonly unit: string;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly reservedQuantity: number;
  readonly boughtQuantity: number;
  readonly usedQuantity: number;
  readonly leftoverQuantity: number;
  readonly securedQuantity: number;
  readonly returnedQuantity: number;
  readonly wasteQuantity: number;
}

export interface ProjectStockRap {
  readonly id: string;
  readonly items: readonly ProjectStockItem[];
}

export interface ProjectStockMaterial {
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

export interface ProjectStockData {
  readonly source: ProjectOperationSource;
  readonly rap: ProjectStockRap | null;
  readonly materials: readonly ProjectStockMaterial[];
}

export interface ProjectExpensesSource {
  readonly costs: ProjectOperationSource;
  readonly vendorBills: ProjectOperationSource;
}
