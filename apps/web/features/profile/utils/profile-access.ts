import type { PermissionKey } from "@/lib/auth/permissions";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

type PermissionGroupDefinition = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly permissions: readonly PermissionKey[];
};

export type ProfileAccessGroup = PermissionGroupDefinition & {
  readonly activePermissionDescriptions: readonly string[];
};

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "view:bank_account": "Melihat rekening dan saldo bank",
  "create:bank_account": "Membuat rekening bank baru",
  "update:bank_account": "Mengubah informasi rekening bank",
  "delete:bank_account": "Mengarsipkan rekening bank",
  "view:ledger": "Melihat catatan buku kas",
  "create:ledger": "Mencatat mutasi buku kas",
  "reconcile:ledger": "Melakukan rekonsiliasi buku kas",
  "view:budget": "Melihat budget proyek",
  "create:budget": "Membuat budget proyek",
  "update:budget": "Mengubah budget proyek",
  "approve:budget": "Menyetujui budget proyek",
  "view:cost": "Melihat pengeluaran lapangan",
  "create:cost": "Mengajukan pengeluaran lapangan",
  "update:cost": "Mengubah pengajuan pengeluaran",
  "approve:cost": "Menyetujui pengeluaran lapangan",
  "pay:cost": "Mencairkan pengeluaran lapangan",
  "view:vendor_bill": "Melihat tagihan vendor",
  "create:vendor_bill": "Mencatat tagihan vendor",
  "update:vendor_bill": "Mengubah tagihan vendor",
  "pay:vendor_bill": "Membayar tagihan vendor",
  "view:client_invoice": "Melihat invoice klien",
  "create:client_invoice": "Membuat invoice klien",
  "update:client_invoice": "Mengubah invoice klien",
  "reconcile:client_invoice": "Mencatat penerimaan pembayaran klien",
  "view:profitability": "Melihat posisi margin proyek",
  "view:ai_brief": "Melihat briefing keuangan AI",
  "use:ai_chat": "Bertanya ke asisten AI",
  "view:material": "Melihat master material",
  "create:material": "Membuat master material",
  "update:material": "Mengubah master material",
  "view:inventory": "Melihat persediaan material",
  "create:stock_movement": "Mencatat pergerakan stok",
  "reserve:stock": "Mereservasi stok untuk proyek",
  "use:stock": "Mencatat penggunaan stok",
  "adjust:stock": "Menyesuaikan jumlah stok",
  "waste:stock": "Mencatat material terbuang",
  "transfer:stock": "Memindahkan stok antar lokasi",
  "create:stock_count": "Membuat perhitungan stok",
  "approve:stock_count": "Menyetujui perhitungan stok",
  "request:goods_receipt_reversal": "Meminta pembatalan penerimaan barang",
  "approve:goods_receipt_reversal": "Menyetujui pembatalan penerimaan barang",
  "view:rap": "Melihat RAP internal",
  "create:rap": "Membuat RAP internal",
  "update:rap": "Mengubah RAP internal",
  "lock:rap": "Mengunci RAP internal",
  "view:rab": "Melihat RAB untuk klien",
  "create:rab": "Membuat RAB untuk klien",
  "update:rab": "Mengubah RAB untuk klien",
  "approve:rab": "Menyetujui RAB",
  "view:settings": "Melihat Pengaturan ERP",
  "manage:budget_settings": "Mengelola default alokasi budget",
  "manage:expense_categories": "Mengelola kategori pengeluaran",
  "manage:item_library": "Mengelola library item dan harga",
  "manage:material_settings": "Mengelola pengaturan master material",
  "manage:users": "Mengelola user dan role internal",
  "manage:vendors": "Mengelola master vendor",
  "create:opening_inventory": "Mengajukan saldo awal inventory",
  "approve:opening_inventory": "Menyetujui dan memposting saldo awal inventory",
  "reverse:opening_inventory": "Membalik posting saldo awal inventory",
};

const PROFILE_PERMISSION_GROUPS: readonly PermissionGroupDefinition[] = [
  {
    key: "finance",
    title: "Kontrol keuangan",
    description: "Kas, rekening, buku kas, dan posisi margin.",
    iconName: "account_balance",
    permissions: [
      "view:bank_account",
      "create:bank_account",
      "update:bank_account",
      "delete:bank_account",
      "view:ledger",
      "create:ledger",
      "reconcile:ledger",
      "view:profitability",
    ],
  },
  {
    key: "budget",
    title: "Budget proyek",
    description: "Pembuatan, perubahan, dan persetujuan budget.",
    iconName: "monitoring",
    permissions: ["view:budget", "create:budget", "update:budget", "approve:budget"],
  },
  {
    key: "expenses",
    title: "Pengeluaran & tagihan",
    description: "Biaya lapangan, tagihan vendor, dan invoice klien.",
    iconName: "receipt_long",
    permissions: [
      "view:cost",
      "create:cost",
      "update:cost",
      "approve:cost",
      "pay:cost",
      "view:vendor_bill",
      "create:vendor_bill",
      "update:vendor_bill",
      "pay:vendor_bill",
      "view:client_invoice",
      "create:client_invoice",
      "update:client_invoice",
      "reconcile:client_invoice",
    ],
  },
  {
    key: "material",
    title: "Material & stok",
    description: "Master material, persediaan, penggunaan, dan audit stok.",
    iconName: "inventory_2",
    permissions: [
      "view:material",
      "create:material",
      "update:material",
      "view:inventory",
      "create:stock_movement",
      "reserve:stock",
      "use:stock",
      "adjust:stock",
      "waste:stock",
      "transfer:stock",
      "create:stock_count",
      "approve:stock_count",
      "request:goods_receipt_reversal",
      "approve:goods_receipt_reversal",
    ],
  },
  {
    key: "planning",
    title: "RAP & RAB",
    description: "Rencana internal dan dokumen penawaran untuk klien.",
    iconName: "fact_check",
    permissions: [
      "view:rap",
      "create:rap",
      "update:rap",
      "lock:rap",
      "view:rab",
      "create:rab",
      "update:rab",
      "approve:rab",
    ],
  },
  {
    key: "settings",
    title: "Pengaturan ERP",
    description: "Default budget, kategori, library harga, dan master material.",
    iconName: "tune",
    permissions: [
      "view:settings",
      "manage:budget_settings",
      "manage:expense_categories",
      "manage:item_library",
      "manage:material_settings",
    ],
  },
];

export function summarizeProfileAccess(
  permissions: readonly PermissionKey[],
): readonly ProfileAccessGroup[] {
  const activePermissions = new Set<PermissionKey>(permissions);

  return PROFILE_PERMISSION_GROUPS.map((group) => ({
    ...group,
    activePermissionDescriptions: group.permissions
      .filter((permission) => activePermissions.has(permission))
      .map((permission) => PERMISSION_DESCRIPTIONS[permission]),
  }));
}

export function countAccessibleProfileModules(groups: readonly ProfileAccessGroup[]): number {
  return groups.filter((group) => group.activePermissionDescriptions.length > 0).length;
}

export function getProfileInitials(name: string): string {
  const initials = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "A";
}

export function formatProfileRole(roleName: string): string {
  const roleLabels: Readonly<Record<string, string>> = {
    OWNER: "Owner",
    FINANCE_ADMIN: "Finance Admin",
    PROJECT_MANAGER: "Project Manager",
    PURCHASING: "Purchasing",
    DESIGNER: "Designer",
  };

  return roleLabels[roleName] ?? formatBusinessLabel(roleName);
}
