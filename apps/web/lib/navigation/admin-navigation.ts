import type { PermissionKey } from "@atria/core/auth/permissions";
import type { AppIconName } from "@/components/ui";
import { canonicalWorkspacePath, isWorkspacePath } from "./workspace-routes";

export type AdminNavigationItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: AppIconName;
  readonly permissions: readonly PermissionKey[];
};

export const ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  {
    href: "/ledger",
    label: "Dashboard",
    icon: "space_dashboard",
    permissions: ["view:ledger"],
  },
  { href: "/projects", label: "Proyek", icon: "folder_open", permissions: ["view:project"] },
  {
    href: "/expenses",
    label: "Pengeluaran",
    icon: "receipt_long",
    permissions: ["view:cost", "view:vendor_bill"],
  },
  {
    href: "/approvals",
    label: "Persetujuan",
    icon: "fact_check",
    permissions: ["view:approval_queue"],
  },
  {
    href: "/materials",
    label: "Material",
    icon: "inventory_2",
    permissions: ["view:inventory", "view:material"],
  },
  {
    href: "/reconciliation",
    label: "Rekonsiliasi",
    icon: "account_balance",
    permissions: ["reconcile:ledger"],
  },
  { href: "/settings", label: "Pengaturan", icon: "tune", permissions: ["view:settings"] },
  { href: "/ai", label: "Asisten AI", icon: "chat", permissions: ["use:ai_chat"] },
];

export function availableAdminNavigation(
  permissions: readonly PermissionKey[],
): readonly AdminNavigationItem[] {
  return ADMIN_NAVIGATION.filter((item) =>
    item.permissions.some((key) => permissions.includes(key)),
  );
}

export function canAccessAdminPath(
  pathname: string,
  permissions: readonly PermissionKey[],
): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\\\r\n]/.test(pathname))
    return false;
  const routePathname = new URL(pathname, "https://atria.invalid").pathname;
  const path = canonicalWorkspacePath(routePathname);
  if (path !== "/" && !isWorkspacePath(path)) return false;
  if (path === "/" || path === "/profile" || path === "/notifications") return true;
  if (path === "/ai") return permissions.includes("use:ai_chat");
  if (path === "/onboarding") return permissions.includes("manage:onboarding");
  if (path === "/onboarding/review") return permissions.includes("review:onboarding");
  if (path === "/expenses/new") return permissions.includes("create:cost");
  if (path === "/materials/opening") return permissions.includes("view:settings");
  return availableAdminNavigation(permissions).some((item) => {
    const root = canonicalWorkspacePath(item.href);
    return path === root || path.startsWith(`${root}/`);
  });
}
