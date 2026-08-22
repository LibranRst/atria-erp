"use server";

import { createProjectAction } from "@/app/actions/project/crud";
import { db } from "@/db";
import { aiConversation, aiProposalConfirmation } from "@/db/schema";
import { insertCanonicalProjectBudgetTx } from "@/lib/budget/project-budget-creation";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiCreateProjectProposalSchema,
  aiSetupBudgetProposalSchema,
} from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function confirmAiCreateProjectProposal(
  input: unknown,
): Promise<ActionResponse<{ projectId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiCreateProjectProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian pembuatan proyek tidak valid." },
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

    const result = await createProjectAction({
      name: proposal.name,
      clientId: proposal.clientId || undefined,
      newClientName: proposal.newClientName || undefined,
      newClientPhone: proposal.newClientPhone || undefined,
      projectManagerId: proposal.projectManagerId,
      totalContractValue: proposal.totalContractValue,
      startDate: proposal.startDate || undefined,
      endDate: proposal.endDate || undefined,
      location: proposal.location || undefined,
      notes: proposal.notes || undefined,
      status: "DRAFT",
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "CREATE_PROJECT",
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

  revalidatePath("/projects");
  revalidatePath(`/projects/${outcome.documentId}`);

  return {
    success: true,
    data: { projectId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}

export async function confirmAiSetupBudgetProposal(
  input: unknown,
): Promise<ActionResponse<{ budgetId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiSetupBudgetProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian alokasi budget tidak valid." },
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

    const budget = await insertCanonicalProjectBudgetTx({
      tx,
      projectId: proposal.projectId,
      contractValue: proposal.contractValue,
      allocation: {
        budgetCapRatio: proposal.budgetCapRatio,
        categories: proposal.categories,
      },
      notes: proposal.notes ?? "Alokasi awal disiapkan melalui Asisten AI",
    });

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "SETUP_BUDGET",
      documentId: budget.id,
    });

    return { kind: "created", documentId: budget.id } as const;
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

  revalidatePath(`/projects/${proposal.projectId}`);
  revalidatePath("/ledger");

  return {
    success: true,
    data: { budgetId: outcome.documentId, alreadyConfirmed: outcome.kind === "already" },
  };
}
