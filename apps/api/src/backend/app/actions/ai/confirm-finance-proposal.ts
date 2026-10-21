import { mapPayVendorBillError } from "@backend/app/actions/finance/pay-vendor-bill";
import { mapRecordClientPaymentError } from "@backend/app/actions/finance/record-client-payment";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { resolveActor } from "@backend/server/actor";
import {
  confirmMutation,
  mapConfirmationError,
} from "@backend/server/usecases/ai/confirm-mutation";
import { assertFinancePermission } from "@backend/server/usecases/finance/mutation-access";
import { payVendorBillTx } from "@backend/server/usecases/finance/pay-vendor-bill";
import { recordClientPaymentTx } from "@backend/server/usecases/finance/record-client-payment";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiPayVendorBillProposalSchema,
  aiRecordClientPaymentProposalSchema,
} from "@atria/core/validations/ai-proposal";

export async function confirmAiPayVendorBillProposal(
  input: unknown,
): Promise<ActionResponse<{ paymentId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiPayVendorBillProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Rincian pembayaran tagihan vendor tidak valid.",
      },
    };
  try {
    assertFinancePermission(actor, "pay:vendor_bill");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const proposal = parsed.data;
  const outcome = await confirmMutation(
    actor,
    proposal,
    "PAY_VENDOR_BILL",
    async (tx) => {
      const result = await payVendorBillTx(tx, actor, {
        vendorPaymentId: proposal.vendorPaymentId,
        bankAccountId: proposal.bankAccountId,
        referenceNumber: proposal.referenceNumber,
      });
      return { documentId: result.paymentId, result };
    },
    mapPayVendorBillError,
  );
  if (!outcome.success) return outcome;
  if (outcome.data.kind === "created") revalidatePath(`/projects/${outcome.data.result.projectId}`);
  revalidatePath("/ledger");
  revalidatePath("/expenses");
  revalidatePath("/reconciliation");
  return {
    success: true,
    data: { paymentId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}

export async function confirmAiRecordClientPaymentProposal(
  input: unknown,
): Promise<ActionResponse<{ paymentId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiRecordClientPaymentProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Rincian penerimaan pembayaran klien tidak valid.",
      },
    };
  try {
    assertFinancePermission(actor, "reconcile:client_invoice");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const proposal = parsed.data;
  const outcome = await confirmMutation(
    actor,
    proposal,
    "RECORD_CLIENT_PAYMENT",
    async (tx) => {
      const result = await recordClientPaymentTx(tx, actor, {
        clientInvoiceId: proposal.clientInvoiceId,
        bankAccountId: proposal.bankAccountId,
        amountPaid: proposal.amountPaid,
        paymentDate: new Date(proposal.paymentDate),
        referenceNumber: proposal.referenceNumber,
      });
      return { documentId: result.paymentId, result };
    },
    mapRecordClientPaymentError,
  );
  if (!outcome.success) return outcome;
  if (outcome.data.kind === "created") revalidatePath(`/projects/${outcome.data.result.projectId}`);
  revalidatePath("/ledger");
  revalidatePath("/reconciliation");
  return {
    success: true,
    data: { paymentId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
