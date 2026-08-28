import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenant";
import { DEKORIA_TENANT_ID } from "./tenant-constants";
import { user } from "./auth";
import {
  project,
  projectBudgetCategory,
  projectBudgetItem,
  projectCategoryPlanItem,
  projectRapItem,
} from "./projects";
import { goodsReceipt, materialMaster } from "./materials";

// ==========================================
// // 8. Rekening Bank (Bank Account)
// ==========================================
export const bankAccount = pgTable(
  "bank_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    accountNumber: varchar("account_number", { length: 50 }).notNull(),
    bankName: varchar("bank_name", { length: 100 }).notNull(),
    holderName: varchar("holder_name", { length: 255 }).notNull(),
    balance: numeric("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
    cardColorFrom: varchar("card_color_from", { length: 7 }).default("#0F2B5C").notNull(),
    cardColorTo: varchar("card_color_to", { length: 7 }).default("#1E40AF").notNull(),
    cardTextColor: varchar("card_text_color", { length: 10 }).default("light").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ba_tenant_account_number_uidx").on(table.tenantId, table.accountNumber),
    index("ba_tenant_id_idx").on(table.tenantId),
    index("ba_is_active_idx").on(table.isActive),
  ],
);

export const bankAccountRelations = relations(bankAccount, ({ many }) => ({
  cashTransactions: many(cashTransaction),
  projectCosts: many(projectCost),
  clientPayments: many(clientPayment),
  vendorPayments: many(vendorPayment),
  statementImports: many(bankStatementImport),
}));

// ==========================================
// // 9. Buku Besar (Cash Transaction Ledger)
// ==========================================
export const cashTransaction = pgTable(
  "cash_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccount.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 10 }).notNull(), // INFLOW, OUTFLOW
    category: varchar("category", { length: 50 }).notNull(), // client_payment, vendor_payment, petty_cash_refill, dll
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    description: text("description").notNull(),
    reconciled: boolean("reconciled").default(false).notNull(),
    reconciliationDate: timestamp("reconciliation_date"),
    reconciledById: uuid("reconciled_by_id").references(() => user.id, { onDelete: "restrict" }),
    reconciliationExceptionReason: text("reconciliation_exception_reason"),
    reconciliationExceptionAt: timestamp("reconciliation_exception_at"),
    reconciliationExceptionById: uuid("reconciliation_exception_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    referenceType: varchar("reference_type", { length: 100 }), // client_payment, vendor_payment, project_cost
    referenceId: uuid("reference_id"), // Polimorfik reference ID
    bankReference: varchar("bank_reference", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("ct_bank_account_id_idx").on(table.bankAccountId),
    index("ct_reference_idx").on(table.referenceType, table.referenceId),
    uniqueIndex("ct_bank_account_reference_uidx").on(table.bankAccountId, table.bankReference),
    index("ct_reconciliation_exception_at_idx").on(table.reconciliationExceptionAt),
  ],
);

export const cashTransactionRelations = relations(cashTransaction, ({ one }) => ({
  bankAccount: one(bankAccount, {
    fields: [cashTransaction.bankAccountId],
    references: [bankAccount.id],
  }),
  reconciledBy: one(user, {
    fields: [cashTransaction.reconciledById],
    references: [user.id],
    relationName: "transactionReconciler",
  }),
  reconciliationExceptionBy: one(user, {
    fields: [cashTransaction.reconciliationExceptionById],
    references: [user.id],
    relationName: "transactionReconciliationExceptionReviewer",
  }),
}));

// ==========================================
// // 10. Pengeluaran Lapangan (Project Cost)
// ==========================================
export const projectCost = pgTable(
  "project_cost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    projectBudgetItemId: uuid("project_budget_item_id").references(() => projectBudgetItem.id, {
      onDelete: "set null",
    }),
    projectBudgetCategoryId: uuid("project_budget_category_id")
      .notNull()
      .references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
    materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
    projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "restrict",
    }),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    receiptGroupId: uuid("receipt_group_id"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    description: text("description").notNull(),
    receiptImageUrl: text("receipt_image_url"),
    status: varchar("status", { length: 50 }).notNull(), // SUBMITTED, VERIFIED, APPROVED, PAID, REJECTED
    budgetOverrun: boolean("budget_overrun").default(false).notNull(),
    /*
     * Keputusan persetujuan yang dibekukan saat pengajuan dibuat.
     *
     * Ambangnya bisa diubah Owner lewat Settings; tanpa pembekuan ini,
     * menurunkan ambang akan diam-diam mengubah status pengajuan yang sudah
     * menunggu keputusan. Yang disimpan adalah keputusannya, bukan angkanya —
     * alur kerja bertanya "apakah ini butuh Owner", bukan "berapa ambangnya".
     */
    requiresOwnerApproval: boolean("requires_owner_approval").default(false).notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccount.id, {
      onDelete: "restrict",
    }),
    cashTransactionId: uuid("cash_transaction_id").references(() => cashTransaction.id, {
      onDelete: "restrict",
    }),
    verifiedById: uuid("verified_by_id").references(() => user.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at"),
    approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),
    paidById: uuid("paid_by_id").references(() => user.id, { onDelete: "restrict" }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pc_project_id_idx").on(table.projectId),
    index("pc_project_budget_item_id_idx").on(table.projectBudgetItemId),
    index("pc_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
    index("pc_material_id_idx").on(table.materialId),
    index("pc_project_rap_item_id_idx").on(table.projectRapItemId),
    index("pc_requested_by_id_idx").on(table.requestedById),
    index("pc_bank_account_id_idx").on(table.bankAccountId),
    index("pc_cash_transaction_id_idx").on(table.cashTransactionId),
    index("pc_verified_by_id_idx").on(table.verifiedById),
    index("pc_approved_by_id_idx").on(table.approvedById),
    index("pc_paid_by_id_idx").on(table.paidById),
  ],
);

export const projectCostRelations = relations(projectCost, ({ one }) => ({
  project: one(project, { fields: [projectCost.projectId], references: [project.id] }),
  budgetItem: one(projectBudgetItem, {
    fields: [projectCost.projectBudgetItemId],
    references: [projectBudgetItem.id],
  }),
  budgetCategory: one(projectBudgetCategory, {
    fields: [projectCost.projectBudgetCategoryId],
    references: [projectBudgetCategory.id],
  }),
  material: one(materialMaster, {
    fields: [projectCost.materialId],
    references: [materialMaster.id],
  }),
  rapItem: one(projectRapItem, {
    fields: [projectCost.projectRapItemId],
    references: [projectRapItem.id],
  }),
  requestedBy: one(user, {
    fields: [projectCost.requestedById],
    references: [user.id],
    relationName: "costRequester",
  }),
  bankAccount: one(bankAccount, {
    fields: [projectCost.bankAccountId],
    references: [bankAccount.id],
  }),
  cashTransaction: one(cashTransaction, {
    fields: [projectCost.cashTransactionId],
    references: [cashTransaction.id],
  }),
  verifiedBy: one(user, {
    fields: [projectCost.verifiedById],
    references: [user.id],
    relationName: "costVerifier",
  }),
  approvedBy: one(user, {
    fields: [projectCost.approvedById],
    references: [user.id],
    relationName: "costApprover",
  }),
  paidBy: one(user, {
    fields: [projectCost.paidById],
    references: [user.id],
    relationName: "costPayer",
  }),
}));

// ==========================================
// // 11. Invoice Klien (Client Invoice)
// ==========================================
export const clientInvoice = pgTable(
  "client_invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(), // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, VOID
    stage: varchar("stage", { length: 50 }).notNull(), // DP, PROGRESS_1, PROGRESS_2, PELUNASAN, RETENTION, AD_HOC
    dueDate: timestamp("due_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ci_tenant_invoice_number_uidx").on(table.tenantId, table.invoiceNumber),
    index("ci_tenant_id_idx").on(table.tenantId),
    index("ci_project_id_idx").on(table.projectId),
  ],
);

export const clientInvoiceRelations = relations(clientInvoice, ({ one, many }) => ({
  project: one(project, { fields: [clientInvoice.projectId], references: [project.id] }),
  payments: many(clientPayment),
}));

// ==========================================
// // 12. Pembayaran Invoice Klien (Client Payment)
// ==========================================
export const clientPayment = pgTable(
  "client_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    clientInvoiceId: uuid("client_invoice_id")
      .notNull()
      .references(() => clientInvoice.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccount.id, { onDelete: "restrict" }),
    cashTransactionId: uuid("cash_transaction_id")
      .notNull()
      .references(() => cashTransaction.id, { onDelete: "restrict" }),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull(),
    paymentDate: timestamp("payment_date").notNull(),
    receivedById: uuid("received_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    referenceNumber: varchar("reference_number", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("cp_invoice_id_idx").on(table.clientInvoiceId),
    index("cp_bank_account_id_idx").on(table.bankAccountId),
    index("cp_cash_transaction_id_idx").on(table.cashTransactionId),
  ],
);

export const clientPaymentRelations = relations(clientPayment, ({ one }) => ({
  invoice: one(clientInvoice, {
    fields: [clientPayment.clientInvoiceId],
    references: [clientInvoice.id],
  }),
  bankAccount: one(bankAccount, {
    fields: [clientPayment.bankAccountId],
    references: [bankAccount.id],
  }),
  cashTransaction: one(cashTransaction, {
    fields: [clientPayment.cashTransactionId],
    references: [cashTransaction.id],
  }),
  receivedBy: one(user, {
    fields: [clientPayment.receivedById],
    references: [user.id],
    relationName: "paymentReceiver",
  }),
}));

// ==========================================
// // 13. Vendor
// ==========================================
export const vendor = pgTable(
  "vendor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }).notNull(),
    address: text("address"),
    bankName: varchar("bank_name", { length: 100 }),
    bankAccountNumber: varchar("bank_account_number", { length: 50 }),
    bankAccountHolder: varchar("bank_account_holder", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vendor_tenant_email_uidx").on(table.tenantId, table.email),
    index("vendor_tenant_id_idx").on(table.tenantId),
  ],
);

export const vendorRelations = relations(vendor, ({ many }) => ({
  bills: many(vendorBill),
  materials: many(materialMaster),
}));

// ==========================================
// // 14. Tagihan Vendor (Vendor Bill)
// ==========================================
export const vendorBill = pgTable(
  "vendor_bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendor.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    projectBudgetItemId: uuid("project_budget_item_id").references(() => projectBudgetItem.id, {
      onDelete: "set null",
    }),
    projectBudgetCategoryId: uuid("project_budget_category_id")
      .notNull()
      .references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
    materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
    projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "restrict",
    }),
    projectCategoryPlanItemId: uuid("project_category_plan_item_id").references(
      () => projectCategoryPlanItem.id,
      { onDelete: "restrict" },
    ),
    billNumber: varchar("bill_number", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(), // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, VOID
    dueDate: timestamp("due_date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("vb_vendor_id_idx").on(table.vendorId),
    index("vb_project_id_idx").on(table.projectId),
    index("vb_project_budget_item_id_idx").on(table.projectBudgetItemId),
    index("vb_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
    index("vb_material_id_idx").on(table.materialId),
    index("vb_project_rap_item_id_idx").on(table.projectRapItemId),
    index("vb_project_category_plan_item_id_idx").on(table.projectCategoryPlanItemId),
    uniqueIndex("vb_tenant_bill_number_uidx").on(table.tenantId, table.billNumber),
    index("vb_tenant_id_idx").on(table.tenantId),
  ],
);

export const vendorBillRelations = relations(vendorBill, ({ one, many }) => ({
  vendor: one(vendor, { fields: [vendorBill.vendorId], references: [vendor.id] }),
  project: one(project, { fields: [vendorBill.projectId], references: [project.id] }),
  budgetItem: one(projectBudgetItem, {
    fields: [vendorBill.projectBudgetItemId],
    references: [projectBudgetItem.id],
  }),
  budgetCategory: one(projectBudgetCategory, {
    fields: [vendorBill.projectBudgetCategoryId],
    references: [projectBudgetCategory.id],
  }),
  material: one(materialMaster, {
    fields: [vendorBill.materialId],
    references: [materialMaster.id],
  }),
  rapItem: one(projectRapItem, {
    fields: [vendorBill.projectRapItemId],
    references: [projectRapItem.id],
  }),
  categoryPlanItem: one(projectCategoryPlanItem, {
    fields: [vendorBill.projectCategoryPlanItemId],
    references: [projectCategoryPlanItem.id],
  }),
  payments: many(vendorPayment),
  goodsReceipts: many(goodsReceipt),
}));

// ==========================================
// // 15. Pembayaran Vendor (Vendor Payment)
// ==========================================
export const vendorPayment = pgTable(
  "vendor_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    vendorBillId: uuid("vendor_bill_id")
      .notNull()
      .references(() => vendorBill.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccount.id, { onDelete: "restrict" }),
    cashTransactionId: uuid("cash_transaction_id").references(() => cashTransaction.id, {
      onDelete: "restrict",
    }),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
    /*
     * Keputusan persetujuan yang dibekukan saat pengajuan dibuat.
     *
     * Ambangnya bisa diubah Owner lewat Settings; tanpa pembekuan ini,
     * menurunkan ambang akan diam-diam mengubah status pengajuan yang sudah
     * menunggu keputusan. Yang disimpan adalah keputusannya, bukan angkanya —
     * alur kerja bertanya "apakah ini butuh Owner", bukan "berapa ambangnya".
     */
    requiresOwnerApproval: boolean("requires_owner_approval").default(false).notNull(),
    paymentDate: timestamp("payment_date").notNull(),
    paidById: uuid("paid_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    referenceNumber: varchar("reference_number", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("vp_bill_id_idx").on(table.vendorBillId),
    index("vp_bank_account_id_idx").on(table.bankAccountId),
    index("vp_cash_transaction_id_idx").on(table.cashTransactionId),
  ],
);

export const vendorPaymentRelations = relations(vendorPayment, ({ one }) => ({
  vendorBill: one(vendorBill, {
    fields: [vendorPayment.vendorBillId],
    references: [vendorBill.id],
  }),
  bankAccount: one(bankAccount, {
    fields: [vendorPayment.bankAccountId],
    references: [bankAccount.id],
  }),
  cashTransaction: one(cashTransaction, {
    fields: [vendorPayment.cashTransactionId],
    references: [cashTransaction.id],
  }),
  paidBy: one(user, {
    fields: [vendorPayment.paidById],
    references: [user.id],
    relationName: "vendorPaymentPayer",
  }),
}));

// ==========================================
// // 22. Impor Koran Bank (Bank Statement Import)
// ==========================================
export const bankStatementImport = pgTable(
  "bank_statement_import",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccount.id, { onDelete: "restrict" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    importedById: uuid("imported_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("bsi_bank_account_id_idx").on(table.bankAccountId)],
);

export const bankStatementImportRelations = relations(bankStatementImport, ({ one, many }) => ({
  bankAccount: one(bankAccount, {
    fields: [bankStatementImport.bankAccountId],
    references: [bankAccount.id],
  }),
  importedBy: one(user, { fields: [bankStatementImport.importedById], references: [user.id] }),
  rows: many(bankStatementRow),
}));

// ==========================================
// // 23. Detil Transaksi Koran Bank (Bank Statement Row)
// ==========================================
export const bankStatementRow = pgTable(
  "bank_statement_row",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    importId: uuid("import_id")
      .notNull()
      .references(() => bankStatementImport.id, { onDelete: "cascade" }),
    transactionDate: timestamp("transaction_date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    type: varchar("type", { length: 10 }).notNull(), // INFLOW, OUTFLOW
    isReconciled: boolean("is_reconciled").default(false).notNull(),
    matchedCashTransactionId: uuid("matched_cash_transaction_id").references(
      () => cashTransaction.id,
      { onDelete: "set null" },
    ),
    fingerprint: varchar("fingerprint", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bsr_import_id_idx").on(table.importId),
    index("bsr_matched_cash_transaction_idx").on(table.matchedCashTransactionId),
    uniqueIndex("bsr_tenant_fingerprint_uidx").on(table.tenantId, table.fingerprint),
  ],
);

export const bankStatementRowRelations = relations(bankStatementRow, ({ one }) => ({
  import: one(bankStatementImport, {
    fields: [bankStatementRow.importId],
    references: [bankStatementImport.id],
  }),
  matchedCashTransaction: one(cashTransaction, {
    fields: [bankStatementRow.matchedCashTransactionId],
    references: [cashTransaction.id],
  }),
}));
