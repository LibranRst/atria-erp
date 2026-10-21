import { describe, expect, test } from "bun:test";

import { canExposeExpenseBankAccounts, redactExpensePaymentBankData } from "./expenses-access";

describe("Expenses bank-data boundary", () => {
  test("only exposes bank accounts with the effective permission", () => {
    expect(canExposeExpenseBankAccounts(["view:bank_account"])).toBe(true);
    expect(canExposeExpenseBankAccounts(["pay:cost", "view:bank_account"])).toBe(true);
    expect(canExposeExpenseBankAccounts([])).toBe(false);
    expect(canExposeExpenseBankAccounts(["pay:cost"])).toBe(false);
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
