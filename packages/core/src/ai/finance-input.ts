import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { hasTwoDecimalPrecision, RAP_COST_MAX } from "../project/rap-cost";
import { updateBudgetAllocationDefaultsSchema } from "../validations/settings";
import { approvalThresholdInputSchema, expenseCategoryInputSchema } from "./operational-settings";

export const FINANCE_INPUT_KIND = "FINANCE_INPUT";
const id = z.string().guid();
const date = z.string().date();
const money = z.number().finite().positive().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision);
export const invoiceStages = [
  "DP",
  "PROGRESS_1",
  "PROGRESS_2",
  "PELUNASAN",
  "RETENTION",
  "AD_HOC",
] as const;
export const financeInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CREATE_INVOICE"),
      projectId: id,
      invoiceNumber: z.string().trim().min(1).max(100),
      amount: money,
      stage: z.enum(invoiceStages),
      dueDate: date,
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("CREATE_SCHEDULE"),
      projectId: id,
      firstDueDate: date,
      installments: z
        .array(
          z
            .object({
              label: z.string().trim().min(2).max(120),
              percentage: z.number().finite().positive().max(1),
            })
            .strict(),
        )
        .min(1)
        .max(24),
    })
    .strict()
    .superRefine((input, ctx) => {
      if (Math.abs(input.installments.reduce((sum, row) => sum + row.percentage, 0) - 1) > 0.000001)
        ctx.addIssue({ code: "custom", message: "Total termin harus tepat 100%." });
    }),
  z
    .object({
      action: z.literal("BUDGET_DEFAULTS"),
      payload: updateBudgetAllocationDefaultsSchema.safeExtend({
        notes: z.string().trim().max(1000).nullable(),
        categories: updateBudgetAllocationDefaultsSchema.shape.categories.max(30),
      }),
    })
    .strict(),
  approvalThresholdInputSchema,
  expenseCategoryInputSchema,
]);
export const clientInvoiceInputSchema = z.discriminatedUnion("action", [
  financeInputSchema.options[0],
  financeInputSchema.options[1],
]);
export const budgetSettingsInputSchema = financeInputSchema.options[2];
const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  money: z.boolean().default(false),
});
export const financeInputProposalSchema = z
  .object({
    kind: z.literal(FINANCE_INPUT_KIND),
    input: financeInputSchema,
    title: z.string(),
    entityName: z.string(),
    projectId: id.nullable(),
    expectedContext: z.string().length(64),
    effect: z.string(),
    summary: z.array(fact),
    rows: z.array(z.object({ id: z.string(), title: z.string(), facts: z.array(fact) })).max(30),
    changes: z.array(
      z.object({
        label: z.string(),
        before: z.union([z.string(), z.number()]),
        after: z.union([z.string(), z.number()]),
        money: z.boolean().optional(),
      }),
    ),
  })
  .strict();
export const financeInputIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type FinanceInput = z.infer<typeof financeInputSchema>;
export type FinanceInputProposal = z.infer<typeof financeInputProposalSchema>;
export type FinanceInputView = {
  readonly proposal: FinanceInputProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type FinanceInputReceipt = { readonly resultId: string; readonly alreadyConfirmed: boolean };
export function financeInputPermission(input: FinanceInput): PermissionKey {
  return input.action === "BUDGET_DEFAULTS"
    ? "manage:budget_settings"
    : input.action === "APPROVAL_THRESHOLDS"
      ? "manage:approval_settings"
      : input.action === "EXPENSE_CATEGORY_SETTINGS"
        ? "manage:expense_categories"
        : "create:client_invoice";
}
export function isFinanceSettingsInput(input: FinanceInput): boolean {
  return input.action !== "CREATE_INVOICE" && input.action !== "CREATE_SCHEDULE";
}

/** Deterministic monthly dates and cent allocation shared by previews and manual/AI writes. */
export function invoiceScheduleRows(
  contract: number,
  firstDate: string,
  installments: readonly { readonly label: string; readonly percentage: number }[],
): readonly {
  readonly label: string;
  readonly amount: number;
  readonly dueDate: string;
  readonly stage: string;
}[] {
  if (!Number.isFinite(contract) || contract <= 0 || contract > RAP_COST_MAX)
    throw new Error("Nilai kontrak tidak valid untuk jadwal invoice.");
  const parsed = financeInputSchema.parse({
    action: "CREATE_SCHEDULE",
    projectId: "00000000-0000-4000-8000-000000000000",
    firstDueDate: firstDate,
    installments,
  });
  if (parsed.action !== "CREATE_SCHEDULE") throw new Error("Jadwal invoice tidak valid.");
  const origin = new Date(`${firstDate}T00:00:00.000Z`);
  let allocatedCents = 0;
  return parsed.installments.map((row, index) => {
    const last = index === parsed.installments.length - 1;
    const cents = last
      ? Math.round(contract * 100) - allocatedCents
      : Math.round(contract * 100 * row.percentage);
    allocatedCents += cents;
    if (cents <= 0) throw new Error("Nominal setiap termin harus lebih besar dari nol.");
    const due = new Date(Date.UTC(origin.getUTCFullYear(), origin.getUTCMonth() + index, 1));
    const monthEnd = new Date(
      Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0),
    ).getUTCDate();
    due.setUTCDate(Math.min(origin.getUTCDate(), monthEnd));
    return {
      label: row.label,
      amount: cents / 100,
      dueDate: due.toISOString().slice(0, 10),
      stage: index === 0 ? "DP" : last ? "PELUNASAN" : `PROGRESS_${index}`,
    };
  });
}
