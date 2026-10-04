export type NumericDraft =
  | { readonly kind: "valid"; readonly value: number }
  | { readonly kind: "incomplete"; readonly error: string }
  | { readonly kind: "invalid"; readonly error: string };

export type NumericBounds = {
  readonly min?: number;
  readonly max?: number;
  readonly strictlyPositive?: boolean;
};

/** Parse decimal typing without coercing empty/incomplete text to a persisted zero. */
export function parseNumericDraft(raw: string, bounds: NumericBounds = {}): NumericDraft {
  const trimmed = raw.trim();
  if (!trimmed || /^-?$/.test(trimmed) || /^-?\d*[.,]$/.test(trimmed))
    return { kind: "incomplete", error: "Lengkapi angka terlebih dahulu." };
  if (!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed))
    return { kind: "invalid", error: "Gunakan angka yang valid." };
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) return { kind: "invalid", error: "Angka terlalu besar." };
  if (bounds.strictlyPositive && value <= 0)
    return { kind: "invalid", error: "Nilai harus lebih dari 0." };
  if (bounds.min !== undefined && value < bounds.min)
    return {
      kind: "invalid",
      error: `Nilai minimal ${bounds.min.toLocaleString("id-ID")}.`,
    };
  if (bounds.max !== undefined && value > bounds.max)
    return {
      kind: "invalid",
      error: `Nilai maksimal ${bounds.max.toLocaleString("id-ID")}.`,
    };
  return { kind: "valid", value };
}

export function numericDraftHasUncommittedEdits(
  raw: string,
  value: number,
  bounds: NumericBounds = {},
): boolean {
  const parsed = parseNumericDraft(raw, bounds);
  return parsed.kind !== "valid" || parsed.value !== value;
}
