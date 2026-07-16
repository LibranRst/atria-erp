export type HeaderMenuItem = {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (
    pathname: string,
    searchParams: URLSearchParams,
  ) => boolean;
};

const HEADER_MENU_ITEMS: readonly HeaderMenuItem[] = [
  {
    label: "Dashboard",
    href: "/ledger",
    iconName: "dashboard",
    match: (path): boolean => path === "/ledger",
  },
  {
    label: "Proyek",
    href: "/projects",
    iconName: "folder",
    match: (path): boolean => path.startsWith("/projects"),
  },
  {
    label: "Material & Stok",
    href: "/materials",
    iconName: "inventory_2",
    match: (path): boolean => path.startsWith("/materials"),
  },
  {
    label: "Kas & Tagihan",
    href: "/expenses",
    iconName: "receipt_long",
    match: (path): boolean => path.startsWith("/expenses"),
  },
  {
    label: "Persetujuan",
    href: "/approvals",
    iconName: "verified_user",
    match: (path): boolean => path.startsWith("/approvals"),
  },
  {
    label: "Pengaturan ERP",
    href: "/settings",
    iconName: "tune",
    match: (path): boolean => path.startsWith("/settings"),
  },
  {
    label: "Profil Saya",
    href: "/profile",
    iconName: "person",
    match: (path): boolean => path.startsWith("/profile"),
  },
];

export function getHeaderMenuItems(
  roleName: string | null,
): readonly HeaderMenuItem[] {
  return HEADER_MENU_ITEMS.filter((item) => {
    if (!roleName) return false;

    if (item.label === "Dashboard") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Persetujuan") {
      return roleName === "OWNER";
    }

    if (item.label === "Pengaturan ERP") {
      return (
        roleName === "OWNER" ||
        roleName === "FINANCE_ADMIN" ||
        roleName === "PURCHASING"
      );
    }

    return true;
  });
}

export function getPageTitle(pathname: string): string {
  if (pathname === "/ledger") return "Dashboard";
  if (pathname === "/projects") return "Proyek";
  if (pathname.startsWith("/projects/")) return "Detail Proyek";
  if (pathname === "/expenses") return "Kas & Tagihan";
  if (pathname === "/expenses/new") return "Biaya Lapangan";
  if (pathname === "/materials") return "Material & Stok";
  if (pathname === "/profile") return "Profil Saya";
  if (pathname === "/settings") return "Pengaturan ERP";
  if (pathname === "/settings/budget") return "Alokasi Budget";
  if (pathname === "/settings/categories") return "Kategori Pengeluaran";
  if (pathname === "/settings/library") return "Library Item & Harga";
  if (pathname === "/settings/materials") return "Material Master";
  if (pathname === "/approvals") return "Persetujuan";
  return "Finance ERP";
}
