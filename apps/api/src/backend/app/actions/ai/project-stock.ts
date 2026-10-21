import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  canReadProjectStock,
  prepareProjectStockProposal,
  readStockProjectAccess,
} from "@backend/server/usecases/ai/project-stock-context";
import {
  ProjectStockError,
  writeProjectStockRowTx,
  type ProjectStockTx,
} from "@backend/server/usecases/material/project-stock-writer";
import { mapStockError } from "@backend/app/actions/material/inventory-utils";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  PROJECT_STOCK_KIND,
  projectStockIdentitySchema,
  projectStockProposalSchema,
  projectStockPermission,
  type ProjectStockProposal,
  type ProjectStockView,
  type ProjectStockReceipt,
} from "@atria/core/ai/project-stock";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { z } from "zod";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
type Identity = z.infer<typeof projectStockIdentitySchema>;
function failure(error: unknown): ActionResponse<never> {
  if (error instanceof ProjectStockError)
    return { success: false, error: { code: error.code, message: error.message } };
  const stock = mapStockError<never>(error, "Pergerakan stok belum tersimpan.");
  if (!stock.success && stock.error.code !== "TRANSACTION_FAILED") return stock;
  return {
    success: false,
    error: {
      code: "CONFLICT",
      message:
        "Stok, sumber biaya atau kesiapan berubah. Periksa sumber dan minta preview terbaru.",
    },
  };
}
async function owned(
  connection: Pick<ProjectStockTx, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: ProjectStockProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      identity,
      "proposeProjectStock",
      projectStockProposalSchema,
    );
  } catch {
    throw new ProjectStockError(
      "NOT_FOUND",
      "Usulan stok belum tersimpan atau bukan milik percakapan Anda.",
    );
  }
}
function rights(actor: Actor, proposal: ProjectStockProposal): void {
  if (!canReadProjectStock(actor) || !actorCan(actor, projectStockPermission(proposal.action)))
    throw new ProjectStockError("FORBIDDEN", "Izin pergerakan stok telah berubah.");
}
export async function getAiProjectStockProposal(
  input: unknown,
): Promise<ActionResponse<ProjectStockView>> {
  const actor = await resolveActor(),
    identity = projectStockIdentitySchema.safeParse(input);
  if (!actor || !canReadProjectStock(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat dan stok Material diperlukan." },
    };
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    rights(actor, stored.proposal);
    await readStockProjectAccess(actor, stored.proposal.projectId);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, PROJECT_STOCK_KIND),
      ),
    });
    const proposal = actorCan(actor, "view:budget")
      ? stored.proposal
      : { ...stored.proposal, budget: null };
    // A receipt is historical; execution is never re-run on a read.
    if (receipt)
      return {
        success: true,
        data: { proposal, status: "CONFIRMED", resultId: receipt.documentId },
      };
    let status: ProjectStockView["status"] = stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED") {
      try {
        const fresh = await prepareProjectStockProposal(actor, stored.proposal.input);
        if (JSON.stringify(fresh) === JSON.stringify(stored.proposal)) status = "READY";
      } catch (error: unknown) {
        if (error instanceof ProjectStockError && error.code === "FORBIDDEN") throw error;
      }
    }
    return { success: true, data: { proposal, status, resultId: null } };
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiProjectStockProposal(
  input: unknown,
): Promise<ActionResponse<ProjectStockReceipt>> {
  const actor = await resolveActor(),
    identity = projectStockIdentitySchema.safeParse(input);
  if (!actor || !canReadProjectStock(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat dan stok Material diperlukan." },
    };
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan tersimpan.",
      },
    };
  let initial: Awaited<ReturnType<typeof owned>>;
  try {
    initial = await owned(db, actor, identity.data);
    rights(actor, initial.proposal);
    await readStockProjectAccess(actor, initial.proposal.projectId);
  } catch (error: unknown) {
    return failure(error);
  }
  const outcome = await confirmMutation(
    actor,
    identity.data,
    PROJECT_STOCK_KIND,
    async (tx) => {
      const stored = await owned(tx, actor, identity.data);
      rights(actor, stored.proposal);
      if (stored.expiresAt <= Date.now())
        throw new ProjectStockError("CONFLICT", "Usulan kedaluwarsa. Minta preview terbaru.");
      const fresh = await prepareProjectStockProposal(actor, stored.proposal.input, tx);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new ProjectStockError(
          "CONFLICT",
          "Data stok atau budget berubah. Minta preview terbaru sebelum menyimpan.",
        );
      const movements = [];
      for (const row of [...fresh.input.rows].sort((a, b) =>
        `${a.materialId}:${a.inventoryLocationId}`.localeCompare(
          `${b.materialId}:${b.inventoryLocationId}`,
        ),
      ))
        movements.push(await writeProjectStockRowTx(tx, actor, fresh.projectId, fresh.action, row));
      if (!movements[0]) throw new ProjectStockError("CONFLICT", "Pergerakan stok tidak tersedia.");
      return { documentId: movements[0].id, result: { projectId: fresh.projectId } };
    },
    failure,
  );
  if (!outcome.success) return outcome;
  revalidateWorkspacePath("/materials");
  revalidateWorkspacePath(`/projects/${initial.proposal.projectId}`);
  revalidateWorkspacePath("/ledger");
  return {
    success: true,
    data: { resultId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
