"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { account, aiConversation, aiProposalConfirmation, auditLog, role, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { actorCan } from "@/lib/auth/permissions";
import { recordReadinessMilestonesTx } from "@/lib/onboarding/readiness-events";
import { resolveActor } from "@/server/actor";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiCreateUserBatchProposalSchema } from "@atria/core/validations/ai-proposal";

type ConfirmBatchResult = {
  readonly count: number;
  readonly userIds: readonly string[];
  readonly alreadyConfirmed: boolean;
};

function refuse(code: "FORBIDDEN" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND", message: string) {
  return { success: false as const, error: { code, message } };
}

/**
 * Menerapkan usulan pembuatan banyak akun staf sekaligus dari kartu asisten AI.
 *
 * Dieksekusi secara atomik dalam satu transaksi database (All-or-Nothing):
 * - Aktor manusia harus memiliki izin `manage:users`.
 * - Peran `OWNER` dilarang keras di jalur pembuatan chat.
 * - Seluruh email diverifikasi unik (baik di dalam batch maupun terhadap database).
 * - Seluruh kata sandi di-hash via Better Auth dan pengguna diatur `mustChangePassword: true`.
 * - Idempotensi dijamin oleh `toolCallId` di tabel `ai_proposal_confirmation`.
 */
export async function confirmAiCreateUserBatchProposal(
  input: unknown,
): Promise<ActionResponse<ConfirmBatchResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiCreateUserBatchProposalSchema.safeParse(input);
  if (!validation.success) {
    return refuse(
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Rincian batch pembuatan pengguna tidak valid.",
    );
  }
  const proposal = validation.data;

  // Pagar 1: Hak akses aktor
  if (!actorCan(actor, "manage:users")) {
    return refuse("FORBIDDEN", "Anda tidak memiliki izin untuk mengelola atau membuat pengguna.");
  }

  // Pagar 2: Deteksi duplikat internal dalam batch
  const emailSet = new Set<string>();
  for (const u of proposal.users) {
    const normalizedEmail = u.email.trim().toLowerCase();
    if (emailSet.has(normalizedEmail)) {
      return refuse("CONFLICT", `Email "${normalizedEmail}" duplikat di dalam batch.`);
    }
    emailSet.add(normalizedEmail);
  }

  // Pagar 3: Larangan membuat akun Owner dari chat
  for (const u of proposal.users) {
    if (u.roleId === OWNER_ROLE_ID) {
      return refuse(
        "FORBIDDEN",
        `Akun "${u.name}" menggunakan peran Owner. Peran Owner tidak dapat dibuat lewat asisten AI demi keamanan akun superuser.`,
      );
    }
  }

  // Pagar 4: Peran harus terdaftar di database dan bukan Owner
  const distinctRoleIds = [...new Set(proposal.users.map((u) => u.roleId))];
  const matchedRoles = await db.query.role.findMany({
    where: inArray(role.id, distinctRoleIds),
    columns: { id: true, name: true },
  });
  const roleMap = new Map(matchedRoles.map((r) => [r.id, r]));

  for (const u of proposal.users) {
    const matchedRole = roleMap.get(u.roleId);
    if (!matchedRole) {
      return refuse("NOT_FOUND", `Peran untuk pengguna "${u.name}" tidak ditemukan di sistem.`);
    }
    if (matchedRole.id === OWNER_ROLE_ID) {
      return refuse(
        "FORBIDDEN",
        `Peran "${matchedRole.name}" adalah peran Owner yang dilarang dibuat lewat asisten AI.`,
      );
    }
  }

  // Pagar 5: Semua email harus belum terdaftar di database
  const emailsToCheck = [...emailSet];
  const existingUsers = await db.query.user.findMany({
    where: inArray(user.email, emailsToCheck),
    columns: { id: true, email: true, name: true },
  });
  if (existingUsers.length > 0) {
    const conflict = existingUsers[0]!;
    return refuse(
      "CONFLICT",
      `Email "${conflict.email}" sudah digunakan oleh akun "${conflict.name}". Seluruh batch dibatalkan.`,
    );
  }

  // Pagar 6: Idempotensi kartu usulan
  const existingConfirmation = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
    columns: { documentId: true, userId: true },
  });
  if (existingConfirmation) {
    return existingConfirmation.userId === actor.userId
      ? {
          success: true,
          data: { count: proposal.users.length, userIds: [existingConfirmation.documentId], alreadyConfirmed: true },
        }
      : refuse("FORBIDDEN", "Usulan batch ini milik percakapan pengguna lain.");
  }

  // Pagar 7: Kepemilikan percakapan
  const conversation = await db.query.aiConversation.findFirst({
    where: eq(aiConversation.id, proposal.conversationId),
    columns: { id: true, userId: true },
  });
  if (!conversation || conversation.userId !== actor.userId) {
    return refuse("NOT_FOUND", "Percakapan tidak ditemukan.");
  }

  try {
    // Hash kata sandi untuk seluruh user secara paralel sebelum masuk transaksi DB
    const hashedPasswords = await Promise.all(
      proposal.users.map((u) =>
        auth.$context.then((context) => context.password.hash(u.temporaryPassword)),
      ),
    );

    const createdUserIds = await db.transaction(async (tx) => {
      const ids: string[] = [];

      for (let i = 0; i < proposal.users.length; i++) {
        const u = proposal.users[i]!;
        const passwordHash = hashedPasswords[i]!;

        const [row] = await tx
          .insert(user)
          .values({
            name: u.name,
            email: u.email,
            emailVerified: true,
            roleId: u.roleId,
            mustChangePassword: true,
            temporaryPasswordIssuedAt: new Date(),
          })
          .returning();

        ids.push(row.id);

        await tx.insert(account).values({
          id: `credential-${row.id}`,
          accountId: row.id,
          providerId: "credential",
          userId: row.id,
          password: passwordHash,
        });

        await tx.insert(auditLog).values({
          userId: actor.userId,
          action: "CREATE_STAFF_USER_BATCH",
          targetTable: "user",
          targetId: row.id,
          newState: JSON.stringify({
            name: row.name,
            email: row.email,
            roleId: row.roleId,
            batchToolCallId: proposal.toolCallId,
            origin: "AI_PROPOSAL",
          }),
        });
      }

      await recordReadinessMilestonesTx({
        tx,
        actorUserId: actor.userId,
        changedItem: "core_team",
      });

      await tx.insert(aiProposalConfirmation).values({
        toolCallId: proposal.toolCallId,
        conversationId: conversation.id,
        userId: actor.userId,
        proposalType: "CREATE_USER_BATCH",
        documentId: ids[0] ?? proposal.toolCallId,
      });

      return ids;
    });

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return {
      success: true,
      data: { count: createdUserIds.length, userIds: createdUserIds, alreadyConfirmed: false },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat batch pengguna.";
    return refuse(
      message.includes("unique") ? "CONFLICT" : "VALIDATION_ERROR",
      message.includes("unique") ? "Ada email yang sudah terdaftar." : message,
    );
  }
}
