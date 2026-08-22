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
  proposeGoodsReceipt: {
    running: "Menyiapkan penerimaan barang",
    done: "Usulan penerimaan barang disiapkan",
    failed: "Gagal menyiapkan penerimaan barang",
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
  traces: readonly {
    readonly key: string;
    readonly label: string;
    readonly state: ToolTraceState;
  }[],
): readonly {
  readonly key: string;
  readonly label: string;
  readonly state: ToolTraceState;
  readonly count: number;
}[] {
  const collapsed: {
    key: string;
    label: string;
    state: ToolTraceState;
    count: number;
  }[] = [];

  for (const trace of traces) {
    const previous = collapsed[collapsed.length - 1];
    if (previous && previous.label === trace.label && previous.state === trace.state) {
      previous.count += 1;
      continue;
    }
    collapsed.push({ key: trace.key, label: trace.label, state: trace.state, count: 1 });
  }

  return collapsed;
}
