"use server";

import { submitFieldRequest } from "@/app/actions/finance/field-requests";
import { db } from "@/db";
import { aiProposalConfirmation } from "@/db/schema";
import { findOwnedConversation } from "@/lib/ai/conversation-store";
import { getServerSession } from "@/lib/server/session";
import type { ActionResponse } from "@/lib/types/action-response";
import { aiExpenseProposalSchema } from "@/lib/validations/ai-proposal";
import { eq } from "drizzle-orm";

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
 * ditekan dua kali, atau dua permintaan berlomba. Penjaga terakhirnya adalah
 * batasan UNIQUE di database, bukan pemeriksaan di aplikasi.
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

  // Percakapan harus milik pengguna ini; tanpa pemeriksaan ini, sebuah id
  // percakapan asing bisa dipakai untuk menitipkan catatan konfirmasi.
  const conversation = await findOwnedConversation(proposal.conversationId, session.user.id);
  if (!conversation) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Percakapan tidak ditemukan." },
    };
  }

  const existing = await db.query.aiProposalConfirmation.findFirst({
    where: eq(aiProposalConfirmation.toolCallId, proposal.toolCallId),
    columns: { documentId: true, userId: true },
  });

  if (existing) {
    if (existing.userId !== session.user.id) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Usulan ini bukan milik Anda." },
      };
    }
    return { success: true, data: { expenseId: existing.documentId, alreadyConfirmed: true } };
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

  if (!result.success) {
    return result;
  }

  try {
    await db.insert(aiProposalConfirmation).values({
      toolCallId: proposal.toolCallId,
      conversationId: conversation.id,
      userId: session.user.id,
      proposalType: "FIELD_EXPENSE",
      documentId: result.data.id,
    });
  } catch (error) {
    // Dokumennya sudah tercipta. Kegagalan mencatat jejak konfirmasi tidak boleh
    // ditampilkan sebagai kegagalan pengajuan — itu akan mendorong pengguna
    // menekan tombol lagi dan membuat dokumen kedua.
    console.error("Gagal mencatat konfirmasi usulan AI:", error);
  }

  return { success: true, data: { expenseId: result.data.id, alreadyConfirmed: false } };
}
