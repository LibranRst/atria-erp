import type { PermissionKey } from "./permissions";

export type AdministrationCapabilities = {
  readonly canViewUsers: boolean;
  readonly canManageUsers: boolean;
  readonly canViewVendors: boolean;
  readonly canManageVendors: boolean;
  readonly canManageRoles: boolean;
};

/**
 * Kemampuan workspace Administrasi diturunkan dari izin, bukan nama peran.
 *
 * Sebelumnya fungsi ini membandingkan `roleName === "OWNER"`. Selama hanya ada
 * empat peran bawaan, hasilnya kebetulan sama dengan matriks izin — tetapi
 * begitu Owner bisa membuat peran, cabang nama peran itu berubah menjadi
 * penolakan diam-diam: peran baru diberi `manage:users`, servernya mengizinkan,
 * dan layarnya tetap kosong.
 *
 * Pemetaannya persis satu-ke-satu dengan yang sudah ditegakkan Server Action
 * (`assertPermission(actor, "manage:users" | "manage:vendors")`), jadi keempat
 * peran bawaan tidak berubah perilakunya.
 */
export function getAdministrationCapabilities(
  can: (permission: PermissionKey) => boolean,
): AdministrationCapabilities {
  const manageUsers = can("manage:users");
  const manageVendors = can("manage:vendors");

  return {
    canViewUsers: manageUsers,
    canManageUsers: manageUsers,
    canViewVendors: manageVendors,
    canManageVendors: manageVendors,
    canManageRoles: can("manage:roles"),
  };
}
