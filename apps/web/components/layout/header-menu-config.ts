export { getHeaderMenuItems } from "@atria/core/navigation/header-menu";
export type { HeaderMenuItem } from "@atria/core/navigation/header-menu";

export function getPageTitle(pathname: string): string {
  if (pathname === "/notifications") return "Notifikasi";
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
