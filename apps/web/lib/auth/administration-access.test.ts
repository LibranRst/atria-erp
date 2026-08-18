import { describe, expect, test } from "bun:test";

import { getAdministrationCapabilities } from "@atria/core/auth/administration-access";

const administrationStaffActionPath = new URL(
  "../../app/actions/administration-staff.ts",
  import.meta.url,
);
const administrationVendorActionPath = new URL(
  "../../app/actions/administration-vendors.ts",
  import.meta.url,
);

describe("administration role boundary", () => {
  test("keeps user administration owner-only", () => {
    expect(getAdministrationCapabilities("OWNER")).toMatchObject({
      canViewUsers: true,
      canManageUsers: true,
    });
    expect(getAdministrationCapabilities("FINANCE_ADMIN")).toMatchObject({
      canViewUsers: false,
      canManageUsers: false,
    });
  });

  test("allows Finance Admin to manage vendors", () => {
    expect(getAdministrationCapabilities("FINANCE_ADMIN")).toMatchObject({
      canViewVendors: true,
      canManageVendors: true,
    });
    expect(getAdministrationCapabilities("PURCHASING")).toMatchObject({
      canViewVendors: false,
      canManageVendors: false,
    });
  });

  test("keeps direct administration mutations behind server-side permissions", async () => {
    const staffSource = await Bun.file(administrationStaffActionPath).text();
    const vendorSource = await Bun.file(administrationVendorActionPath).text();
    const createUserBlock = staffSource.slice(
      staffSource.indexOf("export async function createStaffUser"),
      staffSource.indexOf("export async function updateStaffUser"),
    );
    const updateUserBlock = staffSource.slice(
      staffSource.indexOf("export async function updateStaffUser"),
      staffSource.indexOf("export async function changeTemporaryPassword"),
    );
    const vendorBlock = vendorSource.slice(
      vendorSource.indexOf("export async function saveVendor"),
      vendorSource.indexOf("export async function setVendorActive"),
    );

    expect(createUserBlock).toContain('assertPermission(actor, "manage:users")');
    expect(updateUserBlock).toContain('assertPermission(actor, "manage:users")');
    expect(vendorBlock).toContain('assertPermission(actor, "manage:vendors")');
  });
});
