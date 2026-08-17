/**
 * Aturan penjagaan pembayaran vendor.
 *
 * Ketiganya sebelumnya hanya hidup di dalam transaksi Server Action dan tidak
 * punya satu pun test. Dipisahkan ke sini supaya perilakunya dapat dikunci:
 * yang dijaga adalah uang keluar, jadi regresi diam-diam mahal.
 *
 * Seluruh nominal memakai `bigint` sen, sesuai aturan uang di CLAUDE.md.
 */

/** Ambang persetujuan Owner: Rp5.000.000 dalam sen. */
export const OWNER_APPROVAL_PAYMENT_THRESHOLD_CENTS = BigInt(500_000_000);

/**
 * Sisa tagihan yang boleh dibayar atau dijadwalkan.
 *
 * `committed` berbeda maknanya per pemanggil dan itu memang disengaja:
 * penjadwalan menghitung pembayaran `PENDING` **dan** `COMPLETED` supaya dua
 * jadwal tidak menumpuk melebihi tagihan, sedangkan pencairan hanya menghitung
 * yang `COMPLETED` karena pembayaran pending yang sedang dicairkan adalah
 * dirinya sendiri.
 */
export function exceedsVendorBillOutstanding({
  billAmountCents,
  committedCents,
  amountCents,
}: {
  readonly billAmountCents: bigint;
  readonly committedCents: bigint;
  readonly amountCents: bigint;
}): boolean {
  return amountCents > billAmountCents - committedCents;
}

/**
 * Apakah pencairan ini wajib memegang persetujuan Owner yang sudah `APPROVED`.
 *
 * Dua pemicunya independen: nominal mencapai ambang, atau kategori budget-nya
 * sudah terlampaui. Kategori yang persis mencapai alokasi belum terhitung
 * overrun — yang dijaga adalah melewati, bukan menyentuh.
 */
export function vendorPaymentRequiresOwnerApproval({
  amountCents,
  categoryAllocatedCents,
  categoryActualCents,
}: {
  readonly amountCents: bigint;
  readonly categoryAllocatedCents: bigint;
  readonly categoryActualCents: bigint;
}): boolean {
  const isOverrun = categoryActualCents > categoryAllocatedCents;
  return amountCents >= OWNER_APPROVAL_PAYMENT_THRESHOLD_CENTS || isOverrun;
}

export type VendorPaymentApprovalGate =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: "APPROVAL_RECORD_MISSING" }
  | { readonly allowed: false; readonly reason: "APPROVAL_REQUIRED_BUT_PENDING" };

/**
 * Gerbang akhir sebelum kas keluar. Ketiadaan record persetujuan dibedakan dari
 * record yang ada tetapi belum disetujui, karena keduanya menuntut tindakan
 * berbeda dari Finance.
 */
export function checkVendorPaymentApprovalGate({
  requiresApproval,
  approvalStatus,
}: {
  readonly requiresApproval: boolean;
  readonly approvalStatus: string | null | undefined;
}): VendorPaymentApprovalGate {
  if (!requiresApproval) return { allowed: true };
  if (!approvalStatus) return { allowed: false, reason: "APPROVAL_RECORD_MISSING" };
  if (approvalStatus !== "APPROVED") {
    return { allowed: false, reason: "APPROVAL_REQUIRED_BUT_PENDING" };
  }
  return { allowed: true };
}

export type VendorPaymentStateGate =
  | { readonly payable: true }
  | { readonly payable: false; readonly reason: "PAYMENT_ALREADY_COMPLETED" }
  | { readonly payable: false; readonly reason: "PAYMENT_NOT_PENDING" };

/**
 * Hanya pembayaran `PENDING` yang boleh dicairkan. Pembayaran `FAILED` — hasil
 * penolakan Owner — sengaja jatuh ke `PAYMENT_NOT_PENDING` agar percobaan
 * mencairkan pembayaran yang sudah ditolak berhenti di sini.
 */
export function checkVendorPaymentState(status: string): VendorPaymentStateGate {
  if (status === "PENDING") return { payable: true };
  if (status === "COMPLETED") return { payable: false, reason: "PAYMENT_ALREADY_COMPLETED" };
  return { payable: false, reason: "PAYMENT_NOT_PENDING" };
}
