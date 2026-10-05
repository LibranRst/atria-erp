import { and, eq, inArray } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";

import { db } from "@backend/db";
import {
  aiConversation,
  aiProposalConfirmation,
  role,
  rolePermission,
  user,
} from "@backend/db/schema";
import { resolveActor } from "@backend/server/actor";
import { updateRolePermissionsUseCase } from "@backend/server/usecases/administration/roles";
import {
  describeForbiddenProposal,
  findForbiddenProposalPermissions,
} from "@atria/core/auth/ai-role-proposal";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import { describeCriticalGaps, isKnownPermissionKey } from "@atria/core/auth/role-impact";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiRoleChangeProposalSchema } from "@atria/core/validations/ai-proposal";

type ConfirmResult = { readonly roleId: string; readonly alreadyConfirmed: boolean };

function refuse(code: "FORBIDDEN" | "VALIDATION_ERROR" | "CONFLICT", message: string) {
  return { success: false as const, error: { code, message } };
}

/**
 * Menerapkan usulan perubahan izin dari kartu asisten.
 *
 * Kartu itu datang dari klien, jadi tidak satu pun isinya dipercaya: yang dipakai
 * hanyalah id peran dan daftar kunci, dan seluruh penilaian diulang di sini
 * terhadap keadaan database saat ini. Peran bisa saja sudah berubah sejak
 * kartunya dibuat.
 *
 * Jalur ini lebih ketat daripada layar "Peran & akses", dan itu disengaja.
 * Layar menempatkan Owner di depan daftar lengkap; kartu menempatkannya di depan
 * satu tombol. Yang dibedakan bukan wewenangnya, melainkan bentuk keputusannya.
 */
export async function confirmAiRoleChangeProposal(
  input: unknown,
): Promise<ActionResponse<ConfirmResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiRoleChangeProposalSchema.safeParse(input);
  if (!validation.success) {
    return refuse("VALIDATION_ERROR", "Rincian perubahan peran tidak valid.");
  }
  const proposal = validation.data;

  const unknown = [...proposal.grant, ...proposal.revoke].filter(
    (key) => !isKnownPermissionKey(key),
  );
  if (unknown.length > 0) {
    return refuse("VALIDATION_ERROR", `Izin tidak dikenal: ${unknown.join(", ")}.`);
  }
  const grant = proposal.grant as PermissionKey[];
  const revoke = proposal.revoke as PermissionKey[];

  // Pagar pertama: sebagian izin tidak boleh melewati jalur ini sama sekali,
  // baik diberikan maupun dicabut.
  const forbidden = findForbiddenProposalPermissions([...grant, ...revoke]);
  if (forbidden.length > 0) {
    return refuse("FORBIDDEN", describeForbiddenProposal(forbidden));
  }

  if (proposal.roleId === OWNER_ROLE_ID) {
    return refuse("FORBIDDEN", "Peran Owner tidak dapat diubah.");
  }

  const target = await db.query.role.findFirst({
    where: eq(role.id, proposal.roleId),
    with: { permissions: { columns: { permissionKey: true } } },
  });
  if (!target) {
    return { success: false, error: { code: "NOT_FOUND", message: "Peran tidak ditemukan." } };
  }

  // Selisih dihitung ulang terhadap keadaan sekarang, bukan terhadap kartu.
  const held = new Set(target.permissions.map((row) => row.permissionKey as PermissionKey));
  const after = new Set(held);
  for (const key of grant) after.add(key);
  for (const key of revoke) after.delete(key);
  const actuallyRemoved = revoke.filter((key) => held.has(key));

  /*
   * Pagar kedua: jalur ini menolak pencabutan yang menyisakan nol pemegang aktif
   * untuk izin kritis. Layar hanya memperingatkan; di sini ditolak, karena
   * seseorang yang menekan satu tombol di dalam percakapan tidak sedang meninjau
   * keadaan perusahaan secara keseluruhan.
   */
  const coverage = new Map<PermissionKey, boolean>();
  for (const key of actuallyRemoved) {
    const holders = await db.query.rolePermission.findMany({
      where: eq(rolePermission.permissionKey, key),
      columns: { roleId: true },
    });
    const otherRoleIds = holders.map((row) => row.roleId).filter((roleId) => roleId !== target.id);
    if (otherRoleIds.length === 0) {
      coverage.set(key, false);
      continue;
    }
    const stillActive = await db.query.user.findMany({
      where: and(inArray(user.roleId, otherRoleIds), eq(user.isActive, true)),
      columns: { id: true },
      limit: 1,
    });
    coverage.set(key, stillActive.length > 0);
  }
  const gaps = describeCriticalGaps(actuallyRemoved, (key) => coverage.get(key) === true);
  if (gaps.length > 0) {
    return refuse(
      "CONFLICT",
      `Ditolak: setelah ini ${gaps[0]!.consequence}. Ubah lewat Pengaturan › Tim, Vendor & Peran bila memang disengaja.`,
    );
  }

  // Idempotensi: kartu yang sama tidak boleh diterapkan dua kali.
  const existing = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
    columns: { documentId: true, userId: true },
  });
  if (existing) {
    return existing.userId === actor.userId
      ? { success: true, data: { roleId: existing.documentId, alreadyConfirmed: true } }
      : refuse("FORBIDDEN", "Usulan ini milik percakapan pengguna lain.");
  }

  const conversation = await db.query.aiConversation.findFirst({
    where: and(
      eq(aiConversation.id, proposal.conversationId),
      eq(aiConversation.userId, actor.userId),
    ),
    columns: { id: true },
  });
  if (!conversation) {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }

  /*
   * Pagar ketiga dan keempat berada di dalam use-case yang sama dengan layar:
   * anti-eskalasi dihitung terhadap AKTOR MANUSIA dari sesi ini — bukan konteks
   * asisten — dan auditnya ditandai `AI_PROPOSED_ROLE_CHANGE`.
   */
  const result = await updateRolePermissionsUseCase(
    actor,
    { roleId: target.id, permissions: [...after] },
    "AI_PROPOSAL",
  );
  if (!result.success) return result;

  await db.insert(aiProposalConfirmation).values({
    toolCallId: proposal.toolCallId,
    conversationId: conversation.id,
    userId: actor.userId,
    proposalType: "ROLE_PERMISSION_CHANGE",
    documentId: target.id,
  });

  revalidatePath("/", "layout");
  return { success: true, data: { roleId: target.id, alreadyConfirmed: false } };
}
