import type { PermissionKey } from "@atria/core/auth/permissions";
export { buildFabActions } from "@atria/core/navigation/quick-actions";
export type { FabAction } from "@atria/core/navigation/quick-actions";
import {
  getRoleNavItems as getSharedRoleNavItems,
  ROLE_NAV_ITEMS,
  type RoleNavItem,
} from "@atria/core/navigation/role-navigation";

export type NavItem = RoleNavItem & {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

const navMatchByHref: Record<RoleNavItem["href"], NavItem["match"]> = {
  "/ledger": (path, params): boolean => path === "/ledger" && params.get("brief") !== "true",
  "/projects": (path): boolean => path.startsWith("/projects"),
  "/materials": (path): boolean => path.startsWith("/materials"),
  "/expenses": (path): boolean => path.startsWith("/expenses"),
};

export const NAV_ITEMS: readonly NavItem[] = ROLE_NAV_ITEMS.map((item) => ({
  ...item,
  match: navMatchByHref[item.href],
}));

export function getRoleNavItems(permissions: readonly PermissionKey[]): readonly NavItem[] {
  return getSharedRoleNavItems(permissions).map((item) => ({
    ...item,
    match: navMatchByHref[item.href],
  }));
}
