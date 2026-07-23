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

// ==========================================
// // 16. Berkas Lampiran (Attachment)
// ==========================================
export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    referenceType: varchar("reference_type", { length: 100 }).notNull(), // project_cost, vendor_bill, client_invoice, dll
    referenceId: uuid("reference_id").notNull(), // Polimorfik reference ID
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("att_reference_idx").on(table.referenceType, table.referenceId)],
);

export const attachmentRelations = relations(attachment, ({ one }) => ({
  uploadedBy: one(user, {
    fields: [attachment.uploadedById],
    references: [user.id],
    relationName: "attachmentUploader",
  }),
}));



// ==========================================
// // 17. Keputusan Otorisasi (Approval)
// ==========================================
export const approval = pgTable(
  "approval",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    referenceType: varchar("reference_type", { length: 100 }).notNull(), // project_cost, project_budget, vendor_bill, dll
    referenceId: uuid("reference_id").notNull(), // Polimorfik reference ID
    status: varchar("status", { length: 50 }).notNull(), // APPROVED, REJECTED
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("app_reference_idx").on(table.referenceType, table.referenceId),
    index("app_approver_id_idx").on(table.approverId),
  ],
);

export const approvalRelations = relations(approval, ({ one }) => ({
  approver: one(user, {
    fields: [approval.approverId],
    references: [user.id],
    relationName: "approver",
  }),
}));



// ==========================================
// // 18. Log AI Pipeline (AI Run)
// ==========================================
export const aiRun = pgTable(
  "ai_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runType: varchar("run_type", { length: 50 }).notNull(), // OCR_RECEIPT, FINANCIAL_BRIEFING
    runById: uuid("run_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 50 }).notNull(), // PROCESSING, COMPLETED, FAILED
    payload: text("payload"), // Input parameter dalam stringified JSON
    result: text("result"), // Hasil ekstraksi JSON atau ringkasan dalam string
    errorMessage: text("error_message"),
    tokensUsed: integer("tokens_used"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_run_by_id_idx").on(table.runById)],
);

export const aiRunRelations = relations(aiRun, ({ one }) => ({
  runBy: one(user, { fields: [aiRun.runById], references: [user.id], relationName: "aiRunner" }),
}));



// ==========================================
// // 19. Notifikasi (Notification)
// ==========================================
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    severity: varchar("severity", { length: 20 }).default("INFO").notNull(), // INFO, WARNING, CRITICAL
    referenceType: varchar("reference_type", { length: 100 }),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("notif_user_id_idx").on(table.userId), index("notif_read_idx").on(table.read)],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}));



// ==========================================
// // 20. Riwayat Audit (Audit Log)
// ==========================================
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 100 }).notNull(), // CREATE_PROJECT, RECORD_CLIENT_PAYMENT, dll
    targetTable: varchar("target_table", { length: 100 }).notNull(),
    targetId: uuid("target_id").notNull(),
    originalState: text("original_state"), // JSON string
    newState: text("new_state"), // JSON string
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("al_user_id_idx").on(table.userId),
    index("al_target_idx").on(table.targetTable, table.targetId),
  ],
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, { fields: [auditLog.userId], references: [user.id] }),
}));



// ==========================================
// // 21. Konfigurasi Aplikasi (App Config)
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


