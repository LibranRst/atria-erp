export type RapSetupStage = "MATERIAL" | "TUKANG" | "SUBCON" | "REVIEW" | "COMPLETE";
export type RapPackageSetupRow = { readonly categoryCode: string; readonly status: string };

export function assertRapSetupTransition(current: RapSetupStage, target: RapSetupStage): void {
  const next: Record<RapSetupStage, RapSetupStage | null> = {
    MATERIAL: "TUKANG",
    TUKANG: "SUBCON",
    SUBCON: "REVIEW",
    REVIEW: "COMPLETE",
    COMPLETE: null,
  };
  if (next[current] !== target)
    throw new Error("Urutan tahap RAP tidak valid. Muat ulang halaman.");
}

export function assertRapCategoryReady(
  rows: readonly RapPackageSetupRow[],
  code: "TUKANG" | "SUBCON",
  skipped: boolean,
): void {
  const relevant = rows.filter(
    (row) => row.categoryCode === code && !["SUPERSEDED", "CANCELLED", "DONE"].includes(row.status),
  );
  if (skipped) {
    if (relevant.some((row) => row.status === "DRAFT" || row.status === "ACTIVE"))
      throw new Error(
        `${code} masih memiliki package. Hapus package draft atau batalkan keputusan Tidak Digunakan.`,
      );
    return;
  }
  if (relevant.length === 0)
    throw new Error(`${code} belum memiliki package Siap atau keputusan Tidak Digunakan.`);
  if (relevant.some((row) => row.status === "DRAFT"))
    throw new Error(`${code} masih memiliki package DRAFT.`);
  if (!relevant.some((row) => row.status === "ACTIVE" || row.status === "LOCKED"))
    throw new Error(`${code} belum memiliki package Siap.`);
}
