import { describe, expect, test } from "bun:test";

import { getAdministrationCapabilities } from "@atria/core/auth/administration-access";
import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";

/**
 * Kemampuan administrasi sekarang diturunkan dari izin. Test tetap menguji
 * keempat peran bawaan lewat matriks seed-nya, supaya batas yang dijaga di sini
 * tetap batas yang sama seperti sebelum penyatuan peran — ditambah satu kasus
 * peran buatan, yang justru menjadi alasan perubahannya.
 */
function capabilitiesOf(permissions: readonly PermissionKey[]) {
  const held = new Set<PermissionKey>(permissions);
  return getAdministrationCapabilities((permission) => held.has(permission));
}

function capabilitiesOfSeedRole(roleName: string) {
  return capabilitiesOf(ROLE_PERMISSIONS[roleName] ?? []);
}

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
    expect(capabilitiesOfSeedRole("OWNER")).toMatchObject({
      canViewUsers: true,
      canManageUsers: true,
    });
    expect(capabilitiesOfSeedRole("FINANCE_ADMIN")).toMatchObject({
      canViewUsers: false,
      canManageUsers: false,
    });
  });

  test("allows Finance Admin to manage vendors", () => {
    expect(capabilitiesOfSeedRole("FINANCE_ADMIN")).toMatchObject({
      canViewVendors: true,
      canManageVendors: true,
    });
    expect(capabilitiesOfSeedRole("PURCHASING")).toMatchObject({
      canViewVendors: false,
      canManageVendors: false,
    });
  });

  test("grants a custom role exactly what its permissions say", () => {
    expect(capabilitiesOf(["manage:users"])).toMatchObject({
      canViewUsers: true,
      canManageUsers: true,
      canViewVendors: false,
      canManageVendors: false,
      canManageRoles: false,
    });
    expect(capabilitiesOf(["manage:roles"])).toMatchObject({
      canManageRoles: true,
      canManageUsers: false,
    });
    expect(capabilitiesOf([])).toMatchObject({
      canViewUsers: false,
      canViewVendors: false,
      canManageRoles: false,
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
