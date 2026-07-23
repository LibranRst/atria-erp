import { describe, expect, test } from "bun:test";

import { getAdministrationCapabilities } from "./administration-access";

const administrationActionPath = new URL("../../app/actions/administration.ts", import.meta.url);

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
    const source = await Bun.file(administrationActionPath).text();
    const createUserBlock = source.slice(
      source.indexOf("export async function createStaffUser"),
      source.indexOf("export async function updateStaffUser"),
    );
    const updateUserBlock = source.slice(
      source.indexOf("export async function updateStaffUser"),
      source.indexOf("export async function changeTemporaryPassword"),
    );
    const vendorBlock = source.slice(
      source.indexOf("export async function saveVendor"),
      source.indexOf("export async function setVendorActive"),
    );

    expect(createUserBlock).toContain('assertPermission(actor, "manage:users")');
    expect(updateUserBlock).toContain('assertPermission(actor, "manage:users")');
    expect(vendorBlock).toContain('assertPermission(actor, "manage:vendors")');
  });
});
