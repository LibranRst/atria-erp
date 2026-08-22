"use server";

import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { recordClientPayment } from "@/app/actions/finance/record-client-payment";
import { db } from "@/db";
import { aiConversation, aiProposalConfirmation } from "@/db/schema";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiPayVendorBillProposalSchema,
  aiRecordClientPaymentProposalSchema,
} from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function confirmAiPayVendorBillProposal(
  input: unknown,
): Promise<ActionResponse<{ paymentId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiPayVendorBillProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Rincian pembayaran tagihan vendor tidak valid.",
      },
    };
  }

  const proposal = validation.data;

  const outcome = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({ id: aiConversation.id })
      .from(aiConversation)
      .where(
        and(
          eq(aiConversation.id, proposal.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      )
      .for("update");

    if (!conversation) return { kind: "not_found" } as const;

    const existing = await tx.query.aiProposalConfirmation.findFirst({
      where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
      columns: { documentId: true, userId: true },
    });

    if (existing) {
      return existing.userId === session.user.id
        ? ({ kind: "already", documentId: existing.documentId } as const)
        : ({ kind: "foreign" } as const);
    }

    const result = await payVendorBill({
      vendorPaymentId: proposal.vendorPaymentId,
      bankAccountId: proposal.bankAccountId,
      referenceNumber: proposal.referenceNumber,
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "PAY_VENDOR_BILL",
      documentId: result.data.paymentId,
    });

    return { kind: "created", documentId: result.data.paymentId } as const;
  });

  if (outcome.kind === "not_found") {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }
  if (outcome.kind === "foreign") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
    };
  }
  if (outcome.kind === "submit_failed") return outcome.response;

  revalidatePath("/ledger");
  revalidatePath("/expenses");

  return {
    success: true,
    data: { paymentId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}

export async function confirmAiRecordClientPaymentProposal(
  input: unknown,
): Promise<ActionResponse<{ paymentId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiRecordClientPaymentProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Rincian penerimaan pembayaran klien tidak valid.",
      },
    };
  }

  const proposal = validation.data;

  const outcome = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({ id: aiConversation.id })
      .from(aiConversation)
      .where(
        and(
          eq(aiConversation.id, proposal.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      )
      .for("update");

    if (!conversation) return { kind: "not_found" } as const;

    const existing = await tx.query.aiProposalConfirmation.findFirst({
      where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
      columns: { documentId: true, userId: true },
    });

    if (existing) {
      return existing.userId === session.user.id
        ? ({ kind: "already", documentId: existing.documentId } as const)
        : ({ kind: "foreign" } as const);
    }

    const result = await recordClientPayment({
      clientInvoiceId: proposal.clientInvoiceId,
      bankAccountId: proposal.bankAccountId,
      amountPaid: proposal.amountPaid,
      paymentDate: new Date(proposal.paymentDate),
      referenceNumber: proposal.referenceNumber,
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "RECORD_CLIENT_PAYMENT",
      documentId: result.data.paymentId,
    });

    return { kind: "created", documentId: result.data.paymentId } as const;
  });

  if (outcome.kind === "not_found") {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }
  if (outcome.kind === "foreign") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
    };
  }
  if (outcome.kind === "submit_failed") return outcome.response;

  revalidatePath("/ledger");

  return {
    success: true,
    data: { paymentId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}
