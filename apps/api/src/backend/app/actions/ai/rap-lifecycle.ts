import {
  addProjectRapItemsTx,
  lockRapMaterialReferencesTx,
} from "@backend/server/usecases/material/rap-writer";
import { copyRapTemplateTx } from "@backend/server/usecases/material/rap-template-writer";
import { itemPriceLibrary } from "@backend/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  aiProposalConfirmation,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
} from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { readOwnedStoredProposal } from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  assertSetupScope,
  canReadSetup,
  setupFailure,
  SetupError,
} from "@backend/server/usecases/ai/rap-finalization-context";
import {
  readLifecycleContext,
  buildLifecycleProposal,
} from "@backend/server/usecases/ai/rap-lifecycle-context";
import {
  createRapRevisionTx,
  createPackageRevisionTx,
  lockRevisionContextTx,
} from "@backend/server/usecases/project/rap-revision-writer";
import {
  changePackageStatusTx,
  deletePackageTx,
} from "@backend/server/usecases/project/category-plan-writer";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  lifecycleIdentitySchema,
  lifecycleProposalSchema,
  lifecyclePermissions,
  type LifecycleProposal,
  type LifecycleView,
  type LifecycleReceipt,
} from "@atria/core/ai/rap-lifecycle";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
import type { z } from "zod";
type Identity = z.infer<typeof lifecycleIdentitySchema>;
async function owned(
  connection: Pick<FinanceTransaction, "query">,
  actor: Actor,
  identity: Identity,
): Promise<{ proposal: LifecycleProposal; expiresAt: number }> {
  try {
    return await readOwnedStoredProposal(
      connection,
      actor,
      identity,
      "proposeRapLifecycleActions",
      lifecycleProposalSchema,
    );
  } catch {
    throw new SetupError("NOT_FOUND", "Usulan RAP tidak ditemukan pada percakapan Anda.");
  }
}
function assertRights(actor: Actor, proposal: LifecycleProposal): void {
  if (
    !canReadSetup(actor) ||
    lifecyclePermissions(proposal.request).some((p) => !actorCan(actor, p))
  )
    throw new SetupError("FORBIDDEN", "Izin tindakan RAP telah berubah.");
}
export async function getAiRapLifecycleProposal(
  input: unknown,
): Promise<ActionResponse<LifecycleView>> {
  const actor = await resolveActor();
  if (!actor || !canReadSetup(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat, RAP dan budget diperlukan." },
    };
  const identity = lifecycleIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identitas usulan tidak valid." },
    };
  try {
    const stored = await owned(db, actor, identity.data);
    assertRights(actor, stored.proposal);
    await assertSetupScope(actor, stored.proposal.projectId);
    const receipt = await db.query.aiProposalConfirmation.findFirst({
      where: and(
        eq(aiProposalConfirmation.userId, actor.userId),
        eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
        eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
        eq(aiProposalConfirmation.proposalType, "RAP_LIFECYCLE"),
      ),
    });
    if (receipt)
      return {
        success: true,
        data: {
          proposal: stored.proposal,
          status: "CONFIRMED",
          confirmedAt: receipt.createdAt.toISOString(),
        },
      };
    let status: LifecycleView["status"] = stored.expiresAt <= Date.now() ? "EXPIRED" : "STALE";
    if (status !== "EXPIRED") {
      try {
        const context = await readLifecycleContext(
          actor,
          stored.proposal.projectId,
          db,
          stored.proposal.request,
        );
        if (
          context.fingerprint === stored.proposal.expectedContext &&
          JSON.stringify(
            buildLifecycleProposal(actor, stored.proposal.request, context, stored.proposal),
          ) === JSON.stringify(stored.proposal)
        )
          status = "READY";
      } catch (error: unknown) {
        if (error instanceof SetupError && error.code === "FORBIDDEN") throw error;
      }
    }
    return { success: true, data: { proposal: stored.proposal, status, confirmedAt: null } };
  } catch (error: unknown) {
    return setupFailure(error);
  }
}
export async function confirmAiRapLifecycleProposal(
  input: unknown,
): Promise<ActionResponse<LifecycleReceipt>> {
  const actor = await resolveActor();
  if (!actor || !canReadSetup(actor))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses chat, RAP dan budget diperlukan." },
    };
  const identity = lifecycleIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Konfirmasi hanya menerima identitas usulan server.",
      },
    };
  let stored: Awaited<ReturnType<typeof owned>>;
  try {
    stored = await owned(db, actor, identity.data);
    assertRights(actor, stored.proposal);
    await assertSetupScope(actor, stored.proposal.projectId);
  } catch (error: unknown) {
    return setupFailure(error);
  }
  const result = await confirmMutation(
    actor,
    identity.data,
    "RAP_LIFECYCLE",
    async (tx) => {
      const fresh = await owned(tx, actor, identity.data),
        proposal = fresh.proposal;
      assertRights(actor, proposal);
      if (fresh.expiresAt <= Date.now())
        throw new SetupError("CONFLICT", "Usulan kedaluwarsa. Minta usulan terbaru.");
      await lockRevisionContextTx(
        tx,
        actor,
        proposal.projectId,
        proposal.request.action === "PACKAGE_CHANGES" ? "update:budget" : "update:rap",
      );
      const [budget] = await tx
        .select()
        .from(projectBudgets)
        .where(
          and(
            eq(projectBudgets.projectId, proposal.projectId),
            eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
          ),
        )
        .for("share");
      if (!budget) throw new SetupError("CONFLICT", "Budget berubah.");
      const categories = await tx
        .select()
        .from(projectBudgetCategory)
        .where(eq(projectBudgetCategory.projectBudgetId, budget.id))
        .orderBy(asc(projectBudgetCategory.id))
        .for("share");
      if (categories.length)
        await tx
          .select({ id: expenseCategory.id })
          .from(expenseCategory)
          .where(
            inArray(
              expenseCategory.id,
              categories.map((c) => c.expenseCategoryId),
            ),
          )
          .orderBy(asc(expenseCategory.id))
          .for("share");
      const libraryIds = proposal.materialRows
        .flatMap((r) => (r.libraryId ? [r.libraryId] : []))
        .sort();
      if (libraryIds.length)
        await tx
          .select({ id: itemPriceLibrary.id })
          .from(itemPriceLibrary)
          .where(inArray(itemPriceLibrary.id, libraryIds))
          .orderBy(asc(itemPriceLibrary.id))
          .for("share");
      await lockRapMaterialReferencesTx(
        tx,
        proposal.materialRows.flatMap((r) => (r.values.materialId ? [r.values.materialId] : [])),
      );
      const context = await readLifecycleContext(actor, proposal.projectId, tx, proposal.request);
      if (
        context.fingerprint !== proposal.expectedContext ||
        JSON.stringify(buildLifecycleProposal(actor, proposal.request, context, proposal)) !==
          JSON.stringify(proposal)
      )
        throw new SetupError("CONFLICT", "RAP, paket atau budget berubah. Minta preview terbaru.");
      if (proposal.request.action === "REVISION") {
        if (!proposal.nextRapId)
          throw new SetupError("CONFLICT", "Identitas revisi tidak tersedia.");
        await createRapRevisionTx(
          tx,
          actor,
          proposal.projectRapId,
          proposal.request.reason,
          proposal.nextRapId,
        );
        for (const row of proposal.rows.filter((r) => r.category !== "MATERIAL")) {
          if (!row.nextId)
            throw new SetupError("CONFLICT", "Identitas revisi paket tidak tersedia.");
          await createPackageRevisionTx(tx, actor, row.id, proposal.request.reason, row.nextId);
        }
      } else if (proposal.request.action === "PACKAGE_CHANGES") {
        for (const row of [...proposal.rows].sort((a, b) => a.id.localeCompare(b.id))) {
          if (row.action === "DELETE") await deletePackageTx(tx, actor, row.id);
          else await changePackageStatusTx(tx, actor, row.id, "DRAFT");
        }
      }
      if (proposal.request.action === "ADD_MATERIAL") {
        for (const [index, source] of proposal.request.rows.entries()) {
          const row = proposal.materialRows[index];
          if (!row) throw new SetupError("CONFLICT", "Item yang ditinjau tidak tersedia.");
          if (source.sourceKind === "LIBRARY")
            await copyRapTemplateTx(
              tx,
              actor,
              { ...source, projectRapId: proposal.projectRapId },
              row.rowId,
            );
          else
            await addProjectRapItemsTx(tx, actor, proposal.projectRapId, [row.values], [row.rowId]);
        }
      }
      const id = proposal.nextRapId ?? proposal.projectRapId;
      return { documentId: id, result: { id } };
    },
    setupFailure,
  );
  if (!result.success) return result;
  revalidateWorkspacePath(`/projects/${stored.proposal.projectId}`);
  return {
    success: true,
    data: {
      projectRapId: result.data.documentId,
      addedIds: stored.proposal.materialRows.map((r) => r.rowId),
      revisionIds: stored.proposal.rows
        .filter((r) => r.action === "REVISION")
        .flatMap((r) => (r.nextId ? [r.nextId] : [])),
      reopenedIds: stored.proposal.rows.filter((r) => r.action === "REOPEN").map((r) => r.id),
      deletedIds: stored.proposal.rows.filter((r) => r.action === "DELETE").map((r) => r.id),
      alreadyConfirmed: result.data.kind === "already",
    },
  };
}
