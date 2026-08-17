export type ApprovalDetailType = "project_cost" | "vendor_payment" | "inventory_opening";

type ApprovalDetailBase = {
  readonly id: string;
  readonly createdAt: Date;
  readonly dueDate: Date | null;
  readonly notes: string | null;
  readonly referenceId: string;
  readonly amount: number;
  readonly description: string;
  readonly receiptImageUrl: string | null;
  readonly projectName: string;
  readonly budgetItemName: string;
  readonly allocatedAmount: number;
  readonly actualSpent: number;
  readonly requestedBy: string;
  readonly canEmergencyOverride?: boolean;
  readonly priority: "CRITICAL" | "WARNING" | "NORMAL";
  readonly priorityReason: string;
};

export type FinanceApprovalDetail = ApprovalDetailBase & {
  readonly type: "project_cost" | "vendor_payment";
  readonly allocatedAmount: number;
  readonly actualSpent: number;
  readonly budgetOverrun: boolean;
  /**
   * `false` ketika menyetujui permintaan ini tidak menaikkan realisasi
   * kategori. Tagihan vendor kategori Material adalah pembelian persediaan:
   * ia disimpan sebagai `INVENTORY_PURCHASE`/`INVENTORY_ASSET` dan realisasi
   * Material baru diakui saat stok dipakai atau menjadi waste.
   *
   * Tanpa penanda ini, panel "Dampak ke budget" memproyeksikan kenaikan
   * realisasi yang tidak pernah terjadi — angka yang dipakai Owner untuk
   * memutus pencairan.
   */
  readonly consumesBudgetActual: boolean;
};

export type InventoryOpeningApprovalDetail = ApprovalDetailBase & {
  readonly type: "inventory_opening";
  readonly allocatedAmount: 0;
  readonly actualSpent: 0;
  readonly budgetOverrun: false;
  /** Saldo awal stok membentuk nilai persediaan, bukan realisasi proyek. */
  readonly consumesBudgetActual: false;
  readonly inventoryItems: readonly InventoryOpeningApprovalItem[];
};

export type InventoryOpeningApprovalItem = {
  readonly id: string;
  readonly materialInventoryId: string;
  readonly materialName: string;
  readonly locationName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly totalValue: number;
};

export type ApprovalDetail = FinanceApprovalDetail | InventoryOpeningApprovalDetail;
