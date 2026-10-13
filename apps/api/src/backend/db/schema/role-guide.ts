import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Individual acknowledgment; organization setup state remains independent. */
export const userRoleGuideState = pgTable("user_role_guide_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  contextKey: varchar("context_key", { length: 64 }).notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
});
