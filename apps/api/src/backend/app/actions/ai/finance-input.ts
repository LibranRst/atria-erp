import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  FinanceInputError,
  assertFinanceInputRights,
  prepareFinanceInput,
  readFinanceInputProject,
  readFinanceBudgetSettings,
} from "@backend/server/usecases/ai/finance-input-context";
import {
  lockClientInvoiceProjectTx,
  writeFinanceInvoiceInputTx,
} from "@backend/server/usecases/finance/client-invoice-writer";
import {
  lockBudgetDefaultsTx,
  writeBudgetDefaultsTx,
} from "@backend/server/usecases/settings/budget-defaults-writer";
import {
  OperationalSettingsError,
  lockApprovalThresholdsTx,
  lockExpenseCategorySettingsTx,
  readOperationalThresholds,
  readExpenseCategorySettings,
  writeApprovalThresholdsTx,
  writeExpenseCategorySettingsTx,
} from "@backend/server/usecases/settings/operational-settings-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  FINANCE_INPUT_KIND,
  financeInputIdentitySchema,
  financeInputProposalSchema,
  type FinanceInputProposal,
  type FinanceInputView,
  type FinanceInputReceipt,
} from "@atria/core/ai/finance-input";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof financeInputIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof FinanceInputError || error instanceof OperationalSettingsError)
    return { success: false, error: { code: error.code, message: error.message } };
  const reason = error instanceof Error ? error.message : "";
  return {
    success: false,
    error: {
      code: reason.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "TRANSACTION_FAILED",
      message: reason.startsWith("FORBIDDEN:")
        ? "Akses tindakan telah berubah atau tidak tersedia."
        : "Usulan belum tersimpan. Periksa data dan minta preview terbaru.",
    },
  };
}
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: FinanceInputProposal; expiresAt: number }> {
  try {
    const found: { proposal: FinanceInputProposal; expiresAt: number }[] = [];
    for (const [name, action] of [
      ["proposeClientInvoice", "CREATE_INVOICE"],
      ["proposeClientInvoiceSchedule", "CREATE_SCHEDULE"],
      ["proposeBudgetSettings", "BUDGET_DEFAULTS"],
      ["proposeApprovalThresholds", "APPROVAL_THRESHOLDS"],
      ["proposeExpenseCategorySettings", "EXPENSE_CATEGORY_SETTINGS"],
    ] as const) {
      try {
        const result = await readOwnedStoredProposal(
          connection,
          actor,
          identity,
          name,
          financeInputProposalSchema,
        );
        if (result.proposal.input.action === action) found.push(result);
      } catch {
        /* Each explicitly registered tool has a distinct proposal contract. */
      }
    }
    if (found.length !== 1) throw new Error("Invalid stored proposal");
    return found[0];
  } catch {
    throw new FinanceInputError(
      "NOT_FOUND",
      "Usulan belum tersimpan atau bukan milik percakapan Anda.",
    );
  }
}
async function assertSources(actor: Actor, proposal: FinanceInputProposal): Promise<void> {
  assertFinanceInputRights(actor, proposal.input);
  if (proposal.input.action === "APPROVAL_THRESHOLDS") await readOperationalThresholds(actor);
  else if (proposal.input.action === "EXPENSE_CATEGORY_SETTINGS")
    await readExpenseCategorySettings(actor, proposal.input.expenseCategoryId);
  else if (proposal.input.action === "BUDGET_DEFAULTS")
    await readFinanceBudgetSettings(actor, proposal.input.payload.budgetAllocationSettingId);
  else await readFinanceInputProject(actor, proposal.input.projectId);
}
export async function getAiFinanceInputProposal(
  raw: unknown,
): Promise<ActionResponse<FinanceInputView>> {
  const actor = await resolveActor(),
    identity = financeInputIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    await assertSources(actor, stored.proposal);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, FINANCE_INPUT_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: { proposal: stored.proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: FinanceInputView["status"] = stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED") {
      try {
        if (
          JSON.stringify(await prepareFinanceInput(actor, stored.proposal.input)) ===
          JSON.stringify(stored.proposal)
        )
          status = "READY";
      } catch (error: unknown) {
        if (
          (error instanceof FinanceInputError && error.code === "FORBIDDEN") ||
          (error instanceof OperationalSettingsError && error.code !== "VALIDATION_ERROR")
        )
          throw error;
      }
    }
    return { success: true, data: { proposal: stored.proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiFinanceInputProposal(
  raw: unknown,
): Promise<ActionResponse<FinanceInputReceipt>> {
  const actor = await resolveActor(),
    identity = financeInputIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  let proposal: FinanceInputProposal;
  try {
    proposal = (await owned(db, actor, identity.data)).proposal;
    await assertSources(actor, proposal);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    FINANCE_INPUT_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, identity.data),
        input = stored.proposal.input;
      assertFinanceInputRights(actor, input);
      if (stored.expiresAt <= Date.now())
        throw new FinanceInputError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      if (input.action === "APPROVAL_THRESHOLDS") await lockApprovalThresholdsTx(tx, actor);
      else if (input.action === "EXPENSE_CATEGORY_SETTINGS")
        await lockExpenseCategorySettingsTx(tx, actor, input.expenseCategoryId);
      else if (input.action === "BUDGET_DEFAULTS")
        await lockBudgetDefaultsTx(tx, actor, input.payload.budgetAllocationSettingId);
      else await lockClientInvoiceProjectTx(tx, actor, input.projectId);
      if (
        JSON.stringify(await prepareFinanceInput(actor, input, tx)) !==
        JSON.stringify(stored.proposal)
      )
        throw new FinanceInputError(
          "CONFLICT",
          "Sumber berubah sejak preview. Minta usulan terbaru sebelum menyimpan.",
        );
      const documentId =
        input.action === "APPROVAL_THRESHOLDS"
          ? (await writeApprovalThresholdsTx(tx, actor, input.patch, input.reason)).id
          : input.action === "EXPENSE_CATEGORY_SETTINGS"
            ? (
                await writeExpenseCategorySettingsTx(
                  tx,
                  actor,
                  input.expenseCategoryId,
                  input.patch,
                  input.reason,
                )
              ).id
            : input.action === "BUDGET_DEFAULTS"
              ? await writeBudgetDefaultsTx(tx, actor, input.payload)
              : await writeFinanceInvoiceInputTx(tx, actor, input);
      return { documentId, result: { action: input.action } };
    },
    failure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(proposal.projectId ? `/projects/${proposal.projectId}` : "/settings");
  revalidateWorkspacePath("/ledger");
  if (
    proposal.input.action === "APPROVAL_THRESHOLDS" ||
    proposal.input.action === "EXPENSE_CATEGORY_SETTINGS"
  ) {
    revalidateWorkspacePath("/expenses");
    revalidateWorkspacePath("/projects");
  }
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
