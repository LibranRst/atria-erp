import { expect, test } from "bun:test";
import {
  catalogSettingsInputSchema,
  catalogSettingsIdentitySchema,
  catalogSettingsPermission,
  catalogTemplateSchema,
  catalogVendorSchema,
} from "./catalog-settings";
const id = "10000000-0000-4000-8000-000000000001";
test("optional vendor email remains validated, normalized and clearable", () => {
  const vendor = { name: "Vendor uji", phone: "08123456789" };
  for (const email of [undefined, null, ""]) {
    expect(catalogVendorSchema.safeParse({ ...vendor, email }).success).toBe(true);
    expect(
      catalogSettingsInputSchema.safeParse({
        action: "VENDOR_EDIT",
        vendorId: id,
        patch: { email },
      }).success,
    ).toBe(true);
  }
  expect(catalogVendorSchema.parse({ ...vendor, email: " SALES@EXAMPLE.COM " }).email).toBe(
    "sales@example.com",
  );
  for (const email of ["not-an-email", "sales@", "@example.com", "sales@example.com\ninvalid"]) {
    expect(catalogVendorSchema.safeParse({ ...vendor, email }).success).toBe(false);
    expect(
      catalogSettingsInputSchema.safeParse({
        action: "VENDOR_EDIT",
        vendorId: id,
        patch: { email },
      }).success,
    ).toBe(false);
  }
});
test("partial vendor updates preserve omitted status and reject empty/unknown patches", () => {
  const v = catalogSettingsInputSchema.parse({
    action: "VENDOR_EDIT",
    vendorId: id,
    patch: { phone: "081234567" },
  });
  if (v.action !== "VENDOR_EDIT") throw new Error("Invalid case");
  expect(v.patch).toEqual({ phone: "081234567" });
  expect(
    catalogSettingsInputSchema.safeParse({ action: "VENDOR_EDIT", vendorId: id, patch: {} })
      .success,
  ).toBe(false);
  expect(
    catalogSettingsInputSchema.safeParse({
      action: "VENDOR_EDIT",
      vendorId: id,
      patch: { userId: id },
    }).success,
  ).toBe(false);
  expect(catalogSettingsPermission("VENDOR_STATUS")).toBe("manage:vendors");
});
test("inventory defaults cannot smuggle valuation; valuation needs an explicit reason and exact finite money", () => {
  const d = {
    action: "INVENTORY_DEFAULTS",
    materialInventoryId: id,
    minimumStock: 2,
    lastPurchasePrice: 10,
  };
  expect(catalogSettingsInputSchema.safeParse(d).success).toBe(true);
  for (const patch of [
    { averageCost: 5 },
    { minimumStock: 1.001 },
    { lastPurchasePrice: Infinity },
  ])
    expect(catalogSettingsInputSchema.safeParse({ ...d, ...patch }).success).toBe(false);
  expect(
    catalogSettingsInputSchema.safeParse({
      action: "INVENTORY_VALUATION",
      materialInventoryId: id,
      averageCost: 10,
      reason: "short",
    }).success,
  ).toBe(false);
  expect(
    catalogSettingsIdentitySchema.safeParse({ conversationId: id, toolCallId: "proof", input: d })
      .success,
  ).toBe(false);
});
test("complete pricing templates reject missing fixed price, duplicate component identities, overprecision and >100 rows", () => {
  const t = {
    expenseCategoryId: id,
    itemType: "CLIENT_LINE",
    itemCategory: "Finishing",
    name: "Paket finishing",
    unit: "ls",
    pricingMode: "FIXED_CLIENT_PRICE",
    targetGrossPercentage: 0.2,
    fixedClientPrice: 100,
    priceSourceType: "VENDOR_QUOTE",
    sourceNote: "Penawaran vendor",
    effectiveFrom: "2026-10-10T00:00:00.000Z",
    components: [
      { label: "Panel", componentType: "MATERIAL", quantity: 1, unit: "lembar", unitCost: 50 },
    ],
  };
  expect(catalogTemplateSchema.safeParse(t).success).toBe(true);
  expect(catalogTemplateSchema.safeParse({ ...t, fixedClientPrice: undefined }).success).toBe(
    false,
  );
  expect(
    catalogTemplateSchema.safeParse({
      ...t,
      components: [
        { ...t.components[0], id },
        { ...t.components[0], id },
      ],
    }).success,
  ).toBe(false);
  expect(
    catalogTemplateSchema.safeParse({
      ...t,
      components: Array.from({ length: 101 }, () => t.components[0]),
    }).success,
  ).toBe(false);
  expect(catalogTemplateSchema.safeParse({ ...t, targetGrossPercentage: 0.20001 }).success).toBe(
    false,
  );
});
