export type StockMovementDirection = "IN" | "OUT" | "NEUTRAL";

/**
 * Arah kanonis setiap jenis pergerakan stok.
 *
 * `stock_movement.movement_direction` adalah dasar rekonsiliasi antara buku
 * pergerakan dan saldo `material_inventory`: menjumlahkan `IN` dikurangi `OUT`
 * harus menghasilkan `current_stock`. Ketika arah tersimpan salah, saldo tidak
 * lagi dapat diturunkan dari jejak auditnya sendiri walaupun angka stoknya
 * benar.
 *
 * `RESERVE` sengaja `NEUTRAL`: reservasi menahan stok untuk sebuah proyek
 * tanpa memindahkan barang secara fisik.
 *
 * Jenis yang arahnya bergantung tanda selisih — `ADJUSTMENT`,
 * `STOCK_COUNT_ADJUSTMENT`, dan `TRANSFER` — tidak dipetakan di sini; penulisnya
 * menentukan arah secara eksplisit.
 */
const INBOUND_MOVEMENT_TYPES = [
  "OPENING_BALANCE",
  "STOCK_IN",
  "GOODS_RECEIPT",
  "RETURN",
  "TRANSFER_IN",
] as const;

const OUTBOUND_MOVEMENT_TYPES = [
  "USE",
  "WASTE",
  "TRANSFER_OUT",
  "GOODS_RECEIPT_REVERSAL",
] as const;

export function resolveStockMovementDirection(movementType: string): StockMovementDirection {
  if ((INBOUND_MOVEMENT_TYPES as readonly string[]).includes(movementType)) return "IN";
  if ((OUTBOUND_MOVEMENT_TYPES as readonly string[]).includes(movementType)) return "OUT";
  return "NEUTRAL";
}
