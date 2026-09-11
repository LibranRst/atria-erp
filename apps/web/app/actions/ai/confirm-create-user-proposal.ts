"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { account, aiConversation, aiProposalConfirmation, auditLog, role, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { actorCan } from "@/lib/auth/permissions";
import { recordReadinessMilestonesTx } from "@/lib/onboarding/readiness-events";
import { resolveActor } from "@/server/actor";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiCreateUserProposalSchema } from "@atria/core/validations/ai-proposal";

type ConfirmResult = { readonly userId: string; readonly alreadyConfirmed: boolean };

function refuse(code: "FORBIDDEN" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND", message: string) {
  return { success: false as const, error: { code, message } };
}

/**
 * Menerapkan usulan pembuatan akun pengguna baru dari kartu asisten AI.
 *
 * Seluruh data diverifikasi ulang di server terhadap database saat ini:
 * - Aktor manusia harus memiliki izin `manage:users`.
 * - Peran `OWNER` ditolak melalui jalur asisten demi keamanan akun superuser.
 * - Email diperiksa unik agar tidak menabrak batasan database.
 * - Kata sandi sementara di-hash dengan Better Auth dan akun diatur `mustChangePassword: true`.
 * - Idempotensi dijamin oleh `toolCallId` di tabel `ai_proposal_confirmation`.
 */
export async function confirmAiCreateUserProposal(
  input: unknown,
): Promise<ActionResponse<ConfirmResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiCreateUserProposalSchema.safeParse(input);
  if (!validation.success) {
    return refuse(
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Rincian pembuatan akun tidak valid.",
    );
  }
  const proposal = validation.data;

  // Pagar 1: Hak akses aktor
  if (!actorCan(actor, "manage:users")) {
    return refuse("FORBIDDEN", "Anda tidak memiliki izin untuk mengelola atau membuat pengguna.");
  }

  // Pagar 2: Larangan membuat akun Owner dari chat
  if (proposal.roleId === OWNER_ROLE_ID) {
    return refuse(
      "FORBIDDEN",
      "Akun dengan peran Owner tidak dapat dibuat lewat asisten AI demi keamanan akun superuser. Buat akun Owner melalui Pengaturan › Tim, Vendor & Peran.",
    );
  }

  // Pagar 3: Peran harus benar-benar ada di database
  const assignedRole = await db.query.role.findFirst({
    where: eq(role.id, proposal.roleId),
    columns: { id: true, name: true },
  });
  if (!assignedRole) {
    return refuse("NOT_FOUND", "Peran yang dipilih tidak ditemukan di sistem.");
  }

  if (assignedRole.id === OWNER_ROLE_ID) {
    return refuse(
      "FORBIDDEN",
      "Akun dengan peran Owner tidak dapat dibuat lewat asisten AI demi keamanan akun superuser.",
    );
  }

  // Pagar 4: Email harus belum terdaftar
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, proposal.email),
    columns: { id: true },
  });
  if (existingUser) {
    return refuse("CONFLICT", "Email sudah digunakan oleh pengguna lain.");
  }

  // Pagar 5: Idempotensi kartu
  const existingConfirmation = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
    columns: { documentId: true, userId: true },
  });
  if (existingConfirmation) {
    return existingConfirmation.userId === actor.userId
      ? { success: true, data: { userId: existingConfirmation.documentId, alreadyConfirmed: true } }
      : refuse("FORBIDDEN", "Usulan ini milik percakapan pengguna lain.");
  }

  // Pagar 6: Kepemilikan percakapan
  const conversation = await db.query.aiConversation.findFirst({
    where: eq(aiConversation.id, proposal.conversationId),
    columns: { id: true, userId: true },
  });
  if (!conversation || conversation.userId !== actor.userId) {
    return refuse("NOT_FOUND", "Percakapan tidak ditemukan.");
  }

  try {
    const passwordHash = await auth.$context.then((context) =>
      context.password.hash(proposal.temporaryPassword),
    );

    const createdUser = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(user)
        .values({
          name: proposal.name,
          email: proposal.email,
          emailVerified: true,
          roleId: proposal.roleId,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
        })
        .returning();

      await tx.insert(account).values({
        id: `credential-${row.id}`,
        accountId: row.id,
        providerId: "credential",
        userId: row.id,
        password: passwordHash,
      });

      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: "CREATE_STAFF_USER",
        targetTable: "user",
        targetId: row.id,
        newState: JSON.stringify({
          name: row.name,
          email: row.email,
          roleId: row.roleId,
          mustChangePassword: true,
          origin: "AI_PROPOSAL",
        }),
      });

      await recordReadinessMilestonesTx({
        tx,
        actorUserId: actor.userId,
        changedItem: "core_team",
      });

      await tx.insert(aiProposalConfirmation).values({
        toolCallId: proposal.toolCallId,
        conversationId: conversation.id,
        userId: actor.userId,
        proposalType: "CREATE_USER",
        documentId: row.id,
      });

      return row;
    });

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true, data: { userId: createdUser.id, alreadyConfirmed: false } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat pengguna.";
    return refuse(
      message.includes("unique") ? "CONFLICT" : "VALIDATION_ERROR",
      message.includes("unique") ? "Email sudah digunakan." : message,
    );
  }
}
