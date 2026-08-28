import { actorHasPermission } from "@atria/core/auth/permissions";

/**
 * Rekening bank hanya terbuka bagi peran yang memang berhak melihatnya.
 *
 * Dulu ini daftar nama peran; sekarang ia bertanya pada izin yang sama dengan
 * yang menjaga halaman rekening itu sendiri, sehingga mencabut
 * `view:bank_account` benar-benar menutup datanya di sini juga.
 */
export function canExposeExpenseBankAccounts(roleName: string): boolean {
  return actorHasPermission(roleName, "view:bank_account");
}

export function redactExpensePaymentBankData<
  TPayment extends {
    readonly bankAccountId: string;
    readonly bankAccount?: { readonly name: string } | null;
  },
>(
  payment: TPayment,
  canExpose: boolean,
): Omit<TPayment, "bankAccountId" | "bankAccount"> & {
  readonly bankAccountId: string;
  readonly bankAccount: { readonly name: string } | null;
} {
  if (canExpose) {
    return {
      ...payment,
      bankAccountId: payment.bankAccountId,
      bankAccount: payment.bankAccount ?? null,
    };
  }
  return {
    ...payment,
    bankAccountId: "",
    bankAccount: null,
  };
}
