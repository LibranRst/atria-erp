/**
 * Bentuk usulan pengeluaran yang dikirim tool `proposeExpenseDraft` ke antarmuka.
 *
 * Keluaran tool berasal dari server, tetapi tetap diperiksa bentuknya di klien
 * sebelum dirender sebagai kartu yang bisa memicu penulisan data. Kartu yang
 * datanya tidak lengkap lebih baik tidak muncul sama sekali daripada muncul
 * dengan nilai yang salah.
 */

export type ProposalMoney = {
  readonly amount: number;
  readonly formatted: string;
};

export type ExpenseProposal = {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectBudgetCategoryId: string;
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: ProposalMoney;
  readonly amount: ProposalMoney;
  readonly remainingBeforeSubmit: ProposalMoney;
  readonly exceedsRemaining: boolean;
};

function isMoney(value: unknown): value is ProposalMoney {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as ProposalMoney;
  return typeof candidate.amount === "number" && typeof candidate.formatted === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Mengambil usulan dari keluaran tool, atau `null` jika bentuknya tidak utuh
 * (misalnya tool mengembalikan penolakan akses atau pesan kesalahan).
 */
export function readExpenseProposal(output: unknown): ExpenseProposal | null {
  if (typeof output !== "object" || output === null) return null;

  const proposal = (output as { proposal?: unknown }).proposal;
  if (typeof proposal !== "object" || proposal === null) return null;

  const candidate = proposal as ExpenseProposal;

  if (
    !isNonEmptyString(candidate.projectId) ||
    !isNonEmptyString(candidate.projectName) ||
    !isNonEmptyString(candidate.projectBudgetCategoryId) ||
    !isNonEmptyString(candidate.categoryName) ||
    !isNonEmptyString(candidate.description) ||
    typeof candidate.quantity !== "number" ||
    typeof candidate.exceedsRemaining !== "boolean" ||
    !isMoney(candidate.unitPrice) ||
    !isMoney(candidate.amount) ||
    !isMoney(candidate.remainingBeforeSubmit)
  ) {
    return null;
  }

  if (!(candidate.quantity > 0) || !(candidate.amount.amount > 0)) {
    return null;
  }

  return candidate;
}
