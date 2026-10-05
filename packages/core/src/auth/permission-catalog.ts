import type { PermissionKey } from "./permissions";

/**
 * Katalog izin: satu-satunya tempat sebuah kunci izin punya nama manusia dan
 * tempat tinggal.
 *
 * Katalog ini **wajib lengkap**. Sebuah layar yang menyunting izin tetapi tidak
 * bisa menjangkau salah satu kunci bukan layar yang tidak lengkap — ia layar
 * yang berbohong: Owner mengira sudah melihat seluruh akses sebuah peran,
 * padahal ada kunci yang tak pernah ditampilkan dan karena itu tak pernah bisa
 * dicabut. `permission-catalog.test.ts` menegakkan bahwa setiap `PermissionKey`
 * muncul di tepat satu grup dan punya label.
 *
 * Grup di sini adalah taksonomi produk (bagaimana manusia memikirkan modul
 * ERP), bukan struktur teknis. Menambah kunci izin baru berarti menambahnya ke
 * salah satu grup pada berkas ini — tesnya tidak memberi jalan lain.
 */

export type PermissionGroupKey =
  | "workspace"
  | "finance"
  | "budget"
  | "expenses"
  | "material"
  | "planning"
  | "settings"
  | "organization"
  | "ai";

export type PermissionGroup = {
  readonly key: PermissionGroupKey;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly permissions: readonly PermissionKey[];
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "use:desktop_admin": "Menggunakan workspace desktop",
  "view:bank_account": "Melihat rekening dan saldo bank",
  "create:bank_account": "Membuat rekening bank baru",
  "update:bank_account": "Mengubah informasi rekening bank",
  "delete:bank_account": "Mengarsipkan rekening bank",
  "view:ledger": "Melihat catatan buku kas",
  "create:ledger": "Mencatat mutasi buku kas",
  "reconcile:ledger": "Melakukan rekonsiliasi buku kas",
  "view:project": "Melihat proyek",
  "create:project": "Membuat proyek baru",
  "activate:project": "Mengaktifkan proyek",
  "close:project": "Menutup proyek",
  "view:budget": "Melihat budget proyek",
  "create:budget": "Membuat budget proyek",
  "update:budget": "Mengubah budget proyek",
  "approve:budget": "Menyetujui budget proyek",
  "view:cost": "Melihat pengeluaran lapangan",
  "create:cost": "Mengajukan pengeluaran lapangan",
  "update:cost": "Mengubah pengajuan pengeluaran",
  "verify:cost": "Memverifikasi pengeluaran lapangan",
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
  "view:approval_queue": "Melihat antrean persetujuan",
  "decide:all_approvals": "Memutuskan seluruh jenis persetujuan",
  "override:self_approval": "Override persetujuan diri sendiri dalam keadaan darurat",
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
  "create:opening_inventory": "Mengajukan saldo awal inventory",
  "approve:opening_inventory": "Menyetujui dan memposting saldo awal inventory",
  "reverse:opening_inventory": "Membalik posting saldo awal inventory",
  "view:rap": "Melihat RAP internal",
  "create:rap": "Membuat RAP internal",
  "update:rap": "Mengubah RAP internal",
  "lock:rap": "Mengunci RAP internal",
  "view:rab": "Melihat RAB untuk klien",
  "create:rab": "Membuat RAB untuk klien",
  "update:rab": "Mengubah RAB untuk klien",
  "approve:rab": "Menyetujui RAB",
  "manage:onboarding": "Menjalankan onboarding perusahaan",
  "review:onboarding": "Meninjau data awal onboarding",
  "view:settings": "Melihat Pengaturan ERP",
  "manage:approval_settings": "Mengubah ambang persetujuan Owner",
  "manage:budget_settings": "Mengelola default alokasi budget",
  "manage:expense_categories": "Mengelola kategori pengeluaran",
  "manage:item_library": "Mengelola library item dan harga",
  "manage:material_settings": "Mengelola pengaturan master material",
  "manage:users": "Mengelola user dan role internal",
  "manage:roles": "Mengelola peran dan izinnya",
  "manage:vendors": "Mengelola master vendor",
};

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: "workspace",
    title: "Workspace",
    description: "Akses tampilan desktop; izin tindakan dan cakupan data tetap berlaku.",
    iconName: "space_dashboard",
    permissions: ["use:desktop_admin"],
  },
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
      "view:approval_queue",
      "decide:all_approvals",
      "override:self_approval",
    ],
  },
  {
    key: "budget",
    title: "Budget proyek",
    description: "Pembuatan, perubahan, dan persetujuan budget.",
    iconName: "monitoring",
    permissions: [
      "view:project",
      "create:project",
      "activate:project",
      "close:project",
      "view:budget",
      "create:budget",
      "update:budget",
      "approve:budget",
    ],
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
      "verify:cost",
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
      "create:opening_inventory",
      "approve:opening_inventory",
      "reverse:opening_inventory",
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
      "manage:onboarding",
      "review:onboarding",
      "view:settings",
      "manage:approval_settings",
      "manage:budget_settings",
      "manage:expense_categories",
      "manage:item_library",
      "manage:material_settings",
    ],
  },
  {
    key: "organization",
    title: "Tim, vendor & peran",
    description: "Akun internal, master vendor, dan pengaturan akses.",
    iconName: "group",
    permissions: ["manage:users", "manage:vendors", "manage:roles"],
  },
  {
    key: "ai",
    title: "Asisten AI",
    description: "Tanya jawab data dan briefing keuangan.",
    iconName: "sparkle",
    permissions: ["view:ai_brief", "use:ai_chat"],
  },
];

export function getAllCatalogPermissionKeys(): readonly PermissionKey[] {
  return PERMISSION_GROUPS.flatMap((group) => group.permissions);
}

export function describePermission(key: PermissionKey): string {
  return PERMISSION_LABELS[key];
}

/**
 * Izin yang kehilangan pemegang terakhirnya menghentikan sebuah alur kerja.
 *
 * Dipakai `analyzeRoleChangeImpact` untuk memperingatkan sebelum sebuah
 * pencabutan menyisakan **nol** orang di seluruh perusahaan yang bisa
 * menyelesaikan langkah tertentu. Nilainya adalah kalimat akibatnya, bukan nama
 * izinnya — yang perlu dibaca manusia adalah apa yang berhenti jalan.
 *
 * Daftar ini sengaja pendek: hanya langkah yang benar-benar memblokir, bukan
 * setiap izin yang terdengar penting.
 */
export const CRITICAL_PERMISSIONS: Partial<Record<PermissionKey, string>> = {
  "verify:cost": "tidak ada yang bisa memverifikasi pengeluaran lapangan",
  "approve:cost": "tidak ada yang bisa menyetujui pengeluaran lapangan",
  "pay:cost": "tidak ada yang bisa mencairkan pengeluaran lapangan",
  "approve:budget": "tidak ada yang bisa menyetujui budget proyek",
  "approve:rab": "tidak ada yang bisa menyetujui RAB klien",
  "pay:vendor_bill": "tidak ada yang bisa membayar tagihan vendor",
  "reconcile:ledger": "tidak ada yang bisa merekonsiliasi buku kas",
  "reconcile:client_invoice": "tidak ada yang bisa mencatat penerimaan pembayaran klien",
  "approve:stock_count": "tidak ada yang bisa menyetujui hasil stock opname",
  "approve:opening_inventory": "tidak ada yang bisa memposting saldo awal inventory",
  "approve:goods_receipt_reversal": "tidak ada yang bisa menyetujui pembatalan penerimaan barang",
  "create:project": "tidak ada yang bisa membuat proyek baru",
  "activate:project": "tidak ada yang bisa mengaktifkan proyek",
  "manage:users": "tidak ada yang bisa mengelola akun tim",
  "manage:roles": "tidak ada yang bisa mengubah peran dan izin lagi",
};
