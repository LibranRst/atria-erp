import type { PermissionKey } from "../auth/permissions";

export type HeaderMenuItem = {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (pathname: string, searchParams: URLSearchParams) => boolean;
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
    label: "Rekonsiliasi",
    href: "/reconciliation",
    iconName: "fact_check",
    match: (path): boolean => path.startsWith("/reconciliation"),
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
    label: "Asisten AI",
    href: "/ai",
    iconName: "sparkle",
    match: (path): boolean => path === "/ai",
  },
  {
    label: "Profil Saya",
    href: "/profile",
    iconName: "person",
    match: (path): boolean => path.startsWith("/profile"),
  },
];

/**
 * Menu bilah atas dibaca dari izin efektif sesi.
 *
 * Sebelumnya daftar ini diturunkan dari nama peran lalu dicari di matriks seed
 * — dua lapis yang sama-sama buta terhadap peran buatan Owner: peran baru tidak
 * punya nama di peta UUID statis, sehingga menunya kosong berapa pun izin yang
 * diberikan. Sesi tanpa izin sama sekali tetap tidak mendapat menu.
 */
export function getHeaderMenuItems(
  permissions: readonly PermissionKey[],
): readonly HeaderMenuItem[] {
  if (permissions.length === 0) return [];
  const held = new Set<PermissionKey>(permissions);
  const can = (permission: PermissionKey): boolean => held.has(permission);

  return HEADER_MENU_ITEMS.filter((item) => {
    // Rute AI sudah memeriksa `use:ai_chat` sebelum melakukan apa pun, dan
    // menunya tidak boleh menawarkan pintu yang akan ditolak.
    if (item.label === "Asisten AI") return can("use:ai_chat");
    if (item.label === "Dashboard") return can("view:ledger");
    if (item.label === "Persetujuan") return can("view:approval_queue");
    if (item.label === "Rekonsiliasi") return can("reconcile:ledger");
    if (item.label === "Pengaturan ERP") return can("view:settings");

    return true;
  });
}
