import {
  writeReceiptReversalTx,
  assertReceiptScope,
  ReceiptReversalError,
} from "@backend/server/usecases/material/receipt-reversal-writer";
import {
  assertStockCorrectionActorTx,
  writeStockCorrectionTx,
  StockCorrectionError,
  stockCorrectionReferencePermissions,
} from "@backend/server/usecases/material/stock-correction-writer";
import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation, project, formDraft, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  prepareProcurementWarehouseProposal,
  assertProcurementWarehouseRights,
  ProcurementWarehouseError,
  toBillDraftPayload,
} from "@backend/server/usecases/ai/procurement-warehouse-context";
import {
  saveVendorBillDraftTx,
  submitVendorBillDraftTx,
} from "@backend/server/usecases/finance/vendor-bill-draft-writer";
import { createStockTransferTx } from "@backend/server/usecases/material/warehouse-transfer-writer";
import {
  saveStockCountTx,
  submitStockCountTx,
  approveStockCountTx,
  rejectStockCountTx,
} from "@backend/server/usecases/material/warehouse-count-writer";
import { postGoodsReceiptTx } from "@backend/server/usecases/material/post-goods-receipt";
import {
  createWarehouseIntakeTx,
  WarehouseIntakeError,
} from "@backend/server/usecases/material/warehouse-intake-writer";
import {
  createInventoryOpeningTx,
  decideInventoryOpeningTx,
  reverseInventoryOpeningTx,
} from "@backend/server/usecases/material/opening-inventory-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  correctVendorBillTx,
  VendorBillCorrectionError,
} from "@backend/server/usecases/finance/vendor-bill-correction-writer";
import {
  procurementWarehouseIdentitySchema,
  procurementWarehouseProposalSchema,
  PROCUREMENT_WAREHOUSE_KIND,
  type ProcurementWarehouseProposal,
  type ProcurementWarehouseView,
  type ProcurementWarehouseReceipt,
} from "@atria/core/ai/procurement-warehouse";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof procurementWarehouseIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  if (
    error instanceof ProcurementWarehouseError ||
    error instanceof StockCorrectionError ||
    error instanceof ReceiptReversalError ||
    error instanceof WarehouseIntakeError ||
    error instanceof VendorBillCorrectionError
  )
    return { success: false, error: { code: error.code, message: error.message } };
  const denied = error instanceof Error && error.message.startsWith("FORBIDDEN");
  return {
    success: false,
    error: {
      code: denied ? "FORBIDDEN" : "CONFLICT",
      message: denied
        ? "Akses tindakan atau proyek tidak tersedia."
        : "Sumber, draft, stok atau status berubah. Periksa data dan minta preview terbaru; belum ada perubahan yang disimpan.",
    },
  };
}
async function owned(
  tx: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: ProcurementWarehouseProposal; expiresAt: number }> {
  const matches: { proposal: ProcurementWarehouseProposal; expiresAt: number }[] = [];
  for (const name of [
    "proposeVendorBill",
    "proposeVendorBillCorrection",
    "proposeWarehouseOperation",
    "proposeWarehouseIntake",
    "proposeGoodsReceipt",
    "proposeStockCorrection",
  ]) {
    try {
      matches.push(
        await readOwnedStoredProposal(
          tx,
          actor,
          identity,
          name,
          procurementWarehouseProposalSchema,
        ),
      );
    } catch {
      /* Absent alternate tool is expected; require exactly one proof. */
    }
  }
  if (matches.length !== 1)
    throw new ProcurementWarehouseError(
      "NOT_FOUND",
      "Usulan belum tersimpan atau bukan milik percakapan Anda.",
    );
  return matches[0];
}
async function rights(
  tx: Pick<FinanceTransaction, "query" | "select">,
  actor: Actor,
  proposal: ProcurementWarehouseProposal,
): Promise<void> {
  assertProcurementWarehouseRights(actor, proposal.input);
  if (proposal.input.action === "STOCK_CORRECT")
    await assertStockCorrectionActorTx(
      tx,
      actor,
      true,
      stockCorrectionReferencePermissions(proposal.input),
    );
  if (proposal.projectId) {
    const accessible = await tx.query.project.findFirst({
      where: and(
        eq(project.id, proposal.projectId),
        eq(project.tenantId, INSTANCE_TENANT_ID),
        actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
      ),
      columns: { id: true },
    });
    if (
      !accessible ||
      (actor.dataScope === "NONE" &&
        !proposal.action.startsWith("RECEIPT_REVERSAL") &&
        proposal.action !== "PROJECT_RECEIPT")
    )
      throw new ProcurementWarehouseError("FORBIDDEN", "Proyek di luar akses Anda.");
  }
}
export async function getAiProcurementWarehouseProposal(
  raw: unknown,
): Promise<ActionResponse<ProcurementWarehouseView>> {
  const actor = await resolveActor(),
    parsed = procurementWarehouseIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return { success: false, error: { code: "FORBIDDEN", message: "Akses chat tidak tersedia." } };
  if (!parsed.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, parsed.data);
    await rights(db, actor, stored.proposal);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, parsed.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, parsed.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, PROCUREMENT_WAREHOUSE_KIND),
      ),
    });
    let status: ProcurementWarehouseView["status"] = receipt
      ? "CONFIRMED"
      : stored.expiresAt <= Date.now()
        ? "EXPIRED"
        : "STALE";
    if (!receipt && status !== "EXPIRED") {
      try {
        const fresh = await prepareProcurementWarehouseProposal(actor, stored.proposal.input);
        if (JSON.stringify(fresh) === JSON.stringify(stored.proposal)) status = "READY";
      } catch (error: unknown) {
        if (
          error instanceof ProcurementWarehouseError ||
          (error instanceof StockCorrectionError && error.code === "FORBIDDEN") ||
          (error instanceof VendorBillCorrectionError &&
            (error.code === "FORBIDDEN" || error.code === "CONFLICT")) ||
          (error instanceof ReceiptReversalError && error.code === "FORBIDDEN")
        )
          throw error;
      }
    }
    const proposal = actorCan(actor, "view:budget")
      ? stored.proposal
      : {
          ...stored.proposal,
          budget: null,
          summary: stored.proposal.summary.filter(
            (f) => f.label !== "Melebihi alokasi termasuk pending",
          ),
        };
    return { success: true, data: { proposal, status, resultId: receipt?.documentId ?? null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
async function writeTx(
  tx: FinanceTransaction,
  actor: Actor,
  proposal: ProcurementWarehouseProposal,
): Promise<string> {
  const input = proposal.input;
  switch (input.action) {
    case "STOCK_CORRECT":
      return (await writeStockCorrectionTx(tx, actor, input, true))[0].id;
    case "VENDOR_BILL_CORRECT":
      return (await correctVendorBillTx(tx, actor, input)).id;
    case "PROJECT_RECEIPT":
      return (
        await postGoodsReceiptTx(tx, actor, {
          ...input,
          receivedAt: new Date(input.receivedAt + "T00:00:00Z"),
        })
      ).id;
    case "WAREHOUSE_STOCK_IN":
      return (await createWarehouseIntakeTx(tx, actor, input)).id;
    case "OPENING_REQUEST":
      return (
        await createInventoryOpeningTx(tx, actor, {
          ...input,
          cutoverDate: new Date(input.cutoverDate + "T00:00:00Z"),
        })
      ).id;
    case "OPENING_APPROVE":
    case "OPENING_REJECT":
      return (
        await decideInventoryOpeningTx(tx, actor, {
          batchId: input.batchId,
          decision: input.action === "OPENING_APPROVE" ? "APPROVE" : "REJECT",
          reason: input.reason,
          emergencyOverride: false,
        })
      ).id;
    case "OPENING_REVERSE":
      return (await reverseInventoryOpeningTx(tx, actor, input)).id;
    case "RECEIPT_REVERSAL_REQUEST":
    case "RECEIPT_REVERSAL_APPROVE":
    case "RECEIPT_REVERSAL_REJECT":
      await assertReceiptScope(tx, actor, proposal.projectId!);
      return (await writeReceiptReversalTx(tx, actor, input)).id;
    case "VENDOR_BILL_SAVE":
      return (
        await saveVendorBillDraftTx(tx, actor, {
          draftId: input.draftId,
          expectedRevision: input.expectedRevision,
          payload: toBillDraftPayload(input.payload),
        })
      ).id;
    case "VENDOR_BILL_SUBMIT": {
      const row = await tx.query.formDraft.findFirst({ where: eq(formDraft.id, input.draftId) });
      if (!row) throw new ProcurementWarehouseError("CONFLICT", "Draft tidak tersedia.");
      return (
        await submitVendorBillDraftTx(tx, actor, {
          draftId: input.draftId,
          expectedRevision: row.revision,
        })
      ).vendorBillId;
    }
    case "WAREHOUSE_TRANSFER":
      return (
        await createStockTransferTx(tx, actor, {
          ...input,
          transferredAt: new Date(`${input.transferredAt}T00:00:00.000Z`),
        })
      ).id;
    case "STOCK_COUNT_SAVE":
      return (await saveStockCountTx(tx, actor, input)).id;
    case "STOCK_COUNT_SUBMIT":
      return (await submitStockCountTx(tx, actor, input)).id;
    case "STOCK_COUNT_APPROVE":
      return (
        await approveStockCountTx(tx, actor, {
          stockCountId: input.stockCountId,
          emergencyOverride: false,
        })
      ).id;
    case "STOCK_COUNT_REJECT":
      return (await rejectStockCountTx(tx, actor, input)).id;
  }
}
export async function confirmAiProcurementWarehouseProposal(
  raw: unknown,
): Promise<ActionResponse<ProcurementWarehouseReceipt>> {
  const actor = await resolveActor(),
    parsed = procurementWarehouseIdentitySchema.safeParse(raw);
  if (!actor || !actorCan(actor, "use:ai_chat"))
    return { success: false, error: { code: "FORBIDDEN", message: "Akses chat tidak tersedia." } };
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  let initial: Awaited<ReturnType<typeof owned>>;
  try {
    initial = await owned(db, actor, parsed.data);
    await rights(db, actor, initial.proposal);
  } catch (error: unknown) {
    return failure(error);
  }
  const result = await confirmMutation(
    actor,
    parsed.data,
    PROCUREMENT_WAREHOUSE_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, parsed.data);
      await rights(tx, actor, stored.proposal);
      if (stored.expiresAt <= Date.now())
        throw new ProcurementWarehouseError(
          "CONFLICT",
          "Usulan kedaluwarsa. Minta preview terbaru.",
        );
      const fresh = await prepareProcurementWarehouseProposal(actor, stored.proposal.input, tx);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new ProcurementWarehouseError(
          "CONFLICT",
          "Data berubah sejak preview. Minta preview terbaru sebelum menyimpan.",
        );
      return {
        documentId: await writeTx(tx, actor, fresh),
        result: { projectId: fresh.projectId },
      };
    },
    failure,
  );
  if (!result.success) return result;
  for (const path of [
    "/expenses",
    "/materials",
    "/materials/opening",
    "/approvals",
    "/settings",
    "/onboarding/review",
    "/ledger",
    ...(initial.proposal.projectId ? [`/projects/${initial.proposal.projectId}`] : []),
  ])
    revalidateWorkspacePath(path);
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
