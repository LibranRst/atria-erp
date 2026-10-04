import { eq } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { db } from "@backend/db";
import { aiConversation, aiProposalConfirmation, role } from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { createRoleUseCase } from "@backend/server/usecases/administration/roles";
import {
  describeForbiddenProposal,
  findForbiddenProposalPermissions,
} from "@atria/core/auth/ai-role-proposal";
import { isKnownPermissionKey } from "@atria/core/auth/role-impact";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiCreateRoleProposalSchema } from "@atria/core/validations/ai-proposal";

type ConfirmResult = { readonly roleId: string; readonly alreadyConfirmed: boolean };

/**
 * Membuat peran baru dari kartu asisten.
 *
 * Peran baru selalu nol pemegang, jadi tidak ada kemampuan siapa pun yang
 * berubah saat ini diterapkan — penugasan orang ke dalamnya menuntut
 * `manage:users`, yang tertutup dari jalur asisten. Yang dijaga di sini adalah
 * isi perannya, karena ia baru "menyala" ketika seseorang ditugaskan berbulan
 * kemudian, oleh orang yang jarang membuka lagi daftar izinnya.
 */
export async function confirmAiCreateRoleProposal(
  input: unknown,
): Promise<ActionResponse<ConfirmResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiCreateRoleProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian peran baru tidak valid." },
    };
  }
  const proposal = validation.data;

  const unknown = proposal.permissions.filter((key) => !isKnownPermissionKey(key));
  if (unknown.length > 0) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: `Izin tidak dikenal: ${unknown.join(", ")}.` },
    };
  }
  const permissions = proposal.permissions as PermissionKey[];

  // Pagar yang sama dengan perubahan izin: sebagian kunci tidak boleh lahir
  // lewat jalur ini sama sekali, termasuk pada peran yang belum punya pemegang.
  const forbidden = findForbiddenProposalPermissions(permissions);
  if (forbidden.length > 0) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: describeForbiddenProposal(forbidden) },
    };
  }

  const normalized = proposal.name.trim().toUpperCase().replaceAll(" ", "_");
  const duplicate = await db.query.role.findFirst({ where: eq(role.name, normalized) });
  if (duplicate) {
    return { success: false, error: { code: "CONFLICT", message: "Nama peran sudah dipakai." } };
  }

  const existing = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
    columns: { documentId: true, userId: true },
  });
  if (existing) {
    return existing.userId === actor.userId
      ? { success: true, data: { roleId: existing.documentId, alreadyConfirmed: true } }
      : {
          success: false,
          error: { code: "FORBIDDEN", message: "Usulan ini milik percakapan pengguna lain." },
        };
  }

  const conversation = await db.query.aiConversation.findFirst({
    where: eq(aiConversation.id, proposal.conversationId),
    columns: { id: true, userId: true },
  });
  if (!conversation || conversation.userId !== actor.userId) {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }

  /*
   * Anti-eskalasi dan auditnya berada di use-case yang sama dengan layar:
   * aktornya manusia dari sesi ini, dan auditnya ditandai
   * `AI_PROPOSED_ROLE_CREATE`.
   */
  const result = await createRoleUseCase(
    actor,
    {
      name: proposal.name,
      description: proposal.description,
      dataScope: proposal.dataScope,
      permissions,
    },
    "AI_PROPOSAL",
  );
  if (!result.success) return result;

  await db.insert(aiProposalConfirmation).values({
    toolCallId: proposal.toolCallId,
    conversationId: conversation.id,
    userId: actor.userId,
    proposalType: "CREATE_ROLE",
    documentId: result.data.id,
  });

  revalidatePath("/settings");
  return { success: true, data: { roleId: result.data.id, alreadyConfirmed: false } };
}
