import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";

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
    iconName: "chat",
    match: (path): boolean => path === "/ai",
  },
  {
    label: "Profil Saya",
    href: "/profile",
    iconName: "person",
    match: (path): boolean => path.startsWith("/profile"),
  },
];

export function getHeaderMenuItems(roleName: string | null): readonly HeaderMenuItem[] {
  return HEADER_MENU_ITEMS.filter((item) => {
    if (!roleName) return false;

    // Dibaca dari matriks izin yang sama dengan yang ditegakkan di server, bukan
    // dari daftar peran yang ditulis ulang di sini: rute AI sudah memeriksa
    // `use:ai_chat` sebelum melakukan apa pun, dan menunya tidak boleh
    // menawarkan pintu yang akan ditolak.
    if (item.label === "Asisten AI") {
      return (ROLE_PERMISSIONS[roleName] ?? []).includes("use:ai_chat");
    }

    if (item.label === "Dashboard") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Persetujuan") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Rekonsiliasi") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Pengaturan ERP") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN" || roleName === "PURCHASING";
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
  if (pathname === "/reconciliation") return "Rekonsiliasi";
  // Halaman AI menyetel judulnya sendiri karena berganti mengikuti keadaan
  // dalam halaman (percakapan ↔ riwayat). Entri ini yang menjaga kedua sumber
  // tetap sepakat kalau ada yang membacanya lewat rute.
  if (pathname === "/ai") return "Asisten AI";
  return "Finance ERP";
}
