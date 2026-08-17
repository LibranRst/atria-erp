import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { budgetAllocationSetting, formDraft, project, projectBudget } from "./projects";
import {
  bankStatementImport,
  cashTransaction,
  clientPayment,
  projectCost,
  vendorPayment,
} from "./finance";
import { itemPriceLibrary } from "./materials";
import { aiRun, appConfig, approval, attachment, auditLog, notification } from "./system";

// ==========================================
// // 1. Peran Otorisasi (Role)
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
// // 2. Pengguna (User)
// ==========================================
export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    temporaryPasswordIssuedAt: timestamp("temporary_password_issued_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("user_role_id_idx").on(table.roleId)],
);

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
  updatedBudgetAllocationSettings: many(budgetAllocationSetting, {
    relationName: "budgetAllocationSettingUpdater",
  }),
  updatedItemPriceLibraryItems: many(itemPriceLibrary, { relationName: "itemPriceLibraryUpdater" }),
  importedStatements: many(bankStatementImport),
  sessions: many(session, { relationName: "sessionUser" }),
  developerSimulationSessions: many(session, { relationName: "developerActor" }),
  accounts: many(account),
  formDrafts: many(formDraft),
}));

// ==========================================
// // 24. Sesi Better Auth (Session)
// ==========================================
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    developerActorUserId: uuid("developer_actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_developer_actor_user_id_idx").on(table.developerActorUserId),
  ],
);

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
// // 25. Akun Better Auth (Account)
// ==========================================
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ==========================================
// // 26. Verifikasi Better Auth (Verification)
// ==========================================
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
