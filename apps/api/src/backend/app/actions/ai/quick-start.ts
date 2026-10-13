import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { aiProposalConfirmation, appConfig, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import { prepareQuickStartTx } from "@backend/server/usecases/ai/quick-start-context";
import {
  assertQuickStartActorTx,
  advanceQuickStartTx,
  pauseQuickStartTx,
  resumeQuickStartTx,
  recordQuickStartRetryTx,
  setInitialStockDecisionTx,
  createFirstProjectQuickStartTx,
  QuickStartError,
  type QuickStartTx,
} from "@backend/server/usecases/onboarding/quick-start-writer";
import {
  QUICK_START_KIND,
  quickStartIdentitySchema,
  quickStartProposalSchema,
  type QuickStartView,
} from "@atria/core/ai/quick-start";
import { OWNER_ONBOARDING_V2_CONFIG_KEY } from "@atria/core/onboarding/organization-setup";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
function failure(e: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code:
        e instanceof QuickStartError || e instanceof StoredProposalError
          ? e.code
          : "TRANSACTION_FAILED",
      message:
        e instanceof QuickStartError || e instanceof StoredProposalError
          ? e.message
          : e instanceof Error &&
              ["QUICK_START_COMPLETED", "STALE_QUICK_START_STEP"].includes(e.message)
            ? "Posisi setup berubah. Minta preview terbaru."
            : e instanceof Error && e.message === "FINANCE_DEFAULTS_INCOMPLETE"
              ? "Lengkapi default budget dan lima kategori utama terlebih dahulu."
              : "Setup belum dapat disimpan atau diperiksa. Periksa lagi sebelum mengulang.",
    },
  };
}
export async function getAiQuickStartProposal(
  raw: unknown,
): Promise<ActionResponse<QuickStartView>> {
  const actor = await resolveActor(),
    id = quickStartIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!id.success)
    return failure(new QuickStartError("VALIDATION_ERROR", "Identitas usulan setup tidak valid."));
  try {
    return await db.transaction(async (tx) => {
      const stored = await readOwnedStoredProposal(
        tx,
        actor,
        id.data,
        "proposeQuickStart",
        quickStartProposalSchema,
      );
      await assertQuickStartActorTx(tx, actor, stored.proposal.input, true);
      const receipt = await tx.query.aiProposalConfirmation.findFirst({
        where: and(
          eq(aiProposalConfirmation.toolCallId, id.data.toolCallId),
          eq(aiProposalConfirmation.userId, actor.userId),
          eq(aiProposalConfirmation.conversationId, id.data.conversationId),
          eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
          eq(aiProposalConfirmation.proposalType, QUICK_START_KIND),
        ),
      });
      const destination =
        stored.proposal.input.action === "CREATE_PROJECT" && receipt
          ? `/projects/${receipt.documentId}`
          : stored.proposal.input.action === "STOCK_DECISION"
            ? "/settings?tab=readiness"
            : "/onboarding";
      if (receipt)
        return {
          success: true,
          data: {
            proposal: stored.proposal,
            status: "CONFIRMED",
            blockedReason: null,
            resultId: receipt.documentId,
            destination,
          },
        };
      if (stored.expiresAt <= Date.now())
        return {
          success: true,
          data: {
            proposal: stored.proposal,
            status: "EXPIRED",
            resultId: null,
            destination,
            blockedReason: null,
          },
        };
      let status: QuickStartView["status"] = "STALE";
      let blockedReason: string | null = null;
      try {
        const fresh = await prepareQuickStartTx(tx, actor, stored.proposal.input);
        if (JSON.stringify(fresh) === JSON.stringify(stored.proposal))
          status = fresh.changed ? "READY" : "NO_CHANGE";
      } catch (e: unknown) {
        if (e instanceof QuickStartError && e.code === "CONFLICT") blockedReason = e.message;
        if (
          !(e instanceof QuickStartError && e.code === "CONFLICT") &&
          !(
            e instanceof Error &&
            ["QUICK_START_COMPLETED", "STALE_QUICK_START_STEP"].includes(e.message)
          )
        )
          throw e;
      }
      return {
        success: true,
        data: { proposal: stored.proposal, status, resultId: null, destination, blockedReason },
      };
    });
  } catch (e: unknown) {
    return failure(e);
  }
}
export async function confirmAiQuickStartProposal(
  raw: unknown,
): Promise<ActionResponse<{ readonly resultId: string; readonly alreadyConfirmed: boolean }>> {
  const actor = await resolveActor(),
    id = quickStartIdentitySchema.safeParse(raw);
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  if (!id.success)
    return failure(
      new QuickStartError(
        "VALIDATION_ERROR",
        "Konfirmasi hanya menerima identitas usulan setup tersimpan.",
      ),
    );
  try {
    await db.transaction(async (tx) => {
      const stored = await readOwnedStoredProposal(
        tx,
        actor,
        id.data,
        "proposeQuickStart",
        quickStartProposalSchema,
      );
      await assertQuickStartActorTx(tx, actor, stored.proposal.input, true);
    });
  } catch (e: unknown) {
    return failure(e);
  }
  const outcome = await confirmMutation(
    actor,
    id.data,
    QUICK_START_KIND,
    async (tx: QuickStartTx) => {
      const stored = await readOwnedStoredProposal(
        tx,
        actor,
        id.data,
        "proposeQuickStart",
        quickStartProposalSchema,
      );
      if (stored.expiresAt <= Date.now())
        throw new QuickStartError("CONFLICT", "Usulan kedaluwarsa. Minta preview setup terbaru.");
      const fresh = await prepareQuickStartTx(tx, actor, stored.proposal.input);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new QuickStartError(
          "CONFLICT",
          "Progres, Settings atau sumber setup berubah. Minta preview terbaru.",
        );
      if (!fresh.changed)
        throw new QuickStartError(
          "CONFLICT",
          "Setup sudah sesuai. Tidak ada perubahan untuk disimpan.",
        );
      const input = fresh.input;
      let documentId: string;
      if (input.action === "CREATE_PROJECT")
        documentId = (await createFirstProjectQuickStartTx(tx, actor, input.project)).projectId;
      else if (input.action === "RETRY")
        documentId = await recordQuickStartRetryTx(tx, actor, input.stepId);
      else {
        if (input.action === "ADVANCE")
          await advanceQuickStartTx(tx, actor, { stepId: input.stepId });
        else if (input.action === "PAUSE")
          await pauseQuickStartTx(tx, actor, { currentStep: input.stepId });
        else if (input.action === "RESUME") await resumeQuickStartTx(tx, actor, input.stepId);
        else await setInitialStockDecisionTx(tx, actor, { decision: input.decision });
        const config = await tx.query.appConfig.findFirst({
          where: and(
            eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
            eq(appConfig.tenantId, INSTANCE_TENANT_ID),
          ),
          columns: { id: true },
        });
        if (!config) throw new QuickStartError("CONFLICT", "Hasil setup tidak tersedia.");
        documentId = config.id;
      }
      return { documentId, result: { action: input.action } };
    },
    failure,
  );
  if (!outcome.success) return outcome;
  for (const path of ["/", "/onboarding", "/settings", "/projects", "/ledger", "/materials"])
    revalidateWorkspacePath(path);
  if (outcome.data.kind === "created" && outcome.data.result.action === "CREATE_PROJECT")
    revalidateWorkspacePath(`/projects/${outcome.data.documentId}`);
  return {
    success: true,
    data: { resultId: outcome.data.documentId, alreadyConfirmed: outcome.data.kind === "already" },
  };
}
