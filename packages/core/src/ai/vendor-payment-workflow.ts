import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { hasTwoDecimalPrecision, RAP_COST_MAX } from "../project/rap-cost";
export const VENDOR_PAYMENT_WORKFLOW_KIND = "VENDOR_PAYMENT_WORKFLOW";
const id = z.string().guid();
export const vendorPaymentScheduleSchema = z
  .object({
    action: z.literal("SCHEDULE"),
    vendorBillId: id,
    bankAccountId: id,
    amount: z.number().finite().positive().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision),
    paymentDate: z.string().date(),
  })
  .strict();
export const vendorPaymentDecisionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    vendorPaymentId: id,
    notes: z.string().trim().min(3).max(1000),
  })
  .strict();
export const vendorPaymentPaySchema = z
  .object({
    action: z.literal("PAY"),
    vendorPaymentId: id,
    bankAccountId: id,
    referenceNumber: z.string().trim().min(2).max(100),
  })
  .strict();
export const vendorPaymentWorkflowInputSchema = z.union([
  vendorPaymentScheduleSchema,
  vendorPaymentDecisionSchema,
  vendorPaymentPaySchema,
]);
const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  money: z.boolean(),
});
export const vendorPaymentWorkflowProposalSchema = z
  .object({
    kind: z.literal(VENDOR_PAYMENT_WORKFLOW_KIND),
    input: vendorPaymentWorkflowInputSchema,
    projectId: id,
    vendorBillId: id,
    title: z.string(),
    entityName: z.string(),
    expectedContext: z.string().length(64),
    effect: z.string(),
    facts: z.array(fact).max(20),
    comparisons: z
      .array(
        z.object({
          label: z.string(),
          before: z.union([z.string(), z.number()]),
          after: z.union([z.string(), z.number()]),
          money: z.boolean(),
        }),
      )
      .max(5),
  })
  .strict();
export const vendorPaymentWorkflowIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type VendorPaymentWorkflowInput = z.infer<typeof vendorPaymentWorkflowInputSchema>;
export type VendorPaymentWorkflowProposal = z.infer<typeof vendorPaymentWorkflowProposalSchema>;
export type VendorPaymentWorkflowView = {
  readonly proposal: VendorPaymentWorkflowProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type VendorPaymentWorkflowReceipt = {
  readonly resultId: string;
  readonly alreadyConfirmed: boolean;
};
export function vendorPaymentWorkflowPermission(input: VendorPaymentWorkflowInput): PermissionKey {
  return input.action === "APPROVE" || input.action === "REJECT"
    ? "approve:cost"
    : "pay:vendor_bill";
}
