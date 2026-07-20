import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const stockHandlingSchema = z.enum(["EXPENSE_ONLY", "STOCK_IN", "DIRECT_USE", "RESERVE_FOR_PROJECT"]);
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berupa hex color.");

const bankAccountThemeSchema = z.object({
  cardColorFrom: hexColorSchema.default("#0F2B5C"),
  cardColorTo: hexColorSchema.default("#1E40AF"),
  cardTextColor: z.enum(["light", "dark"]).default("light"),
});

export const createBankAccountSchema = bankAccountThemeSchema.extend({
  name: z.string().min(2, "Nama rekening minimal 2 karakter.").max(100),
  accountNumber: z.string().min(3, "Nomor rekening wajib diisi.").max(50),
  bankName: z.string().min(2, "Nama bank wajib diisi.").max(100),
  holderName: z.string().min(2, "Nama pemegang rekening wajib diisi.").max(255),
  openingBalance: z.number().nonnegative("Saldo awal tidak boleh negatif.").default(0),
  openingReference: z.string().max(100).optional().nullable(),
  openingNote: z.string().max(500).optional().nullable(),
});

export type CreateBankAccountInput = z.input<typeof createBankAccountSchema>;

export const updateBankAccountSchema = bankAccountThemeSchema.extend({
  bankAccountId: z.string().regex(uuidRegex, "ID rekening bank tidak valid."),
  name: z.string().min(2, "Nama rekening minimal 2 karakter.").max(100),
  accountNumber: z.string().min(3, "Nomor rekening wajib diisi.").max(50),
  bankName: z.string().min(2, "Nama bank wajib diisi.").max(100),
  holderName: z.string().min(2, "Nama pemegang rekening wajib diisi.").max(255),
  isActive: z.boolean(),
});

export type UpdateBankAccountInput = z.input<typeof updateBankAccountSchema>;

export const postManualCashMovementSchema = z.object({
  bankAccountId: z.string().regex(uuidRegex, "ID rekening bank tidak valid."),
  type: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().positive("Nominal mutasi harus lebih besar dari 0."),
  category: z.enum(["owner_capital", "bank_fee", "correction", "cash_adjustment", "other"]),
  description: z.string().min(5, "Deskripsi mutasi minimal 5 karakter.").max(500),
  transactionDate: z.coerce.date(),
  referenceNumber: z.string().max(100).optional().nullable(),
});

export type PostManualCashMovementInput = z.input<typeof postManualCashMovementSchema>;

export const transferBetweenBankAccountsSchema = z.object({
  fromBankAccountId: z.string().regex(uuidRegex, "ID rekening sumber tidak valid."),
  toBankAccountId: z.string().regex(uuidRegex, "ID rekening tujuan tidak valid."),
  amount: z.number().positive("Nominal transfer harus lebih besar dari 0."),
  description: z.string().min(5, "Deskripsi transfer minimal 5 karakter.").max(500),
  transactionDate: z.coerce.date(),
  referenceNumber: z.string().max(100).optional().nullable(),
}).refine((value) => value.fromBankAccountId !== value.toBankAccountId, {
  message: "Rekening sumber dan tujuan harus berbeda.",
  path: ["toBankAccountId"],
});

export type TransferBetweenBankAccountsInput = z.input<typeof transferBetweenBankAccountsSchema>;

export const submitVendorBillSchema = z.object({
  vendorId: z.string().regex(uuidRegex, "ID Vendor tidak valid."),
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  projectBudgetCategoryId: z.string().regex(uuidRegex, "ID kategori budget proyek tidak valid."),
  projectBudgetItemId: z.string().regex(uuidRegex, "ID item anggaran tidak valid.").optional().nullable(),
  projectCategoryPlanItemId: z.string().regex(uuidRegex, "ID detail plan kategori tidak valid.").optional().nullable(),
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
  bankAccountId: z.string().regex(uuidRegex, "ID bank tidak valid.").optional(),
});

export type PayVendorBillInput = z.infer<typeof payVendorBillSchema>;

export const submitFieldRequestSchema = z.object({
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  projectBudgetCategoryId: z.string().regex(uuidRegex, "ID kategori budget proyek tidak valid."),
  projectBudgetItemId: z.string().regex(uuidRegex, "ID item anggaran tidak valid.").optional().nullable(),
  materialId: z.string().regex(uuidRegex, "ID material tidak valid.").optional().nullable(),
  projectRapItemId: z.string().regex(uuidRegex, "ID RAP item tidak valid.").optional().nullable(),
  projectCategoryPlanItemId: z.string().regex(uuidRegex, "ID detail plan kategori tidak valid.").optional().nullable(),
  stockMovementId: z.string().regex(uuidRegex, "ID pergerakan stock tidak valid.").optional().nullable(),
  inventoryLocationId: z.string().regex(uuidRegex, "ID lokasi inventory tidak valid.").optional().nullable(),
  stockHandling: stockHandlingSchema.default("EXPENSE_ONLY"),
  quantity: z.number().positive("Kuantitas harus lebih besar dari 0."),
  unitPrice: z.number().nonnegative("Harga satuan tidak boleh negatif."),
  amount: z.number().positive("Nominal pengeluaran harus lebih besar dari 0."),
  description: z.string().min(5, "Deskripsi pengeluaran minimal 5 karakter.").max(500),
  receiptImageUrl: z.string().url("Format URL nota tidak valid.").or(z.string().length(0)).optional().nullable(),
});

export type SubmitFieldRequestInput = z.input<typeof submitFieldRequestSchema>;

export const submitFieldRequestsSchema = z.object({
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  receiptImageUrl: z.string().url("Format URL nota tidak valid.").or(z.string().length(0)).optional().nullable(),
  items: z.array(
    z.object({
      projectBudgetCategoryId: z.string().regex(uuidRegex, "ID kategori budget proyek tidak valid."),
      projectBudgetItemId: z.string().regex(uuidRegex, "ID item anggaran tidak valid.").optional().nullable(),
      materialId: z.string().regex(uuidRegex, "ID material tidak valid.").optional().nullable(),
      projectRapItemId: z.string().regex(uuidRegex, "ID RAP item tidak valid.").optional().nullable(),
      projectCategoryPlanItemId: z.string().regex(uuidRegex, "ID detail plan kategori tidak valid.").optional().nullable(),
      stockMovementId: z.string().regex(uuidRegex, "ID pergerakan stock tidak valid.").optional().nullable(),
      inventoryLocationId: z.string().regex(uuidRegex, "ID lokasi inventory tidak valid.").optional().nullable(),
      stockHandling: stockHandlingSchema.default("EXPENSE_ONLY"),
      quantity: z.number().positive("Kuantitas harus lebih besar dari 0."),
      unitPrice: z.number().nonnegative("Harga satuan tidak boleh negatif."),
      amount: z.number().positive("Nominal pengeluaran harus lebih besar dari 0."),
      description: z.string().min(5, "Deskripsi pengeluaran minimal 5 karakter.").max(500),
    })
  ).min(1, "Minimal harus ada 1 item pengeluaran."),
});

export type SubmitFieldRequestsInput = z.input<typeof submitFieldRequestsSchema>;

export const approveFieldRequestSchema = z.object({
  projectCostId: z.string().regex(uuidRegex, "ID Biaya Proyek tidak valid."),
  status: z.enum(["APPROVED", "REJECTED"], { error: "Status persetujuan harus APPROVED atau REJECTED." }),
  notes: z.string().max(500).optional().nullable(),
  emergencyOverride: z.boolean().default(false),
});

export type ApproveFieldRequestInput = z.input<typeof approveFieldRequestSchema>;

export const createClientInvoiceSchema = z.object({
  projectId: z.string().regex(uuidRegex, "ID Proyek tidak valid."),
  invoiceNumber: z.string().min(1, "Nomor invoice wajib diisi.").max(100),
  amount: z.number().positive("Nominal tagihan harus lebih besar dari 0."),
  stage: z.enum(["DP", "PROGRESS_1", "PROGRESS_2", "PELUNASAN", "RETENTION", "AD_HOC"], {
    error: "Tahap tagihan tidak valid.",
  }),
  dueDate: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateClientInvoiceInput = z.infer<typeof createClientInvoiceSchema>;
