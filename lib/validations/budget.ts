import { z } from "zod";
import { EXPENSE_CATEGORY_CODES } from "@/lib/budget/excel-budget";

// Regex untuk memvalidasi UUID 36 karakter (mendukung dummy UUID buatan untuk testing/seeding)
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const uuidSchema = (message: string) => z.string().regex(uuidRegex, message);

// 1. Skema Validasi Pembuatan Item Anggaran (RAB BoQ)
export const createBudgetItemSchema = z.object({
  projectBudgetId: uuidSchema("ID Rencana Anggaran (Budget) tidak valid."),
  costCategoryId: uuidSchema("ID Kategori Biaya tidak valid."),
  name: z.string().min(3, "Nama item anggaran minimal 3 karakter.").max(255, "Nama item anggaran maksimal 255 karakter."),
  budgetCategory: z.string().min(3, "Kategori anggaran minimal 3 karakter.").max(255, "Kategori anggaran maksimal 255 karakter."),
  quantity: z.number().positive("Kuantitas harus lebih besar dari nol."),
  unit: z.string().min(1, "Satuan wajib diisi.").max(50, "Satuan maksimal 50 karakter."),
  unitPrice: z.number().nonnegative("Harga satuan tidak boleh negatif."),
});

export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;

export const createProjectBudgetFromRatiosSchema = z.object({
  projectId: uuidSchema("ID Proyek tidak valid."),
  contractValue: z.number().nonnegative("Nilai kontrak tidak boleh negatif."),
  approvedRabValue: z.number().nonnegative("Nilai RAB approved tidak boleh negatif.").optional(),
  projectProgressPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateProjectBudgetFromRatiosInput = z.infer<typeof createProjectBudgetFromRatiosSchema>;

export const updateProjectBudgetCategoryAllocationSchema = z.object({
  projectBudgetCategoryId: uuidSchema("ID kategori budget proyek tidak valid."),
  ratioPercentage: z.number().min(0).max(1).optional(),
  allocatedAmount: z.number().nonnegative().optional(),
}).refine((value) => value.ratioPercentage !== undefined || value.allocatedAmount !== undefined, {
  message: "Ratio atau nominal alokasi wajib diisi.",
});

export type UpdateProjectBudgetCategoryAllocationInput = z.infer<typeof updateProjectBudgetCategoryAllocationSchema>;

export const approveCanonicalProjectBudgetSchema = z.object({
  projectBudgetId: uuidSchema("ID budget proyek tidak valid."),
});

export type ApproveCanonicalProjectBudgetInput = z.infer<typeof approveCanonicalProjectBudgetSchema>;

export const canonicalExpenseCategoryCodeSchema = z.enum(EXPENSE_CATEGORY_CODES);

// 2. Skema Validasi Pencatatan Pembayaran Termin Klien
export const recordClientPaymentSchema = z.object({
  clientInvoiceId: uuidSchema("ID Invoice tidak valid."),
  bankAccountId: uuidSchema("ID Rekening Bank tidak valid."),
  amountPaid: z.number().positive("Jumlah nominal pembayaran harus lebih besar dari nol."),
  paymentDate: z.coerce.date(),
  referenceNumber: z.string().min(1, "Nomor referensi pembayaran (bukti transfer) wajib diisi.").max(100, "Nomor referensi maksimal 100 karakter."),
});

export type RecordClientPaymentInput = z.infer<typeof recordClientPaymentSchema>;
