"use server";

import { submitFieldRequest } from "@/app/actions/finance/field-requests";
import { db } from "@/db";
import { aiConversation, aiProposalConfirmation } from "@/db/schema";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@atria/core/types/action-response";
import { aiExpenseProposalSchema } from "@atria/core/validations/ai-proposal";
import { and, eq } from "drizzle-orm";

/**
 * Mengonfirmasi usulan pengeluaran yang disiapkan asisten AI.
 *
 * Ini satu-satunya jalur di mana percakapan AI bisa berujung pada penulisan data,
 * dan hanya berjalan setelah pengguna menekan tombol konfirmasi di kartu usulan.
 *
 * Aksi ini sengaja tidak punya logika finansial sendiri: ia memvalidasi ulang
 * bentuk masukan lalu mendelegasikan ke `submitFieldRequest`, jalur yang sama
 * persis dengan form manual — termasuk pemeriksaan RBAC, lingkup proyek,
 * transaksi database, dan jejak audit di dalamnya.
 *
 * Idempoten terhadap `toolCallId`. Satu kartu usulan hanya bisa menghasilkan satu
 * dokumen, walaupun kartunya dibuka lagi setelah riwayat dimuat ulang, tombolnya
 * ditekan dua kali, atau dua permintaan berlomba.
 *
 * Yang menegakkan janji terakhir itu adalah kunci pesimistis pada baris
 * percakapan, bukan batasan UNIQUE di `ai_proposal_confirmation`. Batasan itu
 * baru diuji sesudah dokumennya terlanjur dibuat, jadi ia hanya mencegah catatan
 * konfirmasi ganda — bukan dokumen ganda. Dua permintaan yang berlomba
 * sama-sama lolos pemeriksaan "sudah pernah dikonfirmasi?" dan sama-sama
 * membuat pengajuan. Karena itu seluruh urutan periksa lalu tulis dijalankan
 * di bawah `SELECT ... FOR UPDATE` atas percakapannya, idiom yang sama dengan
 * penguncian `bank_account` pada mutasi saldo.
 */
export async function confirmAiExpenseProposal(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string; alreadyConfirmed: boolean }>> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." },
    };
  }

  const validation = aiExpenseProposalSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rincian usulan pengeluaran tidak valid." },
    };
  }

  const proposal = validation.data;

  // Seluruh urutan berjalan di bawah kunci baris percakapan, sehingga dua
  // penekanan tombol yang berlomba diserialkan: yang kedua baru membaca setelah
  // yang pertama menuliskan catatan konfirmasinya.
  const outcome = await db.transaction(async (tx) => {
    // Percakapan harus milik pengguna ini; tanpa pemeriksaan ini, sebuah id
    // percakapan asing bisa dipakai untuk menitipkan catatan konfirmasi.
    const [conversation] = await tx
      .select({ id: aiConversation.id })
      .from(aiConversation)
      .where(
        and(
          eq(aiConversation.id, proposal.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      )
      .for("update");
    if (!conversation) return { kind: "not_found" } as const;

    const existing = await tx.query.aiProposalConfirmation.findFirst({
      where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
      columns: { documentId: true, userId: true },
    });

    if (existing) {
      return existing.userId === session.user.id
        ? ({ kind: "already", documentId: existing.documentId } as const)
        : ({ kind: "foreign" } as const);
    }

    const result = await submitFieldRequest({
      projectId: proposal.projectId,
      projectBudgetCategoryId: proposal.projectBudgetCategoryId,
      description: proposal.description,
      quantity: proposal.quantity,
      unitPrice: proposal.unitPrice,
      amount: proposal.amount,
      stockHandling: "EXPENSE_ONLY",
    });

    if (!result.success) return { kind: "submit_failed", response: result } as const;

    await tx.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "FIELD_EXPENSE",
      documentId: result.data.id,
    });

    return { kind: "created", documentId: result.data.id } as const;
  });

  if (outcome.kind === "not_found") {
    return { success: false, error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." } };
  }
  if (outcome.kind === "foreign") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
    };
  }
  if (outcome.kind === "submit_failed") return outcome.response;
  if (outcome.kind === "already") {
    return { success: true, data: { expenseId: outcome.documentId, alreadyConfirmed: true } };
  }

  return { success: true, data: { expenseId: outcome.documentId, alreadyConfirmed: false } };
}
