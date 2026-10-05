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
    href: "/admin/ledger",
    label: "Dashboard",
    icon: "space_dashboard",
    permissions: ["view:ledger"],
  },
  { href: "/admin/projects", label: "Proyek", icon: "folder_open", permissions: ["view:project"] },
  {
    href: "/admin/expenses",
    label: "Pengeluaran",
    icon: "receipt_long",
    permissions: ["view:cost", "view:vendor_bill"],
  },
  {
    href: "/admin/approvals",
    label: "Persetujuan",
    icon: "fact_check",
    permissions: ["view:approval_queue"],
  },
  {
    href: "/admin/materials",
    label: "Material",
    icon: "inventory_2",
    permissions: ["view:inventory", "view:material"],
  },
  {
    href: "/admin/reconciliation",
    label: "Rekonsiliasi",
    icon: "account_balance",
    permissions: ["reconcile:ledger"],
  },
  { href: "/admin/settings", label: "Pengaturan", icon: "tune", permissions: ["view:settings"] },
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
  if (!permissions.includes("use:desktop_admin")) return false;
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
