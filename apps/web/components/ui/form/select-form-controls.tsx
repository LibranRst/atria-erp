"use client";

import React from "react";

import { AnchoredListbox } from "../overlay/anchored-listbox";
import { SearchDialog, SelectionDialog } from "../overlay/dialogs";
import {
  resolveSelectPresentation,
  selectDialogNeedsSearch,
  type SelectPresentation,
} from "../overlay/interaction-surface-policy";
import { Button } from "../button/button";
import { FormField } from "./basic-form-controls";
import type { SelectOption } from "./form-control-types";
import { cx, selectedOptionLabel } from "./form-control-utils";
import { useFormPresentation } from "./form-presentation-context";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { DialogOptionList, type DialogOptionListHandle } from "./dialog-option-list";

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

  const dialogContent = (
    <div className="space-y-3">
      <DialogOptionList
        key={searchable ? query : "selection"}
        ref={optionListRef}
        label={title ?? label}
        value={value}
        options={filtered}
        emptyText={emptyText}
        onSelect={selectOption}
      />
      {createActionLabel && onCreateAction ? (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          leadingIcon={<AppIcon name="add" className="icon-sm" />}
          trailingIcon={<AppIcon name="chevron_right" className="icon-md shrink-0" />}
          onClick={() => {
            setOpen(false);
            setQuery("");
            onCreateAction();
          }}
          className="justify-between text-accent"
        >
          {createActionDescription ? (
            <span className="min-w-0 text-left">
              <span className="block truncate">{createActionLabel}</span>
              <span className="block truncate text-meta font-normal text-on-surface-variant">
                {createActionDescription}
              </span>
            </span>
          ) : (
            createActionLabel
          )}
        </Button>
      ) : null}
    </div>
  );

  const trigger = (
    <button
      id={id}
      type="button"
      aria-haspopup={resolvedPresentation === "menu" ? "listbox" : "dialog"}
      aria-expanded={resolvedPresentation === "dialog" ? open : undefined}
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
          : "flex w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left shadow-control transition focus:border-accent focus:ring-2 focus:ring-focus-ring focus:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55",
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
        {(selected?.description || selected?.meta) && (
          <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
            {selected.description ?? selected.meta}
          </span>
        )}
      </span>
      <AppIcon name="expand_more" className="icon-sm shrink-0 text-on-surface-variant" />
    </button>
  );

  return (
    <FormField
      label={label}
      helper={helper}
      error={error}
      htmlFor={id}
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
}): React.JSX.Element {
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

  return (
    <FormField label={label} helper={helper} error={error} htmlFor={id}>
      <div className="min-w-0">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          className={cx(
            grouped
              ? "flex min-h-8 w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-55"
              : "flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left shadow-control transition focus:border-accent focus:ring-2 focus:ring-focus-ring focus:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55",
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
          <AppIcon name="expand_more" className="icon-sm shrink-0 text-on-surface-variant" />
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
        <div className="space-y-3">
          <DialogOptionList
            key={query}
            ref={optionListRef}
            label={label}
            value={value}
            options={dialogOptions}
            emptyText={canUseCustomValue ? "" : "Belum ada pilihan."}
            onSelect={(option) => {
              setOpen(false);
              setQuery("");
              onChange(option.value);
            }}
          />
          {canUseCustomValue ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              leadingIcon={<AppIcon name="add" className="icon-sm" />}
              onClick={() => {
                setOpen(false);
                setQuery("");
                onChange(customValue);
              }}
            >
              Gunakan &quot;{customValue}&quot;
            </Button>
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
  return (
    <div
      className={cx(
        "flex min-h-12 items-center gap-2 rounded-full bg-surface-container-lowest px-5 shadow-control ring-1 ring-ring-control transition-shadow focus-within:ring-2 focus-within:ring-focus-ring",
        className,
      )}
    >
      <AppIcon name="search" className="icon-sm shrink-0 text-on-surface-variant" />
      <input
        id={id}
        name={name}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/55"
      />
      {showClear && value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition active:scale-95"
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
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly presentation?: SelectPresentation;
}): React.JSX.Element {
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
