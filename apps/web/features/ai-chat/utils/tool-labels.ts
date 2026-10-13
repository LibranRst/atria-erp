import type { ActivityTrace } from "./activity-summary";
/**
 * `interrupted` bukan keadaan yang dikirim SDK. Serikat keadaan tool hanya
 * punya empat nilai dan tidak satu pun berarti "dibatalkan", jadi tool yang
 * berhenti di tengah tetap terlihat persis seperti tool yang masih berjalan.
 * Yang membedakan hanya konteksnya: masih tertahan padahal alirannya sudah
 * berhenti. Baris yang terus berputar setelah pengguna menekan berhenti adalah
 * kebohongan yang dipertahankan antarmuka.
 */
export type ToolTraceState = "running" | "done" | "failed" | "interrupted";

const TOOL_LABELS: Record<
  string,
  { readonly running: string; readonly done: string; readonly failed: string }
> = {
  getQuickStartContext: {
    running: "Memeriksa kesiapan setup",
    done: "Posisi setup diperiksa",
    failed: "Setup belum dapat diperiksa",
  },
  proposeQuickStart: {
    running: "Menyiapkan langkah setup",
    done: "Langkah setup siap ditinjau",
    failed: "Langkah setup belum dapat disiapkan",
  },
  getVendorBillCorrectionContext: {
    running: "Memeriksa tagihan tersimpan",
    done: "Tagihan dan batas koreksi diperiksa",
    failed: "Tagihan belum dapat diperiksa",
  },
  proposeVendorBillCorrection: {
    running: "Menyiapkan koreksi tagihan",
    done: "Koreksi tagihan siap ditinjau",
    failed: "Koreksi tagihan belum dapat disiapkan",
  },
  getProjectManagementContext: {
    running: "Memeriksa proyek dan budget",
    done: "Proyek dan budget diperiksa",
    failed: "Proyek belum dapat dibaca",
  },
  proposeProjectManagement: {
    running: "Menyiapkan keputusan proyek",
    done: "Keputusan siap ditinjau",
    failed: "Keputusan belum dapat disiapkan",
  },
  getClientInvoiceContext: {
    running: "Memeriksa tagihan klien",
    done: "Tagihan klien diperiksa",
    failed: "Tagihan klien belum dapat diperiksa",
  },
  proposeClientInvoiceSchedule: {
    running: "Menyiapkan jadwal termin klien",
    done: "Jadwal termin siap ditinjau",
    failed: "Jadwal termin belum dapat disiapkan",
  },
  proposeClientInvoice: {
    running: "Menyiapkan tagihan klien",
    done: "Usulan tagihan klien siap",
    failed: "Usulan tagihan klien belum siap",
  },
  getBudgetSettingsContext: {
    running: "Memeriksa default budget",
    done: "Default budget diperiksa",
    failed: "Default budget belum dapat diperiksa",
  },
  getRabExportContext: {
    running: "Mencari revisi RAB",
    done: "Revisi RAB diperiksa",
    failed: "Revisi RAB belum dapat dibaca",
  },
  getOwnProfileContext: {
    running: "Memeriksa profil Anda",
    done: "Profil dan pilihan foto dibaca",
    failed: "Profil belum dapat diperiksa",
  },
  proposeOwnProfile: {
    running: "Menyiapkan perubahan profil",
    done: "Perubahan profil siap",
    failed: "Usulan profil belum dapat disiapkan",
  },
  inspectProjectBudgetSummary: {
    running: "Memeriksa ringkasan budget",
    done: "Ringkasan budget diperiksa",
    failed: "Ringkasan budget belum dapat diperiksa",
  },
  prepareRabExport: {
    running: "Menyiapkan dokumen RAB",
    done: "Dokumen RAB siap",
    failed: "Dokumen RAB belum dapat disiapkan",
  },
  getAdministrationContext: {
    running: "Memeriksa staf dan peran",
    done: "Data administrasi diperiksa",
    failed: "Administrasi belum dapat diperiksa",
  },
  proposeStaffChanges: {
    running: "Menyiapkan perubahan staf",
    done: "Perubahan staf siap ditinjau",
    failed: "Perubahan staf belum dapat disiapkan",
  },
  proposeRoleDetails: {
    running: "Menyiapkan detail peran",
    done: "Detail peran siap ditinjau",
    failed: "Detail peran belum dapat disiapkan",
  },
  proposeRoleDeletion: {
    running: "Memeriksa penghapusan peran",
    done: "Penghapusan peran siap ditinjau",
    failed: "Peran belum dapat dihapus",
  },
  getOperationalSettingsContext: {
    running: "Membaca ambang persetujuan",
    done: "Ambang persetujuan diperiksa",
    failed: "Gagal membaca ambang persetujuan",
  },
  getExpenseCategorySettingsContext: {
    running: "Membaca pengaturan kategori",
    done: "Pengaturan kategori diperiksa",
    failed: "Gagal membaca pengaturan kategori",
  },
  proposeApprovalThresholds: {
    running: "Menyiapkan koreksi ambang",
    done: "Koreksi ambang siap ditinjau",
    failed: "Gagal menyiapkan koreksi ambang",
  },
  proposeExpenseCategorySettings: {
    running: "Menyiapkan koreksi kategori",
    done: "Koreksi kategori siap ditinjau",
    failed: "Gagal menyiapkan koreksi kategori",
  },
  proposeBudgetSettings: {
    running: "Menyiapkan koreksi default budget",
    done: "Usulan default budget siap",
    failed: "Usulan default budget belum siap",
  },
  getCatalogSettingsContext: {
    running: "Memeriksa katalog dan pengaturan",
    done: "Katalog diperiksa",
    failed: "Katalog belum dapat dibaca",
  },
  proposeCatalogSettings: {
    running: "Menyiapkan perubahan pengaturan",
    done: "Perubahan siap ditinjau",
    failed: "Perubahan belum dapat disiapkan",
  },
  getVendorBillContext: {
    running: "Mencocokkan sumber tagihan vendor",
    done: "Sumber tagihan diperiksa",
    failed: "Sumber tagihan belum dapat dibaca",
  },
  proposeVendorBill: {
    running: "Menyiapkan usulan tagihan vendor",
    done: "Tagihan siap ditinjau",
    failed: "Tagihan belum dapat disiapkan",
  },
  getWarehouseContext: {
    running: "Memeriksa lokasi dan persediaan",
    done: "Konteks gudang diperiksa",
    failed: "Konteks gudang belum dapat dibaca",
  },
  getWarehouseIntakeContext: {
    running: "Memeriksa sumber penerimaan dan saldo awal",
    done: "Sumber penerimaan diperiksa",
    failed: "Sumber penerimaan belum dapat dibaca",
  },
  getStockCorrectionContext: {
    running: "Memeriksa sumber koreksi stok",
    done: "Stok dan lokasi diperiksa",
    failed: "Sumber koreksi stok belum dapat dibaca",
  },
  proposeStockCorrection: {
    running: "Menyiapkan perbandingan stok",
    done: "Koreksi stok siap ditinjau",
    failed: "Koreksi stok belum dapat disiapkan",
  },
  proposeWarehouseIntake: {
    running: "Menyiapkan penerimaan dan perubahan stok",
    done: "Usulan stok siap ditinjau",
    failed: "Usulan stok belum dapat disiapkan",
  },
  proposeWarehouseOperation: {
    running: "Menyiapkan tindakan gudang",
    done: "Tindakan gudang siap ditinjau",
    failed: "Tindakan gudang belum dapat disiapkan",
  },
  getProjectStockContext: {
    running: "Memeriksa stok dan sumber proyek",
    done: "Stok proyek diperiksa",
    failed: "Stok proyek belum dapat dibaca",
  },
  proposeProjectStock: {
    running: "Menyiapkan pergerakan stok",
    done: "Pergerakan stok siap ditinjau",
    failed: "Usulan stok belum dapat disiapkan",
  },
  getRabWorkflowContext: {
    running: "Memeriksa RAB dan Change Order",
    done: "RAB dan Change Order diperiksa",
    failed: "Konteks RAB belum dapat dibaca",
  },
  proposeRabWorkflow: {
    running: "Menyiapkan perubahan RAB",
    done: "Perubahan RAB siap ditinjau",
    failed: "Usulan RAB belum dapat disiapkan",
  },
  getRabDraftContext: {
    running: "Memeriksa sumber RAB",
    done: "Sumber RAB diperiksa",
    failed: "Sumber RAB belum dapat dibaca",
  },
  proposeRabDraft: {
    running: "Menyiapkan draft RAB",
    done: "Draft RAB siap ditinjau",
    failed: "Draft RAB belum dapat disiapkan",
  },
  getRapLifecycleContext: {
    running: "Memeriksa RAP dan paket",
    done: "RAP dan paket diperiksa",
    failed: "RAP belum dapat dibaca",
  },
  proposeRapLifecycleActions: {
    running: "Menyiapkan tindakan RAP",
    done: "Review tindakan RAP disiapkan",
    failed: "Tindakan RAP belum dapat disiapkan",
  },
  getRapSetupContext: {
    running: "Memeriksa kesiapan dan budget RAP",
    done: "Kesiapan RAP diperiksa",
    failed: "Kesiapan RAP belum dapat dibaca",
  },
  proposeRapSetupActions: {
    running: "Menyiapkan langkah RAP untuk ditinjau",
    done: "Langkah RAP siap ditinjau",
    failed: "Langkah RAP belum dapat disiapkan",
  },
  getCategoryPlanContext: {
    running: "Membaca budget dan paket pekerjaan",
    done: "Budget dan paket diperiksa",
    failed: "Konteks paket belum dapat dibaca",
  },
  proposeCategoryPlanPackages: {
    running: "Menyiapkan paket Tukang/Subcon",
    done: "Usulan paket siap ditinjau",
    failed: "Usulan paket belum dapat disiapkan",
  },
  getEditableRapItems: {
    running: "Membaca item RAP tersimpan",
    done: "Item RAP dibaca",
    failed: "Gagal membaca item RAP",
  },
  proposeRapMaterialChanges: {
    running: "Menyiapkan perubahan RAP",
    done: "Perubahan RAP siap ditinjau",
    failed: "Perubahan RAP belum dapat disiapkan",
  },
  getRapDraftContext: {
    running: "Membaca konteks RAP Material",
    done: "Budget dan material RAP dibaca",
    failed: "Gagal membaca konteks RAP",
  },
  proposeRapMaterialDraft: {
    running: "Menyiapkan draft RAP Material",
    done: "Draft RAP siap ditinjau",
    failed: "Draft RAP belum dapat disiapkan",
  },
  listProjects: {
    running: "Membaca daftar proyek",
    done: "Daftar proyek dibaca",
    failed: "Gagal membaca daftar proyek",
  },
  getProjectBudget: {
    running: "Membaca budget dan realisasi biaya",
    done: "Budget dan realisasi biaya dibaca",
    failed: "Gagal membaca budget",
  },
  getCompanyBudgetDefaults: {
    running: "Membaca Pengaturan Budget",
    done: "Pengaturan Budget dibaca",
    failed: "Gagal membaca Pengaturan Budget",
  },
  getProjectHealth: {
    running: "Menilai kesehatan keuangan proyek",
    done: "Kesehatan keuangan proyek dinilai",
    failed: "Gagal menilai kesehatan proyek",
  },
  getBankBalances: {
    running: "Membaca saldo rekening",
    done: "Saldo rekening dibaca",
    failed: "Gagal membaca saldo rekening",
  },
  getPendingApprovals: {
    running: "Membaca antrean persetujuan",
    done: "Antrean persetujuan dibaca",
    failed: "Gagal membaca antrean persetujuan",
  },
  getUpcomingBills: {
    running: "Membaca tagihan vendor jatuh tempo",
    done: "Tagihan vendor jatuh tempo dibaca",
    failed: "Gagal membaca tagihan vendor",
  },
  getMaterialShortage: {
    running: "Menghitung kebutuhan material",
    done: "Kebutuhan material dihitung",
    failed: "Gagal menghitung kebutuhan material",
  },
  getRecentExpenses: {
    running: "Membaca pengeluaran terakhir",
    done: "Pengeluaran terakhir dibaca",
    failed: "Gagal membaca pengeluaran",
  },
  getFinancialHistory: {
    running: "Membaca laporan periode",
    done: "Laporan periode dibaca",
    failed: "Laporan periode belum tersedia",
  },
  getExpenseCategories: {
    running: "Membaca kategori biaya",
    done: "Kategori biaya dibaca",
    failed: "Gagal membaca kategori biaya",
  },
  listVendors: {
    running: "Mencari daftar vendor",
    done: "Daftar vendor ditemukan",
    failed: "Gagal mencari vendor",
  },
  listClients: {
    running: "Mencari data klien",
    done: "Data klien ditemukan",
    failed: "Gagal mencari klien",
  },
  getMaterialCatalog: {
    running: "Membaca katalog material & stok",
    done: "Katalog material dibaca",
    failed: "Gagal membaca katalog material",
  },
  getInventoryLocations: {
    running: "Membaca lokasi gudang",
    done: "Lokasi gudang dibaca",
    failed: "Gagal membaca lokasi gudang",
  },
  getUnpaidVendorBills: {
    running: "Membaca tagihan vendor",
    done: "Tagihan vendor dibaca",
    failed: "Gagal membaca tagihan vendor",
  },
  getUnpaidClientInvoices: {
    running: "Membaca invoice klien",
    done: "Invoice klien dibaca",
    failed: "Gagal membaca invoice klien",
  },
  getPendingExpenseApprovals: {
    running: "Membaca pengajuan biaya menunggu persetujuan",
    done: "Pengajuan biaya dibaca",
    failed: "Gagal membaca antrean biaya",
  },
  suggestFollowUps: {
    running: "Menyiapkan langkah lanjutan",
    done: "Langkah lanjutan disiapkan",
    failed: "Gagal menyiapkan langkah lanjutan",
  },
  getExpenseBatchContext: {
    running: "Memeriksa draft dan pengeluaran",
    done: "Sumber pengeluaran dibaca",
    failed: "Sumber pengeluaran belum dapat dibaca",
  },
  proposeExpenseBatch: {
    running: "Menyiapkan pengeluaran batch",
    done: "Draft batch siap ditinjau",
    failed: "Draft batch belum siap",
  },
  proposeExpenseBatchVerify: {
    running: "Menyiapkan verifikasi pengeluaran",
    done: "Verifikasi batch siap ditinjau",
    failed: "Verifikasi belum siap",
  },
  proposeExpenseBatchDecision: {
    running: "Menyiapkan keputusan pengeluaran",
    done: "Keputusan batch siap ditinjau",
    failed: "Keputusan belum siap",
  },
  proposeExpenseBatchPayment: {
    running: "Menyiapkan pencairan pengeluaran",
    done: "Pencairan batch siap ditinjau",
    failed: "Pencairan belum siap",
  },
  proposeExpenseDraft: {
    running: "Menyiapkan usulan pengajuan biaya",
    done: "Usulan pengajuan biaya disiapkan",
    failed: "Gagal menyiapkan usulan pengajuan",
  },
  proposeExpenseReview: {
    running: "Menyiapkan keputusan persetujuan",
    done: "Usulan keputusan persetujuan disiapkan",
    failed: "Gagal menyiapkan keputusan persetujuan",
  },
  proposeCreateProject: {
    running: "Menyiapkan usulan proyek baru",
    done: "Usulan proyek baru disiapkan",
    failed: "Gagal menyiapkan usulan proyek",
  },
  proposeSetupProjectBudget: {
    running: "Menyusun usulan alokasi budget",
    done: "Usulan alokasi budget disiapkan",
    failed: "Gagal menyusun alokasi budget",
  },
  getBankCashContext: {
    running: "Membaca rekening dan saldo",
    done: "Rekening dan saldo dibaca",
    failed: "Gagal membaca rekening",
  },
  proposeBankCash: {
    running: "Menyiapkan usulan rekening atau kas",
    done: "Usulan rekening/kas siap ditinjau",
    failed: "Usulan rekening/kas belum siap",
  },
  getVendorPaymentContext: {
    running: "Membaca tagihan dan jadwal vendor",
    done: "Tagihan dan jadwal vendor dibaca",
    failed: "Gagal membaca pembayaran vendor",
  },
  proposeVendorPaymentSchedule: {
    running: "Menyiapkan jadwal pembayaran vendor",
    done: "Jadwal pembayaran siap ditinjau",
    failed: "Jadwal pembayaran belum siap",
  },
  proposeVendorPaymentDecision: {
    running: "Menyiapkan keputusan pembayaran vendor",
    done: "Keputusan pembayaran siap ditinjau",
    failed: "Keputusan pembayaran belum siap",
  },
  proposeVendorBillPayment: {
    running: "Menyiapkan usulan pembayaran vendor",
    done: "Usulan pembayaran vendor disiapkan",
    failed: "Gagal menyiapkan pembayaran vendor",
  },
  proposeRecordClientPayment: {
    running: "Menyiapkan pencatatan termin klien",
    done: "Usulan pencatatan termin disiapkan",
    failed: "Gagal menyiapkan pencatatan termin",
  },
  proposeMaterialMaster: {
    running: "Menyiapkan review material",
    done: "Review material disiapkan",
    failed: "Review material belum siap",
  },
  proposeUpdateMaterial: {
    running: "Menyiapkan perubahan material",
    done: "Usulan perubahan material disiapkan",
    failed: "Usulan perubahan material belum siap",
  },
  getEditableMaterials: {
    running: "Mencari material yang akan diubah",
    done: "Pilihan material dimuat",
    failed: "Pilihan material belum dimuat",
  },
  getMaterialInputContext: {
    running: "Membaca pilihan material",
    done: "Pilihan material dimuat",
    failed: "Pilihan belum dimuat",
  },
  getMaterialDraftForCorrection: {
    running: "Membaca draft material",
    done: "Draft material dimuat",
    failed: "Draft belum dimuat",
  },
  getAvailableActions: {
    running: "Memeriksa kemampuan asisten",
    done: "Kemampuan asisten dimuat",
    failed: "Kemampuan belum dimuat",
  },
  proposeGoodsReceipt: {
    running: "Menyiapkan penerimaan barang",
    done: "Usulan penerimaan barang disiapkan",
    failed: "Gagal menyiapkan penerimaan barang",
  },
  listRoles: {
    running: "Membaca daftar peran",
    done: "Daftar peran dibaca",
    failed: "Gagal membaca daftar peran",
  },
  proposeCreateRole: {
    running: "Menyiapkan usulan peran baru",
    done: "Usulan peran baru disiapkan",
    failed: "Gagal menyiapkan usulan peran baru",
  },
  proposeCreateUser: {
    running: "Menyiapkan usulan akun pengguna",
    done: "Usulan akun pengguna disiapkan",
    failed: "Gagal menyiapkan usulan akun pengguna",
  },
  proposeCreateUserBatch: {
    running: "Menyiapkan usulan pembuatan tim sekaligus",
    done: "Usulan pembuatan tim sekaligus disiapkan",
    failed: "Gagal menyiapkan usulan tim",
  },
  getBankReconciliationContext: {
    running: "Memeriksa antrean rekonsiliasi",
    done: "Antrean rekonsiliasi dibaca",
    failed: "Antrean rekonsiliasi belum tersedia",
  },
  analyzeBankStatementAttachment: {
    running: "Membaca lampiran mutasi bank",
    done: "Lampiran mutasi siap ditinjau",
    failed: "Lampiran mutasi belum dapat dibaca",
  },
  proposeBankReconciliation: {
    running: "Menyiapkan usulan rekonsiliasi mutasi bank",
    done: "Usulan rekonsiliasi mutasi bank disiapkan",
    failed: "Gagal menyiapkan usulan rekonsiliasi bank",
  },
  requestUserInput: {
    running: "Menyiapkan form input interaktif",
    done: "Form input siap diisi",
    failed: "Gagal menyiapkan form input",
  },
};

const FALLBACK = {
  running: "Mengambil data",
  done: "Data diambil",
  failed: "Gagal mengambil data",
} as const;

export function toolNameFromPartType(partType: string): string | null {
  return partType.startsWith("tool-") ? partType.slice("tool-".length) : null;
}

export type ToolActivityKind = "read" | "proposal" | "input" | "suggestion" | "activity";
export function toolActivityKind(name: string): ToolActivityKind {
  if (name.startsWith("propose")) return "proposal";
  if (name === "requestUserInput") return "input";
  if (name.startsWith("suggest")) return "suggestion";
  if (/available.*actions|capabilities/i.test(name)) return "activity";
  return /^(get|list|search|find|check|read|analy[sz]e|calculate)/.test(name) ? "read" : "activity";
}

export function toolTraceState(
  state: string | undefined,
  /** Benar bila aliran jawaban sudah berhenti — selesai, dihentikan, atau gagal. */
  isSettled = false,
): ToolTraceState {
  if (state === "output-error") return "failed";
  if (state === "output-available") return "done";
  return isSettled ? "interrupted" : "running";
}

export function toolLabel(toolName: string, state: ToolTraceState): string {
  const entry = TOOL_LABELS[toolName] ?? FALLBACK;
  // Yang terhenti tidak butuh kalimatnya sendiri: pekerjaannya memang pekerjaan
  // yang sedang berjalan, hanya saja tidak pernah sampai selesai.
  return state === "interrupted" ? entry.running : entry[state];
}

export function collapseTraces(
  traces: readonly Omit<ActivityTrace, "count">[],
): readonly ActivityTrace[] {
  const collapsed: ActivityTrace[] = [];
  for (const trace of traces) {
    const previous = collapsed[collapsed.length - 1];
    if (
      previous &&
      previous.label === trace.label &&
      previous.state === trace.state &&
      previous.kind === trace.kind &&
      previous.detail === trace.detail &&
      previous.waitingForInput === trace.waitingForInput
    ) {
      collapsed[collapsed.length - 1] = { ...previous, count: previous.count + 1 };
    } else collapsed.push({ ...trace, count: 1 });
  }
  return collapsed;
}
