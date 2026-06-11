import { z } from "zod";

// Regex untuk memvalidasi UUID 36 karakter (mendukung dummy UUID buatan untuk testing/seeding)
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const uuidSchema = (message: string) => z.string().regex(uuidRegex, message);

// 1. Skema Validasi Pembuatan Item Anggaran (RAB BoQ)
export const createBudgetItemSchema = z.object({
  projectBudgetId: uuidSchema("ID Rencana Anggaran (Budget) tidak valid."),
  costCategoryId: uuidSchema("ID Kategori Biaya tidak valid."),
  name: z.string().min(3, "Nama item anggaran minimal 3 karakter.").max(255, "Nama item anggaran maksimal 255 karakter."),
  allocatedAmount: z.number().positive("Nominal alokasi anggaran harus lebih besar dari nol."),
});

export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;

// 2. Skema Validasi Pencatatan Pembayaran Termin Klien
export const recordClientPaymentSchema = z.object({
  clientInvoiceId: uuidSchema("ID Invoice tidak valid."),
  bankAccountId: uuidSchema("ID Rekening Bank tidak valid."),
  amountPaid: z.number().positive("Jumlah nominal pembayaran harus lebih besar dari nol."),
  paymentDate: z.coerce.date(),
  referenceNumber: z.string().min(1, "Nomor referensi pembayaran (bukti transfer) wajib diisi.").max(100, "Nomor referensi maksimal 100 karakter."),
});

export type RecordClientPaymentInput = z.infer<typeof recordClientPaymentSchema>;
