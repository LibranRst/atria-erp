export const OWNER_APPROVAL_AMOUNT_THRESHOLD = 5_000_000;

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
    requiresOwnerApproval: input.amount >= OWNER_APPROVAL_AMOUNT_THRESHOLD || isOverrun,
  };
}
