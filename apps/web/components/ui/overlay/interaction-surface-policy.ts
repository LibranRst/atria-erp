import type { SelectOption } from "../form/form-control-types";

export type SelectPresentation = "auto" | "menu" | "dialog" | "sheet";
export type ResolvedSelectPresentation = "menu" | "dialog";

export const SIMPLE_SELECT_OPTION_LIMIT = 6;

type SelectSurfaceContext = {
  readonly options: readonly SelectOption[];
  readonly presentation?: SelectPresentation;
  readonly hasCreateAction?: boolean;
};

/**
 * Menentukan bobot surface dari isi pilihan, bukan dari fitur pemanggil.
 * Semua pilihan yang tidak membutuhkan pencarian tetap anchored di trigger,
 * termasuk row berdeskripsi, grouped, atau memiliki disabled reason. Dialog
 * hanya dipakai ketika daftar panjang/create action memang membutuhkan search.
 */
export function resolveSelectPresentation({
  options,
  presentation = "auto",
  hasCreateAction = false,
}: SelectSurfaceContext): ResolvedSelectPresentation {
  if (presentation === "menu") return "menu";
  if (presentation === "dialog" || presentation === "sheet") return "dialog";

  return selectDialogNeedsSearch({ options, hasCreateAction }) ? "dialog" : "menu";
}

export function selectDialogNeedsSearch({
  options,
  hasCreateAction = false,
}: Pick<SelectSurfaceContext, "options" | "hasCreateAction">): boolean {
  return options.length > SIMPLE_SELECT_OPTION_LIMIT || hasCreateAction;
}
