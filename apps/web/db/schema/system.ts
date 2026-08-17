import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  jsonb,
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
// // 18B. Percakapan AI Chat (AI Conversation)
// ==========================================
export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }), // Diringkas dari pesan pertama pengguna
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_conversation_user_id_idx").on(table.userId),
    index("ai_conversation_updated_at_idx").on(table.updatedAt),
  ],
);

export const aiConversationRelations = relations(aiConversation, ({ one, many }) => ({
  user: one(user, { fields: [aiConversation.userId], references: [user.id] }),
  messages: many(aiMessage),
}));

// ==========================================
// // 18C. Pesan AI Chat (AI Message)
// ==========================================
export const aiMessage = pgTable(
  "ai_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user, assistant
    // Disimpan sebagai UIMessage parts agar riwayat bisa dirender ulang persis,
    // termasuk jejak pemanggilan tool.
    parts: jsonb("parts").notNull(),
    provider: varchar("provider", { length: 20 }), // DEEPSEEK, GEMINI
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_message_conversation_id_idx").on(table.conversationId)],
);

export const aiMessageRelations = relations(aiMessage, ({ one }) => ({
  conversation: one(aiConversation, {
    fields: [aiMessage.conversationId],
    references: [aiConversation.id],
  }),
}));

// ==========================================
// // 18D. Konfirmasi Usulan AI (AI Proposal Confirmation)
// ==========================================
/**
 * Mencatat bahwa satu kartu usulan sudah dikonfirmasi menjadi dokumen nyata.
 *
 * `tool_call_id` unik per kartu dan ikut tersimpan di `ai_message.parts`, sehingga
 * riwayat yang dimuat ulang tahu kartu mana yang sudah dieksekusi. Batasan UNIQUE
 * di kolom itu membuat konfirmasi bersifat idempoten: klik ganda, permintaan yang
 * berlomba, atau kartu yang dibuka lagi setelah refresh tidak bisa menghasilkan
 * dokumen kedua.
 */
export const aiProposalConfirmation = pgTable(
  "ai_proposal_confirmation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull().unique(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    proposalType: varchar("proposal_type", { length: 50 }).notNull(), // FIELD_EXPENSE
    documentId: uuid("document_id").notNull(), // Id dokumen yang tercipta, mis. project_cost
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_proposal_conversation_id_idx").on(table.conversationId)],
);

export const aiProposalConfirmationRelations = relations(aiProposalConfirmation, ({ one }) => ({
  conversation: one(aiConversation, {
    fields: [aiProposalConfirmation.conversationId],
    references: [aiConversation.id],
  }),
  user: one(user, { fields: [aiProposalConfirmation.userId], references: [user.id] }),
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
