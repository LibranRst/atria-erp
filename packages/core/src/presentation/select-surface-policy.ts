export type SelectPresentation = "auto" | "menu" | "dialog" | "sheet";
export type ResolvedSelectPresentation = "menu" | "dialog";
export const SIMPLE_SELECT_OPTION_LIMIT = 6;

export type SelectSurfaceContext = {
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly presentation?: SelectPresentation;
  readonly hasCreateAction?: boolean;
  readonly hasCustomValue?: boolean;
};

/** Rich option rows stay anchored; search is reserved for long or editable choices. */
export function resolveSelectPresentation({
  options,
  presentation = "auto",
  hasCreateAction = false,
  hasCustomValue = false,
}: SelectSurfaceContext): ResolvedSelectPresentation {
  if (presentation === "menu") return "menu";
  if (presentation === "dialog" || presentation === "sheet") return "dialog";
  return selectDialogNeedsSearch({ options, hasCreateAction, hasCustomValue }) ? "dialog" : "menu";
}

export function selectDialogNeedsSearch({
  options,
  hasCreateAction = false,
  hasCustomValue = false,
}: Pick<SelectSurfaceContext, "options" | "hasCreateAction" | "hasCustomValue">): boolean {
  return options.length > SIMPLE_SELECT_OPTION_LIMIT || hasCreateAction || hasCustomValue;
}

type SearchableSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly meta?: string;
  readonly group?: string;
};

export function filterSelectOptions<T extends SearchableSelectOption>(
  options: readonly T[],
  query: string,
): readonly T[] {
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  if (!normalized) return options;
  return options.filter((option) =>
    [option.label, option.description, option.meta, option.group]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("id-ID")
      .includes(normalized),
  );
}

export function canUseCustomSelectValue(
  options: readonly { readonly value: string }[],
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  return (
    normalized.length > 0 &&
    !options.some((option) => option.value.trim().toLocaleLowerCase("id-ID") === normalized)
  );
}
