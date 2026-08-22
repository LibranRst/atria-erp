import type { SelectOption } from "../form/form-control-types";

export type SelectPresentation = "auto" | "menu" | "dialog" | "sheet";
export type ResolvedSelectPresentation = "menu" | "dialog";

export const SIMPLE_SELECT_OPTION_LIMIT = 6;

type SelectSurfaceContext = {
  readonly options: readonly SelectOption[];
  readonly presentation?: SelectPresentation;
  readonly hasCreateAction?: boolean;
};

function isSimpleOption(option: SelectOption): boolean {
  return (
    option.description === undefined &&
    option.meta === undefined &&
    option.group === undefined &&
    option.disabledReason === undefined
  );
}

/**
 * Menentukan bobot surface dari isi pilihan, bukan dari fitur pemanggil.
 * Menu hanya dipakai untuk daftar pendek yang dapat dipahami lewat satu label;
 * konteks yang butuh pencarian atau penjelasan mendapat dialog yang sesuai,
 * tanpa mengubah pilihan ringan menjadi workflow sheet.
 */
export function resolveSelectPresentation({
  options,
  presentation = "auto",
  hasCreateAction = false,
}: SelectSurfaceContext): ResolvedSelectPresentation {
  if (presentation === "menu") return "menu";
  if (presentation === "dialog" || presentation === "sheet") return "dialog";

  const isShortSimpleList =
    options.length >= 1 &&
    options.length <= SIMPLE_SELECT_OPTION_LIMIT &&
    options.every(isSimpleOption);

  return isShortSimpleList && !hasCreateAction ? "menu" : "dialog";
}

export function selectDialogNeedsSearch({
  options,
  hasCreateAction = false,
}: Pick<SelectSurfaceContext, "options" | "hasCreateAction">): boolean {
  return options.length > SIMPLE_SELECT_OPTION_LIMIT || hasCreateAction;
}
