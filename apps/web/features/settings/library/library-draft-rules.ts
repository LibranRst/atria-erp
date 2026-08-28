import type { ExpenseCategorySettingRow } from "@/app/actions/settings/system";

import type { Draft } from "../types/library-types";

export type LibraryDraftEvaluation = {
  readonly completedCount: number;
  readonly total: number;
  readonly canSave: boolean;
  readonly disabledReason: string | undefined;
};

/**
 * Aturan kelengkapan dan alasan-disable template harga.
 * Dipisah dari komponen agar editor sheet dan orchestrator memakai satu sumber
 * kebenaran; tidak ada efek samping di sini.
 */
export function evaluateLibraryDraft(
  draft: Draft | null,
  categories: readonly ExpenseCategorySettingRow[],
): LibraryDraftEvaluation {
  if (!draft) {
    return { completedCount: 0, total: 0, canSave: false, disabledReason: undefined };
  }

  const checks: ReadonlyArray<unknown> = [
    draft.expenseCategoryId &&
      categories.some((category) => category.id === draft.expenseCategoryId),
    draft.name.trim().length >= 2,
    draft.itemCategory.trim().length >= 2,
    draft.unit.trim().length > 0,
    draft.effectiveFrom.trim().length > 0 && !Number.isNaN(new Date(draft.effectiveFrom).getTime()),
    draft.sourceNote.trim().length >= 3,
    draft.pricingMode === "MARGIN_BASED" || draft.fixedClientPrice > 0,
    draft.components.length > 0,
    ...draft.components.flatMap((component) => [
      component.label.trim().length >= 2,
      Number(component.quantity) > 0,
      component.unit.trim().length > 0,
      Number(component.unitCost) >= 0,
    ]),
  ];
  const completedCount = checks.filter(Boolean).length;
  const total = checks.length || 1;

  const categoryValid =
    Boolean(draft.expenseCategoryId) &&
    categories.some((category) => category.id === draft.expenseCategoryId);
  const disabledReason = !categoryValid
    ? "Pilih kategori pengeluaran yang valid."
    : draft.name.trim().length < 2
      ? "Isi nama template minimal 2 karakter."
      : draft.itemCategory.trim().length < 2
        ? "Isi kategori item minimal 2 karakter."
        : !draft.unit.trim()
          ? "Isi satuan."
          : !draft.effectiveFrom.trim() || Number.isNaN(new Date(draft.effectiveFrom).getTime())
            ? "Isi tanggal berlaku yang valid."
            : draft.sourceNote.trim().length < 3
              ? "Isi catatan sumber harga minimal 3 karakter."
              : draft.pricingMode === "FIXED_CLIENT_PRICE" && draft.fixedClientPrice <= 0
                ? "Harga tetap untuk klien harus lebih dari 0."
                : draft.components.some(
                      (component) =>
                        component.label.trim().length < 2 ||
                        Number(component.quantity) <= 0 ||
                        !component.unit.trim() ||
                        Number(component.unitCost) < 0,
                    )
                  ? "Lengkapi nama minimal 2 karakter, jumlah, satuan, dan biaya satuan di setiap komponen."
                  : undefined;

  return {
    completedCount,
    total,
    canSave: completedCount === total,
    disabledReason,
  };
}
