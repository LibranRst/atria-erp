import { z } from "zod";
import { hasTwoDecimalPrecision } from "../project/rap-cost";

const reason = z
  .string()
  .trim()
  .min(10, "Jelaskan alasan perubahan minimal 10 karakter.")
  .max(1000);
const threshold = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000)
  .refine(hasTwoDecimalPrecision);
const categoryRatio = z
  .number()
  .finite()
  .min(0)
  .max(1)
  .refine(
    (value) => Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) < 0.000001,
    "Alokasi maksimal enam angka desimal.",
  );
export const approvalThresholdPatchSchema = z
  .object({
    fieldCostAmount: threshold.optional(),
    vendorPaymentAmount: threshold.optional(),
  })
  .strict()
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    "Pilih ambang yang ingin diubah.",
  );
export const expenseCategoryPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    defaultRatio: categoryRatio.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    "Pilih detail kategori yang ingin diubah.",
  );
export const approvalThresholdInputSchema = z
  .object({
    action: z.literal("APPROVAL_THRESHOLDS"),
    patch: approvalThresholdPatchSchema,
    reason,
  })
  .strict();
export const expenseCategoryInputSchema = z
  .object({
    action: z.literal("EXPENSE_CATEGORY_SETTINGS"),
    expenseCategoryId: z.string().guid(),
    patch: expenseCategoryPatchSchema,
    reason,
  })
  .strict();
export type ApprovalThresholdPatch = z.infer<typeof approvalThresholdPatchSchema>;
export type ExpenseCategoryPatch = z.infer<typeof expenseCategoryPatchSchema>;
export type OperationalSettingsInput =
  z.infer<typeof approvalThresholdInputSchema> | z.infer<typeof expenseCategoryInputSchema>;
export const CORE_EXPENSE_CODES = [
  "MATERIAL",
  "TUKANG",
  "OPERASIONAL",
  "LAIN_LAIN",
  "SUBCON",
] as const;
export function isCoreExpenseCode(code: string): boolean {
  return CORE_EXPENSE_CODES.some((value) => value === code);
}
