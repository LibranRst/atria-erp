/**
 * Label Bahasa Indonesia untuk jejak pemanggilan tool yang tampil di chat.
 *
 * Pengguna perlu tahu asisten sedang membaca data apa — itu yang membuat angka
 * di jawaban bisa dipercaya. Nama teknis tool tidak pernah ditampilkan.
 */

export type ToolTraceState = "running" | "done" | "failed";

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
  suggestFollowUps: {
    running: "Menyiapkan pertanyaan lanjutan",
    done: "Pertanyaan lanjutan disiapkan",
    failed: "Gagal menyiapkan pertanyaan lanjutan",
  },
  proposeExpenseDraft: {
    running: "Menyiapkan usulan pengajuan biaya",
    done: "Usulan pengajuan biaya disiapkan",
    failed: "Gagal menyiapkan usulan pengajuan",
  },
};

const FALLBACK = {
  running: "Mengambil data",
  done: "Data diambil",
  failed: "Gagal mengambil data",
} as const;

/**
 * Nama part tool dari AI SDK berbentuk `tool-<namaTool>`.
 */
export function toolNameFromPartType(partType: string): string | null {
  return partType.startsWith("tool-") ? partType.slice("tool-".length) : null;
}

/**
 * Memetakan state part AI SDK ke tiga keadaan yang perlu dibedakan pengguna.
 * Tool yang gagal harus terbaca gagal — bukan dianggap selesai — supaya jawaban
 * yang kekurangan data tidak terlihat lebih meyakinkan daripada seharusnya.
 */
export function toolTraceState(state: string | undefined): ToolTraceState {
  if (state === "output-error") return "failed";
  if (state === "output-available") return "done";
  return "running";
}

export function toolLabel(toolName: string, state: ToolTraceState): string {
  return (TOOL_LABELS[toolName] ?? FALLBACK)[state];
}

/**
 * Menggabungkan jejak berturut-turut yang identik menjadi satu baris bercacah.
 *
 * DeepSeek kerap memanggil tool yang sama untuk beberapa proyek sekaligus;
 * menampilkan enam baris yang sama persis hanya menjadi derau.
 */
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
