import type { inventoryOpeningBatch } from "@/db/schema";
import type { MaterialInventoryRow } from "./inventory";

export type OpeningBatch = typeof inventoryOpeningBatch.$inferSelect;

export type InventoryOpeningBatchView = OpeningBatch & {
  readonly itemCount: number;
  readonly totalValue: number;
  readonly canReverse: boolean;
  readonly requestedByName: string;
  readonly approvedByName: string | null;
  readonly reversedByName: string | null;
  readonly items: readonly {
    readonly id: string;
    readonly materialInventoryId: string;
    readonly materialName: string;
    readonly locationName: string;
    readonly unit: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly totalValue: number;
    readonly currentStock: number;
    readonly reservedStock: number;
    readonly availableStock: number;
    readonly averageCost: number;
    readonly stockMovementId: string | null;
  }[];
};

export type InitialStockCandidate = MaterialInventoryRow & {
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
};

export type InitialStockImportPreview = {
  readonly items: readonly {
    readonly rowNumber: number;
    readonly materialInventoryId: string;
    readonly materialName: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
  readonly errors: readonly {
    readonly rowNumber: number;
    readonly message: string;
  }[];
};
