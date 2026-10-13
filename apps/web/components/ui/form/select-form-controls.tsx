"use client";

import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import { DesktopSelect, DesktopInputControl } from "../desktop/desktop-controls";
import { DesktopFilterSelect } from "../desktop/desktop-filter-select";
import React from "react";

import { AnchoredListbox } from "../overlay/anchored-listbox";
import { SearchDialog, SelectionDialog } from "../overlay/dialogs";
import {
  resolveSelectPresentation,
  selectDialogNeedsSearch,
  type SelectPresentation,
} from "../overlay/interaction-surface-policy";
import { FormField } from "./basic-form-controls";
import type { SelectOption } from "./form-control-types";
import { cx, selectedOptionLabel } from "./form-control-utils";
import { useFormPresentation } from "./form-presentation-context";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { DialogOptionList, type DialogOptionListHandle } from "./dialog-option-list";

function DialogCreateActionRow({
  label,
  description,
  onClick,
}: {
  readonly label: string;
  readonly description?: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex min-h-12 w-full min-w-0 items-center gap-3 rounded-3xl border-t border-outline-variant/20 bg-white px-5 py-3 text-left text-accent transition-all outline-none hover:bg-surface-container-lowest/50 focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container"
    >
      <AppIcon name="add" className="icon-sm shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row font-bold">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-meta font-normal text-on-surface-variant">
            {description}
          </span>
        ) : null}
      </span>
      <AppIcon name="chevron_right" className="icon-md shrink-0" aria-hidden="true" />
    </button>
  );
}

export function AdaptiveSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Pilih opsi",
  helper,
  disabled,
  readOnly,
  required,
  optional,
  searchPlaceholder = "Cari opsi...",
  emptyText = "Tidak ada opsi.",
  title,
  compact,
  error,
  createActionLabel,
  createActionDescription,
  onCreateAction,
  presentation = "auto",
}: {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helper?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly searchPlaceholder?: string;
  readonly emptyText?: string;
  readonly title?: string;
  readonly compact?: boolean;
  readonly error?: string;
  readonly createActionLabel?: string;
  readonly createActionDescription?: string;
  readonly onCreateAction?: () => void;
  readonly presentation?: SelectPresentation;
}): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const generatedId = React.useId();
  const controlId = id ?? `${generatedId}-control`;
  const messageId = helper || error ? `${generatedId}-message` : undefined;
  const grouped = useFormPresentation() === "grouped";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const optionListRef = React.useRef<DialogOptionListHandle>(null);
  const selected = options.find((option) => option.value === value);
  const hasCreateAction = Boolean(createActionLabel && onCreateAction);
  const resolvedPresentation = resolveSelectPresentation({
    options,
    presentation,
    hasCreateAction,
  });
  const searchable = selectDialogNeedsSearch({ options, hasCreateAction });
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filtered = options.filter((option) => {
    if (option.action) return true;
    const text =
      `${option.label} ${option.description ?? ""} ${option.meta ?? ""} ${option.group ?? ""}`.toLocaleLowerCase(
        "id-ID",
      );
    return text.includes(normalizedQuery);
  });

  function selectOption(option: SelectOption): void {
    setOpen(false);
    setQuery("");
    onChange(option.value);
  }

  if (desktop) {
    return (
      <DesktopSelect
        id={controlId}
        label={label}
        value={options.some((option) => option.value === value) ? value : null}
        options={options}
        onChange={(next): void => onChange(next ?? "")}
        placeholder={placeholder}
        description={helper}
        error={error}
        disabled={disabled || readOnly}
        required={required}
        emptyText={emptyText}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        createActionLabel={createActionLabel}
        createActionDescription={createActionDescription}
        onCreateAction={onCreateAction}
        className={grouped ? "atria-grouped-select px-4 py-3" : undefined}
      />
    );
  }

  const dialogContent = (
    <div className="space-y-2">
      <DialogOptionList
        ref={optionListRef}
        label={title ?? label}
        value={value}
        options={filtered}
        emptyText={emptyText}
        animateHeight={searchable}
        onSelect={selectOption}
      />
      {createActionLabel && onCreateAction ? (
        <DialogCreateActionRow
          label={createActionLabel}
          description={createActionDescription}
          onClick={() => {
            setOpen(false);
            setQuery("");
            onCreateAction();
          }}
        />
      ) : null}
    </div>
  );

  const trigger = (
    <button
      id={controlId}
      type="button"
      aria-label={`${label}: ${selected?.label || placeholder}`}
      aria-haspopup={resolvedPresentation === "menu" ? "listbox" : "dialog"}
      aria-expanded={resolvedPresentation === "dialog" ? open : undefined}
      aria-describedby={messageId}
      disabled={disabled || readOnly}
      onClick={
        resolvedPresentation === "dialog"
          ? () => {
              setQuery("");
              setOpen(true);
            }
          : undefined
      }
      className={cx(
        grouped
          ? "flex min-h-8 w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-55"
          : "flex w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left shadow-control transition focus:border-accent focus:ring-2 focus:ring-focus-ring focus:outline-none active:z-10 active:scale-[1.05] active:shadow-raised disabled:cursor-not-allowed disabled:opacity-55",
        !grouped && (compact ? "min-h-11" : "min-h-12"),
        !grouped && compact && "bg-surface-container-low",
        readOnly && (grouped ? "opacity-70" : "bg-surface-container"),
      )}
    >
      <span className="min-w-0">
        <span
          className={cx(
            "block truncate text-sm leading-4 font-bold",
            selected ? "text-on-surface" : "text-on-surface-variant/65",
          )}
        >
          {selected?.label || placeholder}
        </span>
        {!selected?.action && (selected?.description || selected?.meta) && (
          <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
            {selected.description ?? selected.meta}
          </span>
        )}
      </span>
      <AppIcon
        name="expand_more"
        className={cx(
          "icon-sm shrink-0 text-on-surface-variant transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </button>
  );

  return (
    <FormField
      label={label}
      helper={helper}
      error={error}
      htmlFor={controlId}
      helperId={messageId}
      required={required}
      optional={optional}
      readOnly={readOnly}
    >
      <div className="min-w-0">
        {resolvedPresentation === "menu" ? (
          <AnchoredListbox
            trigger={trigger}
            label={title ?? label}
            value={value}
            options={options}
            onChange={onChange}
            emptyText={emptyText}
          />
        ) : (
          trigger
        )}
      </div>
      {searchable ? (
        <SearchDialog
          open={resolvedPresentation === "dialog" && open}
          title={title ?? label}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={searchPlaceholder}
          onSearchKeyDown={(event) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            optionListRef.current?.focusFirst();
          }}
          onClose={() => {
            setOpen(false);
            setQuery("");
          }}
        >
          {dialogContent}
        </SearchDialog>
      ) : (
        <SelectionDialog
          open={resolvedPresentation === "dialog" && open}
          title={title ?? label}
          onClose={() => setOpen(false)}
        >
          {dialogContent}
        </SelectionDialog>
      )}
    </FormField>
  );
}

/**
 * @deprecated Gunakan `AdaptiveSelect`. Alias ini dipertahankan selama satu
 * siklus migrasi agar cabang lama tidak rusak ketika di-merge.
 */
export const SheetSelect = AdaptiveSelect;

export function ComboboxField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Pilih atau ketik nilai",
  helper,
  error,
  disabled,
  allowCustomValue = true,
  emptyText = "Tidak ada opsi.",
  createCustomDescription,
}: {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helper?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly allowCustomValue?: boolean;
  readonly emptyText?: string;
  readonly createCustomDescription?: string;
}): React.JSX.Element {
  const generatedId = React.useId();
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const controlId = id ?? `${generatedId}-control`;
  const messageId = helper || error ? `${generatedId}-message` : undefined;
  const grouped = useFormPresentation() === "grouped";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const optionListRef = React.useRef<DialogOptionListHandle>(null);
  const uniqueOptions = Array.from(new Set([...options, value].filter(Boolean)));
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredOptions = normalizedQuery
    ? uniqueOptions.filter((option) => option.toLocaleLowerCase("id-ID").includes(normalizedQuery))
    : uniqueOptions;
  const dialogOptions = filteredOptions.map((option) => ({ value: option, label: option }));
  const customValue = query.trim();
  const canUseCustomValue =
    allowCustomValue &&
    customValue.length > 0 &&
    !uniqueOptions.some((option) => option.toLowerCase() === customValue.toLowerCase());

  if (desktop)
    return (
      <DesktopSelect
        id={controlId}
        label={label}
        value={value || null}
        options={uniqueOptions.map((option) => ({ value: option, label: option }))}
        onChange={(next): void => onChange(next ?? "")}
        placeholder={placeholder}
        description={helper}
        error={error}
        disabled={disabled}
        searchable
        allowCustomValue={allowCustomValue}
        customDescription={createCustomDescription}
        emptyText={emptyText}
        className={grouped ? "atria-grouped-select px-4 py-3" : undefined}
      />
    );

  return (
    <FormField label={label} helper={helper} error={error} htmlFor={controlId} helperId={messageId}>
      <div className="min-w-0">
        <button
          id={controlId}
          type="button"
          aria-label={`${label}: ${value || placeholder}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={messageId}
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          className={cx(
            grouped
              ? "flex min-h-12 w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-55"
              : "flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left shadow-control transition focus:border-accent focus:ring-2 focus:ring-focus-ring focus:outline-none active:z-10 active:scale-[1.05] active:shadow-raised disabled:cursor-not-allowed disabled:opacity-55",
          )}
        >
          <span
            className={cx(
              "block min-w-0 truncate text-sm font-bold",
              value ? "text-on-surface" : "text-on-surface-variant/65",
            )}
          >
            {value || placeholder}
          </span>
          <AppIcon
            name="expand_more"
            className={cx(
              "icon-sm shrink-0 text-on-surface-variant transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      <SearchDialog
        open={open}
        title={label}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={`Cari ${label.toLocaleLowerCase("id-ID")}...`}
        onSearchKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          optionListRef.current?.focusFirst();
        }}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
      >
        <div className="space-y-2">
          <DialogOptionList
            ref={optionListRef}
            label={label}
            value={value}
            options={dialogOptions}
            emptyText={emptyText}
            animateHeight
            onSelect={(option) => {
              setOpen(false);
              setQuery("");
              onChange(option.value);
            }}
          />
          {canUseCustomValue ? (
            <DialogCreateActionRow
              label={`Gunakan "${customValue}"`}
              description={createCustomDescription}
              onClick={() => {
                setOpen(false);
                setQuery("");
                onChange(customValue);
              }}
            />
          ) : null}
        </div>
      </SearchDialog>
    </FormField>
  );
}

export function SearchInput({
  id,
  name,
  value,
  onChange,
  placeholder = "Cari...",
  ariaLabel,
  clearLabel = "Bersihkan pencarian",
  showClear = true,
  className,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  readonly clearLabel?: string;
  readonly showClear?: boolean;
  readonly className?: string;
}): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const InputControl = desktop ? DesktopInputControl : "input";
  return (
    <div
      className={cx(
        "flex min-h-12 items-center gap-2 rounded-full bg-surface-container-lowest px-5 shadow-control ring-1 ring-ring-control transition-shadow focus-within:ring-2 focus-within:ring-focus-ring",
        desktop && "atria-desktop-field",
        className,
      )}
    >
      <AppIcon name="search" className="icon-sm shrink-0 text-on-surface-variant" />
      <InputControl
        id={id}
        name={name}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="atria-embedded-field min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/55 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {showClear && value && !desktop ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition active:z-10 active:scale-[1.05] active:shadow-raised"
          aria-label={clearLabel}
        >
          <AppIcon name="close" className="icon-sm" />
        </button>
      ) : null}
    </div>
  );
}

export const SearchField = SearchInput;

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  presentation = "auto",
  searchable,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly presentation?: SelectPresentation;
  readonly searchable?: boolean;
}): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  if (desktop)
    return (
      <DesktopFilterSelect
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        searchable={
          searchable ??
          (presentation === "menu"
            ? false
            : selectDialogNeedsSearch({ options }) ||
              presentation === "dialog" ||
              presentation === "sheet")
        }
      />
    );
  return (
    <AdaptiveSelect
      compact
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      presentation={presentation}
      placeholder={selectedOptionLabel(options, value) || label}
    />
  );
}
