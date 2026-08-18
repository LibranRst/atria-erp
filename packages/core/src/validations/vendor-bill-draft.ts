import { z } from "zod";

import { submitVendorBillSchema } from "./finance";
import { zodIssuesToDetails } from "./expense-draft";

const uuid = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "ID tidak valid.",
  );
const optionalUuid = z.union([uuid, z.literal("")]);

export const vendorBillDraftPayloadSchema = z.object({
  vendorId: optionalUuid,
  projectId: optionalUuid,
  projectBudgetCategoryId: optionalUuid,
  projectBudgetItemId: optionalUuid,
  projectCategoryPlanItemId: optionalUuid,
  billNumber: z.string().max(120),
  amount: z.union([z.number().nonnegative(), z.literal("")]),
  dueDate: z.string().max(20),
  notes: z.string().max(1_000),
});

export const saveVendorBillDraftSchema = z.object({
  draftId: uuid.optional(),
  expectedRevision: z.number().int().positive().optional(),
  payload: vendorBillDraftPayloadSchema,
});

export const vendorBillDraftIdSchema = z.object({ draftId: uuid });
export const submitVendorBillDraftSchema = z.object({
  draftId: uuid,
  expectedRevision: z.number().int().positive(),
});

export type VendorBillDraftPayload = z.infer<typeof vendorBillDraftPayloadSchema>;
export type SaveVendorBillDraftInput = z.infer<typeof saveVendorBillDraftSchema>;
export type SubmitVendorBillDraftInput = z.infer<typeof submitVendorBillDraftSchema>;

export function toVendorBillSubmission(
  payload: VendorBillDraftPayload,
): ReturnType<typeof submitVendorBillSchema.safeParse> {
  return submitVendorBillSchema.safeParse({
    vendorId: payload.vendorId,
    projectId: payload.projectId,
    projectBudgetCategoryId: payload.projectBudgetCategoryId,
    projectCategoryPlanItemId: payload.projectCategoryPlanItemId || undefined,
    billNumber: payload.billNumber.trim(),
    amount: Number(payload.amount),
    dueDate: new Date(payload.dueDate),
    notes: payload.notes.trim() || undefined,
  });
}

export { zodIssuesToDetails };
