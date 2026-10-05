import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenant";
import { DEKORIA_TENANT_ID } from "./tenant-constants";
import { user } from "./auth";
import { expenseCategory, materialCategory, project, projectRapItem } from "./projects";
import { projectCost, vendor, vendorBill } from "./finance";

// ==========================================
// // 14B. Master Material (Material Master)
// ==========================================
export const materialMaster = pgTable(
  "material_master",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => materialCategory.id, { onDelete: "restrict" }),
    defaultVendorId: uuid("default_vendor_id").references(() => vendor.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    specification: text("specification"),
    brand: varchar("brand", { length: 100 }),
    code: varchar("code", { length: 100 }),
    color: varchar("color", { length: 100 }),
    unit: varchar("unit", { length: 50 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("mm_category_id_idx").on(table.categoryId),
    index("mm_default_vendor_id_idx").on(table.defaultVendorId),
    index("mm_name_idx").on(table.name),
  ],
);

export const materialMasterRelations = relations(materialMaster, ({ one, many }) => ({
  category: one(materialCategory, {
    fields: [materialMaster.categoryId],
    references: [materialCategory.id],
  }),
  defaultVendor: one(vendor, { fields: [materialMaster.defaultVendorId], references: [vendor.id] }),
  inventory: many(materialInventory),
  itemLibraryItems: many(itemPriceLibrary),
  rapItems: many(projectRapItem),
  stockMovements: many(stockMovement),
  projectCosts: many(projectCost),
  vendorBills: many(vendorBill),
}));

// ==========================================
// // 14C. Lokasi Inventory (Inventory Location)
// ==========================================
export const inventoryLocation = pgTable(
  "inventory_location",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("il_tenant_name_uidx").on(table.tenantId, table.name),
    index("il_tenant_id_idx").on(table.tenantId),
  ],
);

export const inventoryLocationRelations = relations(inventoryLocation, ({ many }) => ({
  inventory: many(materialInventory),
  stockMovements: many(stockMovement),
}));

// ==========================================
// // 14D. Inventory Material (Material Inventory)
// ==========================================
export const materialInventory = pgTable(
  "material_inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialMaster.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    currentStock: numeric("current_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
    reservedStock: numeric("reserved_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
    minimumStock: numeric("minimum_stock", { precision: 12, scale: 2 }).default("0.00").notNull(),
    averageCost: numeric("average_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
    lastPurchasePrice: numeric("last_purchase_price", { precision: 15, scale: 2 })
      .default("0.00")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("mi_material_location_uidx").on(table.materialId, table.locationId),
    index("mi_material_id_idx").on(table.materialId),
    index("mi_location_id_idx").on(table.locationId),
  ],
);

export const materialInventoryRelations = relations(materialInventory, ({ one }) => ({
  material: one(materialMaster, {
    fields: [materialInventory.materialId],
    references: [materialMaster.id],
  }),
  location: one(inventoryLocation, {
    fields: [materialInventory.locationId],
    references: [inventoryLocation.id],
  }),
}));

export const stockTransfer = pgTable(
  "stock_transfer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    transferNumber: varchar("transfer_number", { length: 100 }).notNull(),
    fromLocationId: uuid("from_location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    toLocationId: uuid("to_location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 }).notNull().default("POSTED"),
    transferredAt: timestamp("transferred_at").notNull(),
    note: text("note").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("st_from_location_idx").on(table.fromLocationId),
    index("st_to_location_idx").on(table.toLocationId),
    uniqueIndex("st_tenant_transfer_number_uidx").on(table.tenantId, table.transferNumber),
    index("st_tenant_id_idx").on(table.tenantId),
  ],
);

export const stockCount = pgTable(
  "stock_count",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    countNumber: varchar("count_number", { length: 100 }).notNull(),
    inventoryLocationId: uuid("inventory_location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    countedAt: timestamp("counted_at").notNull(),
    note: text("note"),
    rejectionReason: text("rejection_reason"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at"),
    approvedById: uuid("approved_by_id").references(() => user.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sc_location_idx").on(table.inventoryLocationId),
    index("sc_status_idx").on(table.status),
    uniqueIndex("sc_tenant_count_number_uidx").on(table.tenantId, table.countNumber),
    index("sc_tenant_id_idx").on(table.tenantId),
  ],
);

// ==========================================
// // 14E. Item / Price Library Settings
// ==========================================
export const itemPriceLibrary = pgTable(
  "item_price_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    expenseCategoryId: uuid("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    materialId: uuid("material_id").references(() => materialMaster.id, { onDelete: "set null" }),
    defaultVendorId: uuid("default_vendor_id").references(() => vendor.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 100 }),
    itemType: varchar("item_type", { length: 50 }).notNull().default("CLIENT_LINE"),
    itemCategory: varchar("item_category", { length: 120 }).notNull().default("General"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 50 }).notNull(),
    defaultClientPrice: numeric("default_client_price", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    defaultInternalCost: numeric("default_internal_cost", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    pricingMode: varchar("pricing_mode", { length: 50 }).notNull().default("MARGIN_BASED"),
    targetGrossPercentage: numeric("target_gross_percentage", { precision: 8, scale: 4 })
      .notNull()
      .default("0.0000"),
    priceSourceType: varchar("price_source_type", { length: 50 })
      .notNull()
      .default("COST_BREAKDOWN"),
    sourceNote: text("source_note"),
    effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ipl_tenant_code_uidx").on(table.tenantId, table.code),
    index("ipl_expense_category_id_idx").on(table.expenseCategoryId),
    index("ipl_material_id_idx").on(table.materialId),
    index("ipl_default_vendor_id_idx").on(table.defaultVendorId),
    index("ipl_item_type_idx").on(table.itemType),
    index("ipl_item_category_idx").on(table.itemCategory),
    index("ipl_is_active_idx").on(table.isActive),
    index("ipl_updated_by_id_idx").on(table.updatedById),
  ],
);

export const itemPriceLibraryRelations = relations(itemPriceLibrary, ({ one, many }) => ({
  expenseCategory: one(expenseCategory, {
    fields: [itemPriceLibrary.expenseCategoryId],
    references: [expenseCategory.id],
  }),
  material: one(materialMaster, {
    fields: [itemPriceLibrary.materialId],
    references: [materialMaster.id],
  }),
  defaultVendor: one(vendor, {
    fields: [itemPriceLibrary.defaultVendorId],
    references: [vendor.id],
  }),
  costComponents: many(itemPriceLibraryCostComponent),
  updatedBy: one(user, {
    fields: [itemPriceLibrary.updatedById],
    references: [user.id],
    relationName: "itemPriceLibraryUpdater",
  }),
}));

export const itemPriceLibraryCostComponent = pgTable(
  "item_price_library_cost_component",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    itemPriceLibraryId: uuid("item_price_library_id")
      .notNull()
      .references(() => itemPriceLibrary.id, { onDelete: "cascade" }),
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
  },
  (table) => [
    index("iplcc_library_item_id_idx").on(table.itemPriceLibraryId),
    index("iplcc_vendor_id_idx").on(table.vendorId),
    index("iplcc_component_type_idx").on(table.componentType),
  ],
);

export const itemPriceLibraryCostComponentRelations = relations(
  itemPriceLibraryCostComponent,
  ({ one }) => ({
    libraryItem: one(itemPriceLibrary, {
      fields: [itemPriceLibraryCostComponent.itemPriceLibraryId],
      references: [itemPriceLibrary.id],
    }),
    vendor: one(vendor, {
      fields: [itemPriceLibraryCostComponent.vendorId],
      references: [vendor.id],
    }),
  }),
);

// ==========================================
// // 14G. Stock Movement (Pergerakan Stock)
// ==========================================
export const stockMovement = pgTable(
  "stock_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialMaster.id, { onDelete: "restrict" }),
    inventoryLocationId: uuid("inventory_location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "restrict" }),
    projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "restrict",
    }),
    projectCostId: uuid("project_cost_id").references(() => projectCost.id, {
      onDelete: "restrict",
    }),
    vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "restrict" }),
    movementType: varchar("movement_type", { length: 50 }).notNull(),
    movementDirection: varchar("movement_direction", { length: 20 }).notNull().default("NEUTRAL"),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: uuid("reference_id"),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).default("0.00").notNull(),
    note: text("note"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sm_material_id_idx").on(table.materialId),
    index("sm_location_id_idx").on(table.inventoryLocationId),
    index("sm_project_id_idx").on(table.projectId),
    index("sm_project_rap_item_id_idx").on(table.projectRapItemId),
    index("sm_project_cost_id_idx").on(table.projectCostId),
    index("sm_vendor_bill_id_idx").on(table.vendorBillId),
    index("sm_created_by_id_idx").on(table.createdById),
    index("sm_type_idx").on(table.movementType),
    index("sm_reference_idx").on(table.referenceType, table.referenceId),
  ],
);

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
  material: one(materialMaster, {
    fields: [stockMovement.materialId],
    references: [materialMaster.id],
  }),
  location: one(inventoryLocation, {
    fields: [stockMovement.inventoryLocationId],
    references: [inventoryLocation.id],
  }),
  project: one(project, { fields: [stockMovement.projectId], references: [project.id] }),
  rapItem: one(projectRapItem, {
    fields: [stockMovement.projectRapItemId],
    references: [projectRapItem.id],
  }),
  projectCost: one(projectCost, {
    fields: [stockMovement.projectCostId],
    references: [projectCost.id],
  }),
  vendorBill: one(vendorBill, {
    fields: [stockMovement.vendorBillId],
    references: [vendorBill.id],
  }),
  createdBy: one(user, { fields: [stockMovement.createdById], references: [user.id] }),
}));

export const inventoryOpeningBatch = pgTable(
  "inventory_opening_batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    batchNumber: varchar("batch_number", { length: 100 }).notNull(),
    cutoverDate: timestamp("cutover_date").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("PENDING_APPROVAL"),
    note: text("note").notNull(),
    referenceNumber: varchar("reference_number", { length: 100 }),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
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
  },
  (table) => [
    index("iob_status_idx").on(table.status),
    index("iob_requested_by_idx").on(table.requestedById),
    uniqueIndex("iob_tenant_batch_number_uidx").on(table.tenantId, table.batchNumber),
    index("iob_tenant_id_idx").on(table.tenantId),
  ],
);

export const inventoryOpeningItem = pgTable(
  "inventory_opening_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryOpeningBatch.id, { onDelete: "cascade" }),
    materialInventoryId: uuid("material_inventory_id")
      .notNull()
      .references(() => materialInventory.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, {
      onDelete: "set null",
    }),
    reversalStockMovementId: uuid("reversal_stock_movement_id").references(() => stockMovement.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ioi_batch_inventory_uidx").on(table.batchId, table.materialInventoryId),
    index("ioi_batch_idx").on(table.batchId),
  ],
);

export const inventoryOpeningBatchRelations = relations(inventoryOpeningBatch, ({ one, many }) => ({
  requestedBy: one(user, {
    fields: [inventoryOpeningBatch.requestedById],
    references: [user.id],
    relationName: "openingRequestedBy",
  }),
  approvedBy: one(user, {
    fields: [inventoryOpeningBatch.approvedById],
    references: [user.id],
    relationName: "openingApprovedBy",
  }),
  reversedBy: one(user, {
    fields: [inventoryOpeningBatch.reversedById],
    references: [user.id],
    relationName: "openingReversedBy",
  }),
  items: many(inventoryOpeningItem),
}));

export const inventoryOpeningItemRelations = relations(inventoryOpeningItem, ({ one }) => ({
  batch: one(inventoryOpeningBatch, {
    fields: [inventoryOpeningItem.batchId],
    references: [inventoryOpeningBatch.id],
  }),
  inventory: one(materialInventory, {
    fields: [inventoryOpeningItem.materialInventoryId],
    references: [materialInventory.id],
  }),
  stockMovement: one(stockMovement, {
    fields: [inventoryOpeningItem.stockMovementId],
    references: [stockMovement.id],
    relationName: "openingMovement",
  }),
  reversalStockMovement: one(stockMovement, {
    fields: [inventoryOpeningItem.reversalStockMovementId],
    references: [stockMovement.id],
    relationName: "openingReversalMovement",
  }),
}));

export const stockTransferItem = pgTable(
  "stock_transfer_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    stockTransferId: uuid("stock_transfer_id")
      .notNull()
      .references(() => stockTransfer.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialMaster.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    outMovementId: uuid("out_movement_id").references(() => stockMovement.id, {
      onDelete: "restrict",
    }),
    inMovementId: uuid("in_movement_id").references(() => stockMovement.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sti_transfer_idx").on(table.stockTransferId),
    index("sti_material_idx").on(table.materialId),
  ],
);

export const stockCountItem = pgTable(
  "stock_count_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    stockCountId: uuid("stock_count_id")
      .notNull()
      .references(() => stockCount.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialMaster.id, { onDelete: "restrict" }),
    systemQuantity: numeric("system_quantity", { precision: 12, scale: 2 }).notNull(),
    countedQuantity: numeric("counted_quantity", { precision: 12, scale: 2 }).notNull(),
    varianceQuantity: numeric("variance_quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sci_count_material_uidx").on(table.stockCountId, table.materialId),
    index("sci_count_idx").on(table.stockCountId),
  ],
);

export const stockTransferRelations = relations(stockTransfer, ({ one, many }) => ({
  fromLocation: one(inventoryLocation, {
    fields: [stockTransfer.fromLocationId],
    references: [inventoryLocation.id],
    relationName: "transferFrom",
  }),
  toLocation: one(inventoryLocation, {
    fields: [stockTransfer.toLocationId],
    references: [inventoryLocation.id],
    relationName: "transferTo",
  }),
  createdBy: one(user, { fields: [stockTransfer.createdById], references: [user.id] }),
  items: many(stockTransferItem),
}));
export const stockTransferItemRelations = relations(stockTransferItem, ({ one }) => ({
  transfer: one(stockTransfer, {
    fields: [stockTransferItem.stockTransferId],
    references: [stockTransfer.id],
  }),
  material: one(materialMaster, {
    fields: [stockTransferItem.materialId],
    references: [materialMaster.id],
  }),
}));
export const stockCountRelations = relations(stockCount, ({ one, many }) => ({
  location: one(inventoryLocation, {
    fields: [stockCount.inventoryLocationId],
    references: [inventoryLocation.id],
  }),
  createdBy: one(user, {
    fields: [stockCount.createdById],
    references: [user.id],
    relationName: "stockCountCreator",
  }),
  approvedBy: one(user, {
    fields: [stockCount.approvedById],
    references: [user.id],
    relationName: "stockCountApprover",
  }),
  items: many(stockCountItem),
}));
export const stockCountItemRelations = relations(stockCountItem, ({ one }) => ({
  count: one(stockCount, { fields: [stockCountItem.stockCountId], references: [stockCount.id] }),
  material: one(materialMaster, {
    fields: [stockCountItem.materialId],
    references: [materialMaster.id],
  }),
}));

// ==========================================
// // 14H. Goods Receipt (Physical Receipt)
// ==========================================
export const goodsReceipt = pgTable(
  "goods_receipt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    vendorBillId: uuid("vendor_bill_id").references(() => vendorBill.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    inventoryLocationId: uuid("inventory_location_id")
      .notNull()
      .references(() => inventoryLocation.id, { onDelete: "restrict" }),
    receiptNumber: varchar("receipt_number", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("DRAFT"),
    receivedAt: timestamp("received_at").notNull(),
    note: text("note"),
    receivedById: uuid("received_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reversalReason: text("reversal_reason"),
    reversalRequestedById: uuid("reversal_requested_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reversalRequestedAt: timestamp("reversal_requested_at"),
    reversedById: uuid("reversed_by_id").references(() => user.id, { onDelete: "restrict" }),
    reversedAt: timestamp("reversed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("gr_vendor_bill_id_idx").on(table.vendorBillId),
    index("gr_project_id_idx").on(table.projectId),
    index("gr_inventory_location_id_idx").on(table.inventoryLocationId),
    index("gr_status_idx").on(table.status),
    uniqueIndex("gr_tenant_receipt_number_uidx").on(table.tenantId, table.receiptNumber),
    index("gr_tenant_id_idx").on(table.tenantId),
  ],
);

export const goodsReceiptItem = pgTable(
  "goods_receipt_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipt.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialMaster.id, { onDelete: "restrict" }),
    projectRapItemId: uuid("project_rap_item_id").references(() => projectRapItem.id, {
      onDelete: "set null",
    }),
    stockMovementId: uuid("stock_movement_id").references(() => stockMovement.id, {
      onDelete: "set null",
    }),
    reversalStockMovementId: uuid("reversal_stock_movement_id").references(() => stockMovement.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("gri_goods_receipt_id_idx").on(table.goodsReceiptId),
    index("gri_material_id_idx").on(table.materialId),
    index("gri_project_rap_item_id_idx").on(table.projectRapItemId),
    index("gri_stock_movement_id_idx").on(table.stockMovementId),
  ],
);

export const goodsReceiptRelations = relations(goodsReceipt, ({ one, many }) => ({
  vendorBill: one(vendorBill, { fields: [goodsReceipt.vendorBillId], references: [vendorBill.id] }),
  project: one(project, { fields: [goodsReceipt.projectId], references: [project.id] }),
  inventoryLocation: one(inventoryLocation, {
    fields: [goodsReceipt.inventoryLocationId],
    references: [inventoryLocation.id],
  }),
  receivedBy: one(user, { fields: [goodsReceipt.receivedById], references: [user.id] }),
  items: many(goodsReceiptItem),
}));

export const goodsReceiptItemRelations = relations(goodsReceiptItem, ({ one }) => ({
  receipt: one(goodsReceipt, {
    fields: [goodsReceiptItem.goodsReceiptId],
    references: [goodsReceipt.id],
  }),
  material: one(materialMaster, {
    fields: [goodsReceiptItem.materialId],
    references: [materialMaster.id],
  }),
  rapItem: one(projectRapItem, {
    fields: [goodsReceiptItem.projectRapItemId],
    references: [projectRapItem.id],
  }),
  stockMovement: one(stockMovement, {
    fields: [goodsReceiptItem.stockMovementId],
    references: [stockMovement.id],
  }),
}));
