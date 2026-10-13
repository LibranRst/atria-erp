import { expect, test } from "bun:test";
import { bankCashInputSchema, bankCashPermission, bankCashNeedsConfirmation } from "./bank-cash";
const id = "77777777-7777-7777-7777-777777777771",
  to = "77777777-7777-7777-7777-777777777772";
const movement = {
  action: "CASH_MOVEMENT",
  bankAccountId: id,
  type: "OUTFLOW",
  amount: 15000,
  category: "bank_fee",
  description: "Biaya administrasi bank",
  transactionDate: "2026-10-11",
  referenceNumber: "REF-11",
};
test("bank cash requires exact money, dates, human references and distinct transfer accounts", () => {
  expect(bankCashInputSchema.safeParse(movement).success).toBe(true);
  for (const patch of [
    { amount: 0 },
    { amount: 0.001 },
    { amount: Infinity },
    { referenceNumber: "" },
    { transactionDate: "2026-02-31" },
    { bankAccountId: "invented" },
    { userId: id },
  ])
    expect(bankCashInputSchema.safeParse({ ...movement, ...patch }).success).toBe(false);
  expect(
    bankCashInputSchema.safeParse({
      action: "TRANSFER",
      fromBankAccountId: id,
      toBankAccountId: id,
      amount: 100,
      description: "Pemindahan saldo",
      transactionDate: "2026-10-11",
      referenceNumber: "T-11",
    }).success,
  ).toBe(false);
  expect(
    bankCashInputSchema.safeParse({
      action: "TRANSFER",
      fromBankAccountId: id,
      toBankAccountId: to,
      amount: 100,
      description: "Pemindahan saldo",
      transactionDate: "2026-10-11",
      referenceNumber: "T-11",
    }).success,
  ).toBe(true);
});
test("metadata patches preserve unspecified theme fields and reject direct balance/status overrides", () => {
  const p = bankCashInputSchema.parse({
    action: "EDIT_ACCOUNT",
    bankAccountId: id,
    patch: { name: "Kas utama" },
  });
  expect(p.action).toBe("EDIT_ACCOUNT");
  if (p.action !== "EDIT_ACCOUNT") throw new Error("wrong action");
  expect(p.patch).toEqual({ name: "Kas utama" });
  for (const patch of [{}, { balance: 50 }, { isActive: false }])
    expect(
      bankCashInputSchema.safeParse({ action: "EDIT_ACCOUNT", bankAccountId: id, patch }).success,
    ).toBe(false);
});
test("opening cash is explicit; money and sensitive bank identity changes retain confirmation", () => {
  const base = {
    action: "CREATE_ACCOUNT",
    payload: {
      name: "Kas QA",
      bankName: "Bank QA",
      accountNumber: "QA-001",
      holderName: "Pemegang QA",
    },
  };
  const zero = bankCashInputSchema.parse(base);
  expect(zero.action).toBe("CREATE_ACCOUNT");
  expect(bankCashNeedsConfirmation(zero)).toBe(false);
  expect(
    bankCashInputSchema.safeParse({ ...base, payload: { ...base.payload, openingBalance: 100 } })
      .success,
  ).toBe(false);
  const cash = bankCashInputSchema.parse({
    ...base,
    openingDate: "2026-10-11",
    payload: { ...base.payload, openingBalance: 100, openingReference: "OPEN-11" },
  });
  expect(bankCashNeedsConfirmation(cash)).toBe(true);
  const name = bankCashInputSchema.parse({
    action: "EDIT_ACCOUNT",
    bankAccountId: id,
    patch: { name: "Kas baru" },
  });
  expect(bankCashNeedsConfirmation(name)).toBe(false);
  expect(bankCashPermission(name)).toBe("update:bank_account");
  expect(
    bankCashNeedsConfirmation(
      bankCashInputSchema.parse({
        action: "EDIT_ACCOUNT",
        bankAccountId: id,
        patch: { accountNumber: "QA-002" },
      }),
    ),
  ).toBe(true);
  expect(
    bankCashPermission(
      bankCashInputSchema.parse({ action: "ACCOUNT_STATUS", bankAccountId: id, isActive: false }),
    ),
  ).toBe("delete:bank_account");
});
