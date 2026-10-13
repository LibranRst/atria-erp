import type { PermissionKey } from "@atria/core/auth/permissions";
import type { AiToolContext } from "./context";
export type AiCapability = {
  readonly label: string;
  readonly permissions: readonly PermissionKey[];
  readonly allPermissions?: readonly PermissionKey[];
  readonly scope: "any" | "project" | "global";
  readonly mode: "read" | "proposal";
  readonly dependencies: readonly string[];
  readonly projectScopeExceptionPermission?: PermissionKey;
  readonly permissionLabels?: Partial<Record<PermissionKey, string>>;
};
const read = (
  label: string,
  permissions: readonly PermissionKey[] = [],
  scope: AiCapability["scope"] = "any",
): AiCapability => ({ label, permissions, scope, mode: "read", dependencies: [] });
const proposal = (
  label: string,
  permissions: readonly PermissionKey[],
  scope: AiCapability["scope"] = "any",
  dependencies: readonly string[] = [],
): AiCapability => ({ label, permissions, scope, mode: "proposal", dependencies });
export const AI_CAPABILITIES: Readonly<Record<string, AiCapability>> = {
  getFinancialHistory: read(
    "Riwayat dan perbandingan pengeluaran atau arus kas",
    ["view:cost", "view:bank_account"],
    "project",
  ),
  getQuickStartContext: {
    ...read("Kesiapan dan sumber setup awal", ["manage:onboarding", "create:opening_inventory"]),
    allPermissions: ["use:ai_chat"],
  },
  proposeQuickStart: {
    ...proposal(
      "Progres Quick Start, keputusan stok awal dan proyek pertama",
      ["manage:onboarding", "create:opening_inventory"],
      "any",
      ["getQuickStartContext"],
    ),
    allPermissions: ["use:ai_chat"],
    permissionLabels: {
      "manage:onboarding": "Progres setup dan proyek pertama dengan izin proyek/Settings",
      "create:opening_inventory": "Keputusan kesiapan stok awal tanpa perubahan jumlah stok",
    },
  },
  getOwnProfileContext: {
    ...read("Profil sendiri dan pilihan foto milik Anda"),
    allPermissions: ["use:ai_chat"],
  },
  proposeOwnProfile: {
    ...proposal("Ubah nama dan foto profil sendiri", ["use:ai_chat"], "any", [
      "getOwnProfileContext",
    ]),
    allPermissions: ["use:ai_chat"],
  },
  inspectProjectBudgetSummary: {
    ...read("Pemeriksaan ringkasan budget dan usulan sinkronisasi", [], "project"),
    allPermissions: ["use:ai_chat", "view:project", "view:budget"],
  },
  getRabExportContext: {
    ...read("Pilihan proyek dan revisi untuk ekspor RAB", [], "project"),
    allPermissions: ["use:ai_chat", "view:project", "view:rab"],
  },
  prepareRabExport: {
    ...read("Preview dan unduhan RAB PDF, Excel atau gambar", [], "project"),
    allPermissions: ["use:ai_chat", "view:project", "view:rab"],
  },
  getBankCashContext: read("Rekening dan saldo untuk pencatatan kas", ["view:bank_account"]),
  proposeBankCash: {
    ...proposal(
      "Rekening, kas manual dan transfer antarrekening",
      ["create:bank_account", "update:bank_account", "delete:bank_account", "create:ledger"],
      "any",
      ["getBankCashContext"],
    ),
    allPermissions: ["view:bank_account"],
    permissionLabels: {
      "create:bank_account": "Buat rekening dengan saldo awal yang ditinjau",
      "update:bank_account": "Koreksi informasi dan tampilan rekening",
      "delete:bank_account": "Aktif/nonaktifkan rekening tanpa menghapus transaksi",
      "create:ledger": "Catat dana masuk/keluar dan transfer antarrekening di Atria",
    },
  },
  getClientInvoiceContext: {
    ...read("Konteks invoice klien", ["view:client_invoice"], "project"),
    allPermissions: ["view:project"],
  },
  proposeClientInvoice: {
    ...proposal("Buat invoice klien", ["create:client_invoice"], "project", [
      "getClientInvoiceContext",
    ]),
    allPermissions: ["view:client_invoice", "view:project"],
  },
  proposeClientInvoiceSchedule: {
    ...proposal("Buat jadwal termin klien", ["create:client_invoice"], "project", [
      "getClientInvoiceContext",
    ]),
    allPermissions: ["view:client_invoice", "view:project"],
  },
  getBudgetSettingsContext: {
    ...read("Default budget untuk koreksi", ["manage:budget_settings"], "any"),
    allPermissions: ["view:settings"],
  },
  proposeBudgetSettings: {
    ...proposal("Ubah default budget perusahaan", ["manage:budget_settings"], "any", [
      "getBudgetSettingsContext",
    ]),
    allPermissions: ["view:settings"],
  },
  getAdministrationContext: read(
    "Staf dan peran untuk administrasi",
    ["manage:users", "manage:roles"],
    "any",
  ),
  proposeStaffChanges: proposal("Koreksi data/status/peran staf", ["manage:users"], "any", [
    "getAdministrationContext",
  ]),
  proposeRoleDetails: proposal("Koreksi detail/cakupan peran", ["manage:roles"], "any", [
    "getAdministrationContext",
  ]),
  proposeRoleDeletion: proposal("Hapus peran kustom tidak terpakai", ["manage:roles"], "any", [
    "getAdministrationContext",
  ]),
  getOperationalSettingsContext: {
    ...read("Ambang persetujuan perusahaan", ["view:settings"], "any"),
    allPermissions: ["view:settings"],
  },
  getExpenseCategorySettingsContext: {
    ...read("Pengaturan kategori pengeluaran", ["view:settings"], "any"),
    allPermissions: ["view:settings"],
  },
  proposeApprovalThresholds: {
    ...proposal("Ubah ambang persetujuan", ["manage:approval_settings"], "any", [
      "getOperationalSettingsContext",
    ]),
    allPermissions: ["view:settings"],
  },
  proposeExpenseCategorySettings: {
    ...proposal("Koreksi pengaturan kategori", ["manage:expense_categories"], "any", [
      "getExpenseCategorySettingsContext",
    ]),
    allPermissions: ["view:settings"],
  },
  listProjects: read("Daftar proyek", ["view:project"], "project"),
  getProjectsAtRisk: read("Risiko proyek", ["view:budget"], "project"),
  getProjectBudget: read("Budget proyek", ["view:budget"], "project"),
  getCompanyBudgetDefaults: read("Pengaturan budget perusahaan", ["view:settings"]),
  getProjectHealth: read("Kondisi proyek", ["view:project"], "project"),
  getBankBalances: read("Saldo rekening", ["view:bank_account"]),
  getPendingApprovals: read("Antrean persetujuan", ["view:cost"], "global"),
  getUpcomingBills: read("Tagihan mendatang", ["view:vendor_bill"], "project"),
  getMaterialShortage: read("Kekurangan material", ["view:material"], "project"),
  getRecentExpenses: read("Pengeluaran terbaru", ["view:cost"], "project"),
  getExpenseCategories: read("Kategori pengeluaran", ["create:cost", "view:budget"]),
  listVendors: read("Cari vendor", ["manage:vendors", "view:vendor_bill"]),
  listClients: read("Cari klien", ["create:project"], "global"),
  getMaterialCatalog: {
    ...read("Katalog material dan stok", ["view:material"]),
    allPermissions: ["view:inventory"],
  },
  getInventoryLocations: read("Lokasi inventory", ["view:material"]),
  getUnpaidVendorBills: read("Tagihan vendor belum dibayar", ["view:vendor_bill"], "project"),
  getUnpaidClientInvoices: read("Tagihan klien belum dibayar", ["view:cost"], "project"),
  getPendingExpenseApprovals: read("Pengeluaran menunggu approval", ["approve:cost"], "global"),
  explainUserAccess: read("Jelaskan akses pengguna"),
  whoCanDo: read("Pemegang izin", ["manage:roles"]),
  analyzeRoleChangeImpact: read("Dampak perubahan peran", ["manage:roles"]),
  listRoles: read("Daftar peran", ["manage:roles", "manage:users"]),
  suggestRoleReview: read("Review peran", ["manage:roles"]),
  proposeCreateUser: proposal("Buat pengguna", ["manage:users"], "any", ["listRoles"]),
  proposeCreateUserBatch: proposal("Buat pengguna batch", ["manage:users"], "any", ["listRoles"]),
  proposeCreateRole: proposal("Buat peran", ["manage:roles"]),
  proposeRoleChange: proposal("Ubah izin peran", ["manage:roles"], "any", ["listRoles"]),
  proposeCreateProject: {
    ...proposal("Buat proyek", ["create:budget"], "global", ["listClients"]),
    allPermissions: ["create:project"],
  },
  proposeSetupProjectBudget: proposal("Setup budget", ["create:budget"], "project", [
    "listProjects",
    "getCompanyBudgetDefaults",
  ]),
  getExpenseBatchContext: {
    ...read("Draft dan pengeluaran batch", ["create:cost", "view:cost"], "project"),
    allPermissions: ["view:project"],
  },
  proposeExpenseBatch: {
    ...proposal("Siapkan pengeluaran batch", ["create:cost"], "project", [
      "getExpenseBatchContext",
    ]),
    allPermissions: ["view:project"],
  },
  proposeExpenseBatchVerify: {
    ...proposal("Verifikasi pengeluaran batch", ["verify:cost"], "project", [
      "getExpenseBatchContext",
    ]),
    allPermissions: ["view:project", "view:cost", "update:cost"],
  },
  proposeExpenseBatchDecision: {
    ...proposal("Setujui/tolak pengeluaran batch", ["approve:cost"], "project", [
      "getExpenseBatchContext",
    ]),
    allPermissions: ["view:project", "view:cost"],
  },
  proposeExpenseBatchPayment: {
    ...proposal("Bayar pengeluaran batch", ["pay:cost"], "project", ["getExpenseBatchContext"]),
    allPermissions: ["view:project", "view:cost", "view:bank_account"],
  },
  proposeExpenseDraft: proposal("Input pengeluaran", ["create:cost"], "project", [
    "listProjects",
    "getExpenseCategories",
  ]),
  proposeExpenseReview: proposal("Review pengeluaran", ["approve:cost"], "global"),
  proposeDisburseExpense: proposal("Bayar pengeluaran", ["pay:cost"], "global"),
  getVendorPaymentContext: {
    ...read("Tagihan, jadwal dan approval vendor", ["view:vendor_bill"], "project"),
    allPermissions: ["view:project"],
  },
  proposeVendorPaymentSchedule: {
    ...proposal("Jadwalkan pembayaran vendor", ["pay:vendor_bill"], "project", [
      "getVendorPaymentContext",
    ]),
    allPermissions: ["view:vendor_bill", "view:project", "view:bank_account"],
  },
  proposeVendorPaymentDecision: {
    ...proposal("Setujui atau tolak jadwal pembayaran vendor", ["approve:cost"], "project", [
      "getVendorPaymentContext",
    ]),
    allPermissions: ["view:vendor_bill", "view:project"],
  },
  proposeVendorBillPayment: {
    ...proposal("Catat pembayaran vendor", ["pay:vendor_bill"], "project", [
      "getVendorPaymentContext",
    ]),
    allPermissions: ["view:vendor_bill", "view:project", "view:bank_account"],
  },
  proposeRecordClientPayment: proposal(
    "Catat pembayaran klien",
    ["reconcile:client_invoice"],
    "project",
  ),
  getBankReconciliationContext: {
    ...read("Mutasi, pasangan dan riwayat rekonsiliasi", ["reconcile:ledger"]),
    allPermissions: ["view:bank_account"],
  },
  analyzeBankStatementAttachment: {
    ...read("Analisis lampiran mutasi bank", ["reconcile:ledger"]),
    allPermissions: ["view:bank_account"],
  },
  proposeBankReconciliation: {
    ...proposal("Impor, pencocokan dan pengecualian rekonsiliasi", ["reconcile:ledger"], "any", [
      "getBankReconciliationContext",
      "analyzeBankStatementAttachment",
    ]),
    allPermissions: ["view:bank_account"],
  },
  proposeGoodsReceipt: {
    ...proposal("Penerimaan material proyek", ["create:stock_movement"], "any", [
      "getWarehouseIntakeContext",
    ]),
    allPermissions: ["view:material", "view:inventory"],
  },
  getMaterialInputContext: read("Pilihan input material", ["manage:material_settings"]),
  getEditableMaterials: read("Cari material untuk diedit", ["manage:material_settings"]),
  getRapDraftContext: {
    ...read("Proyek, budget dan material untuk RAP", ["update:rap"], "project"),
    allPermissions: ["view:budget", "view:material"],
  },
  proposeRapMaterialDraft: {
    ...proposal("Siapkan draft RAP Material", ["update:rap"], "project", ["getRapDraftContext"]),
    allPermissions: ["view:budget", "view:material"],
  },
  getRabDraftContext: {
    ...read("Sumber dan harga jual untuk draft RAB", ["create:rab"], "project"),
    allPermissions: ["view:rap", "view:rab"],
  },
  proposeRabDraft: {
    ...proposal("Buat draft RAB dari sumber terpilih", ["create:rab"], "project", [
      "getRabDraftContext",
    ]),
    allPermissions: ["view:rap", "view:rab"],
  },
  getRapLifecycleContext: {
    ...read("Revisi RAP dan perubahan status paket", ["update:rap", "update:budget"], "project"),
    allPermissions: ["view:rap", "view:budget"],
  },
  proposeRapLifecycleActions: {
    ...proposal(
      "Input library/manual, revisi RAP, Edit Lagi dan hapus paket",
      ["update:rap", "update:budget"],
      "project",
      ["getRapLifecycleContext"],
    ),
    allPermissions: ["view:rap", "view:budget"],
  },
  getRapSetupContext: {
    ...read("Kesiapan tahap RAP dan budget", ["view:rap"], "project"),
    allPermissions: ["view:budget"],
  },
  proposeRapSetupActions: {
    ...proposal(
      "Siapkan paket, scope, tahap dan finalisasi RAP",
      ["update:rap", "update:budget", "lock:rap"],
      "project",
      ["getRapSetupContext"],
    ),
    allPermissions: ["view:rap", "view:budget"],
  },
  getCategoryPlanContext: {
    ...read("Proyek, budget dan referensi paket Tukang/Subcon", ["update:budget"], "project"),
    allPermissions: ["view:budget"],
  },
  proposeCategoryPlanPackages: {
    ...proposal("Buat/edit paket Draft Tukang/Subcon", ["update:budget"], "project", [
      "getCategoryPlanContext",
    ]),
    allPermissions: ["view:budget"],
  },
  getEditableRapItems: {
    ...read("Cari item RAP tersimpan", ["update:rap"], "project"),
    allPermissions: ["view:budget", "view:material"],
  },
  proposeRapMaterialChanges: {
    ...proposal("Edit/hapus item RAP Draft tersimpan", ["update:rap"], "project", [
      "getEditableRapItems",
    ]),
    allPermissions: ["view:budget", "view:material"],
  },
  proposeUpdateMaterial: proposal(
    "Edit atau ubah status Material Master",
    ["manage:material_settings"],
    "any",
    ["getEditableMaterials"],
  ),
  getMaterialDraftForCorrection: read("Draft material", ["manage:material_settings"]),
  proposeMaterialMaster: proposal(
    "Tambah material satuan atau batch",
    ["manage:material_settings"],
    "any",
    ["getMaterialInputContext"],
  ),
  getAvailableActions: read("Kemampuan asisten"),
  getProjectStockContext: {
    ...read("Stok proyek, reservasi dan pemakaian", ["view:material"], "project"),
    projectScopeExceptionPermission: "create:stock_movement",
  },
  proposeProjectStock: {
    ...proposal(
      "Reservasi, pelepasan, pemakaian, pengembalian dan waste stok proyek",
      ["reserve:stock", "use:stock", "waste:stock"],
      "project",
      ["getProjectStockContext"],
    ),
    allPermissions: ["view:material"],
    projectScopeExceptionPermission: "create:stock_movement",
    permissionLabels: {
      "reserve:stock": "Reservasi dan pelepasan kuota stok proyek",
      "waste:stock": "Pencatatan material terbuang dengan alasan audit",
      "use:stock": "Pemakaian dan pengembalian stok proyek",
    },
  },
  getRabWorkflowContext: read("RAB tersimpan dan Change Order", ["view:rab"], "project"),
  proposeRabWorkflow: {
    ...proposal(
      "Koreksi/paket RAB, revisi dan keputusan Change Order",
      ["update:rab", "create:rab", "approve:rab"],
      "project",
      ["getRabWorkflowContext"],
    ),
    allPermissions: ["view:rab"],
    permissionLabels: {
      "update:rab":
        "Koreksi/paket dan pembaruan sumber RAB Draft, draft dan konfirmasi klien Change Order, pembatalan revisi",
      "create:rab": "Buat Draft revisi RAB dari baseline disetujui",
      "approve:rab": "Persetujuan awal RAB dan keputusan Change Order sesuai aturan pemeriksa",
    },
  },
  getProjectManagementContext: {
    ...read(
      "Proyek, PM dan budget saat ini",
      ["update:budget", "create:project", "activate:project", "close:project", "approve:budget"],
      "project",
    ),
    allPermissions: ["view:project"],
  },
  proposeProjectManagement: {
    ...proposal(
      "Koreksi proyek, penugasan PM, aktivasi/closing dan keputusan budget",
      ["update:budget", "create:project", "activate:project", "close:project", "approve:budget"],
      "project",
      ["getProjectManagementContext"],
    ),
    allPermissions: ["view:project"],
    permissionLabels: {
      "update:budget": "Koreksi informasi proyek, alokasi dan pengajuan budget",
      "create:project": "Tugaskan Project Manager aktif",
      "activate:project": "Aktifkan proyek yang memenuhi kesiapan",
      "close:project": "Tutup proyek dengan checklist dan profitabilitas",
      "approve:budget": "Keputusan budget dan realokasi budget disetujui",
    },
  },
  getCatalogSettingsContext: read("Vendor, library harga dan default inventory", [
    "manage:vendors",
    "manage:item_library",
    "manage:material_settings",
  ]),
  proposeCatalogSettings: {
    ...proposal(
      "Pengaturan vendor, item/harga, template dan inventory",
      ["manage:vendors", "manage:item_library", "manage:material_settings"],
      "any",
      ["getCatalogSettingsContext"],
    ),
    permissionLabels: {
      "manage:vendors": "Buat, koreksi dan aktif/nonaktifkan vendor",
      "manage:item_library": "Buat, koreksi dan arsip item, template harga dan komponen biaya",
      "manage:material_settings": "Ubah default inventory dan tinjau valuasi persediaan",
    },
  },
  getVendorBillContext: read("Sumber dan draft tagihan vendor", ["create:vendor_bill"], "project"),
  proposeVendorBill: proposal(
    "Simpan draft dan ajukan tagihan vendor belum dibayar",
    ["create:vendor_bill"],
    "project",
    ["getVendorBillContext"],
  ),
  getVendorBillCorrectionContext: {
    ...read("Tagihan tersimpan, pembayaran dan batas koreksi", ["update:vendor_bill"], "project"),
    allPermissions: ["view:vendor_bill"],
  },
  proposeVendorBillCorrection: {
    ...proposal(
      "Koreksi nomor, jatuh tempo, catatan dan nominal tagihan tersimpan",
      ["update:vendor_bill"],
      "project",
      ["getVendorBillCorrectionContext"],
    ),
    allPermissions: ["view:vendor_bill"],
  },
  getWarehouseContext: {
    ...read("Lokasi, persediaan, penerimaan dan stock opname", [
      "transfer:stock",
      "create:stock_count",
      "approve:stock_count",
      "request:goods_receipt_reversal",
      "approve:goods_receipt_reversal",
    ]),
    allPermissions: ["view:material", "view:inventory"],
  },
  getWarehouseIntakeContext: {
    ...read("Sumber penerimaan, stok masuk dan saldo awal inventory", [
      "create:stock_movement",
      "create:opening_inventory",
      "approve:opening_inventory",
      "reverse:opening_inventory",
    ]),
    allPermissions: ["view:material", "view:inventory"],
  },
  getStockCorrectionContext: {
    ...read("Sumber koreksi stok gudang", ["adjust:stock"]),
    allPermissions: ["view:material", "view:inventory"],
  },
  proposeStockCorrection: {
    ...proposal("Koreksi stok fisik dengan alasan audit", ["adjust:stock"], "any", [
      "getStockCorrectionContext",
    ]),
    allPermissions: ["view:material", "view:inventory"],
  },
  proposeWarehouseIntake: {
    ...proposal(
      "Penerimaan banyak material, stok masuk dan saldo awal inventory",
      [
        "create:stock_movement",
        "create:opening_inventory",
        "approve:opening_inventory",
        "reverse:opening_inventory",
      ],
      "any",
      ["getWarehouseIntakeContext"],
    ),
    allPermissions: ["view:material", "view:inventory"],
    permissionLabels: {
      "create:stock_movement": "Terima material proyek atau catat stok masuk perusahaan",
      "create:opening_inventory": "Ajukan saldo awal inventory kosong",
      "approve:opening_inventory": "Setujui sebagai pemeriksa lain atau tolak saldo awal",
      "reverse:opening_inventory": "Balik saldo awal yang belum memiliki pergerakan berikutnya",
    },
  },
  proposeWarehouseOperation: {
    ...proposal(
      "Transfer, stock opname dan pembatalan penerimaan",
      [
        "transfer:stock",
        "create:stock_count",
        "approve:stock_count",
        "request:goods_receipt_reversal",
        "approve:goods_receipt_reversal",
      ],
      "any",
      ["getWarehouseContext"],
    ),
    allPermissions: ["view:material", "view:inventory"],
    permissionLabels: {
      "transfer:stock": "Transfer stok antar lokasi",
      "request:goods_receipt_reversal": "Ajukan pembatalan penerimaan dengan alasan",
      "approve:goods_receipt_reversal":
        "Setujui atau tolak pembatalan penerimaan sesuai aturan pemeriksa",
      "create:stock_count": "Simpan dan ajukan hasil stock opname",
      "approve:stock_count": "Setujui atau tolak stock opname sesuai aturan pemeriksa",
    },
  },
  suggestFollowUps: read("Saran lanjutan"),
  requestUserInput: read("Pertanyaan klarifikasi"),
};
export function capabilityAvailable(context: AiToolContext, capability: AiCapability): boolean {
  return (
    context.permissions.includes("use:ai_chat") &&
    (capability.allPermissions ?? []).every((key) => context.permissions.includes(key)) &&
    (capability.permissions.length === 0 ||
      capability.permissions.some((key) => context.permissions.includes(key))) &&
    (capability.scope === "any" ||
      (capability.scope === "global"
        ? context.dataScope === "GLOBAL"
        : context.dataScope !== "NONE" ||
          Boolean(
            capability.projectScopeExceptionPermission &&
            context.permissions.includes(capability.projectScopeExceptionPermission),
          )))
  );
}
export function availableAiCapabilities(
  context: AiToolContext,
): { tool: string; label: string; mode: AiCapability["mode"]; scope: AiCapability["scope"] }[] {
  return Object.entries(AI_CAPABILITIES)
    .filter(([, capability]) => capabilityAvailable(context, capability))
    .map(([name, capability]) => ({
      tool: name,
      label: capability.permissionLabels
        ? capability.permissions
            .filter((key) => context.permissions.includes(key))
            .map((key) => capability.permissionLabels?.[key])
            .filter(Boolean)
            .join("; ")
        : capability.label,
      mode: capability.mode,
      scope: capability.scope,
    }));
}

const MANUAL_ACTIONS: readonly (AiCapability & { readonly href: string })[] = [
  { ...read("Penyesuaian darurat stok", ["adjust:stock"]), href: "/materials" },
];
const SUPPORT_TOOLS = new Set([
  "getAvailableActions",
  "suggestFollowUps",
  "requestUserInput",
  "explainUserAccess",
]);
/** Describes implemented chat actions, separately from ERP authorization. */
export function aiCapabilityReport(context: AiToolContext): {
  readonly read: ReturnType<typeof availableAiCapabilities>;
  readonly proposals: ReturnType<typeof availableAiCapabilities>;
  readonly manual: readonly { readonly label: string; readonly href: string }[];
  readonly projectCreation: { readonly available: boolean; readonly reason?: string };
} {
  const actions = availableAiCapabilities(context).filter(
    (action) => !SUPPORT_TOOLS.has(action.tool),
  );
  return {
    read: actions.filter((action) => action.mode === "read"),
    proposals: actions.filter((action) => action.mode === "proposal"),
    manual: MANUAL_ACTIONS.filter((action) => capabilityAvailable(context, action)).map(
      ({ label, href }) => ({ label, href }),
    ),
    projectCreation: {
      available: capabilityAvailable(context, AI_CAPABILITIES.proposeCreateProject),
      ...(!capabilityAvailable(context, AI_CAPABILITIES.proposeCreateProject)
        ? {
            reason: `Pembuatan proyek reguler beserta budget sudah diimplementasikan melalui chat, tetapi akses akun ini belum memenuhi syarat. Yang belum tersedia: ${[
              !context.permissions.includes("use:ai_chat") ? "akses Asisten AI" : null,
              !context.permissions.includes("create:project") ? "izin membuat proyek" : null,
              !context.permissions.includes("create:budget") ? "izin membuat budget proyek" : null,
              context.dataScope !== "GLOBAL" ? "cakupan akses global" : null,
            ]
              .filter(Boolean)
              .join(
                ", ",
              )}. Minta admin memeriksa akses. Quick Start yang selesai tidak dapat diulang untuk melewati batas ini.`,
          }
        : {}),
    },
  };
}
