import { expect, test } from "bun:test";
import {
  applyMaterialUpdate,
  materialUpdateChangesSchema,
  materialUpdateDiff,
  materialUpdateIdentitySchema,
  isMaterialStatusOnly,
  type MaterialEditSnapshot,
  materialEditSnapshotSchema,
} from "./material-update";
const before: MaterialEditSnapshot = {
  name: "Panel",
  categoryId: "00000000-0000-4000-8000-000000000001",
  categoryName: "Panel",
  unit: "lembar",
  defaultVendorId: null,
  vendorName: null,
  specification: null,
  brand: null,
  code: "P-1",
  color: "Putih",
  isActive: true,
};
test("edit snapshots accept the existing seeded PostgreSQL reference IDs", (): void => {
  expect(
    materialEditSnapshotSchema.safeParse({
      ...before,
      categoryId: "00000000-0000-0000-0000-000000000001",
      defaultVendorId: "44444444-4444-4444-4444-444444444444",
    }).success,
  ).toBe(true);
});
test("material edit normalizes metadata and clears nullable text explicitly", (): void => {
  const after = applyMaterialUpdate(before, { name: " Panel Baru ", code: " ", color: null });
  expect(after.name).toBe("Panel Baru");
  expect(after.code).toBeNull();
  expect(after.color).toBeNull();
  expect(after.unit).toBe(before.unit);
  expect(before.name).toBe("Panel");
});
test("status-only changes preserve the unedited metadata exactly", (): void => {
  const legacy = { ...before, name: " Panel ", specification: " lama " };
  const after = {
    ...applyMaterialUpdate(legacy, { isActive: false }),
    categoryName: "Panel",
    vendorName: null,
  };
  expect(after.name).toBe(legacy.name);
  expect(materialUpdateDiff(legacy, after)).toEqual([
    { key: "isActive", label: "Status", before: "Aktif", after: "Nonaktif" },
  ]);
  expect(
    isMaterialStatusOnly({
      kind: "MATERIAL_MASTER_UPDATE",
      materialId: before.categoryId,
      expectedUpdatedAt: "2026-10-07T00:00:00.000Z",
      before: legacy,
      after,
    }),
  ).toBe(true);
});
test("edit contracts reject empty patches, stock fields and confirmation replacement data", (): void => {
  expect(materialUpdateChangesSchema.safeParse({}).success).toBe(false);
  expect(materialUpdateChangesSchema.safeParse({ currentStock: 20 }).success).toBe(false);
  expect(materialUpdateChangesSchema.safeParse({ unitPrice: 20000 }).success).toBe(false);
  expect(
    materialUpdateIdentitySchema.safeParse({
      conversationId: before.categoryId,
      toolCallId: "call-1",
      after: { name: "Client tampering" },
    }).success,
  ).toBe(false);
  expect(() => applyMaterialUpdate(before, { name: "  " })).toThrow();
});
test("diff labels references and explicit no-vendor values rather than raw IDs", (): void => {
  const vendor = {
    ...before,
    defaultVendorId: "00000000-0000-4000-8000-000000000002",
    vendorName: "Vendor A",
  };
  expect(
    materialUpdateDiff(vendor, { ...vendor, defaultVendorId: null, vendorName: null }),
  ).toEqual([
    { key: "defaultVendorId", label: "Vendor", before: "Vendor A", after: "Tanpa vendor" },
  ]);
});
