import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Bentuk usulan pengeluaran yang boleh dikonfirmasi dari kartu chat AI.
 *
 * Sengaja hanya memuat kolom yang benar-benar dibutuhkan `submitFieldRequest`.
 * Bidang seperti penanganan stok, material, atau item RAP tidak diterima dari
 * jalur ini supaya percakapan AI tidak bisa memicu efek samping stok.
 *
 * `toolCallId` adalah identitas kartu usulan dari AI SDK. Nilainya ikut tersimpan
 * di `ai_message.parts`, sehingga kartu yang sama tetap dikenali setelah riwayat
 * dimuat ulang. Kolom itu menjadi kunci idempotensi di `ai_proposal_confirmation`.
 */
export const aiExpenseProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  projectBudgetCategoryId: z.string().regex(uuidRegex, "ID kategori budget proyek tidak valid."),
  description: z
    .string()
    .trim()
    .min(5, "Deskripsi pengeluaran minimal 5 karakter.")
    .max(500, "Deskripsi pengeluaran maksimal 500 karakter."),
  quantity: z.number().positive("Kuantitas harus lebih besar dari 0."),
  unitPrice: z.number().nonnegative("Harga satuan tidak boleh negatif."),
  amount: z.number().positive("Nominal pengeluaran harus lebih besar dari 0."),
});

export type AiExpenseProposalInput = z.infer<typeof aiExpenseProposalSchema>;
