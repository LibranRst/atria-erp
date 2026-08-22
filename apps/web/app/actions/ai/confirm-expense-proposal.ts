"use server";

import {
  approveFieldRequest,
  verifyFieldRequest,
} from "@/app/actions/finance/field-request-review";
import { payFieldRequest, submitFieldRequest } from "@/app/actions/finance/field-requests";
import { db } from "@/db";
import {
  aiConversation,
  aiProposalConfirmation,
  approval,
  projectCost,
  projectExpenses,
} from "@/db/schema";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiDisburseExpenseProposalSchema,
  aiExpenseProposalSchema,
  aiExpenseReviewProposalSchema,
} from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function confirmAiExpenseProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiExpenseProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian usulan pengeluaran tidak valid." },
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

    const result = await submitFieldRequest({
      projectId: proposal.projectId,
      projectBudgetCategoryId: proposal.projectBudgetCategoryId,
      description: proposal.description,
      quantity: proposal.quantity,
      unitPrice: proposal.unitPrice,
      amount: proposal.amount,
      stockHandling: "EXPENSE_ONLY",
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "FIELD_EXPENSE",
      documentId: result.data.id,
    });

    return { kind: "created", documentId: result.data.id } as const;
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

  revalidatePath("/expenses");
  revalidatePath(`/projects/${proposal.projectId}`);

  return {
    success: true,
    data: { expenseId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}

export async function confirmAiExpenseReviewProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; status: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiExpenseReviewProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian keputusan persetujuan tidak valid." },
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

    // 1. Direct projectCost
    let cost = await tx.query.projectCost.findFirst({
      where: eq(projectCost.id, proposal.expenseId),
    });

    if (!cost) {
      // 2. Lookup via projectExpenses
      const pe = await tx.query.projectExpenses.findFirst({
        where: eq(projectExpenses.id, proposal.expenseId),
      });
      if (pe?.legacyProjectCostId) {
        cost = await tx.query.projectCost.findFirst({
          where: eq(projectCost.id, pe.legacyProjectCostId),
        });
      }
    }

    if (!cost) {
      // 3. Lookup via approval record
      const app = await tx.query.approval.findFirst({
        where: eq(approval.id, proposal.expenseId),
      });
      if (app && app.referenceType === "project_cost") {
        cost = await tx.query.projectCost.findFirst({
          where: eq(projectCost.id, app.referenceId),
        });
      }
    }

    if (!cost) {
      return {
        kind: "submit_failed",
        response: {
          success: false,
          error: { code: "NOT_FOUND", message: "Pengajuan biaya tidak ditemukan." },
        },
      } as const;
    }

    const actualCostId = cost.id;

    if (proposal.action === "VERIFY") {
      if (cost.status !== "SUBMITTED") {
        return {
          kind: "submit_failed",
          response: {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Pengajuan ini tidak dalam status menunggu verifikasi (status saat ini: ${cost.status}).`,
            },
          },
        } as const;
      }
      const verifyRes = await verifyFieldRequest(actualCostId);
      if (!verifyRes.success) return { kind: "submit_failed", response: verifyRes } as const;

      await tx.insert(aiProposalConfirmation).values({
        toolCallId: proposal.toolCallId,
        conversationId: conversation.id,
        userId: session.user.id,
        proposalType: "VERIFY_EXPENSE",
        documentId: actualCostId,
      });

      return {
        kind: "created",
        documentId: actualCostId,
        status: verifyRes.data.status,
      } as const;
    }

    if (proposal.action === "APPROVE") {
      // Jika masih SUBMITTED, verifikasi terlebih dahulu
      if (cost.status === "SUBMITTED") {
        const verifyRes = await verifyFieldRequest(actualCostId);
        if (!verifyRes.success) return { kind: "submit_failed", response: verifyRes } as const;
      }

      const approveRes = await approveFieldRequest({
        projectCostId: actualCostId,
        status: "APPROVED",
        notes: proposal.notes,
      });

      if (!approveRes.success) return { kind: "submit_failed", response: approveRes } as const;

      await tx.insert(aiProposalConfirmation).values({
        toolCallId: proposal.toolCallId,
        conversationId: conversation.id,
        userId: session.user.id,
        proposalType: "APPROVE_EXPENSE",
        documentId: actualCostId,
      });

      return {
        kind: "created",
        documentId: actualCostId,
        status: "APPROVED",
      } as const;
    }

    const rejectRes = await approveFieldRequest({
      projectCostId: actualCostId,
      status: "REJECTED",
      notes: proposal.notes,
    });

    if (!rejectRes.success) return { kind: "submit_failed", response: rejectRes } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "REJECT_EXPENSE",
      documentId: actualCostId,
    });

    return {
      kind: "created",
      documentId: actualCostId,
      status: "REJECTED",
    } as const;
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

  revalidatePath("/expenses");
  revalidatePath("/ledger");

  return {
    success: true,
    data: {
      expenseId: outcome.documentId,
      status: outcome.kind === "created" ? outcome.status : "APPROVED",
      alreadyConfirmed: outcome.kind === "already",
    },
  };
}

export async function confirmAiDisburseExpenseProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; nextBalance: number; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiDisburseExpenseProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian pencairan dana tidak valid." },
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

    // 1. Direct projectCost
    let cost = await tx.query.projectCost.findFirst({
      where: eq(projectCost.id, proposal.expenseId),
    });

    if (!cost) {
      // 2. Lookup via projectExpenses
      const pe = await tx.query.projectExpenses.findFirst({
        where: eq(projectExpenses.id, proposal.expenseId),
      });
      if (pe?.legacyProjectCostId) {
        cost = await tx.query.projectCost.findFirst({
          where: eq(projectCost.id, pe.legacyProjectCostId),
        });
      }
    }

    if (!cost) {
      // 3. Lookup via approval record
      const app = await tx.query.approval.findFirst({
        where: eq(approval.id, proposal.expenseId),
      });
      if (app && app.referenceType === "project_cost") {
        cost = await tx.query.projectCost.findFirst({
          where: eq(projectCost.id, app.referenceId),
        });
      }
    }

    if (!cost) {
      return {
        kind: "submit_failed",
        response: {
          success: false,
          error: { code: "NOT_FOUND", message: "Pengajuan biaya tidak ditemukan." },
        },
      } as const;
    }

    const actualCostId = cost.id;

    // Jika belum APPROVED (misal masih SUBMITTED / VERIFIED), otomatis verifikasi & approve dalam transaksi jika berwenang
    if (cost.status === "SUBMITTED") {
      const verifyRes = await verifyFieldRequest(actualCostId);
      if (!verifyRes.success) return { kind: "submit_failed", response: verifyRes } as const;
    }

    if (cost.status === "SUBMITTED" || cost.status === "VERIFIED") {
      const approveRes = await approveFieldRequest({
        projectCostId: actualCostId,
        status: "APPROVED",
        notes: "Disetujui otomatis saat pencairan kas via AI Assistant",
      });
      if (!approveRes.success) return { kind: "submit_failed", response: approveRes } as const;
    }

    const payRes = await payFieldRequest(
      actualCostId,
      proposal.bankAccountId,
      proposal.referenceNumber,
    );
    if (!payRes.success) return { kind: "submit_failed", response: payRes } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "DISBURSE_EXPENSE",
      documentId: actualCostId,
    });

    return {
      kind: "created",
      documentId: actualCostId,
      nextBalance: payRes.data.nextBalance,
    } as const;
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

  revalidatePath("/expenses");
  revalidatePath("/ledger");

  return {
    success: true,
    data: {
      expenseId: outcome.documentId,
      nextBalance: outcome.kind === "created" ? outcome.nextBalance : 0,
      alreadyConfirmed: outcome.kind === "already",
    },
  };
}
