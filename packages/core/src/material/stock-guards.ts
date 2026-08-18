/**
 * Penjagaan pergerakan stok yang melindungi reservasi proyek lain dan mencegah
 * pengembalian melebihi pemakaian.
 *
 * Sama seperti aturan pembayaran vendor, ketiganya sebelumnya hanya hidup di
 * dalam transaksi dan tidak punya test. Yang dijaga di sini adalah stok milik
 * proyek lain — kesalahan di sini merugikan proyek yang tidak melakukan apa pun.
 */

export type ProjectStockMovement = {
  readonly movementType: string;
  readonly quantity: number;
};

/**
 * Pemakaian bersih satu proyek atas satu material: `USE` menambah, `RETURN`
 * mengurangi, tipe lain diabaikan. Inilah plafon yang boleh dikembalikan.
 */
export function calculateNetProjectUsage(movements: readonly ProjectStockMovement[]): number {
  return movements.reduce((total, movement) => {
    if (movement.movementType === "USE") return total + movement.quantity;
    if (movement.movementType === "RETURN") return total - movement.quantity;
    return total;
  }, 0);
}

/**
 * Bagian C "Excess return": pengembalian tidak boleh melebihi pemakaian bersih.
 * Mengembalikan lebih banyak dari yang dipakai akan menciptakan stok dari udara.
 */
export function exceedsProjectUsage({
  returnQuantity,
  movements,
}: {
  readonly returnQuantity: number;
  readonly movements: readonly ProjectStockMovement[];
}): boolean {
  return returnQuantity > calculateNetProjectUsage(movements);
}

/**
 * Sisa reservasi setelah proyek yang sedang bergerak melepas miliknya sendiri.
 *
 * Reservasi milik proyek yang bergerak ikut susut lebih dulu — hanya sebanyak
 * yang benar-benar dipakai, tidak lebih — sehingga yang tersisa adalah reservasi
 * proyek lain yang tetap harus tertutupi.
 */
export function reservedAfterOwnRelease({
  reserved,
  ownReserved,
  quantity,
}: {
  readonly reserved: bigint;
  readonly ownReserved: bigint;
  readonly quantity: bigint;
}): bigint {
  const reservedReduction = quantity > ownReserved ? ownReserved : quantity;
  return reserved - reservedReduction;
}

/**
 * Bagian C "Cross-project reserve": stok sesudah pergerakan tidak boleh turun di
 * bawah reservasi yang masih dipegang proyek lain.
 */
export function violatesOtherProjectReservation({
  nextCurrent,
  reserved,
  ownReserved,
  quantity,
}: {
  readonly nextCurrent: bigint;
  readonly reserved: bigint;
  readonly ownReserved: bigint;
  readonly quantity: bigint;
}): boolean {
  return nextCurrent < reservedAfterOwnRelease({ reserved, ownReserved, quantity });
}

/**
 * Varian untuk pembatalan goods receipt: tidak ada reservasi milik sendiri yang
 * ikut susut, jadi seluruh reservasi yang ada harus tetap tertutupi.
 */
export function reversalWouldConsumeReservedStock({
  currentStock,
  reversalQuantity,
  reservedStock,
}: {
  readonly currentStock: number;
  readonly reversalQuantity: number;
  readonly reservedStock: number;
}): boolean {
  return currentStock - reversalQuantity < reservedStock;
}
