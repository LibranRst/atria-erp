import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { aiConversation } from "./system";
import { formDraft } from "./projects";
import { tenant } from "./tenant";
import { DEKORIA_TENANT_ID } from "./tenant-constants";
import { user } from "./auth";
import type { MaterialSource } from "@atria/core/ai/material-import";
export const materialImportAnalysisJob = pgTable(
  "material_import_analysis_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .default(DEKORIA_TENANT_ID)
      .references(() => tenant.id, { onDelete: "restrict" }),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => formDraft.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toolCallId: varchar("tool_call_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("QUEUED"),
    attachmentUrls: jsonb("attachment_urls").$type<string[]>().notNull(),
    sources: jsonb("sources").$type<MaterialSource[]>().notNull().default([]),
    extracted: integer("extracted").notNull().default(0),
    pageCursor: integer("page_cursor").notNull().default(0),
    cursor: integer("cursor").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    error: text("error"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("material_analysis_proposal_uidx").on(
      table.tenantId,
      table.conversationId,
      table.toolCallId,
    ),
    index("material_analysis_due_idx").on(table.status, table.nextAttemptAt),
  ],
);
