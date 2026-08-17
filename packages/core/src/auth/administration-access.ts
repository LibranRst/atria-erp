export type AdministrationCapabilities = {
  readonly canViewUsers: boolean;
  readonly canManageUsers: boolean;
  readonly canViewVendors: boolean;
  readonly canManageVendors: boolean;
};

export function getAdministrationCapabilities(roleName: string): AdministrationCapabilities {
  if (roleName === "OWNER") {
    return {
      canViewUsers: true,
      canManageUsers: true,
      canViewVendors: true,
      canManageVendors: true,
    };
  }
  if (roleName === "FINANCE_ADMIN") {
    return {
      canViewUsers: false,
      canManageUsers: false,
      canViewVendors: true,
      canManageVendors: true,
    };
  }
  return {
    canViewUsers: false,
    canManageUsers: false,
    canViewVendors: false,
    canManageVendors: false,
  };
}
