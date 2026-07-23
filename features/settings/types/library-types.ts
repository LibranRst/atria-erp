import type { ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";

export type ItemType = "MATERIAL_ITEM" | "WORK_PACKAGE" | "SUBCON_PACKAGE" | "CLIENT_LINE";
export type ComponentType = "LABOR" | "MATERIAL" | "EQUIPMENT" | "LOGISTICS" | "OVERHEAD" | "OTHER";

export type CostComponentDraft = {
  readonly key: string;
  readonly vendorId: string | null;
  readonly componentType: ComponentType;
  readonly label: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitCost: number;
  readonly note: string;
};

export type Draft = {
  readonly id?: string;
  readonly expenseCategoryId: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly code: string;
  readonly itemType: ItemType;
  readonly itemCategory: string;
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly pricingMode: "MARGIN_BASED" | "FIXED_CLIENT_PRICE";
  readonly targetGrossPercentage: number;
  readonly fixedClientPrice: number;
  readonly priceSourceType: "COST_BREAKDOWN" | "VENDOR_QUOTE" | "HISTORICAL" | "LEGACY_BACKFILL";
  readonly sourceNote: string;
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly components: readonly CostComponentDraft[];
};

export type MaterialOption = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
};

export type VendorOption = { readonly id: string; readonly name: string };
