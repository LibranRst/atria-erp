import assert from "node:assert/strict";
import { mock } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { INSTANCE_TENANT_ID } from "@backend/db/schema";

const foreignTenant = "99999999-9999-4999-8999-999999999999";
const dialect = new PgDialect();
let queries = 0,
  writes = 0;
function scoped<Row extends { readonly tenantId: string }>(
  rows: readonly Row[],
  config?: { readonly where?: SQL },
): Row[] {
  queries += 1;
  const query = config?.where ? dialect.sqlToQuery(config.where) : null;
  return rows.filter(
    (row) => !query?.params.includes(INSTANCE_TENANT_ID) || row.tenantId === INSTANCE_TENANT_ID,
  );
}
const categories = [
  { id: "own-category", tenantId: INSTANCE_TENANT_ID, name: "Panel" },
  { id: "foreign-category", tenantId: foreignTenant, name: "Panel" },
  { id: "private-category", tenantId: foreignTenant, name: "PrivateCatalog" },
];
const locations = [
  { id: "own-location", tenantId: INSTANCE_TENANT_ID, name: "Gudang", isActive: true },
  { id: "inactive-location", tenantId: INSTANCE_TENANT_ID, name: "Gudang Lama", isActive: false },
  { id: "foreign-location", tenantId: foreignTenant, name: "Gudang", isActive: true },
  { id: "private-location", tenantId: foreignTenant, name: "PrivateDepot", isActive: true },
];
const vendors = [
  { id: "own-vendor", tenantId: INSTANCE_TENANT_ID, name: "Pemasok", isActive: true },
  { id: "foreign-vendor", tenantId: foreignTenant, name: "Pemasok", isActive: true },
  { id: "private-vendor", tenantId: foreignTenant, name: "PrivateVendor", isActive: true },
];
const materials = [
  { id: "own-material", tenantId: INSTANCE_TENANT_ID, name: "Material lama", code: "OLD" },
  { id: "foreign-material", tenantId: foreignTenant, name: "Material baru", code: "NEW" },
];
mock.module("@backend/db", () => ({
  db: {
    query: {
      materialCategory: {
        findMany: async (config?: { readonly where?: SQL }): Promise<typeof categories> =>
          scoped(categories, config),
      },
      inventoryLocation: {
        findMany: async (config?: { readonly where?: SQL }): Promise<typeof locations> =>
          scoped(locations, config),
      },
      vendor: {
        findMany: async (config?: { readonly where?: SQL }): Promise<typeof vendors> =>
          scoped(vendors, config),
      },
      materialMaster: {
        findMany: async (config?: { readonly where?: SQL }): Promise<typeof materials> =>
          scoped(materials, config),
      },
    },
    transaction: async (): Promise<never> => {
      writes += 1;
      throw new Error("Preview must never open a write transaction");
    },
  },
}));
mock.module("@backend/lib/onboarding/readiness-events", () => ({
  recordReadinessMilestonesTx: async (): Promise<never> => {
    throw new Error("Preview never records milestones");
  },
}));
mock.module("@backend/lib/cache/revalidate-workspace", () => ({
  revalidateWorkspacePath: (): never => {
    throw new Error("Preview never invalidates mutation paths");
  },
}));
let allow = true;
mock.module("@backend/app/actions/settings/system-utils", () => ({
  getSessionUser: async (): Promise<{ readonly id: string; readonly roleId: string }> => ({
    id: "reader",
    roleId: "custom-material-manager",
  }),
  assertSettingsPermission: async (
    _user: unknown,
    permission: PermissionKey,
  ): Promise<ActionResponse<never> | null> => {
    assert.equal(permission, "manage:material_settings");
    return allow
      ? null
      : { success: false, error: { code: "FORBIDDEN", message: "Akses ditolak" } };
  },
}));
const { previewMaterialImport } = await import("../material-import");
const row = {
  rowNumber: 2,
  name: "Material baru",
  code: "NEW",
  categoryName: "Panel",
  unit: "m2",
  locationName: "Gudang",
  vendorName: "Pemasok",
  minimumStock: 1.25,
  lastPurchasePrice: 1234.56,
};
const own = await previewMaterialImport({ rows: [row] });
assert(own.success);
assert.equal(
  own.data.errors.length,
  0,
  "Foreign duplicate identities and reference names do not affect this tenant's CSV",
);
assert.equal(own.data.items[0]?.categoryId, "own-category");
assert.equal(own.data.items[0]?.locationId, "own-location");
assert.equal(own.data.items[0]?.vendorId, "own-vendor");
assert.equal(queries, 4, "The incumbent scoped reference reader supplies all four collections");
const foreign = await previewMaterialImport({
  rows: [
    {
      ...row,
      categoryName: "PrivateCatalog",
      locationName: "PrivateDepot",
      vendorName: "PrivateVendor",
    },
  ],
});
assert(foreign.success && foreign.data.items.length === 0 && foreign.data.errors.length === 1);
assert(foreign.data.errors[0]?.message.includes("tidak ditemukan"));
const inactive = await previewMaterialImport({ rows: [{ ...row, locationName: "Gudang Lama" }] });
assert(inactive.success && inactive.data.items.length === 0 && inactive.data.errors.length === 1);
allow = false;
const before = queries;
const denied = await previewMaterialImport({ rows: [row] });
assert(!denied.success && denied.error.code === "FORBIDDEN");
assert.equal(queries, before, "Denied actors never read reference or duplicate identities");
assert.equal(writes, 0);
console.log("Material import tenant preview regression passed");
