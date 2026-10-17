/** Read-only source context is independent of active-project form choices. */
export interface MaterialShortageRow {
  readonly projectRapItemId: string;
  readonly projectRapId: string;
  readonly projectId?: string | null;
  readonly projectName?: string | null;
  readonly unit?: string | null;
  readonly materialId: string | null;
  readonly materialName: string;
  readonly area: string;
  readonly requiredQuantity: number;
  readonly bufferQuantity: number;
  readonly totalQuantity: number;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly estimatedTotalCost: number;
  readonly status: string;
}
