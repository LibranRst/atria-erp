import { describe, expect, test } from "bun:test";

import { canExposeExpenseBankAccounts, redactExpensePaymentBankData } from "./expenses-access";

describe("Expenses bank-data boundary", () => {
  test("only exposes bank accounts to Owner and Finance Admin", () => {
    expect(canExposeExpenseBankAccounts("OWNER")).toBe(true);
    expect(canExposeExpenseBankAccounts("FINANCE_ADMIN")).toBe(true);
    expect(canExposeExpenseBankAccounts("PURCHASING")).toBe(false);
    expect(canExposeExpenseBankAccounts("PROJECT_MANAGER")).toBe(false);
  });

  test("removes bank identity from non-finance payment payloads", () => {
    expect(
      redactExpensePaymentBankData(
        { bankAccountId: "bank-1", bankAccount: { name: "BCA Operasional" }, amount: 100 },
        false,
      ),
    ).toEqual({ bankAccountId: "", bankAccount: null, amount: 100 });
  });
});
