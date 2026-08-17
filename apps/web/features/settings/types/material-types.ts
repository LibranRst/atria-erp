export type SettingsOption = { readonly id: string; readonly name: string };

export type MaterialDraft = {
  readonly id?: string;
  readonly categoryId: string;
  readonly defaultVendorId: string | null;
  readonly name: string;
  readonly specification: string;
  readonly brand: string;
  readonly code: string;
  readonly color: string;
  readonly unit: string;
  readonly isActive: boolean;
  readonly locationId: string;
  readonly minimumStock: number;
  readonly lastPurchasePrice: number;
};

export type InventoryDraft = {
  readonly materialId: string;
  readonly id: string;
  readonly locationName: string;
  readonly minimumStock: number;
  readonly lastPurchasePrice: number;
};

export type DetailNextAction =
  | { readonly kind: "EDIT_MATERIAL"; readonly draft: MaterialDraft }
  | { readonly kind: "EDIT_INVENTORY"; readonly draft: InventoryDraft };
