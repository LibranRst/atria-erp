import { and, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  aiProposalConfirmation,
  vendorPayment,
  vendorBill,
  bankAccount,
  projectBudgetCategory,
  appConfig,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  prepareVendorPaymentWorkflow,
  assertVendorWorkflowRights,
  readVendorPaymentContext,
} from "@backend/server/usecases/ai/vendor-payment-context";
import { FinanceInputError } from "@backend/server/usecases/ai/finance-input-context";
import {
  scheduleVendorPaymentTx,
  decideVendorPaymentTx,
} from "@backend/server/usecases/finance/vendor-payment-writer";
import { payVendorBillTx } from "@backend/server/usecases/finance/pay-vendor-bill";
import {
  lockFinanceProject,
  type FinanceTransaction,
} from "@backend/server/usecases/finance/mutation-access";
import {
  VENDOR_PAYMENT_WORKFLOW_KIND,
  vendorPaymentWorkflowIdentitySchema,
  vendorPaymentWorkflowProposalSchema,
  type VendorPaymentWorkflowProposal,
  type VendorPaymentWorkflowView,
  type VendorPaymentWorkflowReceipt,
} from "@atria/core/ai/vendor-payment-workflow";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
import { APPROVAL_THRESHOLD_CONFIG_KEYS } from "@atria/core/finance/approval-thresholds";
type Identity = z.infer<typeof vendorPaymentWorkflowIdentitySchema>;
const tools = {
  SCHEDULE: "proposeVendorPaymentSchedule",
  APPROVE: "proposeVendorPaymentDecision",
  REJECT: "proposeVendorPaymentDecision",
  PAY: "proposeVendorBillPayment",
};
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof FinanceInputError)
    return { success: false, error: { code: error.code, message: error.message } };
  const reason = error instanceof Error ? error.message : "";
  const messages: Readonly<Record<string, string>> = {
    MAKER_CHECKER_REQUIRED:
      "Pembuat jadwal tidak dapat menyetujui sendiri. Gunakan pemeriksa lain.",
    PAYMENT_DECISION_ALREADY_FINAL: "Keputusan telah selesai. Minta preview terbaru.",
    PAYMENT_NOT_PENDING: "Jadwal tidak lagi menunggu pembayaran.",
    PAYMENT_ALREADY_COMPLETED: "Pembayaran sudah tercatat. Periksa ledger.",
    PAYMENT_EXCEEDS_VENDOR_BILL_OUTSTANDING:
      "Nominal melebihi sisa tagihan yang belum dijadwalkan.",
    APPROVAL_REQUIRED_BUT_PENDING: "Persetujuan masih tertunda; pembayaran belum dapat dicatat.",
    APPROVAL_RECORD_MISSING: "Persetujuan diperlukan tetapi belum tersedia.",
    DUPLICATE_BANK_REFERENCE: "Referensi mutasi sudah tercatat; periksa pembayaran sebelumnya.",
    OWNER_USER_NOT_FOUND:
      "Pemeriksa Owner aktif belum tersedia. Lengkapi administrasi sebelum menjadwalkan.",
  };
  return {
    success: false,
    error: {
      code: reason.startsWith("FORBIDDEN:") ? "FORBIDDEN" : "TRANSACTION_FAILED",
      message:
        messages[reason] ??
        "Tindakan belum tersimpan. Periksa akses, status tagihan dan saldo lalu minta preview terbaru.",
    },
  };
}
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: VendorPaymentWorkflowProposal; expiresAt: number }> {
  for (const name of new Set(Object.values(tools))) {
    try {
      const result = await readOwnedStoredProposal(
        connection,
        actor,
        identity,
        name,
        vendorPaymentWorkflowProposalSchema,
      );
      if (tools[result.proposal.input.action] === name) return result;
    } catch {
      /* Tool identity is fixed by the registered action contract. */
    }
  }
  throw new FinanceInputError(
    "NOT_FOUND",
    "Usulan belum tersimpan atau bukan milik percakapan Anda.",
  );
}
async function assertSources(actor: Actor, proposal: VendorPaymentWorkflowProposal): Promise<void> {
  assertVendorWorkflowRights(actor, proposal.input);
  await readVendorPaymentContext(actor, proposal.vendorBillId);
}
export async function getAiVendorPaymentWorkflowProposal(
  raw: unknown,
): Promise<ActionResponse<VendorPaymentWorkflowView>> {
  const actor = await resolveActor(),
    identity = vendorPaymentWorkflowIdentitySchema.safeParse(raw);
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
        eq(aiProposalConfirmation.proposalType, VENDOR_PAYMENT_WORKFLOW_KIND),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: { proposal: stored.proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: VendorPaymentWorkflowView["status"] =
      stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED")
      try {
        if (
          JSON.stringify(await prepareVendorPaymentWorkflow(actor, stored.proposal.input)) ===
          JSON.stringify(stored.proposal)
        )
          status = "READY";
      } catch (error: unknown) {
        if (error instanceof FinanceInputError && error.code === "FORBIDDEN") throw error;
      }
    return { success: true, data: { proposal: stored.proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
/** Locks follow the existing manual payment→bill→project order. */
async function lockSources(
  tx: FinanceTransaction,
  actor: Actor,
  proposal: VendorPaymentWorkflowProposal,
): Promise<void> {
  if (proposal.input.action !== "SCHEDULE")
    await tx
      .select()
      .from(vendorPayment)
      .where(eq(vendorPayment.id, proposal.input.vendorPaymentId))
      .for("update");
  await tx.select().from(vendorBill).where(eq(vendorBill.id, proposal.vendorBillId)).for("update");
  await lockFinanceProject(tx, actor, proposal.projectId);
  await tx
    .select()
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        inArray(appConfig.key, [APPROVAL_THRESHOLD_CONFIG_KEYS.vendorPayment]),
      ),
    )
    .for("update");
  if (proposal.input.action === "PAY" || proposal.input.action === "SCHEDULE")
    await tx
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.id, proposal.input.bankAccountId))
      .for("update");
  const bill = await tx.query.vendorBill.findFirst({
    where: eq(vendorBill.id, proposal.vendorBillId),
  });
  if (bill?.projectBudgetCategoryId)
    await tx
      .select()
      .from(projectBudgetCategory)
      .where(eq(projectBudgetCategory.id, bill.projectBudgetCategoryId))
      .for("update");
}
export async function confirmAiVendorPaymentWorkflowProposal(
  raw: unknown,
): Promise<ActionResponse<VendorPaymentWorkflowReceipt>> {
  const actor = await resolveActor(),
    identity = vendorPaymentWorkflowIdentitySchema.safeParse(raw);
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
  let proposal: VendorPaymentWorkflowProposal;
  try {
    proposal = (await owned(db, actor, identity.data)).proposal;
    await assertSources(actor, proposal);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    VENDOR_PAYMENT_WORKFLOW_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, identity.data),
        input = stored.proposal.input;
      assertVendorWorkflowRights(actor, input);
      if (stored.expiresAt <= Date.now())
        throw new FinanceInputError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      await lockSources(tx, actor, stored.proposal);
      if (
        JSON.stringify(await prepareVendorPaymentWorkflow(actor, input, tx)) !==
        JSON.stringify(stored.proposal)
      )
        throw new FinanceInputError(
          "CONFLICT",
          "Tagihan, jadwal, approval, saldo atau aturan berubah sejak preview. Minta usulan terbaru.",
        );
      const result =
        input.action === "SCHEDULE"
          ? await scheduleVendorPaymentTx(tx, actor, {
              vendorBillId: input.vendorBillId,
              bankAccountId: input.bankAccountId,
              amountPaid: input.amount,
              paymentDate: new Date(input.paymentDate + "T00:00:00Z"),
            })
          : input.action === "PAY"
            ? await payVendorBillTx(tx, actor, input)
            : await decideVendorPaymentTx(tx, actor, {
                vendorPaymentId: input.vendorPaymentId,
                status: input.action === "APPROVE" ? "APPROVED" : "REJECTED",
                notes: input.notes,
                emergencyOverride: false,
              });
      const documentId = "paymentId" in result ? result.paymentId : result.id;
      return { documentId, result: { projectId: stored.proposal.projectId } };
    },
    failure,
  );
  if (!result.success) return result;
  for (const path of [
    "/ledger",
    "/expenses",
    "/approvals",
    "/reconciliation",
    `/projects/${proposal.projectId}`,
  ])
    revalidateWorkspacePath(path);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
