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

export interface RapItemView {
  readonly id: string;
  readonly materialId: string | null;
  readonly materialName: string;
  readonly area: string;
  readonly name: string;
  readonly description: string | null;
  readonly requiredQuantity: string;
  readonly bufferQuantity: string;
  readonly totalQuantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly source: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly reservedQuantity: number;
  readonly boughtQuantity: number;
  readonly usedQuantity: number;
  readonly leftoverQuantity: number;
  readonly securedQuantity: number;
  readonly returnedQuantity: number;
  readonly wasteQuantity: number;
  readonly actualMaterialCost: number;
  readonly costVariance: number;
}

export interface RapView {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
  readonly notes: string | null;
  readonly setupStage: string;
  readonly tukangScopeSkipped: boolean;
  readonly subconScopeSkipped: boolean;
  readonly setupUpdatedById: string | null;
  readonly items: RapItemView[];
}

export interface RabItemView {
  readonly id: string;
  readonly sourceType: string;
  readonly itemNature: "PRODUCTION" | "SERVICE_FEE";
  readonly sourceProjectRapItemId: string | null;
  readonly sourceProjectCategoryPlanItemId: string | null;
  readonly clientLabel: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly isBundle: boolean;
  readonly bundleId: string | null;
  readonly sourceRevision: number | null;
  readonly sourceUpdatedAt: Date | null;
}

export interface RabBundleView {
  readonly id: string;
  readonly clientLabel: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly itemIds: readonly string[];
}

export interface ChangeOrderHistoryView {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
  readonly scopeSummary: string;
  readonly previousContractValue: string;
  readonly valueDelta: string;
  readonly revisedContractValue: string;
  readonly clientConfirmedAt: Date | null;
  readonly clientConfirmationReference: string | null;
  readonly createdAt: Date;
  readonly approvedAt: Date | null;
  readonly createdByName: string;
  readonly approvedByName: string | null;
  readonly baseRevision: number;
  readonly revisedRevision: number;
  readonly sourceRevisionSummary: string;
}

export interface RabEstimateView {
  readonly id: string;
  readonly sourceProjectRapId: string | null;
  readonly supersedesRabEstimateId: string | null;
  readonly status: string;
  readonly revision: number;
  readonly title: string;
  readonly clientNotes: string | null;
  readonly approvedValue: string;
  readonly items: RabItemView[];
  readonly bundles: RabBundleView[];
}

export interface RabRevisionHistoryView {
  readonly id: string;
  readonly revision: number;
  readonly status: string;
  readonly value: number;
  readonly voidReason: string | null;
  readonly voidedAt: Date | null;
  readonly voidedByName: string | null;
}

export interface ProjectPlanBudgetCategory {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface VendorOption {
  readonly id: string;
  readonly name: string;
}

export interface ProjectCategoryPlanItemView {
  readonly id: string;
  readonly projectBudgetCategoryId: string;
  readonly expenseCategoryCode: string;
  readonly expenseCategoryName: string;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly name: string;
  readonly scopeDescription: string | null;
  readonly area: string;
  readonly quantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly displayOrder: number;
  readonly actualCost: number;
  readonly variance: number;
}

export type RapFormState = {
  templateId: string;
  materialId: string;
  area: string;
  name: string;
  description: string;
  requiredQuantity: string;
  bufferQuantity: string;
  unit: string;
  estimatedUnitCost: string;
  source: "STOCK" | "PURCHASE" | "STOCK_AND_PURCHASE" | "VENDOR";
  internalNote: string;
};

export type CategoryPlanFormState = {
  templateId: string;
  projectBudgetCategoryId: string;
  vendorId: string;
  name: string;
  scopeDescription: string;
  area: string;
  quantity: string;
  unit: string;
  estimatedUnitCost: string;
  internalNote: string;
};

export type ManualQuotationLine = {
  clientLabel: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  itemNature?: "PRODUCTION" | "SERVICE_FEE";
};

export type RapSetupStage = "MATERIAL" | "TUKANG" | "SUBCON" | "REVIEW";
export type RapOverviewFilter = "MATERIAL" | "TUKANG" | "SUBCON";

export function isRabManualSourceType(sourceType: string | null | undefined): boolean {
  return sourceType === "MANUAL" || sourceType === "MANUAL_CLIENT_LINE";
}
