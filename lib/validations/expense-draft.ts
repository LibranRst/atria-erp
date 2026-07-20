import { z } from "zod";

import { submitFieldRequestsSchema } from "@/lib/validations/finance";

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "ID tidak valid.",
  );
const optionalUuidValue = z.union([uuid, z.literal("")]);
const draftNumber = z.union([z.number().nonnegative(), z.literal("")]);

export const expenseDraftLineSchema = z.object({
  key: z.string().min(1).max(120),
  projectBudgetCategoryId: optionalUuidValue,
  projectBudgetItemId: optionalUuidValue,
  materialId: optionalUuidValue,
  projectRapItemId: optionalUuidValue,
  projectCategoryPlanItemId: optionalUuidValue,
  stockHandling: z.enum([
    "EXPENSE_ONLY",
    "STOCK_IN",
    "DIRECT_USE",
    "RESERVE_FOR_PROJECT",
  ]),
  inventoryLocationId: optionalUuidValue,
  quantity: draftNumber,
  unitPrice: draftNumber,
  amount: draftNumber,
  description: z.string().max(500),
});

export const expenseReceiptAttachmentSchema = z.object({
  fileId: z.string().min(1).max(255),
  url: z.string().url(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().nonnegative().max(12 * 1024 * 1024),
});

export const expenseDraftPayloadSchema = z.object({
  projectId: optionalUuidValue,
  inputMode: z.enum(["MANUAL", "RECEIPT"]),
  receipt: expenseReceiptAttachmentSchema.nullable(),
  lines: z.array(expenseDraftLineSchema).min(1).max(50),
  ocrWarning: z.string().max(1000).nullable(),
});

export const saveExpenseDraftSchema = z.object({
  draftId: uuid.optional(),
  expectedRevision: z.number().int().positive().optional(),
  payload: expenseDraftPayloadSchema,
});

export const expenseDraftIdSchema = z.object({ draftId: uuid });

export const submitExpenseDraftSchema = z.object({
  draftId: uuid,
  expectedRevision: z.number().int().positive(),
});

export type ExpenseDraftPayloadInput = z.infer<typeof expenseDraftPayloadSchema>;
export type SaveExpenseDraftInput = z.infer<typeof saveExpenseDraftSchema>;
export type SubmitExpenseDraftInput = z.infer<typeof submitExpenseDraftSchema>;

export function nextExpenseDraftRevision(expectedRevision: number): number {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("EXPECTED_REVISION_INVALID");
  }
  return expectedRevision + 1;
}

export function toExpenseSubmission(payload: ExpenseDraftPayloadInput): z.input<typeof submitFieldRequestsSchema> {
  return {
    projectId: payload.projectId,
    receiptImageUrl: payload.receipt?.url ?? "",
    items: payload.lines.map((line) => ({
      projectBudgetCategoryId: line.projectBudgetCategoryId,
      materialId: line.materialId || undefined,
      projectRapItemId: line.projectRapItemId || undefined,
      projectCategoryPlanItemId: line.projectCategoryPlanItemId || undefined,
      stockHandling: line.stockHandling,
      inventoryLocationId: line.inventoryLocationId || undefined,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      amount: Number(line.amount),
      description: line.description.trim(),
    })),
  };
}

export function zodIssuesToDetails(error: z.ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((details, issue) => {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    details[key] = [...(details[key] ?? []), issue.message];
    return details;
  }, {});
}
