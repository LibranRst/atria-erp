import type { MaterialCandidate, MaterialDraftView } from "@atria/core/ai/material-import";

export type MaterialReviewFilter = "pending" | "review" | "saved";
export type MaterialReviewPhase =
  "loading" | "analysing" | "failed" | "cancelled" | "empty" | "complete" | "review";

/** A single checkbox changes only its row, including deferred reference choices. */
export function materialRowSelection(
  rows: readonly MaterialCandidate[],
  id: string,
  checked: boolean,
): string[] {
  return rows
    .filter((row) => !row.materialId && (row.id === id ? checked : row.selected))
    .map((row) => row.id);
}

export function materialReviewRows(
  rows: readonly MaterialCandidate[],
  filter: MaterialReviewFilter,
): MaterialCandidate[] {
  return rows.filter((row) =>
    filter === "saved"
      ? Boolean(row.materialId)
      : !row.materialId && (filter === "pending" || row.issues.length > 0),
  );
}

export function materialReviewState(draft: MaterialDraftView | null): {
  phase: MaterialReviewPhase;
  headline: string;
  detail: string;
  badge: string;
  total: number;
  remaining: number;
  valid: number;
  selected: number;
  blocked: number;
  duplicates: number;
  saved: number;
} {
  const rows = draft?.payload.rows ?? [];
  const remaining = rows.filter((row) => !row.materialId);
  const valid = remaining.filter((row) => !row.issues.length);
  const selected = valid.filter((row) => row.selected).length;
  const blocked = remaining.length - valid.length;
  const saved = rows.length - remaining.length;
  const counts = {
    total: rows.length,
    remaining: remaining.length,
    valid: valid.length,
    selected,
    blocked,
    duplicates: remaining.filter((row) =>
      row.issues.some((issue) => issue.toLowerCase().includes("duplikat")),
    ).length,
    saved,
  };
  function state(
    phase: MaterialReviewPhase,
    headline: string,
    detail: string,
    badge: string,
  ): ReturnType<typeof materialReviewState> {
    return { ...counts, phase, headline, detail, badge };
  }
  if (!draft)
    return state(
      "loading",
      "Menyiapkan review material",
      "Draft akan tersedia setelah usulan selesai.",
      "Menyiapkan",
    );
  if (rows.length > 0 && !remaining.length)
    return state(
      "complete",
      "Seluruh material tersimpan",
      `${saved} material sudah ditambahkan ke Material Master.`,
      "Selesai",
    );
  if (["QUEUED", "PROCESSING"].includes(draft.payload.analysisStatus))
    return state(
      "analysing",
      draft.payload.error ? "Analisis dijadwalkan ulang" : "Analisis sedang berjalan",
      draft.payload.error
        ? `${draft.payload.progress} baris selesai. Progres aman dan dicoba ulang otomatis; chat boleh ditutup.`
        : `${draft.payload.progress} baris diproses. Progres tetap tersimpan saat chat ditutup.`,
      draft.payload.error ? "Menunggu" : "Analisis",
    );
  if (draft.payload.analysisStatus === "FAILED")
    return state(
      "failed",
      "Analisis perlu dicoba ulang",
      "Progres terakhir tetap tersedia. Coba lagi untuk melanjutkan analisis.",
      "Perlu dicoba ulang",
    );
  if (draft.payload.analysisStatus === "CANCELLED")
    return state(
      "cancelled",
      saved ? "Sisa draft dibatalkan" : "Draft dibatalkan",
      saved
        ? `${saved} material sudah tersimpan. Material dan referensi yang sudah dibuat tetap ada.`
        : "Material belum dibuat. Referensi yang sudah disetujui tetap ada.",
      "Dibatalkan",
    );
  if (!rows.length)
    return state(
      "empty",
      "Tidak ada material ditemukan",
      "Kirim sumber atau detail material baru melalui chat untuk menyiapkan draft berikutnya.",
      "Tidak ada material",
    );
  if (saved)
    return state(
      "review",
      `${saved} dari ${rows.length} material tersimpan`,
      selected
        ? `${selected} dari ${remaining.length} sisa material dipilih. ${remaining.length - selected} lainnya tetap di draft setelah penyimpanan berikutnya.`
        : `${remaining.length} material masih di draft. Pilih dan simpan sisanya saat sudah siap.`,
      "Sebagian tersimpan",
    );
  if (!valid.length)
    return state(
      "review",
      `Periksa ${blocked} material terlebih dahulu`,
      "Lengkapi referensi atau koreksi baris yang bermasalah sebelum menyimpan.",
      "Perlu diperiksa",
    );
  if (!selected)
    return state(
      "review",
      "Pilih material untuk disimpan",
      `${valid.length} material valid dan belum dipilih.${blocked ? ` ${blocked} lainnya perlu diperiksa.` : ""}`,
      "Belum dipilih",
    );
  if (selected === remaining.length)
    return state(
      "review",
      `Semua ${selected} material dipilih`,
      "Periksa daftar, lalu simpan seluruh material dalam satu tindakan.",
      "Siap disimpan",
    );
  return state(
    "review",
    `${selected} dari ${remaining.length} material dipilih`,
    `${remaining.length - selected} lainnya tetap di draft setelah penyimpanan.${blocked ? ` Termasuk ${blocked} yang perlu diperiksa.` : ""}`,
    "Siap disimpan",
  );
}

export function materialReviewFilters(
  state: ReturnType<typeof materialReviewState>,
): MaterialReviewFilter[] {
  if (state.phase === "complete") return ["saved"];
  const filters: MaterialReviewFilter[] = ["pending"];
  if (state.blocked > 0 && state.valid > 0) filters.push("review");
  if (state.saved > 0) filters.push("saved");
  return filters;
}
export function materialReviewPrimary(
  state: ReturnType<typeof materialReviewState>,
): "save" | "select" | "none" {
  return state.phase !== "review" || !state.valid ? "none" : state.selected ? "save" : "select";
}
