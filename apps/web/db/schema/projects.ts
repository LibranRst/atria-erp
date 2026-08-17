import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { clientInvoice, projectCost, vendor, vendorBill } from "./finance";
import { goodsReceipt, itemPriceLibrary, materialMaster, stockMovement } from "./materials";

// ==========================================
// // 3. Klien (Client)
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
// // 4. Proyek (Project)
// ==========================================
export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "restrict" }),
    projectManagerId: uuid("project_manager_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
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
  },
  (table) => [
    index("project_client_id_idx").on(table.clientId),
    index("project_pm_id_idx").on(table.projectManagerId),
  ],
);

export const projectRelations = relations(project, ({ one, many }) => ({
  client: one(client, { fields: [project.clientId], references: [client.id] }),
  projectManager: one(user, {
    fields: [project.projectManagerId],
    references: [user.id],
    relationName: "projectManager",
  }),
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
// // 4A. Transient Form Draft
// ==========================================
export const formDraft = pgTable(
  "form_draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    index("form_draft_owner_status_idx").on(table.ownerUserId, table.status),
    index("form_draft_project_idx").on(table.projectId),
    index("form_draft_expiry_idx").on(table.status, table.expiresAt),
  ],
);

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
// // 5. RAB Header (Project Budget)
// ==========================================
export const projectBudget = pgTable(
  "project_budget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull(), // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
    approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("pb_project_id_idx").on(table.projectId)],
);

export const projectBudgetRelations = relations(projectBudget, ({ one, many }) => ({
  project: one(project, { fields: [projectBudget.projectId], references: [project.id] }),
  approvedBy: one(user, {
    fields: [projectBudget.approvedById],
    references: [user.id],
    relationName: "budgetApprover",
  }),
  items: many(projectBudgetItem),
  canonicalBudgets: many(projectBudgets),
}));

// ==========================================
// // 6. Kategori Biaya (Project Cost Category)
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
// // 7. Detail RAB BoQ (Project Budget Item)
// ==========================================
export const projectBudgetItem = pgTable(
  "project_budget_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudget.id, { onDelete: "cascade" }),
    costCategoryId: uuid("cost_category_id")
      .notNull()
      .references(() => projectCostCategory.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    budgetCategory: varchar("budget_category", { length: 255 }).notNull().default("Umum"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
    unit: varchar("unit", { length: 50 }).notNull().default("m2"),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull().default("0.00"),
    allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
    actualSpent: numeric("actual_spent", { precision: 15, scale: 2 }).default("0.00").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pbi_project_budget_id_idx").on(table.projectBudgetId),
    index("pbi_cost_category_id_idx").on(table.costCategoryId),
  ],
);

export const projectBudgetItemRelations = relations(projectBudgetItem, ({ one, many }) => ({
  budget: one(projectBudget, {
    fields: [projectBudgetItem.projectBudgetId],
    references: [projectBudget.id],
  }),
  costCategory: one(projectCostCategory, {
    fields: [projectBudgetItem.costCategoryId],
    references: [projectCostCategory.id],
  }),
  canonicalCategories: many(projectBudgetCategory),
  vendorBills: many(vendorBill),
  projectCosts: many(projectCost),
}));

// ==========================================
// // 7A. Canonical Expense Category
// ==========================================
export const expenseCategory = pgTable(
  "expense_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    defaultRatio: numeric("default_ratio", { precision: 8, scale: 6 })
      .notNull()
      .default("0.000000"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("ec_code_idx").on(table.code)],
);

export const expenseCategoryRelations = relations(expenseCategory, ({ many }) => ({
  budgetAllocationCategories: many(budgetAllocationSettingCategory),
  budgetCategories: many(projectBudgetCategory),
  projectExpenses: many(projectExpenses),
  categoryPlanItems: many(projectCategoryPlanItem),
  itemLibraryItems: many(itemPriceLibrary),
}));

// ==========================================
// // 7B. Budget Allocation Settings
// ==========================================
export const budgetAllocationSetting = pgTable(
  "budget_allocation_setting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("ACTIVE"),
    budgetCapRatio: numeric("budget_cap_ratio", { precision: 8, scale: 6 })
      .notNull()
      .default("0.900000"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bas_status_idx").on(table.status),
    index("bas_is_active_idx").on(table.isActive),
    index("bas_updated_by_id_idx").on(table.updatedById),
  ],
);

export const budgetAllocationSettingRelations = relations(
  budgetAllocationSetting,
  ({ one, many }) => ({
    updatedBy: one(user, {
      fields: [budgetAllocationSetting.updatedById],
      references: [user.id],
      relationName: "budgetAllocationSettingUpdater",
    }),
    categories: many(budgetAllocationSettingCategory),
  }),
);

export const budgetAllocationSettingCategory = pgTable(
  "budget_allocation_setting_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetAllocationSettingId: uuid("budget_allocation_setting_id")
      .notNull()
      .references(() => budgetAllocationSetting.id, { onDelete: "cascade" }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    ratioPercentage: numeric("ratio_percentage", { precision: 8, scale: 6 })
      .notNull()
      .default("0.000000"),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("basc_setting_category_uidx").on(
      table.budgetAllocationSettingId,
      table.expenseCategoryId,
    ),
    index("basc_setting_id_idx").on(table.budgetAllocationSettingId),
    index("basc_expense_category_id_idx").on(table.expenseCategoryId),
    index("basc_is_enabled_idx").on(table.isEnabled),
  ],
);

export const budgetAllocationSettingCategoryRelations = relations(
  budgetAllocationSettingCategory,
  ({ one }) => ({
    setting: one(budgetAllocationSetting, {
      fields: [budgetAllocationSettingCategory.budgetAllocationSettingId],
      references: [budgetAllocationSetting.id],
    }),
    expenseCategory: one(expenseCategory, {
      fields: [budgetAllocationSettingCategory.expenseCategoryId],
      references: [expenseCategory.id],
    }),
  }),
);

// ==========================================
// // 7C. Canonical Project Budget
// ==========================================
export const projectBudgets = pgTable(
  "project_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    legacyProjectBudgetId: uuid("legacy_project_budget_id").references(() => projectBudget.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull(),
    approvedRabValue: numeric("approved_rab_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    internalBudget: numeric("internal_budget", { precision: 15, scale: 2 }).notNull(),
    budgetCapRatio: numeric("budget_cap_ratio", { precision: 8, scale: 6 })
      .notNull()
      .default("0.900000"),
    targetGrossAmount: numeric("target_gross_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    projectProgressPercentage: numeric("project_progress_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_budgets_project_id_uidx").on(table.projectId),
    index("project_budgets_status_idx").on(table.status),
    index("project_budgets_legacy_idx").on(table.legacyProjectBudgetId),
  ],
);

export const projectBudgetsRelations = relations(projectBudgets, ({ one, many }) => ({
  project: one(project, { fields: [projectBudgets.projectId], references: [project.id] }),
  legacyBudget: one(projectBudget, {
    fields: [projectBudgets.legacyProjectBudgetId],
    references: [projectBudget.id],
  }),
  approvedBy: one(user, {
    fields: [projectBudgets.approvedById],
    references: [user.id],
    relationName: "canonicalBudgetApprover",
  }),
  categories: many(projectBudgetCategory),
  categoryPlanItems: many(projectCategoryPlanItem),
  expenses: many(projectExpenses),
  profitabilitySnapshots: many(projectProfitabilitySnapshot),
}));

// ==========================================
// // 7C. Canonical Project Budget Category
// ==========================================
export const projectBudgetCategory = pgTable(
  "project_budget_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudgets.id, { onDelete: "cascade" }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    legacyProjectBudgetItemId: uuid("legacy_project_budget_item_id").references(
      () => projectBudgetItem.id,
      { onDelete: "set null" },
    ),
    ratioPercentage: numeric("ratio_percentage", { precision: 8, scale: 6 })
      .notNull()
      .default("0.000000"),
    allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    pendingAmount: numeric("pending_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    actualAmount: numeric("actual_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    usedPercentage: numeric("used_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    status: varchar("status", { length: 50 }).notNull().default("SAFE"),
    isManualOverride: boolean("is_manual_override").default(false).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pbc_budget_category_uidx").on(table.projectBudgetId, table.expenseCategoryId),
    index("pbc_project_budget_id_idx").on(table.projectBudgetId),
    index("pbc_expense_category_id_idx").on(table.expenseCategoryId),
    index("pbc_legacy_budget_item_idx").on(table.legacyProjectBudgetItemId),
    index("pbc_status_idx").on(table.status),
  ],
);

export const projectBudgetCategoryRelations = relations(projectBudgetCategory, ({ one, many }) => ({
  budget: one(projectBudgets, {
    fields: [projectBudgetCategory.projectBudgetId],
    references: [projectBudgets.id],
  }),
  expenseCategory: one(expenseCategory, {
    fields: [projectBudgetCategory.expenseCategoryId],
    references: [expenseCategory.id],
  }),
  legacyBudgetItem: one(projectBudgetItem, {
    fields: [projectBudgetCategory.legacyProjectBudgetItemId],
    references: [projectBudgetItem.id],
  }),
  categoryPlanItems: many(projectCategoryPlanItem),
  projectExpenses: many(projectExpenses),
  vendorBills: many(vendorBill),
  projectCosts: many(projectCost),
}));

// ==========================================
// // 7D. Non-Material Category Plan Item
// ==========================================
export const projectCategoryPlanItem = pgTable(
  "project_category_plan_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudgets.id, { onDelete: "cascade" }),
    projectBudgetCategoryId: uuid("project_budget_category_id")
      .notNull()
      .references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "restrict" }),
    sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, {
      onDelete: "set null",
    }),
    supersedesProjectCategoryPlanItemId: uuid(
      "supersedes_project_category_plan_item_id",
    ).references((): AnyPgColumn => projectCategoryPlanItem.id, { onDelete: "set null" }),
    revision: integer("revision").notNull().default(1),
    name: varchar("name", { length: 255 }).notNull(),
    scopeDescription: text("scope_description"),
    area: varchar("area", { length: 150 }).notNull().default("Umum"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1.00"),
    unit: varchar("unit", { length: 50 }).notNull().default("ls"),
    estimatedUnitCost: numeric("estimated_unit_cost", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    estimatedTotalCost: numeric("estimated_total_cost", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    suggestedClientUnitPrice: numeric("suggested_client_unit_price", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    lockedById: uuid("locked_by_id").references(() => user.id, { onDelete: "restrict" }),
    lockedAt: timestamp("locked_at"),
    internalNote: text("internal_note"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pcpi_project_id_idx").on(table.projectId),
    index("pcpi_project_budget_id_idx").on(table.projectBudgetId),
    index("pcpi_project_budget_category_id_idx").on(table.projectBudgetCategoryId),
    index("pcpi_expense_category_id_idx").on(table.expenseCategoryId),
    index("pcpi_vendor_id_idx").on(table.vendorId),
    index("pcpi_source_library_item_id_idx").on(table.sourceLibraryItemId),
    index("pcpi_supersedes_idx").on(table.supersedesProjectCategoryPlanItemId),
    index("pcpi_status_idx").on(table.status),
  ],
);

export const projectCategoryPlanItemRelations = relations(
  projectCategoryPlanItem,
  ({ one, many }) => ({
    project: one(project, {
      fields: [projectCategoryPlanItem.projectId],
      references: [project.id],
    }),
    budget: one(projectBudgets, {
      fields: [projectCategoryPlanItem.projectBudgetId],
      references: [projectBudgets.id],
    }),
    budgetCategory: one(projectBudgetCategory, {
      fields: [projectCategoryPlanItem.projectBudgetCategoryId],
      references: [projectBudgetCategory.id],
    }),
    expenseCategory: one(expenseCategory, {
      fields: [projectCategoryPlanItem.expenseCategoryId],
      references: [expenseCategory.id],
    }),
    vendor: one(vendor, { fields: [projectCategoryPlanItem.vendorId], references: [vendor.id] }),
    sourceLibraryItem: one(itemPriceLibrary, {
      fields: [projectCategoryPlanItem.sourceLibraryItemId],
      references: [itemPriceLibrary.id],
    }),
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
  }),
);

// ==========================================
// // 7E. Canonical Project Expense
// ==========================================
export const projectExpenses = pgTable(
  "project_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudgets.id, { onDelete: "restrict" }),
    projectBudgetCategoryId: uuid("project_budget_category_id")
      .notNull()
      .references(() => projectBudgetCategory.id, { onDelete: "restrict" }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    legacyProjectCostId: uuid("legacy_project_cost_id").references(() => projectCost.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendor.id, { onDelete: "restrict" }),
    vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "set null" }),
    materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
    projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "restrict",
    }),
    projectCategoryPlanItemId: uuid("project_category_plan_item_id").references(
      () => projectCategoryPlanItem.id,
      { onDelete: "restrict" },
    ),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, {
      onDelete: "set null",
    }),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
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
  },
  (table) => [
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
  ],
);

export const projectExpensesRelations = relations(projectExpenses, ({ one }) => ({
  project: one(project, { fields: [projectExpenses.projectId], references: [project.id] }),
  budget: one(projectBudgets, {
    fields: [projectExpenses.projectBudgetId],
    references: [projectBudgets.id],
  }),
  budgetCategory: one(projectBudgetCategory, {
    fields: [projectExpenses.projectBudgetCategoryId],
    references: [projectBudgetCategory.id],
  }),
  expenseCategory: one(expenseCategory, {
    fields: [projectExpenses.expenseCategoryId],
    references: [expenseCategory.id],
  }),
  legacyProjectCost: one(projectCost, {
    fields: [projectExpenses.legacyProjectCostId],
    references: [projectCost.id],
  }),
  vendor: one(vendor, { fields: [projectExpenses.vendorId], references: [vendor.id] }),
  vendorBill: one(vendorBill, {
    fields: [projectExpenses.vendorBillId],
    references: [vendorBill.id],
  }),
  material: one(materialMaster, {
    fields: [projectExpenses.materialId],
    references: [materialMaster.id],
  }),
  rapItem: one(projectRapItem, {
    fields: [projectExpenses.projectRapItemId],
    references: [projectRapItem.id],
  }),
  categoryPlanItem: one(projectCategoryPlanItem, {
    fields: [projectExpenses.projectCategoryPlanItemId],
    references: [projectCategoryPlanItem.id],
  }),
  stockMovement: one(stockMovement, {
    fields: [projectExpenses.stockMovementId],
    references: [stockMovement.id],
  }),
  requestedBy: one(user, {
    fields: [projectExpenses.requestedById],
    references: [user.id],
    relationName: "canonicalExpenseRequester",
  }),
}));

// ==========================================
// // 7F. Project Profitability Snapshot
// ==========================================
export const projectProfitabilitySnapshot = pgTable(
  "project_profitability_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudgets.id, { onDelete: "cascade" }),
    contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull().default("0.00"),
    approvedRabValue: numeric("approved_rab_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    internalBudget: numeric("internal_budget", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }).notNull().default("0.00"),
    remainingBudget: numeric("remaining_budget", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    budgetUsedPercentage: numeric("budget_used_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    targetGrossAmount: numeric("target_gross_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    projectedFinalCost: numeric("projected_final_cost", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    projectedMarginAmount: numeric("projected_margin_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    projectedMarginPercentage: numeric("projected_margin_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    realizedMarginAmount: numeric("realized_margin_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    realizedMarginPercentage: numeric("realized_margin_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    cashPosition: numeric("cash_position", { precision: 15, scale: 2 }).notNull().default("0.00"),
    snapshotType: varchar("snapshot_type", { length: 50 }).notNull().default("PERIODIC"),
    materialBudget: numeric("material_budget", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    materialActual: numeric("material_actual", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    materialRemaining: numeric("material_remaining", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    materialUsedPercentage: numeric("material_used_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    materialStockValueApplied: numeric("material_stock_value_applied", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    materialShortageValue: numeric("material_shortage_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    leftoverStockValue: numeric("leftover_stock_value", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    riskStatus: varchar("risk_status", { length: 50 }).notNull().default("SAFE"),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pps_project_id_idx").on(table.projectId),
    index("pps_project_budget_id_idx").on(table.projectBudgetId),
    index("pps_risk_status_idx").on(table.riskStatus),
    index("pps_snapshot_at_idx").on(table.snapshotAt),
    index("pps_snapshot_type_idx").on(table.snapshotType),
  ],
);

export const projectProfitabilitySnapshotRelations = relations(
  projectProfitabilitySnapshot,
  ({ one }) => ({
    project: one(project, {
      fields: [projectProfitabilitySnapshot.projectId],
      references: [project.id],
    }),
    budget: one(projectBudgets, {
      fields: [projectProfitabilitySnapshot.projectBudgetId],
      references: [projectBudgets.id],
    }),
  }),
);

// ==========================================
// // 14A. Kategori Material (Material Category)
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
// // 14F. RAP Proyek (Internal Project RAP)
// ==========================================
export const projectRap = pgTable(
  "project_rap",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    supersedesProjectRapId: uuid("supersedes_project_rap_id").references(
      (): AnyPgColumn => projectRap.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    revision: integer("revision").default(1).notNull(),
    setupStage: varchar("setup_stage", { length: 50 }).default("MATERIAL").notNull(),
    tukangScopeSkipped: boolean("tukang_scope_skipped").default(false).notNull(),
    subconScopeSkipped: boolean("subcon_scope_skipped").default(false).notNull(),
    setupUpdatedById: uuid("setup_updated_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    lockedById: uuid("locked_by_id").references(() => user.id, { onDelete: "restrict" }),
    lockedAt: timestamp("locked_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pr_project_id_idx").on(table.projectId),
    index("pr_supersedes_idx").on(table.supersedesProjectRapId),
    index("pr_locked_by_id_idx").on(table.lockedById),
    index("pr_setup_updated_by_id_idx").on(table.setupUpdatedById),
  ],
);

export const projectRapRelations = relations(projectRap, ({ one, many }) => ({
  project: one(project, { fields: [projectRap.projectId], references: [project.id] }),
  supersedes: one(projectRap, {
    fields: [projectRap.supersedesProjectRapId],
    references: [projectRap.id],
    relationName: "rapRevision",
  }),
  revisions: many(projectRap, { relationName: "rapRevision" }),
  lockedBy: one(user, { fields: [projectRap.lockedById], references: [user.id] }),
  setupUpdatedBy: one(user, {
    fields: [projectRap.setupUpdatedById],
    references: [user.id],
    relationName: "rapSetupUpdater",
  }),
  items: many(projectRapItem),
  rabEstimates: many(rabEstimate),
}));

// ==========================================
// // 14F. Item RAP Proyek (Project RAP Item)
// ==========================================
export const projectRapItem = pgTable(
  "project_rap_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectRapId: uuid("project_rap_id")
      .notNull()
      .references(() => projectRap.id, { onDelete: "cascade" }),
    materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "restrict" }),
    sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, {
      onDelete: "set null",
    }),
    area: varchar("area", { length: 150 }).notNull().default("Umum"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    requiredQuantity: numeric("required_quantity", { precision: 12, scale: 2 }).notNull(),
    bufferQuantity: numeric("buffer_quantity", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),
    totalQuantity: numeric("total_quantity", { precision: 12, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    estimatedUnitCost: numeric("estimated_unit_cost", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    estimatedTotalCost: numeric("estimated_total_cost", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    suggestedClientUnitPrice: numeric("suggested_client_unit_price", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    source: varchar("source", { length: 50 }).notNull().default("PURCHASE"),
    status: varchar("status", { length: 50 }).notNull().default("PLANNED"),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pri_project_rap_id_idx").on(table.projectRapId),
    index("pri_material_id_idx").on(table.materialId),
    index("pri_source_library_item_id_idx").on(table.sourceLibraryItemId),
    index("pri_status_idx").on(table.status),
  ],
);

export const projectRapItemRelations = relations(projectRapItem, ({ one, many }) => ({
  rap: one(projectRap, { fields: [projectRapItem.projectRapId], references: [projectRap.id] }),
  material: one(materialMaster, {
    fields: [projectRapItem.materialId],
    references: [materialMaster.id],
  }),
  sourceLibraryItem: one(itemPriceLibrary, {
    fields: [projectRapItem.sourceLibraryItemId],
    references: [itemPriceLibrary.id],
  }),
  stockMovements: many(stockMovement),
  projectCosts: many(projectCost),
  vendorBills: many(vendorBill),
  rabItems: many(rabEstimateItem),
}));

// ==========================================
// // 14I. RAB Estimate Client-Facing
// ==========================================
export const rabEstimate = pgTable(
  "rab_estimate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceProjectRapId: uuid("source_project_rap_id").references(() => projectRap.id, {
      onDelete: "set null",
    }),
    supersedesRabEstimateId: uuid("supersedes_rab_estimate_id").references(
      (): AnyPgColumn => rabEstimate.id,
      { onDelete: "set null" },
    ),
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
  },
  (table) => [
    index("re_project_id_idx").on(table.projectId),
    index("re_source_project_rap_id_idx").on(table.sourceProjectRapId),
    index("re_supersedes_idx").on(table.supersedesRabEstimateId),
    index("re_status_idx").on(table.status),
    index("re_voided_by_id_idx").on(table.voidedById),
  ],
);

export const rabEstimateRelations = relations(rabEstimate, ({ one, many }) => ({
  project: one(project, { fields: [rabEstimate.projectId], references: [project.id] }),
  sourceRap: one(projectRap, {
    fields: [rabEstimate.sourceProjectRapId],
    references: [projectRap.id],
  }),
  supersedes: one(rabEstimate, {
    fields: [rabEstimate.supersedesRabEstimateId],
    references: [rabEstimate.id],
    relationName: "rabRevision",
  }),
  revisions: many(rabEstimate, { relationName: "rabRevision" }),
  voidedBy: one(user, {
    fields: [rabEstimate.voidedById],
    references: [user.id],
    relationName: "rabVoidedBy",
  }),
  items: many(rabEstimateItem),
  bundles: many(rabEstimateBundle),
}));

// ==========================================
// // 14J. RAB Named Bundle Client-Facing
// ==========================================
export const rabEstimateBundle = pgTable(
  "rab_estimate_bundle",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rabEstimateId: uuid("rab_estimate_id")
      .notNull()
      .references(() => rabEstimate.id, { onDelete: "cascade" }),
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
  },
  (table) => [index("reb_rab_estimate_id_idx").on(table.rabEstimateId)],
);

// ==========================================
// // 14K. RAB Estimate Item Client-Facing
// ==========================================
export const rabEstimateItem = pgTable(
  "rab_estimate_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rabEstimateId: uuid("rab_estimate_id")
      .notNull()
      .references(() => rabEstimate.id, { onDelete: "cascade" }),
    bundleId: uuid("bundle_id").references(() => rabEstimateBundle.id, { onDelete: "set null" }),
    sourceType: varchar("source_type", { length: 50 }).notNull().default("RAP_MATERIAL"),
    sourceProjectRapItemId: uuid("source_project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "set null",
    }),
    sourceProjectCategoryPlanItemId: uuid("source_project_category_plan_item_id").references(
      () => projectCategoryPlanItem.id,
      { onDelete: "set null" },
    ),
    sourceLibraryItemId: uuid("source_library_item_id").references(() => itemPriceLibrary.id, {
      onDelete: "set null",
    }),
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
  },
  (table) => [
    index("rei_rab_estimate_id_idx").on(table.rabEstimateId),
    index("rei_bundle_id_idx").on(table.bundleId),
    index("rei_source_type_idx").on(table.sourceType),
    index("rei_source_project_rap_item_id_idx").on(table.sourceProjectRapItemId),
    index("rei_source_project_category_plan_item_id_idx").on(table.sourceProjectCategoryPlanItemId),
    index("rei_source_library_item_id_idx").on(table.sourceLibraryItemId),
  ],
);

export const rabEstimateItemRelations = relations(rabEstimateItem, ({ one }) => ({
  estimate: one(rabEstimate, {
    fields: [rabEstimateItem.rabEstimateId],
    references: [rabEstimate.id],
  }),
  bundle: one(rabEstimateBundle, {
    fields: [rabEstimateItem.bundleId],
    references: [rabEstimateBundle.id],
  }),
  sourceRapItem: one(projectRapItem, {
    fields: [rabEstimateItem.sourceProjectRapItemId],
    references: [projectRapItem.id],
  }),
  sourceCategoryPlanItem: one(projectCategoryPlanItem, {
    fields: [rabEstimateItem.sourceProjectCategoryPlanItemId],
    references: [projectCategoryPlanItem.id],
  }),
  sourceLibraryItem: one(itemPriceLibrary, {
    fields: [rabEstimateItem.sourceLibraryItemId],
    references: [itemPriceLibrary.id],
  }),
}));

export const rabEstimateBundleRelations = relations(rabEstimateBundle, ({ one, many }) => ({
  estimate: one(rabEstimate, {
    fields: [rabEstimateBundle.rabEstimateId],
    references: [rabEstimate.id],
  }),
  items: many(rabEstimateItem),
}));

export const projectChangeOrder = pgTable(
  "project_change_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    baseRabEstimateId: uuid("base_rab_estimate_id")
      .notNull()
      .references(() => rabEstimate.id, { onDelete: "restrict" }),
    revisedRabEstimateId: uuid("revised_rab_estimate_id")
      .notNull()
      .references(() => rabEstimate.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    reason: text("reason").notNull(),
    scopeSummary: text("scope_summary").notNull(),
    previousContractValue: numeric("previous_contract_value", {
      precision: 15,
      scale: 2,
    }).notNull(),
    valueDelta: numeric("value_delta", { precision: 15, scale: 2 }).notNull(),
    revisedContractValue: numeric("revised_contract_value", { precision: 15, scale: 2 }).notNull(),
    clientConfirmedAt: timestamp("client_confirmed_at"),
    clientConfirmationReference: varchar("client_confirmation_reference", { length: 255 }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pco_revised_rab_uidx").on(table.revisedRabEstimateId),
    index("pco_project_id_idx").on(table.projectId),
    index("pco_base_rab_idx").on(table.baseRabEstimateId),
    index("pco_status_idx").on(table.status),
  ],
);

export const projectChangeOrderRelations = relations(projectChangeOrder, ({ one }) => ({
  project: one(project, { fields: [projectChangeOrder.projectId], references: [project.id] }),
  baseRab: one(rabEstimate, {
    fields: [projectChangeOrder.baseRabEstimateId],
    references: [rabEstimate.id],
    relationName: "changeOrderBaseRab",
  }),
  revisedRab: one(rabEstimate, {
    fields: [projectChangeOrder.revisedRabEstimateId],
    references: [rabEstimate.id],
    relationName: "changeOrderRevisedRab",
  }),
  createdBy: one(user, {
    fields: [projectChangeOrder.createdById],
    references: [user.id],
    relationName: "changeOrderCreator",
  }),
  approvedBy: one(user, {
    fields: [projectChangeOrder.approvedById],
    references: [user.id],
    relationName: "changeOrderApprover",
  }),
}));
