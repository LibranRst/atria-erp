import { pgTable, uuid, varchar, text, timestamp, boolean, numeric, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// 1. Peran Otorisasi (Role)
// ==========================================
export const role = pgTable("role", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull().unique(), // owner, finance_admin, project_manager, dll
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roleRelations = relations(role, ({ many }) => ({
  users: many(user),
}));

// ==========================================
// 2. Pengguna (User)
// ==========================================
export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  roleId: uuid("role_id").notNull().references(() => role.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("user_role_id_idx").on(table.roleId),
]);

export const userRelations = relations(user, ({ one, many }) => ({
  role: one(role, { fields: [user.roleId], references: [role.id] }),
  managedProjects: many(project, { relationName: "projectManager" }),
  approvedBudgets: many(projectBudget, { relationName: "budgetApprover" }),
  reconciledTransactions: many(cashTransaction, { relationName: "transactionReconciler" }),
  requestedCosts: many(projectCost, { relationName: "costRequester" }),
  verifiedCosts: many(projectCost, { relationName: "costVerifier" }),
  approvedCosts: many(projectCost, { relationName: "costApprover" }),
  paidCosts: many(projectCost, { relationName: "costPayer" }),
  receivedPayments: many(clientPayment, { relationName: "paymentReceiver" }),
  paidVendorPayments: many(vendorPayment, { relationName: "vendorPaymentPayer" }),
  uploadedAttachments: many(attachment, { relationName: "attachmentUploader" }),
  givenApprovals: many(approval, { relationName: "approver" }),
  triggeredAiRuns: many(aiRun, { relationName: "aiRunner" }),
  notifications: many(notification),
  auditLogs: many(auditLog),
  updatedConfigs: many(appConfig),
  importedStatements: many(bankStatementImport),
  sessions: many(session),
  accounts: many(account),
}));

// ==========================================
// 3. Klien (Client)
// ==========================================
export const client = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientRelations = relations(client, ({ many }) => ({
  projects: many(project),
}));

// ==========================================
// 4. Proyek (Project)
// ==========================================
export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  clientId: uuid("client_id").notNull().references(() => client.id, { onDelete: "restrict" }),
  projectManagerId: uuid("project_manager_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).notNull(), // DRAFT, ACTIVE, ON_HOLD, COMPLETED, CANCELLED
  financialHealth: varchar("financial_health", { length: 50 }).notNull().default("HEALTHY"), // HEALTHY, WARNING, CRITICAL
  totalContractValue: numeric("total_contract_value", { precision: 15, scale: 2 }).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("project_client_id_idx").on(table.clientId),
  index("project_pm_id_idx").on(table.projectManagerId),
]);

export const projectRelations = relations(project, ({ one, many }) => ({
  client: one(client, { fields: [project.clientId], references: [client.id] }),
  projectManager: one(user, { fields: [project.projectManagerId], references: [user.id], relationName: "projectManager" }),
  budget: one(projectBudget),
  clientInvoices: many(clientInvoice),
  vendorBills: many(vendorBill),
  costs: many(projectCost),
}));

// ==========================================
// 5. RAB Header (Project Budget)
// ==========================================
export const projectBudget = pgTable("project_budget", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(), // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pb_project_id_idx").on(table.projectId),
]);

export const projectBudgetRelations = relations(projectBudget, ({ one, many }) => ({
  project: one(project, { fields: [projectBudget.projectId], references: [project.id] }),
  approvedBy: one(user, { fields: [projectBudget.approvedById], references: [user.id], relationName: "budgetApprover" }),
  items: many(projectBudgetItem),
}));

// ==========================================
// 6. Kategori Biaya (Project Cost Category)
// ==========================================
export const projectCostCategory = pgTable("project_cost_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(), // MATERIAL, SUBCONTRACTOR, OPERATIONAL, OTHER
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectCostCategoryRelations = relations(projectCostCategory, ({ many }) => ({
  budgetItems: many(projectBudgetItem),
}));

// ==========================================
// 7. Detail RAB BoQ (Project Budget Item)
// ==========================================
export const projectBudgetItem = pgTable("project_budget_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectBudgetId: uuid("project_budget_id").notNull().references(() => projectBudget.id, { onDelete: "cascade" }),
  costCategoryId: uuid("cost_category_id").notNull().references(() => projectCostCategory.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  budgetCategory: varchar("budget_category", { length: 255 }).notNull().default("Umum"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
  unit: varchar("unit", { length: 50 }).notNull().default("m2"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
  actualSpent: numeric("actual_spent", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pbi_project_budget_id_idx").on(table.projectBudgetId),
  index("pbi_cost_category_id_idx").on(table.costCategoryId),
]);

export const projectBudgetItemRelations = relations(projectBudgetItem, ({ one, many }) => ({
  budget: one(projectBudget, { fields: [projectBudgetItem.projectBudgetId], references: [projectBudget.id] }),
  costCategory: one(projectCostCategory, { fields: [projectBudgetItem.costCategoryId], references: [projectCostCategory.id] }),
  vendorBills: many(vendorBill),
  projectCosts: many(projectCost),
}));

// ==========================================
// 8. Rekening Bank (Bank Account)
// ==========================================
export const bankAccount = pgTable("bank_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }).notNull().unique(),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  holderName: varchar("holder_name", { length: 255 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bankAccountRelations = relations(bankAccount, ({ many }) => ({
  cashTransactions: many(cashTransaction),
  projectCosts: many(projectCost),
  clientPayments: many(clientPayment),
  vendorPayments: many(vendorPayment),
  statementImports: many(bankStatementImport),
}));

// ==========================================
// 9. Buku Besar (Cash Transaction Ledger)
// ==========================================
export const cashTransaction = pgTable("cash_transaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccount.id, { onDelete: "restrict" }),
  type: varchar("type", { length: 10 }).notNull(), // DEBIT, CREDIT
  category: varchar("category", { length: 50 }).notNull(), // client_payment, vendor_payment, petty_cash_refill, dll
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  reconciled: boolean("reconciled").default(false).notNull(),
  reconciliationDate: timestamp("reconciliation_date"),
  reconciledById: uuid("reconciled_by_id").references(() => user.id, { onDelete: "restrict" }),
  referenceType: varchar("reference_type", { length: 100 }), // client_payment, vendor_payment, project_cost
  referenceId: uuid("reference_id"), // Polimorfik reference ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ct_bank_account_id_idx").on(table.bankAccountId),
  index("ct_reference_idx").on(table.referenceType, table.referenceId),
]);

export const cashTransactionRelations = relations(cashTransaction, ({ one }) => ({
  bankAccount: one(bankAccount, { fields: [cashTransaction.bankAccountId], references: [bankAccount.id] }),
  reconciledBy: one(user, { fields: [cashTransaction.reconciledById], references: [user.id], relationName: "transactionReconciler" }),
}));

// ==========================================
// 10. Pengeluaran Lapangan (Project Cost)
// ==========================================
export const projectCost = pgTable("project_cost", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  projectBudgetItemId: uuid("project_budget_item_id").notNull().references(() => projectBudgetItem.id, { onDelete: "restrict" }),
  requestedById: uuid("requested_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  receiptGroupId: uuid("receipt_group_id"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  receiptImageUrl: text("receipt_image_url"),
  status: varchar("status", { length: 50 }).notNull(), // SUBMITTED, VERIFIED, APPROVED, PAID, REJECTED
  budgetOverrun: boolean("budget_overrun").default(false).notNull(),
  bankAccountId: uuid("bank_account_id").references(() => bankAccount.id, { onDelete: "restrict" }),
  cashTransactionId: uuid("cash_transaction_id").references(() => cashTransaction.id, { onDelete: "restrict" }),
  verifiedById: uuid("verified_by_id").references(() => user.id, { onDelete: "restrict" }),
  verifiedAt: timestamp("verified_at"),
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  paidById: uuid("paid_by_id").references(() => user.id, { onDelete: "restrict" }),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pc_project_id_idx").on(table.projectId),
  index("pc_project_budget_item_id_idx").on(table.projectBudgetItemId),
  index("pc_requested_by_id_idx").on(table.requestedById),
  index("pc_bank_account_id_idx").on(table.bankAccountId),
  index("pc_cash_transaction_id_idx").on(table.cashTransactionId),
  index("pc_verified_by_id_idx").on(table.verifiedById),
  index("pc_approved_by_id_idx").on(table.approvedById),
  index("pc_paid_by_id_idx").on(table.paidById),
]);

export const projectCostRelations = relations(projectCost, ({ one }) => ({
  project: one(project, { fields: [projectCost.projectId], references: [project.id] }),
  budgetItem: one(projectBudgetItem, { fields: [projectCost.projectBudgetItemId], references: [projectBudgetItem.id] }),
  requestedBy: one(user, { fields: [projectCost.requestedById], references: [user.id], relationName: "costRequester" }),
  bankAccount: one(bankAccount, { fields: [projectCost.bankAccountId], references: [bankAccount.id] }),
  cashTransaction: one(cashTransaction, { fields: [projectCost.cashTransactionId], references: [cashTransaction.id] }),
  verifiedBy: one(user, { fields: [projectCost.verifiedById], references: [user.id], relationName: "costVerifier" }),
  approvedBy: one(user, { fields: [projectCost.approvedById], references: [user.id], relationName: "costApprover" }),
  paidBy: one(user, { fields: [projectCost.paidById], references: [user.id], relationName: "costPayer" }),
}));

// ==========================================
// 11. Invoice Klien (Client Invoice)
// ==========================================
export const clientInvoice = pgTable("client_invoice", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, VOID
  stage: varchar("stage", { length: 50 }).notNull(), // DP, PROGRESS_1, PROGRESS_2, PELUNASAN, RETENTION, AD_HOC
  dueDate: timestamp("due_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ci_project_id_idx").on(table.projectId),
]);

export const clientInvoiceRelations = relations(clientInvoice, ({ one, many }) => ({
  project: one(project, { fields: [clientInvoice.projectId], references: [project.id] }),
  payments: many(clientPayment),
}));

// ==========================================
// 12. Pembayaran Invoice Klien (Client Payment)
// ==========================================
export const clientPayment = pgTable("client_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientInvoiceId: uuid("client_invoice_id").notNull().references(() => clientInvoice.id, { onDelete: "restrict" }),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccount.id, { onDelete: "restrict" }),
  cashTransactionId: uuid("cash_transaction_id").notNull().references(() => cashTransaction.id, { onDelete: "restrict" }),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  receivedById: uuid("received_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cp_invoice_id_idx").on(table.clientInvoiceId),
  index("cp_bank_account_id_idx").on(table.bankAccountId),
  index("cp_cash_transaction_id_idx").on(table.cashTransactionId),
]);

export const clientPaymentRelations = relations(clientPayment, ({ one }) => ({
  invoice: one(clientInvoice, { fields: [clientPayment.clientInvoiceId], references: [clientInvoice.id] }),
  bankAccount: one(bankAccount, { fields: [clientPayment.bankAccountId], references: [bankAccount.id] }),
  cashTransaction: one(cashTransaction, { fields: [clientPayment.cashTransactionId], references: [cashTransaction.id] }),
  receivedBy: one(user, { fields: [clientPayment.receivedById], references: [user.id], relationName: "paymentReceiver" }),
}));

// ==========================================
// 13. Vendor
// ==========================================
export const vendor = pgTable("vendor", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  address: text("address"),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankAccountHolder: varchar("bank_account_holder", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorRelations = relations(vendor, ({ many }) => ({
  bills: many(vendorBill),
}));

// ==========================================
// 14. Tagihan Vendor (Vendor Bill)
// ==========================================
export const vendorBill = pgTable("vendor_bill", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendor.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  projectBudgetItemId: uuid("project_budget_item_id").notNull().references(() => projectBudgetItem.id, { onDelete: "restrict" }),
  billNumber: varchar("bill_number", { length: 100 }).notNull().unique(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, VOID
  dueDate: timestamp("due_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("vb_vendor_id_idx").on(table.vendorId),
  index("vb_project_id_idx").on(table.projectId),
  index("vb_project_budget_item_id_idx").on(table.projectBudgetItemId),
]);

export const vendorBillRelations = relations(vendorBill, ({ one, many }) => ({
  vendor: one(vendor, { fields: [vendorBill.vendorId], references: [vendor.id] }),
  project: one(project, { fields: [vendorBill.projectId], references: [project.id] }),
  budgetItem: one(projectBudgetItem, { fields: [vendorBill.projectBudgetItemId], references: [projectBudgetItem.id] }),
  payments: many(vendorPayment),
}));

// ==========================================
// 15. Pembayaran Vendor (Vendor Payment)
// ==========================================
export const vendorPayment = pgTable("vendor_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorBillId: uuid("vendor_bill_id").notNull().references(() => vendorBill.id, { onDelete: "restrict" }),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccount.id, { onDelete: "restrict" }),
  cashTransactionId: uuid("cash_transaction_id").references(() => cashTransaction.id, { onDelete: "restrict" }),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  paymentDate: timestamp("payment_date").notNull(),
  paidById: uuid("paid_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vp_bill_id_idx").on(table.vendorBillId),
  index("vp_bank_account_id_idx").on(table.bankAccountId),
  index("vp_cash_transaction_id_idx").on(table.cashTransactionId),
]);

export const vendorPaymentRelations = relations(vendorPayment, ({ one }) => ({
  vendorBill: one(vendorBill, { fields: [vendorPayment.vendorBillId], references: [vendorBill.id] }),
  bankAccount: one(bankAccount, { fields: [vendorPayment.bankAccountId], references: [bankAccount.id] }),
  cashTransaction: one(cashTransaction, { fields: [vendorPayment.cashTransactionId], references: [cashTransaction.id] }),
  paidBy: one(user, { fields: [vendorPayment.paidById], references: [user.id], relationName: "vendorPaymentPayer" }),
}));

// ==========================================
// 16. Berkas Lampiran (Attachment)
// ==========================================
export const attachment = pgTable("attachment", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  uploadedById: uuid("uploaded_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  referenceType: varchar("reference_type", { length: 100 }).notNull(), // project_cost, vendor_bill, client_invoice, dll
  referenceId: uuid("reference_id").notNull(), // Polimorfik reference ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("att_reference_idx").on(table.referenceType, table.referenceId),
]);

export const attachmentRelations = relations(attachment, ({ one }) => ({
  uploadedBy: one(user, { fields: [attachment.uploadedById], references: [user.id], relationName: "attachmentUploader" }),
}));

// ==========================================
// 17. Keputusan Otorisasi (Approval)
// ==========================================
export const approval = pgTable("approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  approverId: uuid("approver_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  referenceType: varchar("reference_type", { length: 100 }).notNull(), // project_cost, project_budget, vendor_bill, dll
  referenceId: uuid("reference_id").notNull(), // Polimorfik reference ID
  status: varchar("status", { length: 50 }).notNull(), // APPROVED, REJECTED
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("app_reference_idx").on(table.referenceType, table.referenceId),
  index("app_approver_id_idx").on(table.approverId),
]);

export const approvalRelations = relations(approval, ({ one }) => ({
  approver: one(user, { fields: [approval.approverId], references: [user.id], relationName: "approver" }),
}));

// ==========================================
// 18. Log AI Pipeline (AI Run)
// ==========================================
export const aiRun = pgTable("ai_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  runType: varchar("run_type", { length: 50 }).notNull(), // OCR_RECEIPT, FINANCIAL_BRIEFING
  runById: uuid("run_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).notNull(), // PROCESSING, COMPLETED, FAILED
  payload: text("payload"), // Input parameter dalam stringified JSON
  result: text("result"), // Hasil ekstraksi JSON atau ringkasan dalam string
  errorMessage: text("error_message"),
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_run_by_id_idx").on(table.runById),
]);

export const aiRunRelations = relations(aiRun, ({ one }) => ({
  runBy: one(user, { fields: [aiRun.runById], references: [user.id], relationName: "aiRunner" }),
}));

// ==========================================
// 19. Notifikasi (Notification)
// ==========================================
export const notification = pgTable("notification", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  severity: varchar("severity", { length: 20 }).default("INFO").notNull(), // INFO, WARNING, CRITICAL
  referenceType: varchar("reference_type", { length: 100 }),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notif_user_id_idx").on(table.userId),
  index("notif_read_idx").on(table.read),
]);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));

// ==========================================
// 20. Riwayat Audit (Audit Log)
// ==========================================
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 100 }).notNull(), // CREATE_PROJECT, RECORD_CLIENT_PAYMENT, dll
  targetTable: varchar("target_table", { length: 100 }).notNull(),
  targetId: uuid("target_id").notNull(),
  originalState: text("original_state"), // JSON string
  newState: text("new_state"), // JSON string
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("al_user_id_idx").on(table.userId),
  index("al_target_idx").on(table.targetTable, table.targetId),
]);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, { fields: [auditLog.userId], references: [user.id] }),
}));

// ==========================================
// 21. Konfigurasi Aplikasi (App Config)
// ==========================================
export const appConfig = pgTable("app_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
});

export const appConfigRelations = relations(appConfig, ({ one }) => ({
  updatedBy: one(user, { fields: [appConfig.updatedById], references: [user.id] }),
}));

// ==========================================
// 22. Impor Koran Bank (Bank Statement Import)
// ==========================================
export const bankStatementImport = pgTable("bank_statement_import", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccount.id, { onDelete: "restrict" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  importedById: uuid("imported_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("bsi_bank_account_id_idx").on(table.bankAccountId),
]);

export const bankStatementImportRelations = relations(bankStatementImport, ({ one, many }) => ({
  bankAccount: one(bankAccount, { fields: [bankStatementImport.bankAccountId], references: [bankAccount.id] }),
  importedBy: one(user, { fields: [bankStatementImport.importedById], references: [user.id] }),
  rows: many(bankStatementRow),
}));

// ==========================================
// 23. Detil Transaksi Koran Bank (Bank Statement Row)
// ==========================================
export const bankStatementRow = pgTable("bank_statement_row", {
  id: uuid("id").primaryKey().defaultRandom(),
  importId: uuid("import_id").notNull().references(() => bankStatementImport.id, { onDelete: "cascade" }),
  transactionDate: timestamp("transaction_date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // DEBIT, CREDIT
  isReconciled: boolean("is_reconciled").default(false).notNull(),
  matchedCashTransactionId: uuid("matched_cash_transaction_id").references(() => cashTransaction.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("bsr_import_id_idx").on(table.importId),
  index("bsr_matched_cash_transaction_idx").on(table.matchedCashTransactionId),
]);

export const bankStatementRowRelations = relations(bankStatementRow, ({ one }) => ({
  import: one(bankStatementImport, { fields: [bankStatementRow.importId], references: [bankStatementImport.id] }),
  matchedCashTransaction: one(cashTransaction, { fields: [bankStatementRow.matchedCashTransactionId], references: [cashTransaction.id] }),
}));

// ==========================================
// 24. Sesi Better Auth (Session)
// ==========================================
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
  index("session_user_id_idx").on(table.userId),
]);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

// ==========================================
// 25. Akun Better Auth (Account)
// ==========================================
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("account_user_id_idx").on(table.userId),
]);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ==========================================
// 26. Verifikasi Better Auth (Verification)
// ==========================================
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("verification_identifier_idx").on(table.identifier),
]);
