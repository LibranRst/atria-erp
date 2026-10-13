import { normalizeMaterialIdentity, type MaterialReference } from "@atria/core/ai/material-import";

export type ReferenceReviewEntry = {
  readonly sourceName: string;
  readonly reference: MaterialReference;
  readonly selected: boolean;
};
export function referenceReviewKey(reference: MaterialReference): string {
  return `${reference.kind}:${normalizeMaterialIdentity(reference.name)}`;
}
export function reconcileReferenceReview(
  suggestions: readonly MaterialReference[],
  previous: readonly ReferenceReviewEntry[],
): ReferenceReviewEntry[] {
  return suggestions.map(
    (reference) =>
      previous.find(
        (entry) =>
          referenceReviewKey({ ...entry.reference, name: entry.sourceName }) ===
          referenceReviewKey(reference),
      ) ?? { sourceName: reference.name, reference: { ...reference }, selected: true },
  );
}
export function referenceReviewError(entries: readonly ReferenceReviewEntry[]): string | undefined {
  const selected = entries.filter((entry) => entry.selected);
  if (!selected.length) return "Pilih referensi yang ingin dibuat.";
  if (selected.some((entry) => entry.reference.name.trim().length < 2))
    return "Isi nama referensi minimal 2 karakter.";
  if (selected.some((entry) => entry.reference.kind === "vendor" && !entry.reference.phone.trim()))
    return "Lengkapi nomor telepon vendor yang dipilih.";
  return undefined;
}
