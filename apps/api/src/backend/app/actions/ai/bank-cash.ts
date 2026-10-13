import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  BankCashError,
  assertBankCashRights,
  prepareBankCashProposal,
  readBankCashAccount,
} from "@backend/server/usecases/ai/bank-cash-context";
import {
  createBankAccountTx,
  updateBankAccountTx,
  setBankAccountActiveTx,
  postManualCashMovementTx,
  transferBetweenBankAccountsTx,
  lockBankAccounts,
  lockBankCatalog,
} from "@backend/server/usecases/finance/bank-cash-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  mapBankAccountError,
  revalidateFinanceViews,
} from "@backend/app/actions/finance/bank-account-action-utils";
import {
  BANK_CASH_KIND,
  bankCashIdentitySchema,
  bankCashProposalSchema,
  bankEditPayloadSchema,
  type BankCashProposal,
  type BankCashView,
  type BankCashReceipt,
} from "@atria/core/ai/bank-cash";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
type Identity = z.infer<typeof bankCashIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  return error instanceof BankCashError
    ? { success: false, error: { code: error.code, message: error.message } }
    : mapBankAccountError(
        error,
        "Usulan rekening/kas belum dapat diproses. Periksa sumber dan coba lagi.",
      );
}
async function owned(
  reader: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: BankCashProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      reader,
      actor,
      identity,
      "proposeBankCash",
      bankCashProposalSchema,
    );
  } catch {
    throw new BankCashError(
      "NOT_FOUND",
      "Usulan belum tersimpan atau bukan milik percakapan Anda.",
    );
  }
}
export async function getAiBankCashProposal(raw: unknown): Promise<ActionResponse<BankCashView>> {
  const actor = await resolveActor(),
    parsed = bankCashIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, parsed.data);
    assertBankCashRights(actor, stored.proposal.input);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, parsed.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, parsed.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, BANK_CASH_KIND),
      ),
    });
    let status: BankCashView["status"] = receipt
      ? "CONFIRMED"
      : stored.expiresAt <= Date.now()
        ? "EXPIRED"
        : "READY";
    if (status === "READY") {
      try {
        if (
          JSON.stringify(await prepareBankCashProposal(actor, stored.proposal.input)) !==
          JSON.stringify(stored.proposal)
        )
          status = "STALE";
      } catch (error: unknown) {
        if (error instanceof BankCashError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
          throw error;
        status = "STALE";
      }
    }
    return {
      success: true,
      data: { proposal: stored.proposal, status, resultId: receipt?.documentId ?? null },
    };
  } catch (error: unknown) {
    return failure(error);
  }
}
async function lockSources(tx: FinanceTransaction, proposal: BankCashProposal): Promise<void> {
  const input = proposal.input;
  if (
    input.action === "CREATE_ACCOUNT" ||
    input.action === "EDIT_ACCOUNT" ||
    input.action === "ACCOUNT_STATUS"
  )
    await lockBankCatalog(tx);
  if (input.action === "TRANSFER")
    await lockBankAccounts(tx, [input.fromBankAccountId, input.toBankAccountId]);
  else if (input.action !== "CREATE_ACCOUNT") await lockBankAccounts(tx, [input.bankAccountId]);
}
export async function confirmAiBankCashProposal(
  raw: unknown,
): Promise<ActionResponse<BankCashReceipt>> {
  const actor = await resolveActor(),
    parsed = bankCashIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  try {
    const stored = await owned(db, actor, parsed.data);
    assertBankCashRights(actor, stored.proposal.input);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    parsed.data,
    BANK_CASH_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, parsed.data);
      assertBankCashRights(actor, stored.proposal.input);
      if (stored.expiresAt <= Date.now())
        throw new BankCashError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      await lockSources(tx, stored.proposal);
      if (
        JSON.stringify(await prepareBankCashProposal(actor, stored.proposal.input, tx)) !==
        JSON.stringify(stored.proposal)
      )
        throw new BankCashError(
          "CONFLICT",
          "Rekening, status atau saldo berubah. Minta preview terbaru sebelum menyimpan.",
        );
      const input = stored.proposal.input;
      let resultId: string;
      if (input.action === "CREATE_ACCOUNT")
        resultId = (
          await createBankAccountTx(
            tx,
            actor.userId,
            input.payload,
            input.openingDate ? new Date(input.openingDate) : undefined,
          )
        ).id;
      else if (input.action === "EDIT_ACCOUNT") {
        const account = await readBankCashAccount(actor, input.bankAccountId, tx);
        resultId = (
          await updateBankAccountTx(
            tx,
            actor.userId,
            bankEditPayloadSchema.parse({
              ...account,
              ...input.patch,
              bankAccountId: account.id,
            }),
          )
        ).id;
      } else if (input.action === "ACCOUNT_STATUS")
        resultId = (
          await setBankAccountActiveTx(tx, actor.userId, input.bankAccountId, input.isActive)
        ).id;
      else if (input.action === "CASH_MOVEMENT")
        resultId = (
          await postManualCashMovementTx(tx, actor.userId, {
            ...input,
            transactionDate: new Date(input.transactionDate),
          })
        ).id;
      else
        resultId = (
          await transferBetweenBankAccountsTx(tx, actor.userId, {
            ...input,
            transactionDate: new Date(input.transactionDate),
          })
        ).transferId;
      return { documentId: resultId, result: { resultId } };
    },
    failure,
  );
  if (!result.success) return result;
  revalidateFinanceViews();
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
