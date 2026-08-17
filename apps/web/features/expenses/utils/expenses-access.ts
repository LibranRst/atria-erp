export function canExposeExpenseBankAccounts(roleName: string): boolean {
  return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
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
