import type { AdministrationCapabilities } from "@atria/core/auth/administration-access";

/** Navigation follows the server-resolved capabilities; it never grants an action permission. */
export function hasSettingsAdministrationAccess(
  capabilities: AdministrationCapabilities | null,
  fallback: { readonly canManageUsers: boolean; readonly canManageVendors: boolean },
): boolean {
  return capabilities
    ? capabilities.canViewUsers || capabilities.canViewVendors || capabilities.canManageRoles
    : fallback.canManageUsers || fallback.canManageVendors;
}
