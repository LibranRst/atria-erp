import { z } from "zod";
import { passwordPolicySchema } from "./administration";

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

export const aiExpenseReviewProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  expenseId: z.string().regex(uuidRegex, "ID Pengeluaran tidak valid."),
  action: z.enum(["APPROVE", "REJECT", "VERIFY"]),
  notes: z.string().max(500).optional(),
});

export type AiExpenseReviewProposalInput = z.infer<typeof aiExpenseReviewProposalSchema>;

export const aiDisburseExpenseProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  expenseId: z.string().regex(uuidRegex, "ID Pengeluaran tidak valid."),
  bankAccountId: z.string().regex(uuidRegex, "ID Akun Bank tidak valid."),
  referenceNumber: z.string().min(1, "Nomor referensi pembayaran wajib diisi.").max(100),
});

export type AiDisburseExpenseProposalInput = z.infer<typeof aiDisburseExpenseProposalSchema>;

export const aiCreateProjectProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  name: z.string().min(1, "Nama proyek wajib diisi").max(200),
  clientId: z.string().regex(uuidRegex, "ID Klien tidak valid.").optional().or(z.literal("")),
  newClientName: z.string().max(200).optional().or(z.literal("")),
  newClientPhone: z.string().max(50).optional().or(z.literal("")),
  projectManagerId: z.string().regex(uuidRegex, "ID Project Manager tidak valid."),
  totalContractValue: z.number().nonnegative().default(0),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  location: z.string().max(300).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type AiCreateProjectProposalInput = z.infer<typeof aiCreateProjectProposalSchema>;

export const aiSetupBudgetProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  contractValue: z.number().nonnegative(),
  budgetCapRatio: z.number().positive().max(1),
  categories: z
    .array(
      z.object({
        expenseCategoryId: z.string().regex(uuidRegex, "ID Kategori Biaya tidak valid."),
        ratioPercentage: z.number().nonnegative().max(1),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1, "Minimal satu kategori budget harus dialokasikan."),
  notes: z.string().max(1000).optional(),
});

export type AiSetupBudgetProposalInput = z.infer<typeof aiSetupBudgetProposalSchema>;

export const aiPayVendorBillProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  vendorPaymentId: z.string().regex(uuidRegex, "ID Jadwal Pembayaran tidak valid."),
  bankAccountId: z.string().regex(uuidRegex, "ID Akun Bank tidak valid."),
  referenceNumber: z.string().min(1, "Nomor referensi pembayaran wajib diisi.").max(100),
  amountPaid: z.number().positive("Nominal pembayaran harus lebih besar dari 0."),
});

export type AiPayVendorBillProposalInput = z.infer<typeof aiPayVendorBillProposalSchema>;

export const aiRecordClientPaymentProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  clientInvoiceId: z.string().regex(uuidRegex, "ID Invoice Klien tidak valid."),
  bankAccountId: z.string().regex(uuidRegex, "ID Akun Bank tidak valid."),
  amountPaid: z.number().positive("Nominal pembayaran harus lebih besar dari 0."),
  paymentDate: z.string().min(1, "Tanggal pembayaran wajib diisi."),
  referenceNumber: z.string().min(1, "Nomor referensi mutasi bank wajib diisi.").max(100),
});

export type AiRecordClientPaymentProposalInput = z.infer<typeof aiRecordClientPaymentProposalSchema>;

export const aiGoodsReceiptProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  inventoryLocationId: z.string().regex(uuidRegex, "ID Lokasi Gudang tidak valid."),
  receiptNumber: z.string().min(1, "Nomor Goods Receipt wajib diisi.").max(100),
  receivedAt: z.string().min(1, "Tanggal penerimaan wajib diisi."),
  vendorBillId: z.string().regex(uuidRegex, "ID Tagihan Vendor tidak valid.").optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        materialId: z.string().regex(uuidRegex, "ID Material tidak valid."),
        quantity: z.number().positive("Kuantitas barang harus lebih besar dari 0."),
        unitCost: z.number().nonnegative("Harga per unit tidak boleh negatif."),
        projectRapItemId: z.string().regex(uuidRegex, "ID Item RAP tidak valid.").optional().or(z.literal("")),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1, "Minimal satu item barang harus dicatat."),
});

export type AiGoodsReceiptProposalInput = z.infer<typeof aiGoodsReceiptProposalSchema>;

/**
 * Usulan perubahan izin peran dari kartu asisten.
 *
 * Hanya membawa apa yang dibutuhkan untuk **mengulang** keputusannya di server:
 * peran mana, dan kunci mana yang ditambah/dicabut. Tidak ada label, tidak ada
 * ringkasan dampak, tidak ada daftar pengguna — semuanya diturunkan ulang dari
 * database saat konfirmasi, karena isi kartu datang dari klien dan tidak boleh
 * menjadi dasar penulisan.
 */
export const aiRoleChangeProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  roleId: z.string().regex(uuidRegex, "ID peran tidak valid."),
  grant: z.array(z.string().min(1)).max(50),
  revoke: z.array(z.string().min(1)).max(50),
});

export type AiRoleChangeProposalInput = z.infer<typeof aiRoleChangeProposalSchema>;

/**
 * Usulan pembuatan peran baru dari kartu asisten.
 *
 * Berbeda dari perubahan izin, pembuatan peran tidak mengubah kemampuan siapa
 * pun saat diterapkan: peran baru selalu nol pemegang, dan penugasan orang ke
 * dalamnya menuntut `manage:users` yang tertutup dari jalur asisten. Yang
 * dijaga di sini bukan dampak seketikanya, melainkan isi peran itu ketika
 * seseorang ditugaskan ke dalamnya berbulan-bulan kemudian.
 */
export const aiCreateRoleProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  name: z
    .string()
    .trim()
    .min(3, "Nama peran minimal 3 karakter.")
    .max(50, "Nama peran maksimal 50 karakter."),
  description: z.string().trim().max(255).optional(),
  dataScope: z.enum(["GLOBAL", "ASSIGNED", "NONE"]),
  permissions: z.array(z.string().min(1)).max(200),
});

export type AiCreateRoleProposalInput = z.infer<typeof aiCreateRoleProposalSchema>;

/**
 * Usulan pembuatan akun pengguna baru dari kartu asisten.
 *
 * Menerima identitas pengguna, penugasan peran, dan kata sandi sementara
 * yang dijamin memenuhi `passwordPolicySchema`.
 */
export const aiCreateUserProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  name: z.string().trim().min(2, "Nama pengguna minimal 2 karakter.").max(255),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  roleId: z.string().regex(uuidRegex, "ID peran tidak valid."),
  temporaryPassword: passwordPolicySchema,
});

export type AiCreateUserProposalInput = z.infer<typeof aiCreateUserProposalSchema>;

/**
 * Item tunggal di dalam usulan batch pembuatan akun pengguna.
 */
export const aiCreateUserBatchItemSchema = z.object({
  name: z.string().trim().min(2, "Nama pengguna minimal 2 karakter.").max(255),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  roleId: z.string().regex(uuidRegex, "ID peran tidak valid."),
  temporaryPassword: passwordPolicySchema,
});

export type AiCreateUserBatchItemInput = z.infer<typeof aiCreateUserBatchItemSchema>;

/**
 * Usulan pembuatan akun pengguna sekaligus (batch) dari kartu asisten.
 */
export const aiCreateUserBatchProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  users: z
    .array(aiCreateUserBatchItemSchema)
    .min(1, "Minimal harus ada 1 pengguna.")
    .max(20, "Maksimal 20 pengguna per satu kali batch."),
});

export type AiCreateUserBatchProposalInput = z.infer<typeof aiCreateUserBatchProposalSchema>;

/**
 * Pasangan rekonsiliasi yang diusulkan antara transaksi kas internal dan mutasi bank.
 */
export const aiBankReconciliationMatchSchema = z.object({
  cashTransactionId: z.string().regex(uuidRegex, "ID transaksi kas tidak valid."),
  statementRow: z.object({
    transactionDate: z.coerce.date(),
    description: z.string().min(1, "Deskripsi mutasi tidak boleh kosong.").max(500),
    amount: z.number().positive("Nominal mutasi harus lebih besar dari 0."),
    type: z.enum(["INFLOW", "OUTFLOW"]),
  }),
});

export type AiBankReconciliationMatchInput = z.infer<typeof aiBankReconciliationMatchSchema>;

/**
 * Mutasi rekening koran yang belum tercatat pada transaksi kas internal.
 */
export const aiBankReconciliationUnmatchedMutationSchema = z.object({
  transactionDate: z.coerce.date(),
  description: z.string().min(1, "Deskripsi mutasi tidak boleh kosong.").max(500),
  amount: z.number().positive("Nominal mutasi harus lebih besar dari 0."),
  type: z.enum(["INFLOW", "OUTFLOW"]),
});

export type AiBankReconciliationUnmatchedMutationInput = z.infer<
  typeof aiBankReconciliationUnmatchedMutationSchema
>;

/**
 * Usulan rekonsiliasi bank yang dikonfirmasi dari kartu interaktif di AI Chat.
 */
export const aiBankReconciliationProposalSchema = z.object({
  toolCallId: z
    .string()
    .trim()
    .min(1, "Identitas usulan tidak valid.")
    .max(128, "Identitas usulan tidak valid."),
  conversationId: z.string().regex(uuidRegex, "ID percakapan tidak valid."),
  bankAccountId: z.string().regex(uuidRegex, "ID Akun Bank tidak valid."),
  matches: z.array(aiBankReconciliationMatchSchema),
  unmatchedMutations: z.array(aiBankReconciliationUnmatchedMutationSchema).optional().default([]),
  importUnmatched: z.boolean().optional().default(true),
});

export type AiBankReconciliationProposalInput = z.infer<typeof aiBankReconciliationProposalSchema>;

