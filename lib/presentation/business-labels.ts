const BUSINESS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  DRAFT: "Draf",
  SUBMITTED: "Diajukan",
  VERIFIED: "Terverifikasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  PAID: "Lunas",
  UNPAID: "Belum dibayar",
  PARTIALLY_PAID: "Dibayar sebagian",
  OVERDUE: "Terlambat",
  VOID: "Dibatalkan",
  CANCELLED: "Dibatalkan",
  PENDING: "Menunggu",
  PENDING_APPROVAL: "Menunggu persetujuan",
  PENDING_REVIEW: "Menunggu peninjauan",
  PENDING_CLIENT: "Menunggu klien",
  PROCESSING: "Sedang diproses",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  POSTED: "Diposting",
  REVERSED: "Dibatalkan",
  REVERSAL_REQUESTED: "Pembatalan diajukan",
  READY: "Siap",
  READY_TO_SEND: "Siap dikirim",
  WAITING_PURCHASE: "Menunggu pembelian",
  NEEDS_VERIFICATION: "Perlu diverifikasi",
  NEEDS_APPROVAL: "Perlu disetujui",
  READY_TO_PAY: "Siap dicairkan",
  ON_HOLD: "Ditunda",
  LOW_STOCK: "Stok menipis",
  OUT_OF_STOCK: "Stok habis",
  OVER_BUDGET: "Melebihi budget",
  LOCKED: "Terkunci",
  PLANNED: "Direncanakan",
  SHORTAGE: "Kekurangan",
  AVAILABLE: "Tersedia",
  RESERVED: "Direservasi",
  CRITICAL: "Kritis",
  WARNING: "Perlu perhatian",
  HEALTHY: "Aman",
  PRIMARY: "Utama",
  SAFE: "Aman",
  WATCH: "Perlu dipantau",
  AT_RISK: "Berisiko",
  OPENING_BALANCE: "Saldo awal",
  OWNER_CAPITAL: "Setoran modal owner",
  BANK_FEE: "Biaya administrasi bank",
  CORRECTION: "Koreksi saldo",
  CASH_ADJUSTMENT: "Penyesuaian kas",
  OTHER: "Lainnya",
  CLIENT_PAYMENT: "Pembayaran klien",
  VENDOR_PAYMENT: "Pembayaran vendor",
  PROJECT_COST: "Pengeluaran proyek",
  PETTY_CASH_REFILL: "Pengisian kas kecil",
  BANK_TRANSFER: "Transfer antar rekening",
  CASH_TRANSACTION: "Transaksi kas",
  CLIENT_INVOICE: "Invoice klien",
  VENDOR_BILL: "Tagihan vendor",
  PROJECT_BUDGET: "Budget proyek",
  INVENTORY_OPENING: "Saldo awal stok",
  GOODS_RECEIPT: "Penerimaan barang",
  GOODS_RECEIPT_REVERSAL: "Pembatalan penerimaan barang",
  STOCK_TRANSFER: "Transfer stok",
  STOCK_COUNT: "Stock opname",
  STOCK_COUNT_ADJUSTMENT: "Penyesuaian stock opname",
  STOCK_IN: "Stok masuk",
  STOCK_OUT: "Stok keluar",
  TRANSFER_IN: "Transfer masuk",
  TRANSFER_OUT: "Transfer keluar",
  EMERGENCY_ADJUSTMENT: "Penyesuaian darurat",
  ADJUSTMENT: "Penyesuaian stok",
  RESERVE: "Reservasi stok",
  USE: "Pemakaian material",
  RETURN: "Pengembalian material",
  WASTE: "Material terbuang",
  DEBIT: "Kas masuk",
  CREDIT: "Kas keluar",
  FINANCE_ADMIN: "Finance Admin",
  PROJECT_MANAGER: "Project Manager",
  OWNER: "Owner",
  PURCHASING: "Purchasing",
  SALES: "Sales",
  DESIGNER: "Designer",
  MARKETING: "Marketing",
  MATERIAL_ITEM: "Item material",
  WORK_PACKAGE: "Paket kerja",
  SUBCON_PACKAGE: "Paket subcon",
  CLIENT_LINE: "Baris penawaran klien",
  COST_BREAKDOWN: "Rincian biaya",
  VENDOR_QUOTE: "Penawaran vendor",
  HISTORICAL: "Riwayat harga",
  LEGACY_BACKFILL: "Data lama",
};

export type BusinessLabelDomain = "FINANCE" | "INVENTORY";

const DOMAIN_LABELS: Readonly<Record<BusinessLabelDomain, Readonly<Record<string, string>>>> = {
  FINANCE: { OPENING_BALANCE: "Saldo awal rekening" },
  INVENTORY: { OPENING_BALANCE: "Saldo awal stok" },
};

function fallbackLabel(value: string): string {
  const words = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  if (!words) return "—";
  const withAcronyms = words.replace(/\b(rap|rab|pm|dp|id)\b/g, (word) => word.toUpperCase());
  return withAcronyms.charAt(0).toLocaleUpperCase("id-ID") + withAcronyms.slice(1);
}

/** Convert canonical enum/reference codes into concise user-facing Bahasa Indonesia. */
export function formatBusinessLabel(
  value: string | null | undefined,
  domain?: BusinessLabelDomain,
): string {
  if (!value?.trim()) return "—";
  const normalized = value.trim().toLocaleUpperCase("en-US");
  if (domain) {
    const domainLabel = DOMAIN_LABELS[domain][normalized];
    if (domainLabel) return domainLabel;
  }
  return BUSINESS_LABELS[normalized] ?? fallbackLabel(value);
}

export function hasRawBusinessSeparator(value: string): boolean {
  return /[_-]/.test(value);
}
