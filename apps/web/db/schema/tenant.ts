import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user, role } from "./auth";

export { DEKORIA_TENANT_ID } from "./tenant-constants";

// ==========================================
// // 0A. Tenant (Perusahaan Pemakai)
// ==========================================
export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 60 }).notNull(),
    // ACTIVE | READ_ONLY | ARCHIVED. READ_ONLY dipakai pada masa tenggang 90
    // hari setelah langganan berakhir: data masih bisa dibaca dan diekspor,
    // tetapi tidak ada mutasi yang diterima.
    status: varchar("status", { length: 30 }).notNull().default("ACTIVE"),
    subscriptionStartsAt: timestamp("subscription_starts_at"),
    subscriptionEndsAt: timestamp("subscription_ends_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_slug_uidx").on(table.slug),
    index("tenant_status_idx").on(table.status),
  ],
);

// ==========================================
// // 0B. Keanggotaan Tenant (Tenant Member)
// ==========================================
/**
 * Menggantikan asumsi "satu user milik satu perusahaan". `user` tetap identitas
 * global dengan email unik global — satu orang, satu akun, banyak keanggotaan —
 * sehingga orang yang bekerja di dua perusahaan tidak perlu dua kata sandi.
 */
export const tenantMember = pgTable(
  "tenant_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_member_tenant_user_uidx").on(table.tenantId, table.userId),
    index("tenant_member_user_id_idx").on(table.userId),
    index("tenant_member_role_id_idx").on(table.roleId),
  ],
);

export const tenantRelations = relations(tenant, ({ many }) => ({
  members: many(tenantMember),
}));

export const tenantMemberRelations = relations(tenantMember, ({ one }) => ({
  tenant: one(tenant, { fields: [tenantMember.tenantId], references: [tenant.id] }),
  user: one(user, { fields: [tenantMember.userId], references: [user.id] }),
  role: one(role, { fields: [tenantMember.roleId], references: [role.id] }),
}));
