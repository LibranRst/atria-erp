import type { PermissionKey } from "../auth/permissions";

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

/** Bilah bawah memuat tiga tujuan; lebih dari itu tidak muat di layar 320 px. */
const MAX_NAV_ITEMS = 3;

/**
 * Sebuah tab layak muncul bila perannya benar-benar bisa melihat isinya.
 *
 * Beberapa rute punya lebih dari satu pintu masuk yang sah: Purchasing membuka
 * /expenses untuk tagihan vendor, bukan biaya lapangan. Tab Projects khusus
 * untuk peran yang memiliki hak akses proyek (Owner, Finance, PM), sementara
 * Purchasing beroperasi dari Materials dan Expenses.
 */
const NAV_REQUIREMENTS: Readonly<Record<string, readonly PermissionKey[]>> = {
  Dashboard: ["view:ledger"],
  Projects: ["view:project"],
  Materials: ["view:inventory"],
  Expenses: ["view:cost", "view:vendor_bill"],
};

/**
 * Urutan yang dikorbankan lebih dulu ketika sebuah peran memenuhi syarat lebih
 * dari tiga tab.
 *
 * Materials turun paling akhir: peran yang memegang buku kas datang untuk
 * angkanya, dan gudang tetap terjangkau dari menu bilah atas. Aturan ini yang
 * membuat Owner dan Finance tetap mendapat Dashboard/Projects/Expenses seperti
 * sebelumnya meski izin material mereka lengkap.
 */
const NAV_PRIORITY: readonly string[] = ["Dashboard", "Projects", "Expenses", "Materials"];

/**
 * Sumber kebenaran navigasi utama untuk web dan native.
 *
 * Diturunkan dari izin efektif, bukan nama peran: peran buatan Owner tidak ada
 * di daftar nama mana pun, dan sebelum perubahan ini setiap peran baru mendarat
 * di cabang "tidak dikenal" — dua tab, apa pun yang diberikan Owner padanya.
 */
export function getRoleNavItems(permissions: readonly PermissionKey[]): readonly RoleNavItem[] {
  const held = new Set<PermissionKey>(permissions);
  const eligible = ROLE_NAV_ITEMS.filter((item) =>
    (NAV_REQUIREMENTS[item.label] ?? []).some((permission) => held.has(permission)),
  );
  if (eligible.length <= MAX_NAV_ITEMS) return eligible;

  const kept = new Set(
    [...eligible]
      .sort((left, right) => NAV_PRIORITY.indexOf(left.label) - NAV_PRIORITY.indexOf(right.label))
      .slice(0, MAX_NAV_ITEMS)
      .map((item) => item.label),
  );
  return ROLE_NAV_ITEMS.filter((item) => kept.has(item.label));
}
