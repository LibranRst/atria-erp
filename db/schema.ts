import { pgTable, uuid, varchar, text, timestamp, boolean, numeric, integer, jsonb, index, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';
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
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  temporaryPasswordIssuedAt: timestamp("temporary_password_issued_at"),
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
  updatedBudgetAllocationSettings: many(budgetAllocationSetting, { relationName: "budgetAllocationSettingUpdater" }),
  updatedItemPriceLibraryItems: many(itemPriceLibrary, { relationName: "itemPriceLibraryUpdater" }),
  importedStatements: many(bankStatementImport),
  sessions: many(session, { relationName: "sessionUser" }),
  developerSimulationSessions: many(session, { relationName: "developerActor" }),
  accounts: many(account),
  formDrafts: many(formDraft),
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
  coverImageUrl: text("cover_image_url"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  location: varchar("location", { length: 255 }),
  roomArea: varchar("room_area", { length: 255 }),
  projectType: varchar("project_type", { length: 100 }),
  notes: text("notes"),
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
  canonicalBudgets: many(projectBudgets),
  categoryPlanItems: many(projectCategoryPlanItem),
  raps: many(projectRap),
  rabEstimates: many(rabEstimate),
  clientInvoices: many(clientInvoice),
  vendorBills: many(vendorBill),
  costs: many(projectCost),
  expenses: many(projectExpenses),
  profitabilitySnapshots: many(projectProfitabilitySnapshot),
  stockMovements: many(stockMovement),
  changeOrders: many(projectChangeOrder),
  goodsReceipts: many(goodsReceipt),
  formDrafts: many(formDraft),
}));

// ==========================================
// 4A. Transient Form Draft
// ==========================================
export const formDraft = pgTable("form_draft", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  formType: varchar("form_type", { length: 50 }).notNull(),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  payload: jsonb("payload").$type<unknown>().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("ACTIVE"),
  lastSavedAt: timestamp("last_saved_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  submissionGroupId: uuid("submission_group_id"),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("form_draft_owner_status_idx").on(table.ownerUserId, table.status),
  index("form_draft_project_idx").on(table.projectId),
  index("form_draft_expiry_idx").on(table.status, table.expiresAt),
]);

export const formDraftRelations = relations(formDraft, ({ one }) => ({
  owner: one(user, {
    fields: [formDraft.ownerUserId],
    references: [user.id],
  }),
  project: one(project, {
    fields: [formDraft.projectId],
    references: [project.id],
  }),
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
  canonicalBudgets: many(projectBudgets),
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
  canonicalCategories: many(projectBudgetCategory),
  vendorBills: many(vendorBill),
  projectCosts: many(projectCost),
}));

// ==========================================
// 7A. Canonical Expense Category
// ==========================================
export const expenseCategory = pgTable("expense_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  defaultRatio: numeric("default_ratio", { precision: 8, scale: 6 }).notNull().default("0.000000"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ec_code_idx").on(table.code),
]);

export const expenseCategoryRelations = relations(expenseCategory, ({ many }) => ({
  budgetAllocationCategories: many(budgetAllocationSettingCategory),
  budgetCategories: many(projectBudgetCategory),
  projectExpenses: many(projectExpenses),
  categoryPlanItems: many(projectCategoryPlanItem),
  itemLibraryItems: many(itemPriceLibrary),
}));

// ==========================================
// 7B. Budget Allocation Settings
// ==========================================
export const budgetAllocationSetting = pgTable("budget_allocation_setting", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("ACTIVE"),
  budgetCapRatio: numeric("budget_cap_ratio", { precision: 8, scale: 6 }).notNull().default("0.900000"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("bas_status_idx").on(table.status),
  index("bas_is_active_idx").on(table.isActive),
  index("bas_updated_by_id_idx").on(table.updatedById),
]);

export const budgetAllocationSettingRelations = relations(budgetAllocationSetting, ({ one, many }) => ({
  updatedBy: one(user, {
    fields: [budgetAllocationSetting.updatedById],
    references: [user.id],
    relationName: "budgetAllocationSettingUpdater",
  }),
  categories: many(budgetAllocationSettingCategory),
}));

export const budgetAllocationSettingCategory = pgTable("budget_allocation_setting_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetAllocationSettingId: uuid("budget_allocation_setting_id").notNull().references(() => budgetAllocationSetting.id, { onDelete: "cascade" }),
  expenseCategoryId: uuid("expense_category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
  ratioPercentage: numeric("ratio_percentage", { precision: 8, scale: 6 }).notNull().default("0.000000"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("basc_setting_category_uidx").on(table.budgetAllocationSettingId, table.expenseCategoryId),
  index("basc_setting_id_idx").on(table.budgetAllocationSettingId),
  index("basc_expense_category_id_idx").on(table.expenseCategoryId),
  index("basc_is_enabled_idx").on(table.isEnabled),
]);

export const budgetAllocationSettingCategoryRelations = relations(budgetAllocationSettingCategory, ({ one }) => ({
  setting: one(budgetAllocationSetting, {
    fields: [budgetAllocationSettingCategory.budgetAllocationSettingId],
    references: [budgetAllocationSetting.id],
  }),
  expenseCategory: one(expenseCategory, {
    fields: [budgetAllocationSettingCategory.expenseCategoryId],
    references: [expenseCategory.id],
  }),
}));

// ==========================================
// 7C. Canonical Project Budget
// ==========================================
export const projectBudgets = pgTable("project_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  legacyProjectBudgetId: uuid("legacy_project_budget_id").references(() => projectBudget.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull(),
  approvedRabValue: numeric("approved_rab_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  internalBudget: numeric("internal_budget", { precision: 15, scale: 2 }).notNull(),
  budgetCapRatio: numeric("budget_cap_ratio", { precision: 8, scale: 6 }).notNull().default("0.900000"),
  targetGrossAmount: numeric("target_gross_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  projectProgressPercentage: numeric("project_progress_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("project_budgets_project_id_uidx").on(table.projectId),
  index("project_budgets_status_idx").on(table.status),
  index("project_budgets_legacy_idx").on(table.legacyProjectBudgetId),
]);

export const projectBudgetsRelations = relations(projectBudgets, ({ one, many }) => ({
  project: one(project, { fields: [projectBudgets.projectId], references: [project.id] }),
  legacyBudget: one(projectBudget, { fields: [projectBudgets.legacyProjectBudgetId], references: [projectBudget.id] }),
  approvedBy: one(user, { fields: [projectBudgets.approvedById], references: [user.id], relationName: "canonicalBudgetApprover" }),
  categories: many(projectBudgetCategory),
  categoryPlanItems: many(projectCategoryPlanItem),
  expenses: many(projectExpenses),
  profitabilitySnapshots: many(projectProfitabilitySnapshot),
}));

// ==========================================
// 7C. Canonical Project Budget Category
// ==========================================
export const projectBudgetCategory = pgTable("project_budget_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectBudgetId: uuid("project_budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  expenseCategoryId: uuid("expense_category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
  legacyProjectBudgetItemId: uuid("legacy_project_budget_item_id").references(() => projectBudgetItem.id, { onDelete: "set null" }),
  ratioPercentage: numeric("ratio_percentage", { precision: 8, scale: 6 }).notNull().default("0.000000"),
  allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  pendingAmount: numeric("pending_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  actualAmount: numeric("actual_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  usedPercentage: numeric("used_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  status: varchar("status", { length: 50 }).notNull().default("SAFE"),
  isManualOverride: boolean("is_manual_override").default(false).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pbc_budget_category_uidx").on(table.projectBudgetId, table.expenseCategoryId),
  index("pbc_project_budget_id_idx").on(table.projectBudgetId),
  index("pbc_expense_category_id_idx").on(table.expenseCategoryId),
  index("pbc_legacy_budget_item_idx").on(table.legacyProjectBudgetItemId),
  index("pbc_status_idx").on(table.status),
]);

export const projectBudgetCategoryRelations = relations(projectBudgetCategory, ({ one, many }) => ({
  budget: one(projectBudgets, { fields: [projectBudgetCategory.projectBudgetId], references: [projectBudgets.id] }),
  expenseCategory: one(expenseCategory, { fields: [projectBudgetCategory.expenseCategoryId], references: [expenseCategory.id] }),
  legacyBudgetItem: one(projectBudgetItem, { fields: [projectBudgetCategory.legacyProjectBudgetItemId], references: [projectBudgetItem.id] }),
  categoryPlanItems: many(projectCategoryPlanItem),
  projectExpenses: many(projectExpenses),
  vendorBills: many(vendorBill),
  projectCosts: many(projectCost),
}));

// ==========================================
// 7D. Non-Material Category Plan Item
// ==========================================
export const projectCategoryPlanItem = pgTable("project_category_plan_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  projectBudgetId: uuid("project_budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  projectBudgetCategoryId: uuid("project_budget_category_id").notNull().references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
  expenseCategoryId: uuid("expense_category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
  vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "restrict" }),
  sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, { onDelete: "set null" }),
  supersedesProjectCategoryPlanItemId: uuid("supersedes_project_category_plan_item_id").references((): AnyPgColumn => projectCategoryPlanItem.id, { onDelete: "set null" }),
  revision: integer("revision").notNull().default(1),
  name: varchar("name", { length: 255 }).notNull(),
  scopeDescription: text("scope_description"),
  area: varchar("area", { length: 150 }).notNull().default("Umum"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
  unit: varchar("unit", { length: 50 }).notNull().default("ls"),
  estimatedUnitCost: numeric("estimated_unit_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  estimatedTotalCost: numeric("estimated_total_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  suggestedClientUnitPrice: numeric("suggested_client_unit_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  lockedById: uuid("locked_by_id").references(() => user.id, { onDelete: "restrict" }),
  lockedAt: timestamp("locked_at"),
  internalNote: text("internal_note"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pcpi_project_id_idx").on(table.projectId),
  index("pcpi_project_budget_id_idx").on(table.projectBudgetId),
  index("pcpi_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
  index("pcpi_expense_category_id_idx").on(table.expenseCategoryId),
  index("pcpi_vendor_id_idx").on(table.vendorId),
  index("pcpi_source_library_item_id_idx").on(table.sourceLibraryItemId),
  index("pcpi_supersedes_idx").on(table.supersedesProjectCategoryPlanItemId),
  index("pcpi_status_idx").on(table.status),
]);

export const projectCategoryPlanItemRelations = relations(projectCategoryPlanItem, ({ one, many }) => ({
  project: one(project, { fields: [projectCategoryPlanItem.projectId], references: [project.id] }),
  budget: one(projectBudgets, { fields: [projectCategoryPlanItem.projectBudgetId], references: [projectBudgets.id] }),
  budgetCategory: one(projectBudgetCategory, { fields: [projectCategoryPlanItem.projectBudgetCategoryId], references: [projectBudgetCategory.id] }),
  expenseCategory: one(expenseCategory, { fields: [projectCategoryPlanItem.expenseCategoryId], references: [expenseCategory.id] }),
  vendor: one(vendor, { fields: [projectCategoryPlanItem.vendorId], references: [vendor.id] }),
  sourceLibraryItem: one(itemPriceLibrary, { fields: [projectCategoryPlanItem.sourceLibraryItemId], references: [itemPriceLibrary.id] }),
  supersedes: one(projectCategoryPlanItem, {
    fields: [projectCategoryPlanItem.supersedesProjectCategoryPlanItemId],
    references: [projectCategoryPlanItem.id],
    relationName: "categoryPlanRevision",
  }),
  revisions: many(projectCategoryPlanItem, { relationName: "categoryPlanRevision" }),
  lockedBy: one(user, { fields: [projectCategoryPlanItem.lockedById], references: [user.id] }),
  projectExpenses: many(projectExpenses),
  vendorBills: many(vendorBill),
  rabItems: many(rabEstimateItem),
}));

// ==========================================
// 7E. Canonical Project Expense
// ==========================================
export const projectExpenses = pgTable("project_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  projectBudgetId: uuid("project_budget_id").notNull().references(() => projectBudgets.id, { onDelete: "restrict" }),
  projectBudgetCategoryId: uuid("project_budget_category_id").notNull().references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
  expenseCategoryId: uuid("expense_category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
  legacyProjectCostId: uuid("legacy_project_cost_id").references(() => projectCost.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "restrict" }),
  vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "set null" }),
  materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
  projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, { onDelete: "restrict" }),
  projectCategoryPlanItemId: uuid("project_category_plan_item_id").references(() => projectCategoryPlanItem.id, { onDelete: "restrict" }),
  stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, { onDelete: "set null" }),
  requestedById: uuid("requested_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("CASH_EXPENSE"),
  isCashImpact: boolean("is_cash_impact").notNull().default(true),
  expenseDate: timestamp("expense_date").defaultNow().notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("UNPAID"),
  receiptImageUrl: text("receipt_image_url"),
  status: varchar("status", { length: 50 }).notNull().default("SUBMITTED"),
  auditNote: text("audit_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pe_project_id_idx").on(table.projectId),
  index("pe_project_budget_id_idx").on(table.projectBudgetId),
  index("pe_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
  index("pe_expense_category_id_idx").on(table.expenseCategoryId),
  index("pe_legacy_project_cost_id_idx").on(table.legacyProjectCostId),
  index("pe_vendor_bill_id_idx").on(table.vendorBillId),
  index("pe_material_id_idx").on(table.materialId),
  index("pe_project_rap_item_id_idx").on(table.projectRapItemId),
  index("pe_project_category_plan_item_id_idx").on(table.projectCategoryPlanItemId),
  index("pe_stock_movement_id_idx").on(table.stockMovementId),
  index("pe_source_type_idx").on(table.sourceType),
  index("pe_status_idx").on(table.status),
]);

export const projectExpensesRelations = relations(projectExpenses, ({ one }) => ({
  project: one(project, { fields: [projectExpenses.projectId], references: [project.id] }),
  budget: one(projectBudgets, { fields: [projectExpenses.projectBudgetId], references: [projectBudgets.id] }),
  budgetCategory: one(projectBudgetCategory, { fields: [projectExpenses.projectBudgetCategoryId], references: [projectBudgetCategory.id] }),
  expenseCategory: one(expenseCategory, { fields: [projectExpenses.expenseCategoryId], references: [expenseCategory.id] }),
  legacyProjectCost: one(projectCost, { fields: [projectExpenses.legacyProjectCostId], references: [projectCost.id] }),
  vendor: one(vendor, { fields: [projectExpenses.vendorId], references: [vendor.id] }),
  vendorBill: one(vendorBill, { fields: [projectExpenses.vendorBillId], references: [vendorBill.id] }),
  material: one(materialMaster, { fields: [projectExpenses.materialId], references: [materialMaster.id] }),
  rapItem: one(projectRapItem, { fields: [projectExpenses.projectRapItemId], references: [projectRapItem.id] }),
  categoryPlanItem: one(projectCategoryPlanItem, { fields: [projectExpenses.projectCategoryPlanItemId], references: [projectCategoryPlanItem.id] }),
  stockMovement: one(stockMovement, { fields: [projectExpenses.stockMovementId], references: [stockMovement.id] }),
  requestedBy: one(user, { fields: [projectExpenses.requestedById], references: [user.id], relationName: "canonicalExpenseRequester" }),
}));

// ==========================================
// 7F. Project Profitability Snapshot
// ==========================================
export const projectProfitabilitySnapshot = pgTable("project_profitability_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  projectBudgetId: uuid("project_budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  approvedRabValue: numeric("approved_rab_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  internalBudget: numeric("internal_budget", { precision: 15, scale: 2 }).notNull().default("0.00"),
  actualCost: numeric("actual_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
  remainingBudget: numeric("remaining_budget", { precision: 15, scale: 2 }).notNull().default("0.00"),
  budgetUsedPercentage: numeric("budget_used_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  targetGrossAmount: numeric("target_gross_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  projectedFinalCost: numeric("projected_final_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
  projectedMarginAmount: numeric("projected_margin_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  projectedMarginPercentage: numeric("projected_margin_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  realizedMarginAmount: numeric("realized_margin_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
  realizedMarginPercentage: numeric("realized_margin_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  cashPosition: numeric("cash_position", { precision: 15, scale: 2 }).notNull().default("0.00"),
  snapshotType: varchar("snapshot_type", { length: 50 }).notNull().default("PERIODIC"),
  materialBudget: numeric("material_budget", { precision: 15, scale: 2 }).notNull().default("0.00"),
  materialActual: numeric("material_actual", { precision: 15, scale: 2 }).notNull().default("0.00"),
  materialRemaining: numeric("material_remaining", { precision: 15, scale: 2 }).notNull().default("0.00"),
  materialUsedPercentage: numeric("material_used_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  materialStockValueApplied: numeric("material_stock_value_applied", { precision: 15, scale: 2 }).notNull().default("0.00"),
  materialShortageValue: numeric("material_shortage_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  leftoverStockValue: numeric("leftover_stock_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
  riskStatus: varchar("risk_status", { length: 50 }).notNull().default("SAFE"),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("pps_project_id_idx").on(table.projectId),
  index("pps_project_budget_id_idx").on(table.projectBudgetId),
  index("pps_risk_status_idx").on(table.riskStatus),
  index("pps_snapshot_at_idx").on(table.snapshotAt),
  index("pps_snapshot_type_idx").on(table.snapshotType),
]);

export const projectProfitabilitySnapshotRelations = relations(projectProfitabilitySnapshot, ({ one }) => ({
  project: one(project, { fields: [projectProfitabilitySnapshot.projectId], references: [project.id] }),
  budget: one(projectBudgets, { fields: [projectProfitabilitySnapshot.projectBudgetId], references: [projectBudgets.id] }),
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
  cardColorFrom: varchar("card_color_from", { length: 7 }).default("#0F2B5C").notNull(),
  cardColorTo: varchar("card_color_to", { length: 7 }).default("#1E40AF").notNull(),
  cardTextColor: varchar("card_text_color", { length: 10 }).default("light").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ba_is_active_idx").on(table.isActive),
]);

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
  projectBudgetItemId: uuid("project_budget_item_id").references(() => projectBudgetItem.id, { onDelete: "set null" }),
  projectBudgetCategoryId: uuid("project_budget_category_id").notNull().references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
  materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
  projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, { onDelete: "restrict" }),
  requestedById: uuid("requested_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  receiptGroupId: uuid("receipt_group_id"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
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
  index("pc_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
  index("pc_material_id_idx").on(table.materialId),
  index("pc_project_rap_item_id_idx").on(table.projectRapItemId),
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
  budgetCategory: one(projectBudgetCategory, { fields: [projectCost.projectBudgetCategoryId], references: [projectBudgetCategory.id] }),
  material: one(materialMaster, { fields: [projectCost.materialId], references: [materialMaster.id] }),
  rapItem: one(projectRapItem, { fields: [projectCost.projectRapItemId], references: [projectRapItem.id] }),
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
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorRelations = relations(vendor, ({ many }) => ({
  bills: many(vendorBill),
  materials: many(materialMaster),
}));

// ==========================================
// 14A. Kategori Material (Material Category)
// ==========================================
export const materialCategory = pgTable("material_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialCategoryRelations = relations(materialCategory, ({ many }) => ({
  materials: many(materialMaster),
}));

// ==========================================
// 14B. Master Material (Material Master)
// ==========================================
export const materialMaster = pgTable("material_master", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => materialCategory.id, { onDelete: "restrict" }),
  defaultVendorId: uuid("default_vendor_id").references(() => vendor.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  specification: text("specification"),
  brand: varchar("brand", { length: 100 }),
  code: varchar("code", { length: 100 }),
  color: varchar("color", { length: 100 }),
  unit: varchar("unit", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("mm_category_id_idx").on(table.categoryId),
  index("mm_default_vendor_id_idx").on(table.defaultVendorId),
  index("mm_name_idx").on(table.name),
]);

export const materialMasterRelations = relations(materialMaster, ({ one, many }) => ({
  category: one(materialCategory, { fields: [materialMaster.categoryId], references: [materialCategory.id] }),
  defaultVendor: one(vendor, { fields: [materialMaster.defaultVendorId], references: [vendor.id] }),
  inventory: many(materialInventory),
  itemLibraryItems: many(itemPriceLibrary),
  rapItems: many(projectRapItem),
  stockMovements: many(stockMovement),
  projectCosts: many(projectCost),
  vendorBills: many(vendorBill),
}));

// ==========================================
// 14C. Lokasi Inventory (Inventory Location)
// ==========================================
export const inventoryLocation = pgTable("inventory_location", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryLocationRelations = relations(inventoryLocation, ({ many }) => ({
  inventory: many(materialInventory),
  stockMovements: many(stockMovement),
}));

// ==========================================
// 14D. Inventory Material (Material Inventory)
// ==========================================
export const materialInventory = pgTable("material_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  materialId: uuid("material_id").notNull().references(() => materialMaster.id, { onDelete: "restrict" }),
  locationId: uuid("location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  currentStock: numeric("current_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
  reservedStock: numeric("reserved_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
  minimumStock: numeric("minimum_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
  averageCost: numeric("average_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  lastPurchasePrice: numeric("last_purchase_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("mi_material_location_uidx").on(table.materialId, table.locationId),
  index("mi_material_id_idx").on(table.materialId),
  index("mi_location_id_idx").on(table.locationId),
]);

export const materialInventoryRelations = relations(materialInventory, ({ one }) => ({
  material: one(materialMaster, { fields: [materialInventory.materialId], references: [materialMaster.id] }),
  location: one(inventoryLocation, { fields: [materialInventory.locationId], references: [inventoryLocation.id] }),
}));

export const stockTransfer = pgTable("stock_transfer", {
  id: uuid("id").primaryKey().defaultRandom(),
  transferNumber: varchar("transfer_number", { length: 100 }).notNull().unique(),
  fromLocationId: uuid("from_location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  toLocationId: uuid("to_location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).notNull().default("POSTED"),
  transferredAt: timestamp("transferred_at").notNull(),
  note: text("note").notNull(),
  createdById: uuid("created_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("st_from_location_idx").on(table.fromLocationId), index("st_to_location_idx").on(table.toLocationId)]);

export const stockCount = pgTable("stock_count", {
  id: uuid("id").primaryKey().defaultRandom(),
  countNumber: varchar("count_number", { length: 100 }).notNull().unique(),
  inventoryLocationId: uuid("inventory_location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  countedAt: timestamp("counted_at").notNull(),
  note: text("note"),
  rejectionReason: text("rejection_reason"),
  createdById: uuid("created_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  submittedAt: timestamp("submitted_at"),
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("sc_location_idx").on(table.inventoryLocationId), index("sc_status_idx").on(table.status)]);

// ==========================================
// 14E. Item / Price Library Settings
// ==========================================
export const itemPriceLibrary = pgTable("item_price_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseCategoryId: uuid("expense_category_id").notNull().references(() => expenseCategory.id, { onDelete: "restrict" }),
  materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "set null" }),
  defaultVendorId: uuid("default_vendor_id").references(() => vendor.id, { onDelete: "set null" }),
  code: varchar("code", { length: 100 }),
  itemType: varchar("item_type", { length: 50 }).notNull().default("CLIENT_LINE"),
  itemCategory: varchar("item_category", { length: 120 }).notNull().default("General"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 50 }).notNull(),
  defaultClientPrice: numeric("default_client_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
  defaultInternalCost: numeric("default_internal_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
  pricingMode: varchar("pricing_mode", { length: 50 }).notNull().default("MARGIN_BASED"),
  targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  priceSourceType: varchar("price_source_type", { length: 50 }).notNull().default("COST_BREAKDOWN"),
  sourceNote: text("source_note"),
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ipl_code_uidx").on(table.code),
  index("ipl_expense_category_id_idx").on(table.expenseCategoryId),
  index("ipl_material_id_idx").on(table.materialId),
  index("ipl_default_vendor_id_idx").on(table.defaultVendorId),
  index("ipl_item_type_idx").on(table.itemType),
  index("ipl_item_category_idx").on(table.itemCategory),
  index("ipl_is_active_idx").on(table.isActive),
  index("ipl_updated_by_id_idx").on(table.updatedById),
]);

export const itemPriceLibraryRelations = relations(itemPriceLibrary, ({ one, many }) => ({
  expenseCategory: one(expenseCategory, { fields: [itemPriceLibrary.expenseCategoryId], references: [expenseCategory.id] }),
  material: one(materialMaster, { fields: [itemPriceLibrary.materialId], references: [materialMaster.id] }),
  defaultVendor: one(vendor, { fields: [itemPriceLibrary.defaultVendorId], references: [vendor.id] }),
  costComponents: many(itemPriceLibraryCostComponent),
  updatedBy: one(user, {
    fields: [itemPriceLibrary.updatedById],
    references: [user.id],
    relationName: "itemPriceLibraryUpdater",
  }),
}));

export const itemPriceLibraryCostComponent = pgTable("item_price_library_cost_component", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemPriceLibraryId: uuid("item_price_library_id").notNull().references(() => itemPriceLibrary.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "set null" }),
  componentType: varchar("component_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
  unit: varchar("unit", { length: 50 }).notNull().default("ls"),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
  note: text("note"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("iplcc_library_item_id_idx").on(table.itemPriceLibraryId),
  index("iplcc_vendor_id_idx").on(table.vendorId),
  index("iplcc_component_type_idx").on(table.componentType),
]);

export const itemPriceLibraryCostComponentRelations = relations(itemPriceLibraryCostComponent, ({ one }) => ({
  libraryItem: one(itemPriceLibrary, { fields: [itemPriceLibraryCostComponent.itemPriceLibraryId], references: [itemPriceLibrary.id] }),
  vendor: one(vendor, { fields: [itemPriceLibraryCostComponent.vendorId], references: [vendor.id] }),
}));

// ==========================================
// 14F. RAP Proyek (Internal Project RAP)
// ==========================================
export const projectRap = pgTable("project_rap", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  supersedesProjectRapId: uuid("supersedes_project_rap_id").references((): AnyPgColumn => projectRap.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  revision: integer("revision").default(1).notNull(),
  setupStage: varchar("setup_stage", { length: 50 }).default("MATERIAL").notNull(),
  tukangScopeSkipped: boolean("tukang_scope_skipped").default(false).notNull(),
  subconScopeSkipped: boolean("subcon_scope_skipped").default(false).notNull(),
  setupUpdatedById: uuid("setup_updated_by_id").references(() => user.id, { onDelete: "restrict" }),
  lockedById: uuid("locked_by_id").references(() => user.id, { onDelete: "restrict" }),
  lockedAt: timestamp("locked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pr_project_id_idx").on(table.projectId),
  index("pr_supersedes_idx").on(table.supersedesProjectRapId),
  index("pr_locked_by_id_idx").on(table.lockedById),
  index("pr_setup_updated_by_id_idx").on(table.setupUpdatedById),
]);

export const projectRapRelations = relations(projectRap, ({ one, many }) => ({
  project: one(project, { fields: [projectRap.projectId], references: [project.id] }),
  supersedes: one(projectRap, { fields: [projectRap.supersedesProjectRapId], references: [projectRap.id], relationName: "rapRevision" }),
  revisions: many(projectRap, { relationName: "rapRevision" }),
  lockedBy: one(user, { fields: [projectRap.lockedById], references: [user.id] }),
  setupUpdatedBy: one(user, { fields: [projectRap.setupUpdatedById], references: [user.id], relationName: "rapSetupUpdater" }),
  items: many(projectRapItem),
  rabEstimates: many(rabEstimate),
}));

// ==========================================
// 14F. Item RAP Proyek (Project RAP Item)
// ==========================================
export const projectRapItem = pgTable("project_rap_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectRapId: uuid("project_rap_id").notNull().references(() => projectRap.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
  sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, { onDelete: "set null" }),
  area: varchar("area", { length: 150 }).notNull().default("Umum"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  requiredQuantity: numeric("required_quantity", { precision: 12, scale: 2 }).notNull(),
  bufferQuantity: numeric("buffer_quantity", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalQuantity: numeric("total_quantity", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  estimatedUnitCost: numeric("estimated_unit_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  estimatedTotalCost: numeric("estimated_total_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  suggestedClientUnitPrice: numeric("suggested_client_unit_price", { precision: 15, scale: 2 }).default("0.00").notNull(),
  source: varchar("source", { length: 50 }).notNull().default("PURCHASE"),
  status: varchar("status", { length: 50 }).notNull().default("PLANNED"),
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("pri_project_rap_id_idx").on(table.projectRapId),
  index("pri_material_id_idx").on(table.materialId),
  index("pri_source_library_item_id_idx").on(table.sourceLibraryItemId),
  index("pri_status_idx").on(table.status),
]);

export const projectRapItemRelations = relations(projectRapItem, ({ one, many }) => ({
  rap: one(projectRap, { fields: [projectRapItem.projectRapId], references: [projectRap.id] }),
  material: one(materialMaster, { fields: [projectRapItem.materialId], references: [materialMaster.id] }),
  sourceLibraryItem: one(itemPriceLibrary, { fields: [projectRapItem.sourceLibraryItemId], references: [itemPriceLibrary.id] }),
  stockMovements: many(stockMovement),
  projectCosts: many(projectCost),
  vendorBills: many(vendorBill),
  rabItems: many(rabEstimateItem),
}));

// ==========================================
// 14. Tagihan Vendor (Vendor Bill)
// ==========================================
export const vendorBill = pgTable("vendor_bill", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendor.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  projectBudgetItemId: uuid("project_budget_item_id").references(() => projectBudgetItem.id, { onDelete: "set null" }),
  projectBudgetCategoryId: uuid("project_budget_category_id").notNull().references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
  materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
  projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, { onDelete: "restrict" }),
  projectCategoryPlanItemId: uuid("project_category_plan_item_id").references(() => projectCategoryPlanItem.id, { onDelete: "restrict" }),
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
  index("vb_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
  index("vb_material_id_idx").on(table.materialId),
  index("vb_project_rap_item_id_idx").on(table.projectRapItemId),
  index("vb_project_category_plan_item_id_idx").on(table.projectCategoryPlanItemId),
]);

export const vendorBillRelations = relations(vendorBill, ({ one, many }) => ({
  vendor: one(vendor, { fields: [vendorBill.vendorId], references: [vendor.id] }),
  project: one(project, { fields: [vendorBill.projectId], references: [project.id] }),
  budgetItem: one(projectBudgetItem, { fields: [vendorBill.projectBudgetItemId], references: [projectBudgetItem.id] }),
  budgetCategory: one(projectBudgetCategory, { fields: [vendorBill.projectBudgetCategoryId], references: [projectBudgetCategory.id] }),
  material: one(materialMaster, { fields: [vendorBill.materialId], references: [materialMaster.id] }),
  rapItem: one(projectRapItem, { fields: [vendorBill.projectRapItemId], references: [projectRapItem.id] }),
  categoryPlanItem: one(projectCategoryPlanItem, { fields: [vendorBill.projectCategoryPlanItemId], references: [projectCategoryPlanItem.id] }),
  payments: many(vendorPayment),
  goodsReceipts: many(goodsReceipt),
}));

// ==========================================
// 14G. Stock Movement (Pergerakan Stock)
// ==========================================
export const stockMovement = pgTable("stock_movement", {
  id: uuid("id").primaryKey().defaultRandom(),
  materialId: uuid("material_id").notNull().references(() => materialMaster.id, { onDelete: "restrict" }),
  inventoryLocationId: uuid("inventory_location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "restrict" }),
  projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, { onDelete: "restrict" }),
  projectCostId: uuid("project_cost_id").references(() => projectCost.id, { onDelete: "restrict" }),
  vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "restrict" }),
  movementType: varchar("movement_type", { length: 50 }).notNull(),
  movementDirection: varchar("movement_direction", { length: 20 }).notNull().default("NEUTRAL"),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: uuid("reference_id"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
  note: text("note"),
  createdById: uuid("created_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sm_material_id_idx").on(table.materialId),
  index("sm_location_id_idx").on(table.inventoryLocationId),
  index("sm_project_id_idx").on(table.projectId),
  index("sm_project_rap_item_id_idx").on(table.projectRapItemId),
  index("sm_project_cost_id_idx").on(table.projectCostId),
  index("sm_vendor_bill_id_idx").on(table.vendorBillId),
  index("sm_created_by_id_idx").on(table.createdById),
  index("sm_type_idx").on(table.movementType),
  index("sm_reference_idx").on(table.referenceType, table.referenceId),
]);

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
  material: one(materialMaster, { fields: [stockMovement.materialId], references: [materialMaster.id] }),
  location: one(inventoryLocation, { fields: [stockMovement.inventoryLocationId], references: [inventoryLocation.id] }),
  project: one(project, { fields: [stockMovement.projectId], references: [project.id] }),
  rapItem: one(projectRapItem, { fields: [stockMovement.projectRapItemId], references: [projectRapItem.id] }),
  projectCost: one(projectCost, { fields: [stockMovement.projectCostId], references: [projectCost.id] }),
  vendorBill: one(vendorBill, { fields: [stockMovement.vendorBillId], references: [vendorBill.id] }),
  createdBy: one(user, { fields: [stockMovement.createdById], references: [user.id] }),
}));

export const inventoryOpeningBatch = pgTable("inventory_opening_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchNumber: varchar("batch_number", { length: 100 }).notNull().unique(),
  cutoverDate: timestamp("cutover_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("PENDING_APPROVAL"),
  note: text("note").notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  requestedById: uuid("requested_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  postedAt: timestamp("posted_at"),
  decisionReason: text("decision_reason"),
  rejectedReason: text("rejected_reason"),
  reversedById: uuid("reversed_by_id").references(() => user.id, { onDelete: "restrict" }),
  reversedAt: timestamp("reversed_at"),
  reversalReason: text("reversal_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("iob_status_idx").on(table.status),
  index("iob_requested_by_idx").on(table.requestedById),
]);

export const inventoryOpeningItem = pgTable("inventory_opening_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => inventoryOpeningBatch.id, { onDelete: "cascade" }),
  materialInventoryId: uuid("material_inventory_id").notNull().references(() => materialInventory.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, { onDelete: "set null" }),
  reversalStockMovementId: uuid("reversal_stock_movement_id").references(() => stockMovement.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ioi_batch_inventory_uidx").on(table.batchId, table.materialInventoryId),
  index("ioi_batch_idx").on(table.batchId),
]);

export const inventoryOpeningBatchRelations = relations(inventoryOpeningBatch, ({ one, many }) => ({
  requestedBy: one(user, { fields: [inventoryOpeningBatch.requestedById], references: [user.id], relationName: "openingRequestedBy" }),
  approvedBy: one(user, { fields: [inventoryOpeningBatch.approvedById], references: [user.id], relationName: "openingApprovedBy" }),
  reversedBy: one(user, { fields: [inventoryOpeningBatch.reversedById], references: [user.id], relationName: "openingReversedBy" }),
  items: many(inventoryOpeningItem),
}));

export const inventoryOpeningItemRelations = relations(inventoryOpeningItem, ({ one }) => ({
  batch: one(inventoryOpeningBatch, { fields: [inventoryOpeningItem.batchId], references: [inventoryOpeningBatch.id] }),
  inventory: one(materialInventory, { fields: [inventoryOpeningItem.materialInventoryId], references: [materialInventory.id] }),
  stockMovement: one(stockMovement, { fields: [inventoryOpeningItem.stockMovementId], references: [stockMovement.id], relationName: "openingMovement" }),
  reversalStockMovement: one(stockMovement, { fields: [inventoryOpeningItem.reversalStockMovementId], references: [stockMovement.id], relationName: "openingReversalMovement" }),
}));

export const stockTransferItem = pgTable("stock_transfer_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  stockTransferId: uuid("stock_transfer_id").notNull().references(() => stockTransfer.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materialMaster.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  outMovementId: uuid("out_movement_id").references(() => stockMovement.id, { onDelete: "restrict" }),
  inMovementId: uuid("in_movement_id").references(() => stockMovement.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("sti_transfer_idx").on(table.stockTransferId), index("sti_material_idx").on(table.materialId)]);

export const stockCountItem = pgTable("stock_count_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  stockCountId: uuid("stock_count_id").notNull().references(() => stockCount.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materialMaster.id, { onDelete: "restrict" }),
  systemQuantity: numeric("system_quantity", { precision: 12, scale: 2 }).notNull(),
  countedQuantity: numeric("counted_quantity", { precision: 12, scale: 2 }).notNull(),
  varianceQuantity: numeric("variance_quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("sci_count_material_uidx").on(table.stockCountId, table.materialId), index("sci_count_idx").on(table.stockCountId)]);

export const stockTransferRelations = relations(stockTransfer, ({ one, many }) => ({
  fromLocation: one(inventoryLocation, { fields: [stockTransfer.fromLocationId], references: [inventoryLocation.id], relationName: "transferFrom" }),
  toLocation: one(inventoryLocation, { fields: [stockTransfer.toLocationId], references: [inventoryLocation.id], relationName: "transferTo" }),
  createdBy: one(user, { fields: [stockTransfer.createdById], references: [user.id] }),
  items: many(stockTransferItem),
}));
export const stockTransferItemRelations = relations(stockTransferItem, ({ one }) => ({
  transfer: one(stockTransfer, { fields: [stockTransferItem.stockTransferId], references: [stockTransfer.id] }),
  material: one(materialMaster, { fields: [stockTransferItem.materialId], references: [materialMaster.id] }),
}));
export const stockCountRelations = relations(stockCount, ({ one, many }) => ({
  location: one(inventoryLocation, { fields: [stockCount.inventoryLocationId], references: [inventoryLocation.id] }),
  createdBy: one(user, { fields: [stockCount.createdById], references: [user.id], relationName: "stockCountCreator" }),
  approvedBy: one(user, { fields: [stockCount.approvedById], references: [user.id], relationName: "stockCountApprover" }),
  items: many(stockCountItem),
}));
export const stockCountItemRelations = relations(stockCountItem, ({ one }) => ({
  count: one(stockCount, { fields: [stockCountItem.stockCountId], references: [stockCount.id] }),
  material: one(materialMaster, { fields: [stockCountItem.materialId], references: [materialMaster.id] }),
}));

// ==========================================
// 14H. Goods Receipt (Physical Receipt)
// ==========================================
export const goodsReceipt = pgTable("goods_receipt", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "restrict" }),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  inventoryLocationId: uuid("inventory_location_id").notNull().references(() => inventoryLocation.id, { onDelete: "restrict" }),
  receiptNumber: varchar("receipt_number", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  receivedAt: timestamp("received_at").notNull(),
  note: text("note"),
  receivedById: uuid("received_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  reversalReason: text("reversal_reason"),
  reversalRequestedById: uuid("reversal_requested_by_id").references(() => user.id, { onDelete: "restrict" }),
  reversalRequestedAt: timestamp("reversal_requested_at"),
  reversedById: uuid("reversed_by_id").references(() => user.id, { onDelete: "restrict" }),
  reversedAt: timestamp("reversed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("gr_vendor_bill_id_idx").on(table.vendorBillId),
  index("gr_project_id_idx").on(table.projectId),
  index("gr_inventory_location_id_idx").on(table.inventoryLocationId),
  index("gr_status_idx").on(table.status),
]);

export const goodsReceiptItem = pgTable("goods_receipt_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  goodsReceiptId: uuid("goods_receipt_id").notNull().references(() => goodsReceipt.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materialMaster.id, { onDelete: "restrict" }),
  projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, { onDelete: "set null" }),
  stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, { onDelete: "set null" }),
  reversalStockMovementId: uuid("reversal_stock_movement_id").references(() => stockMovement.id, { onDelete: "set null" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("gri_goods_receipt_id_idx").on(table.goodsReceiptId),
  index("gri_material_id_idx").on(table.materialId),
  index("gri_project_rap_item_id_idx").on(table.projectRapItemId),
  index("gri_stock_movement_id_idx").on(table.stockMovementId),
]);

export const goodsReceiptRelations = relations(goodsReceipt, ({ one, many }) => ({
  vendorBill: one(vendorBill, { fields: [goodsReceipt.vendorBillId], references: [vendorBill.id] }),
  project: one(project, { fields: [goodsReceipt.projectId], references: [project.id] }),
  inventoryLocation: one(inventoryLocation, { fields: [goodsReceipt.inventoryLocationId], references: [inventoryLocation.id] }),
  receivedBy: one(user, { fields: [goodsReceipt.receivedById], references: [user.id] }),
  items: many(goodsReceiptItem),
}));

export const goodsReceiptItemRelations = relations(goodsReceiptItem, ({ one }) => ({
  receipt: one(goodsReceipt, { fields: [goodsReceiptItem.goodsReceiptId], references: [goodsReceipt.id] }),
  material: one(materialMaster, { fields: [goodsReceiptItem.materialId], references: [materialMaster.id] }),
  rapItem: one(projectRapItem, { fields: [goodsReceiptItem.projectRapItemId], references: [projectRapItem.id] }),
  stockMovement: one(stockMovement, { fields: [goodsReceiptItem.stockMovementId], references: [stockMovement.id] }),
}));

// ==========================================
// 14I. RAB Estimate Client-Facing
// ==========================================
export const rabEstimate = pgTable("rab_estimate", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
  sourceProjectRapId: uuid("source_project_rap_id").references(() => projectRap.id, { onDelete: "set null" }),
  supersedesRabEstimateId: uuid("supersedes_rab_estimate_id").references((): AnyPgColumn => rabEstimate.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  revision: integer("revision").default(1).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  clientNotes: text("client_notes"),
  approvedValue: numeric("approved_value", { precision: 15, scale: 2 }).default("0.00").notNull(),
  approvedAt: timestamp("approved_at"),
  voidReason: text("void_reason"),
  voidedAt: timestamp("voided_at"),
  voidedById: uuid("voided_by_id").references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("re_project_id_idx").on(table.projectId),
  index("re_source_project_rap_id_idx").on(table.sourceProjectRapId),
  index("re_supersedes_idx").on(table.supersedesRabEstimateId),
  index("re_status_idx").on(table.status),
  index("re_voided_by_id_idx").on(table.voidedById),
]);

export const rabEstimateRelations = relations(rabEstimate, ({ one, many }) => ({
  project: one(project, { fields: [rabEstimate.projectId], references: [project.id] }),
  sourceRap: one(projectRap, { fields: [rabEstimate.sourceProjectRapId], references: [projectRap.id] }),
  supersedes: one(rabEstimate, { fields: [rabEstimate.supersedesRabEstimateId], references: [rabEstimate.id], relationName: "rabRevision" }),
  revisions: many(rabEstimate, { relationName: "rabRevision" }),
  voidedBy: one(user, { fields: [rabEstimate.voidedById], references: [user.id], relationName: "rabVoidedBy" }),
  items: many(rabEstimateItem),
  bundles: many(rabEstimateBundle),
}));

// ==========================================
// 14J. RAB Named Bundle Client-Facing
// ==========================================
export const rabEstimateBundle = pgTable("rab_estimate_bundle", {
  id: uuid("id").primaryKey().defaultRandom(),
  rabEstimateId: uuid("rab_estimate_id").notNull().references(() => rabEstimate.id, { onDelete: "cascade" }),
  clientLabel: varchar("client_label", { length: 255 }).notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
  unit: varchar("unit", { length: 50 }).notNull().default("paket"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("reb_rab_estimate_id_idx").on(table.rabEstimateId),
]);

// ==========================================
// 14K. RAB Estimate Item Client-Facing
// ==========================================
export const rabEstimateItem = pgTable("rab_estimate_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  rabEstimateId: uuid("rab_estimate_id").notNull().references(() => rabEstimate.id, { onDelete: "cascade" }),
  bundleId: uuid("bundle_id").references(() => rabEstimateBundle.id, { onDelete: "set null" }),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("RAP_MATERIAL"),
  sourceProjectRapItemId: uuid("source_project_rap_item_id").references(() => projectRapItem.id, { onDelete: "set null" }),
  sourceProjectCategoryPlanItemId: uuid("source_project_category_plan_item_id").references(() => projectCategoryPlanItem.id, { onDelete: "set null" }),
  sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, { onDelete: "set null" }),
  sourceRevision: integer("source_revision"),
  sourceUpdatedAt: timestamp("source_updated_at"),
  clientLabel: varchar("client_label", { length: 255 }).notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  isBundle: boolean("is_bundle").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("rei_rab_estimate_id_idx").on(table.rabEstimateId),
  index("rei_bundle_id_idx").on(table.bundleId),
  index("rei_source_type_idx").on(table.sourceType),
  index("rei_source_project_rap_item_id_idx").on(table.sourceProjectRapItemId),
  index("rei_source_project_category_plan_item_id_idx").on(table.sourceProjectCategoryPlanItemId),
  index("rei_source_library_item_id_idx").on(table.sourceLibraryItemId),
]);

export const rabEstimateItemRelations = relations(rabEstimateItem, ({ one }) => ({
  estimate: one(rabEstimate, { fields: [rabEstimateItem.rabEstimateId], references: [rabEstimate.id] }),
  bundle: one(rabEstimateBundle, { fields: [rabEstimateItem.bundleId], references: [rabEstimateBundle.id] }),
  sourceRapItem: one(projectRapItem, { fields: [rabEstimateItem.sourceProjectRapItemId], references: [projectRapItem.id] }),
  sourceCategoryPlanItem: one(projectCategoryPlanItem, { fields: [rabEstimateItem.sourceProjectCategoryPlanItemId], references: [projectCategoryPlanItem.id] }),
  sourceLibraryItem: one(itemPriceLibrary, { fields: [rabEstimateItem.sourceLibraryItemId], references: [itemPriceLibrary.id] }),
}));

export const rabEstimateBundleRelations = relations(rabEstimateBundle, ({ one, many }) => ({
  estimate: one(rabEstimate, { fields: [rabEstimateBundle.rabEstimateId], references: [rabEstimate.id] }),
  items: many(rabEstimateItem),
}));

export const projectChangeOrder = pgTable("project_change_order", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "restrict" }),
  baseRabEstimateId: uuid("base_rab_estimate_id").notNull().references(() => rabEstimate.id, { onDelete: "restrict" }),
  revisedRabEstimateId: uuid("revised_rab_estimate_id").notNull().references(() => rabEstimate.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
  reason: text("reason").notNull(),
  scopeSummary: text("scope_summary").notNull(),
  previousContractValue: numeric("previous_contract_value", { precision: 15, scale: 2 }).notNull(),
  valueDelta: numeric("value_delta", { precision: 15, scale: 2 }).notNull(),
  revisedContractValue: numeric("revised_contract_value", { precision: 15, scale: 2 }).notNull(),
  clientConfirmedAt: timestamp("client_confirmed_at"),
  clientConfirmationReference: varchar("client_confirmation_reference", { length: 255 }),
  createdById: uuid("created_by_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("pco_revised_rab_uidx").on(table.revisedRabEstimateId),
  index("pco_project_id_idx").on(table.projectId),
  index("pco_base_rab_idx").on(table.baseRabEstimateId),
  index("pco_status_idx").on(table.status),
]);

export const projectChangeOrderRelations = relations(projectChangeOrder, ({ one }) => ({
  project: one(project, { fields: [projectChangeOrder.projectId], references: [project.id] }),
  baseRab: one(rabEstimate, { fields: [projectChangeOrder.baseRabEstimateId], references: [rabEstimate.id], relationName: "changeOrderBaseRab" }),
  revisedRab: one(rabEstimate, { fields: [projectChangeOrder.revisedRabEstimateId], references: [rabEstimate.id], relationName: "changeOrderRevisedRab" }),
  createdBy: one(user, { fields: [projectChangeOrder.createdById], references: [user.id], relationName: "changeOrderCreator" }),
  approvedBy: one(user, { fields: [projectChangeOrder.approvedById], references: [user.id], relationName: "changeOrderApprover" }),
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
  developerActorUserId: uuid("developer_actor_user_id").references(() => user.id, { onDelete: "set null" }),
}, (table) => [
  index("session_user_id_idx").on(table.userId),
  index("session_developer_actor_user_id_idx").on(table.developerActorUserId),
]);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
    relationName: "sessionUser",
  }),
  developerActor: one(user, {
    fields: [session.developerActorUserId],
    references: [user.id],
    relationName: "developerActor",
  }),
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
