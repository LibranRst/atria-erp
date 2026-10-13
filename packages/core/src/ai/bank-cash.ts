import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { createBankAccountSchema, updateBankAccountSchema } from "../validations/finance";
import { hasTwoDecimalPrecision } from "../project/rap-cost";

export const BANK_CASH_KIND = "BANK_CASH";
export const BANK_MONEY_MAX = 9_999_999_999_999.99;
export const bankMoneySchema = z
  .number()
  .finite()
  .nonnegative()
  .max(BANK_MONEY_MAX)
  .refine(hasTwoDecimalPrecision, "Nominal maksimal dua angka desimal.");
const id = z.string().guid();
const reference = z.string().trim().min(2).max(100);
const identityFields = {
  name: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().min(3).max(50),
  bankName: z.string().trim().min(2).max(100),
  holderName: z.string().trim().min(2).max(255),
};
export const bankCreatePayloadSchema = createBankAccountSchema
  .extend({ ...identityFields, openingBalance: bankMoneySchema.default(0) })
  .strict();
export const bankEditPayloadSchema = updateBankAccountSchema.extend(identityFields);
export const bankCreateInputSchema = z
  .object({
    action: z.literal("CREATE_ACCOUNT"),
    payload: bankCreatePayloadSchema,
    openingDate: z.string().date().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.payload.openingBalance > 0) {
      if (!v.openingDate)
        ctx.addIssue({
          code: "custom",
          path: ["openingDate"],
          message: "Tanggal saldo awal wajib diberikan.",
        });
      if (!v.payload.openingReference?.trim())
        ctx.addIssue({
          code: "custom",
          path: ["payload", "openingReference"],
          message: "Referensi saldo awal wajib diberikan.",
        });
    }
  });
export const bankEditInputSchema = z
  .object({
    action: z.literal("EDIT_ACCOUNT"),
    bankAccountId: id,
    patch: bankEditPayloadSchema
      .omit({ bankAccountId: true, isActive: true })
      .extend({
        cardColorFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        cardColorTo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        cardTextColor: z.enum(["light", "dark"]),
      })
      .partial()
      .strict()
      .refine((v) => Object.keys(v).length > 0, "Pilih data rekening yang dikoreksi."),
  })
  .strict();
export const bankStatusInputSchema = z
  .object({ action: z.literal("ACCOUNT_STATUS"), bankAccountId: id, isActive: z.boolean() })
  .strict();
export const cashMovementInputSchema = z
  .object({
    action: z.literal("CASH_MOVEMENT"),
    bankAccountId: id,
    type: z.enum(["INFLOW", "OUTFLOW"]),
    amount: bankMoneySchema.refine((v) => v > 0),
    category: z.enum(["owner_capital", "bank_fee", "correction", "cash_adjustment", "other"]),
    description: z.string().trim().min(5).max(500),
    transactionDate: z.string().date(),
    referenceNumber: reference,
  })
  .strict();
export const bankTransferInputSchema = z
  .object({
    action: z.literal("TRANSFER"),
    fromBankAccountId: id,
    toBankAccountId: id,
    amount: bankMoneySchema.refine((v) => v > 0),
    description: z.string().trim().min(5).max(500),
    transactionDate: z.string().date(),
    referenceNumber: reference,
  })
  .strict()
  .refine(
    (v) => v.fromBankAccountId !== v.toBankAccountId,
    "Rekening sumber dan tujuan harus berbeda.",
  );
export const bankCashInputSchema = z.union([
  bankCreateInputSchema,
  bankEditInputSchema,
  bankStatusInputSchema,
  cashMovementInputSchema,
  bankTransferInputSchema,
]);
const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  money: z.boolean(),
});
const comparison = z.object({
  label: z.string(),
  before: z.union([z.string(), z.number()]),
  after: z.union([z.string(), z.number()]),
  money: z.boolean(),
});
export const bankCashProposalSchema = z
  .object({
    kind: z.literal(BANK_CASH_KIND),
    input: bankCashInputSchema,
    title: z.string(),
    entityName: z.string(),
    expectedContext: z.string().length(64),
    effect: z.string(),
    facts: z.array(fact).max(20),
    comparisons: z.array(comparison).max(10),
    details: z.array(fact).max(12),
  })
  .strict();
export const bankCashIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type BankCashInput = z.infer<typeof bankCashInputSchema>;
export type BankCashProposal = z.infer<typeof bankCashProposalSchema>;
export type BankCashView = {
  readonly proposal: BankCashProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type BankCashReceipt = { readonly resultId: string; readonly alreadyConfirmed: boolean };
export function bankCashPermission(input: BankCashInput): PermissionKey {
  return input.action === "CREATE_ACCOUNT"
    ? "create:bank_account"
    : input.action === "EDIT_ACCOUNT"
      ? "update:bank_account"
      : input.action === "ACCOUNT_STATUS"
        ? "delete:bank_account"
        : "create:ledger";
}
export function bankCashNeedsConfirmation(input: BankCashInput): boolean {
  return (
    input.action === "CASH_MOVEMENT" ||
    input.action === "TRANSFER" ||
    (input.action === "CREATE_ACCOUNT" && input.payload.openingBalance > 0) ||
    (input.action === "EDIT_ACCOUNT" &&
      ["accountNumber", "bankName", "holderName"].some((key) => Object.hasOwn(input.patch, key)))
  );
}
export const cashCategoryLabels = {
  owner_capital: "Modal pemilik",
  bank_fee: "Biaya bank",
  correction: "Koreksi kas",
  cash_adjustment: "Penyesuaian kas",
  other: "Lainnya",
} as const;
