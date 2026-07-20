export type OpeningInventoryEligibilityState = {
  readonly hasPendingOpening: boolean;
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly hasMovement: boolean;
};

export function getOpeningInventoryIneligibleReason(
  state: OpeningInventoryEligibilityState,
): string | null {
  if (state.hasPendingOpening) {
    return "Inventory sudah ada dalam pengajuan saldo awal yang menunggu persetujuan.";
  }
  if (state.currentStock !== 0) return "Inventory sudah memiliki saldo.";
  if (state.reservedStock !== 0) {
    return "Inventory memiliki stok yang sedang direservasi.";
  }
  if (state.hasMovement) {
    return "Inventory sudah memiliki riwayat pergerakan stok.";
  }
  return null;
}
