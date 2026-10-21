import { db } from "@backend/db";
import { approval, bankAccount, projectCost, projectExpenses } from "@backend/db/schema";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  confirmMutation,
  mapConfirmationError,
} from "@backend/server/usecases/ai/confirm-mutation";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "@backend/server/usecases/finance/mutation-access";
import { payFieldRequestTx } from "@backend/server/usecases/finance/pay-field-request";
import {
  approveFieldRequestTx,
  verifyFieldRequestTx,
} from "@backend/server/usecases/finance/review-field-request";
import { submitFieldRequestTx } from "@backend/server/usecases/finance/submit-field-request";
import {
  mapApproveFieldRequestError,
  mapPayFieldRequestError,
  mapSubmitFieldRequestError,
  mapVerifyFieldRequestError,
} from "@backend/app/actions/finance/field-request-utils";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  aiDisburseExpenseProposalSchema,
  aiExpenseProposalSchema,
  aiExpenseReviewProposalSchema,
} from "@atria/core/validations/ai-proposal";
import { eq } from "drizzle-orm";

async function resolveCostTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
): Promise<typeof projectCost.$inferSelect> {
  let actualId = id;
  let cost = await tx.query.projectCost.findFirst({ where: eq(projectCost.id, id) });
  if (!cost) {
    const expense = await tx.query.projectExpenses.findFirst({ where: eq(projectExpenses.id, id) });
    if (expense?.legacyProjectCostId) actualId = expense.legacyProjectCostId;
    else {
      const record = await tx.query.approval.findFirst({ where: eq(approval.id, id) });
      if (record?.referenceType === "project_cost") actualId = record.referenceId;
    }
  }
  [cost] = await tx.select().from(projectCost).where(eq(projectCost.id, actualId)).for("update");
  if (!cost) throw new Error("PROJECT_COST_NOT_FOUND");
  await lockFinanceProject(tx, actor, cost.projectId);
  return cost;
}

export async function confirmAiExpenseProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiExpenseProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian usulan pengeluaran tidak valid." },
    };
  try {
    assertFinancePermission(actor, "create:cost");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const proposal = parsed.data;
  const outcome = await confirmMutation(
    actor,
    proposal,
    "FIELD_EXPENSE",
    async (tx) => {
      const result = await submitFieldRequestTx(tx, actor, {
        ...proposal,
        stockHandling: "EXPENSE_ONLY",
      });
      return { documentId: result.id, result };
    },
    mapSubmitFieldRequestError,
  );
  if (!outcome.success) return outcome;
  revalidatePath("/expenses");
  revalidatePath(`/projects/${proposal.projectId}`);
  return {
    success: true,
    data: { expenseId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}

export async function confirmAiExpenseReviewProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; status: string; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiExpenseReviewProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian keputusan persetujuan tidak valid." },
    };
  const proposal = parsed.data;
  try {
    assertFinancePermission(actor, proposal.action === "VERIFY" ? "verify:cost" : "approve:cost");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const outcome = await confirmMutation(
    actor,
    proposal,
    `${proposal.action}_EXPENSE`,
    async (tx) => {
      let cost = await resolveCostTx(tx, actor, proposal.expenseId);
      if (proposal.action === "VERIFY") cost = await verifyFieldRequestTx(tx, actor, cost.id);
      else {
        if (proposal.action === "APPROVE" && cost.status === "SUBMITTED")
          cost = await verifyFieldRequestTx(tx, actor, cost.id);
        if (!(proposal.action === "APPROVE" && cost.status === "APPROVED")) {
          cost = await approveFieldRequestTx(tx, actor, {
            projectCostId: cost.id,
            status: proposal.action === "APPROVE" ? "APPROVED" : "REJECTED",
            notes: proposal.notes,
          });
        }
      }
      return { documentId: cost.id, result: cost };
    },
    proposal.action === "VERIFY" ? mapVerifyFieldRequestError : mapApproveFieldRequestError,
  );
  if (!outcome.success) return outcome;
  const cost =
    outcome.data.kind === "created"
      ? outcome.data.result
      : await db.transaction((tx) => resolveCostTx(tx, actor, outcome.data.documentId));
  revalidatePath("/expenses");
  revalidatePath("/ledger");
  revalidatePath(`/projects/${cost.projectId}`);
  return {
    success: true,
    data: {
      expenseId: cost.id,
      status: cost.status,
      alreadyConfirmed: outcome.data.kind === "already",
    },
  };
}

export async function confirmAiDisburseExpenseProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; nextBalance: number; alreadyConfirmed: boolean }>> {
  const actor = await resolveActor();
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  const parsed = aiDisburseExpenseProposalSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian pencairan dana tidak valid." },
    };
  const proposal = parsed.data;
  try {
    assertFinancePermission(actor, "pay:cost");
  } catch (error: unknown) {
    return mapConfirmationError(error);
  }
  const outcome = await confirmMutation(
    actor,
    proposal,
    "DISBURSE_EXPENSE",
    async (tx) => {
      let cost = await resolveCostTx(tx, actor, proposal.expenseId);
      if (cost.status === "SUBMITTED") cost = await verifyFieldRequestTx(tx, actor, cost.id);
      if (cost.status === "VERIFIED")
        cost = await approveFieldRequestTx(tx, actor, {
          projectCostId: cost.id,
          status: "APPROVED",
          notes: "Disetujui saat konfirmasi pencairan kas melalui Asisten AI.",
        });
      const result = await payFieldRequestTx(tx, actor, {
        projectCostId: cost.id,
        bankAccountId: proposal.bankAccountId,
        referenceNumber: proposal.referenceNumber,
      });
      return { documentId: cost.id, result };
    },
    mapPayFieldRequestError,
  );
  if (!outcome.success) return outcome;
  let nextBalance: number;
  let projectId: string;
  if (outcome.data.kind === "created") {
    nextBalance = outcome.data.result.nextBalance;
    projectId = outcome.data.result.projectId;
  } else {
    const recovered = await db.transaction(async (tx) => {
      const cost = await resolveCostTx(tx, actor, outcome.data.documentId);
      const account = cost.bankAccountId
        ? await tx.query.bankAccount.findFirst({ where: eq(bankAccount.id, cost.bankAccountId) })
        : undefined;
      return { projectId: cost.projectId, nextBalance: Number(account?.balance ?? 0) };
    });
    ({ nextBalance, projectId } = recovered);
  }
  revalidatePath("/expenses");
  revalidatePath("/ledger");
  revalidatePath("/reconciliation");
  revalidatePath(`/projects/${projectId}`);
  return {
    success: true,
    data: {
      expenseId: outcome.data.documentId,
      nextBalance,
      alreadyConfirmed: outcome.data.kind === "already",
    },
  };
}
