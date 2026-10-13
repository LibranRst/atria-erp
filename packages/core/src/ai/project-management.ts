import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { fromCents, parseNumericToCents } from "../finance/money-minor";
import { invoiceMoneySchema, procurementWarehouseProposalSchema } from "./procurement-warehouse";

const id = z.guid();
const date = z.iso.date().nullable();
export const projectMetadataPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    clientId: id.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    location: z.string().trim().max(255).nullable().optional(),
    roomArea: z.string().trim().max(255).nullable().optional(),
    projectType: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Isi perubahan proyek.");
export const projectAllocationChangeSchema = z
  .object({
    projectBudgetCategoryId: id,
    allocatedAmount: invoiceMoneySchema.optional(),
    ratioPercentage: z
      .number()
      .finite()
      .min(0)
      .max(1)
      .refine((v) => Number(v.toFixed(6)) === v, "Maksimal enam desimal.")
      .optional(),
  })
  .strict()
  .refine(
    (v) => (v.allocatedAmount !== undefined) !== (v.ratioPercentage !== undefined),
    "Pilih nominal atau rasio, bukan keduanya.",
  );
export const projectManagementInputSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("EDIT_PROJECT"), projectId: id, patch: projectMetadataPatchSchema })
    .strict(),
  z.object({ action: z.literal("ASSIGN_PM"), projectId: id, projectManagerId: id }).strict(),
  z.object({ action: z.literal("ACTIVATE_PROJECT"), projectId: id }).strict(),
  z
    .object({
      action: z.literal("COMPLETE_PROJECT"),
      projectId: id,
      closingNote: z.string().trim().min(10).max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal("REALLOCATE_BUDGET"),
      projectId: id,
      projectBudgetId: id,
      reason: z.string().trim().min(10).max(1000),
      categories: z
        .array(projectAllocationChangeSchema)
        .min(1)
        .max(50)
        .refine(
          (v) => new Set(v.map((r) => r.projectBudgetCategoryId)).size === v.length,
          "Kategori tidak boleh berulang.",
        ),
    })
    .strict(),
  z.object({ action: z.literal("SUBMIT_BUDGET"), projectId: id, projectBudgetId: id }).strict(),
  z.object({ action: z.literal("APPROVE_BUDGET"), projectId: id, projectBudgetId: id }).strict(),
  z
    .object({
      action: z.literal("REJECT_BUDGET"),
      projectId: id,
      projectBudgetId: id,
      reason: z.string().trim().min(3).max(1000),
    })
    .strict(),
]);
export type ProjectManagementInput = z.infer<typeof projectManagementInputSchema>;
export type ProjectManagementAction = ProjectManagementInput["action"];
export function projectManagementPermissions(
  action: ProjectManagementAction,
): readonly PermissionKey[] {
  switch (action) {
    case "EDIT_PROJECT":
      return ["view:project", "update:budget"];
    case "ASSIGN_PM":
      return ["view:project", "create:project"];
    case "ACTIVATE_PROJECT":
      return ["view:project", "activate:project"];
    case "COMPLETE_PROJECT":
      return ["view:project", "update:budget", "view:profitability", "close:project"];
    case "APPROVE_BUDGET":
    case "REJECT_BUDGET":
      return ["view:project", "view:budget", "approve:budget"];
    default:
      return ["view:project", "view:budget", "update:budget"];
  }
}
export type AllocationSource = {
  readonly id: string;
  readonly allocatedAmount: string;
  readonly ratioPercentage: string;
};
export function resolveProjectAllocations(
  internalBudget: string,
  current: readonly AllocationSource[],
  changes: readonly z.infer<typeof projectAllocationChangeSchema>[],
): readonly AllocationSource[] {
  const cap = parseNumericToCents(internalBudget);
  if (changes.some((r) => !current.some((c) => c.id === r.projectBudgetCategoryId)))
    throw new Error("Kategori tidak termasuk budget proyek ini.");
  if (new Set(changes.map((r) => r.projectBudgetCategoryId)).size !== changes.length)
    throw new Error("Kategori tidak boleh berulang.");
  const result = current.map((row) => {
    const change = changes.find((c) => c.projectBudgetCategoryId === row.id);
    if (!change) return row;
    const cents =
      change.allocatedAmount !== undefined
        ? parseNumericToCents(change.allocatedAmount.toFixed(2))
        : (cap * BigInt(Math.round((change.ratioPercentage ?? 0) * 1_000_000)) + 500_000n) /
          1_000_000n;
    return {
      id: row.id,
      allocatedAmount: fromCents(cents),
      ratioPercentage: cap > 0n ? (Number(cents) / Number(cap)).toFixed(6) : "0.000000",
    };
  });
  if (result.reduce((sum, row) => sum + parseNumericToCents(row.allocatedAmount), 0n) > cap)
    throw new Error("Total alokasi seluruh kategori melebihi plafon internal proyek.");
  return result;
}
export const PROJECT_MANAGEMENT_KIND = "PROJECT_MANAGEMENT";
export const projectManagementProposalSchema = z
  .object({
    ...procurementWarehouseProposalSchema.shape,
    kind: z.literal(PROJECT_MANAGEMENT_KIND),
    action: z.enum([
      "EDIT_PROJECT",
      "ASSIGN_PM",
      "ACTIVATE_PROJECT",
      "COMPLETE_PROJECT",
      "REALLOCATE_BUDGET",
      "SUBMIT_BUDGET",
      "APPROVE_BUDGET",
      "REJECT_BUDGET",
    ]),
    projectId: id,
    input: projectManagementInputSchema,
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
  })
  .strict()
  .refine(
    (v) => v.input.action === v.action && v.input.projectId === v.projectId,
    "Tindakan/proyek tidak cocok.",
  );
export type ProjectManagementProposal = z.infer<typeof projectManagementProposalSchema>;
export const projectManagementIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type ProjectManagementView = {
  readonly proposal: ProjectManagementProposal;
  readonly status: "READY" | "BLOCKED" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type ProjectManagementReceipt = {
  readonly resultId: string;
  readonly alreadyConfirmed: boolean;
};
