import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenant } from "./tenant";
import { DEKORIA_TENANT_ID } from "./tenant-constants";
import { session, user } from "./auth";

// ==========================================
// // 16. Berkas Lampiran (Attachment)
// ==========================================
export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
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
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
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
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
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
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, { onDelete: "cascade" }),
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

export const aiUserPreference = pgTable("ai_user_preference", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  responseStyle: varchar("response_style", { length: 30 }).notNull().default("STANDARD"),
  primaryFocus: varchar("primary_focus", { length: 30 }).notNull().default("AUTO"),
  customNote: varchar("custom_note", { length: 300 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiUserPreferenceRelations = relations(aiUserPreference, ({ one }) => ({
  user: one(user, { fields: [aiUserPreference.userId], references: [user.id] }),
}));

// ==========================================
// // 18C. Pesan AI Chat (AI Message)
// ==========================================
export const aiMessage = pgTable(
  "ai_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user, assistant
    // Disimpan sebagai UIMessage parts agar riwayat bisa dirender ulang persis,
    // termasuk jejak pemanggilan tool.
    parts: jsonb("parts").notNull(),
    provider: varchar("provider", { length: 20 }), // NINEROUTER, OPENROUTER, DEEPSEEK, GEMINI
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
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull(),
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
  (table) => [
    uniqueIndex("ai_proposal_tenant_tool_call_uidx").on(table.tenantId, table.toolCallId),
    index("ai_proposal_conversation_id_idx").on(table.conversationId),
  ],
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
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    readAt: timestamp("read_at"),
    projectId: uuid("project_id"),
    requiredPermission: varchar("required_permission", { length: 100 }),
    eventKey: varchar("event_key", { length: 255 }),
    severity: varchar("severity", { length: 20 }).default("INFO").notNull(), // INFO, WARNING, CRITICAL
    category: varchar("category", { length: 50 }).default("INFORMATIONAL").notNull(), // ACTION_REQUIRED, INFORMATIONAL
    referenceType: varchar("reference_type", { length: 100 }),
    referenceId: uuid("reference_id"),
    actionUrl: text("action_url"),
    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: uuid("resolved_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notif_event_recipient_uidx").on(table.tenantId, table.userId, table.eventKey),
    index("notif_feed_idx").on(
      table.tenantId,
      table.userId,
      table.category,
      table.isResolved,
      table.createdAt,
      table.id,
    ),
    index("notif_user_id_idx").on(table.userId),
    index("notif_read_idx").on(table.read),
    index("notif_user_category_idx").on(table.userId, table.category),
    index("notif_ref_idx").on(table.referenceType, table.referenceId),
    index("notif_stream_cursor_idx").on(table.tenantId, table.userId, table.updatedAt, table.id),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
  resolvedBy: one(user, {
    fields: [notification.resolvedById],
    references: [user.id],
    relationName: "notificationResolver",
  }),
}));

// ==========================================
// // 19B. Langganan Push Token (User Push Subscription)
// ==========================================
export const userPushSubscription = pgTable(
  "user_push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull(), // WEB, EXPO_IOS, EXPO_ANDROID
    token: text("token"),
    endpoint: text("endpoint"),
    p256dh: text("p256dh"),
    auth: text("auth"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_sub_user_idx").on(table.userId),
    index("push_sub_session_idx").on(table.sessionId),
    index("push_sub_token_idx").on(table.token),
  ],
);

export const userPushSubscriptionRelations = relations(userPushSubscription, ({ one, many }) => ({
  user: one(user, { fields: [userPushSubscription.userId], references: [user.id] }),
  session: one(session, {
    fields: [userPushSubscription.sessionId],
    references: [session.id],
  }),
  deliveries: many(notificationDelivery),
}));

// ==========================================
// // 19C. Durable Push Delivery Outbox
// ==========================================
export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    pushSubscriptionId: uuid("push_subscription_id")
      .notNull()
      .references(() => userPushSubscription.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    receiptAttempts: integer("receipt_attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    leaseExpiresAt: timestamp("lease_expires_at"),
    providerTicketId: varchar("provider_ticket_id", { length: 255 }),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notif_delivery_notification_subscription_uidx").on(
      table.notificationId,
      table.pushSubscriptionId,
    ),
    index("notif_delivery_due_idx").on(table.tenantId, table.status, table.nextAttemptAt, table.id),
    index("notif_delivery_ticket_idx").on(table.providerTicketId),
  ],
);

export const notificationDeliveryRelations = relations(notificationDelivery, ({ one }) => ({
  notification: one(notification, {
    fields: [notificationDelivery.notificationId],
    references: [notification.id],
  }),
  pushSubscription: one(userPushSubscription, {
    fields: [notificationDelivery.pushSubscriptionId],
    references: [userPushSubscription.id],
  }),
}));

// ==========================================
// // 20. Riwayat Audit (Audit Log)
// ==========================================
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
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
// // 20B. Event Quick Start & Readiness
// ==========================================
export const onboardingEvent = pgTable(
  "onboarding_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    stepId: varchar("step_id", { length: 50 }),
    readinessItemId: varchar("readiness_item_id", { length: 50 }),
    outcome: varchar("outcome", { length: 30 }).notNull().default("SUCCESS"),
    errorCode: varchar("error_code", { length: 50 }),
    durationMs: integer("duration_ms"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_event_idempotency_uidx").on(table.tenantId, table.idempotencyKey),
    index("onboarding_event_actor_idx").on(table.actorUserId, table.createdAt),
    index("onboarding_event_type_idx").on(table.tenantId, table.eventType, table.createdAt),
  ],
);

export const onboardingEventRelations = relations(onboardingEvent, ({ one }) => ({
  actor: one(user, { fields: [onboardingEvent.actorUserId], references: [user.id] }),
}));

// ==========================================
// // 21. Konfigurasi Aplikasi (App Config)
// ==========================================
export const appConfig = pgTable(
  "app_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 100 }).notNull(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedById: uuid("updated_by_id").references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("app_config_tenant_key_uidx").on(table.tenantId, table.key),
    index("app_config_tenant_id_idx").on(table.tenantId),
  ],
);

export const appConfigRelations = relations(appConfig, ({ one }) => ({
  updatedBy: one(user, { fields: [appConfig.updatedById], references: [user.id] }),
}));

// Serializes periodic condition transitions and remembers recovery episodes.
export const notificationCondition = pgTable(
  "notification_condition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 255 }).notNull(),
    stage: varchar("stage", { length: 100 }).notNull().default(""),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("notification_condition_key_uidx").on(table.tenantId, table.key)],
);
