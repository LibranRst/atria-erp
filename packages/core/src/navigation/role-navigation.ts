export type RoleNavItem = {
  readonly label: string;
  readonly href: "/ledger" | "/projects" | "/materials" | "/expenses";
  readonly iconName: "dashboard" | "folder" | "inventory_2" | "receipt_long";
};

export const ROLE_NAV_ITEMS: readonly RoleNavItem[] = [
  { label: "Dashboard", href: "/ledger", iconName: "dashboard" },
  { label: "Projects", href: "/projects", iconName: "folder" },
  { label: "Materials", href: "/materials", iconName: "inventory_2" },
  { label: "Expenses", href: "/expenses", iconName: "receipt_long" },
];

/**
 * Sumber kebenaran navigasi utama berdasarkan peran untuk web dan native.
 * Fungsi ini sengaja murni agar keputusan tab tidak bergantung pada runtime UI.
 */
export function getRoleNavItems(roleName: string | null): readonly RoleNavItem[] {
  return ROLE_NAV_ITEMS.filter((item) => {
    if (!roleName) {
      return item.label === "Projects" || item.label === "Expenses";
    }

    if (roleName === "OWNER" || roleName === "FINANCE_ADMIN") {
      return item.label === "Dashboard" || item.label === "Projects" || item.label === "Expenses";
    }

    if (roleName === "PURCHASING") {
      return item.label === "Materials" || item.label === "Expenses" || item.label === "Projects";
    }

    if (roleName === "PROJECT_MANAGER") {
      return item.label === "Projects" || item.label === "Expenses" || item.label === "Materials";
    }

    return item.label === "Projects" || item.label === "Expenses" || item.label === "Materials";
  });
}
