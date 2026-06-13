import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const submitVendorBillSchema = z.object({
  vendorId: z.string().regex(uuidRegex, "ID Vendor tidak valid."),
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  projectBudgetItemId: z.string().regex(uuidRegex, "ID Kategori Anggaran tidak valid."),
  billNumber: z.string().min(1, "Nomor tagihan vendor wajib diisi.").max(100),
  amount: z.number().positive("Nominal tagihan harus lebih besar dari 0."),
  dueDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
});

export type SubmitVendorBillInput = z.infer<typeof submitVendorBillSchema>;

export const schedulePaymentSchema = z.object({
  vendorBillId: z.string().regex(uuidRegex, "ID tagihan tidak valid."),
  bankAccountId: z.string().regex(uuidRegex, "ID bank tidak valid."),
  paymentDate: z.coerce.date(),
  amountPaid: z.number().positive("Nominal pembayaran harus di atas 0."),
});

export type SchedulePaymentInput = z.infer<typeof schedulePaymentSchema>;

export const payVendorBillSchema = z.object({
  vendorPaymentId: z.string().regex(uuidRegex, "ID Pembayaran Vendor tidak valid."),
  referenceNumber: z.string().min(1, "Nomor referensi mutasi bank wajib diisi.").max(100),
});

export type PayVendorBillInput = z.infer<typeof payVendorBillSchema>;

export const submitFieldRequestSchema = z.object({
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  projectBudgetItemId: z.string().regex(uuidRegex, "ID Kategori Anggaran tidak valid."),
  amount: z.number().positive("Nominal pengeluaran harus lebih besar dari 0."),
  description: z.string().min(5, "Deskripsi pengeluaran minimal 5 karakter.").max(500),
  receiptImageUrl: z.string().url("Format URL nota tidak valid.").or(z.string().length(0)).optional().nullable(),
});

export type SubmitFieldRequestInput = z.infer<typeof submitFieldRequestSchema>;

export const submitFieldRequestsSchema = z.object({
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  receiptImageUrl: z.string().url("Format URL nota tidak valid.").or(z.string().length(0)).optional().nullable(),
  items: z.array(
    z.object({
      projectBudgetItemId: z.string().regex(uuidRegex, "ID Kategori Anggaran tidak valid."),
      amount: z.number().positive("Nominal pengeluaran harus lebih besar dari 0."),
      description: z.string().min(5, "Deskripsi pengeluaran minimal 5 karakter.").max(500),
    })
  ).min(1, "Minimal harus ada 1 item pengeluaran."),
});

export type SubmitFieldRequestsInput = z.infer<typeof submitFieldRequestsSchema>;

export const approveFieldRequestSchema = z.object({
  projectCostId: z.string().regex(uuidRegex, "ID Biaya Proyek tidak valid."),
  status: z.enum(["APPROVED", "REJECTED"], { error: "Status persetujuan harus APPROVED atau REJECTED." }),
  notes: z.string().max(500).optional().nullable(),
});

export type ApproveFieldRequestInput = z.infer<typeof approveFieldRequestSchema>;
