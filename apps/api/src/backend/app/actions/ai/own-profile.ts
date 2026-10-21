import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  aiProposalConfirmation,
  auditLog,
  attachment,
  user,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import {
  readOwnedStoredProposal,
  StoredProposalError,
} from "@backend/server/usecases/ai/stored-proposal";
import { confirmMutation } from "@backend/server/usecases/ai/confirm-mutation";
import {
  readOwnProfileTx,
  prepareOwnProfileTx,
  ownProfileSnapshot,
} from "@backend/server/usecases/ai/own-profile-context";
import {
  updateOwnProfileTx,
  OwnProfileError,
} from "@backend/server/usecases/profile/update-own-profile";
import {
  profileAvatarJpeg,
  storeProfileAvatar,
  discardProfileAvatar,
  type StoredProfileAvatar,
} from "@backend/server/usecases/profile/profile-avatar-storage";
import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import {
  OWN_PROFILE_KIND,
  ownProfileIdentitySchema,
  ownProfileProposalSchema,
  type OwnProfileView,
} from "@atria/core/ai/own-profile";
import type { ActionResponse } from "@atria/core/types/action-response";
import { revalidateWorkspacePath } from "@backend/lib/cache/revalidate-workspace";
function failure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code:
        error instanceof OwnProfileError || error instanceof StoredProposalError
          ? error.code
          : "TRANSACTION_FAILED",
      message:
        error instanceof OwnProfileError || error instanceof StoredProposalError
          ? error.message
          : "Profil belum dapat disimpan atau diperiksa. Periksa lagi sebelum mengulang.",
    },
  };
}
export async function getAiOwnProfileProposal(
  raw: unknown,
): Promise<ActionResponse<OwnProfileView>> {
  const actor = await resolveActor(),
    identity = ownProfileIdentitySchema.safeParse(raw);
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  if (!identity.success)
    return failure(new OwnProfileError("VALIDATION_ERROR", "Identitas usulan profil tidak valid."));
  try {
    return await db.transaction(async (tx) => {
      const current = await readOwnProfileTx(tx, actor),
        stored = await readOwnedStoredProposal(
          tx,
          actor,
          identity.data,
          "proposeOwnProfile",
          ownProfileProposalSchema,
        );
      const receipt = await tx.query.aiProposalConfirmation.findFirst({
        where: and(
          eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
          eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
          eq(aiProposalConfirmation.userId, actor.userId),
          eq(aiProposalConfirmation.tenantId, INSTANCE_TENANT_ID),
          eq(aiProposalConfirmation.proposalType, OWN_PROFILE_KIND),
        ),
      });
      if (receipt) {
        const audit = await tx.query.auditLog.findFirst({
          where: and(
            eq(auditLog.id, receipt.documentId),
            eq(auditLog.userId, actor.userId),
            eq(auditLog.targetTable, "user"),
            eq(auditLog.targetId, actor.userId),
            eq(auditLog.action, "UPDATE_OWN_PROFILE"),
          ),
        });
        const result = z
          .object({ name: z.string().optional(), image: z.string().nullable().optional() })
          .strict()
          .safeParse(audit?.newState ? JSON.parse(audit.newState) : null);
        const verified =
          result.success &&
          (result.data.name === undefined || current.name === result.data.name) &&
          (result.data.image === undefined || current.image === result.data.image);
        return {
          success: true,
          data: {
            proposal: stored.proposal,
            status: "CONFIRMED",
            current: ownProfileSnapshot(current),
            saved: result.success
              ? {
                  ...ownProfileSnapshot({
                    name: result.data.name ?? stored.proposal.after.name,
                    image:
                      result.data.image === undefined
                        ? stored.proposal.after.imageUrl
                        : result.data.image,
                  }),
                  hasPhoto:
                    result.data.image === undefined
                      ? stored.proposal.after.hasPhoto
                      : Boolean(result.data.image),
                }
              : null,
            verified,
            confirmedAt: receipt.createdAt.toISOString(),
          },
        };
      }
      const status =
        stored.expiresAt <= Date.now()
          ? "EXPIRED"
          : JSON.stringify(await prepareOwnProfileTx(tx, actor, stored.proposal.input)) ===
              JSON.stringify(stored.proposal)
            ? "READY"
            : "STALE";
      return {
        success: true,
        data: {
          proposal: stored.proposal,
          status,
          current: ownProfileSnapshot(current),
          saved: null,
          verified: false,
          confirmedAt: null,
        },
      };
    });
  } catch (error: unknown) {
    return failure(error);
  }
}
export async function confirmAiOwnProfileProposal(
  raw: unknown,
): Promise<ActionResponse<{ readonly resultId: string; readonly alreadyConfirmed: boolean }>> {
  const actor = await resolveActor(),
    identity = ownProfileIdentitySchema.safeParse(raw);
  if (!actor)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  if (!identity.success)
    return failure(
      new OwnProfileError(
        "VALIDATION_ERROR",
        "Simpan hanya menerima identitas usulan profil tersimpan.",
      ),
    );
  try {
    await db.transaction(async (tx) => {
      await readOwnProfileTx(tx, actor);
      await readOwnedStoredProposal(
        tx,
        actor,
        identity.data,
        "proposeOwnProfile",
        ownProfileProposalSchema,
      );
    });
  } catch (error: unknown) {
    return failure(error);
  }
  let uploaded: StoredProfileAvatar | null = null;
  const result = await confirmMutation(
    actor,
    identity.data,
    OWN_PROFILE_KIND,
    async (tx) => {
      const stored = await readOwnedStoredProposal(
        tx,
        actor,
        identity.data,
        "proposeOwnProfile",
        ownProfileProposalSchema,
      );
      if (stored.expiresAt <= Date.now())
        throw new OwnProfileError("CONFLICT", "Usulan kedaluwarsa. Minta usulan profil terbaru.");
      const fresh = await prepareOwnProfileTx(tx, actor, stored.proposal.input);
      if (JSON.stringify(fresh) !== JSON.stringify(stored.proposal))
        throw new OwnProfileError(
          "CONFLICT",
          "Profil atau foto sumber berubah. Minta usulan terbaru sebelum menyimpan.",
        );
      if (!fresh.changedFields.length)
        throw new OwnProfileError(
          "CONFLICT",
          "Profil sudah sesuai. Tidak ada perubahan untuk disimpan.",
        );
      const input = fresh.input;
      let imageUrl: string | null | undefined;
      if (input.photo.action === "REMOVE") imageUrl = null;
      else if (input.photo.action === "REPLACE") {
        const source = await readPrivateAttachment(
          actor,
          new URL(
            `/api/media/attachments/${input.photo.attachmentId}`,
            process.env.WEB_ORIGIN ?? "http://localhost:3000",
          ).href,
          "ai_chat",
        );
        const bytes = await profileAvatarJpeg(source.bytes, source.row.mimeType);
        uploaded = await storeProfileAvatar(bytes);
        imageUrl = uploaded.url;
        await tx.insert(attachment).values({
          uploadedById: actor.userId,
          fileName: "avatar.jpg",
          fileUrl: uploaded.url,
          storageFileId: uploaded.fileId,
          fileSize: bytes.length,
          mimeType: "image/jpeg",
          referenceType: "user_avatar",
          referenceId: actor.userId,
        });
      }
      const saved = await updateOwnProfileTx(tx, actor, {
        name: fresh.after.name,
        ...(imageUrl === undefined ? {} : { imageUrl }),
      });
      if (!saved.auditId)
        throw new OwnProfileError(
          "CONFLICT",
          "Profil sudah sesuai. Tidak ada perubahan untuk disimpan.",
        );
      return { documentId: saved.auditId, result: { updated: true } };
    },
    failure,
  );
  // Do not remove a committed avatar after an uncertain COMMIT response.
  if (!result.success && uploaded) {
    try {
      const receipt = await db.query.aiProposalConfirmation.findFirst({
        where: and(
          eq(aiProposalConfirmation.toolCallId, identity.data.toolCallId),
          eq(aiProposalConfirmation.conversationId, identity.data.conversationId),
          eq(aiProposalConfirmation.userId, actor.userId),
          eq(aiProposalConfirmation.proposalType, OWN_PROFILE_KIND),
        ),
      });
      if (receipt) {
        revalidateWorkspacePath("/", "layout");
        revalidateWorkspacePath("/profile");
        revalidateWorkspacePath("/ai");
        return { success: true, data: { resultId: receipt.documentId, alreadyConfirmed: true } };
      }
      const current = await db.query.user.findFirst({ where: eq(user.id, actor.userId) });
      const savedAvatar: StoredProfileAvatar = uploaded;
      if (current && current.image !== savedAvatar.url)
        await discardProfileAvatar(savedAvatar.fileId);
    } catch {
      /* Unknown outcome retains the upload until the owned receipt can be checked safely. */
    }
  }
  if (!result.success) return result;
  revalidateWorkspacePath("/", "layout");
  revalidateWorkspacePath("/profile");
  revalidateWorkspacePath("/ai");
  return {
    success: true,
    data: { resultId: result.data.documentId, alreadyConfirmed: result.data.kind === "already" },
  };
}
