import {
  DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS,
  thresholdCentsToRupiah,
} from "./approval-thresholds";

/**
 * @deprecated Ambang sekarang datang dari konfigurasi (`app_config`). Konstanta
 * ini hanya tersisa sebagai nilai seed dan cadangan bagi pemanggil yang belum
 * membaca konfigurasi.
 */
export const OWNER_APPROVAL_AMOUNT_THRESHOLD = thresholdCentsToRupiah(
  DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS,
);

export type ExpenseApprovalInput = {
  /** Nominal pengajuan yang sedang dinilai. */
  readonly amount: number;
  readonly allocatedAmount: number;
  readonly actualAmount: number;
  /**
   * Pengajuan lain pada kategori yang sama yang belum final. Jangan sertakan
   * `amount` di sini; pemanggil pada jalur verifikasi harus mengeluarkannya
   * lebih dulu karena pengajuan itu sendiri masih tercatat sebagai pending.
   */
  readonly otherPendingAmount: number;
  /**
   * Ambang persetujuan Owner dalam rupiah. Wajib diisi pemanggil sisi server
   * dari konfigurasi; nilai seed dipakai hanya bila tidak diberikan.
   */
  readonly ownerApprovalThreshold?: number;
};

export type ExpenseApprovalDecision = {
  readonly isOverrun: boolean;
  readonly requiresOwnerApproval: boolean;
};

/**
 * Menentukan apakah sebuah pengeluaran lapangan memerlukan persetujuan Owner.
 *
 * Dua pemicunya berdiri sendiri: nominal mencapai ambang, **atau** pengajuan
 * mendorong kategori melewati alokasinya.
 *
 * Komitmen kategori dihitung dari realisasi **ditambah** pengajuan lain yang
 * masih menunggu keputusan. Mengukur hanya terhadap realisasi membuat setiap
 * pengajuan dinilai seolah-olah ia satu-satunya: dua pengeluaran Rp400.000 dan
 * Rp300.000 pada alokasi Rp612.000 masing-masing lolos, padahal bersama-sama
 * melewati batas dan seharusnya berhenti untuk diputus Owner.
 */
export function decideExpenseApproval(input: ExpenseApprovalInput): ExpenseApprovalDecision {
  const committed = input.actualAmount + input.otherPendingAmount;
  const isOverrun = committed + input.amount > input.allocatedAmount;
  return {
    isOverrun,
    requiresOwnerApproval:
      input.amount >= (input.ownerApprovalThreshold ?? OWNER_APPROVAL_AMOUNT_THRESHOLD) ||
      isOverrun,
  };
}
