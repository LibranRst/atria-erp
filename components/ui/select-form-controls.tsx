"use client";

import React from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

import { BottomSheet } from "./bottom-sheet";
import { FormField } from "./basic-form-controls";
import type { SelectOption } from "./form-control-types";
import { cx, selectedOptionLabel } from "./form-control-utils";

export function SheetSelect({
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
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = options.find((option) => option.value === value);
  const searchable = options.length > 6;
  const filtered = options.filter((option) => {
    const text =
      `${option.label} ${option.description ?? ""} ${option.meta ?? ""} ${option.group ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const groups = Array.from(
    new Set(filtered.map((option) => option.group ?? "")),
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
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled || readOnly}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className={cx(
          "flex w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-low px-5 text-left transition active:scale-[0.99] focus:outline-none focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:opacity-55",
          compact ? "min-h-11" : "min-h-12",
          readOnly && "bg-surface-container",
        )}
      >
        <span className="min-w-0">
          <span
            className={cx(
              "block truncate text-sm font-bold leading-normal",
              selected ? "text-on-surface" : "text-on-surface-variant/65",
            )}
          >
            {selected?.label || placeholder}
          </span>
          {(selected?.description || selected?.meta) && (
            <span className="block truncate text-[10px] text-on-surface-variant leading-normal">
              {selected.description ?? selected.meta}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
      </button>
      <BottomSheet
        open={open}
        title={title ?? label}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-sm">
          {searchable && (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder}
            />
          )}
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-surface-container-low p-4 text-center text-xs text-on-surface-variant">
              {emptyText}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group || "ungrouped"} className="space-y-2">
                {group && (
                  <p className="ml-1 text-[9px] font-bold uppercase tracking-wide text-primary">
                    {group}
                  </p>
                )}
                {filtered
                  .filter((option) => (option.group ?? "") === group)
                  .map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cx(
                          "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-outline-variant/15 bg-surface-container-low text-on-surface",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">
                            {option.label}
                          </span>
                          {(option.description ||
                            option.meta ||
                            option.disabledReason) && (
                            <span className="mt-1 block text-[10px] leading-4 text-on-surface-variant">
                              {option.disabledReason ??
                                option.description ??
                                option.meta}
                            </span>
                          )}
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </BottomSheet>
    </FormField>
  );
}

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
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const uniqueOptions = Array.from(
    new Set([...options, value].filter(Boolean)),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? uniqueOptions.filter((option) =>
        option.toLowerCase().includes(normalizedQuery),
      )
    : uniqueOptions;
  const customValue = query.trim();
  const canUseCustomValue =
    allowCustomValue &&
    customValue.length > 0 &&
    !uniqueOptions.some(
      (option) => option.toLowerCase() === customValue.toLowerCase(),
    );

  return (
    <FormField label={label} helper={helper} error={error} htmlFor={id}>
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
        className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-low px-5 text-left transition active:scale-[0.99] focus:outline-none focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span
          className={cx(
            "block min-w-0 truncate text-sm font-bold",
            value ? "text-on-surface" : "text-on-surface-variant/65",
          )}
        >
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
      </button>
      <BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
        <div className="space-y-sm">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Cari ${label.toLowerCase()}...`}
          />
          {filteredOptions.length === 0 && !canUseCustomValue ? (
            <p className="rounded-2xl bg-surface-container-low p-4 text-center text-xs text-on-surface-variant">
              Belum ada pilihan.
            </p>
          ) : null}
          {filteredOptions.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cx(
                  "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-outline-variant/15 bg-surface-container-low text-on-surface",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-bold">
                  {option}
                </span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
          {canUseCustomValue && (
            <button
              type="button"
              onClick={() => {
                onChange(customValue);
                setOpen(false);
              }}
              className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-primary/35 bg-primary/5 p-3 text-left text-primary transition active:scale-[0.99]"
            >
              <span className="min-w-0 truncate text-xs font-bold">
                Gunakan &quot;{customValue}&quot;
              </span>
              <Plus className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      </BottomSheet>
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
        "flex min-h-12 items-center gap-2 rounded-full bg-surface-container-low px-5 focus-within:ring-2 focus-within:ring-primary/15",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-on-surface-variant" />
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
          <X className="h-4 w-4" />
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
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <SheetSelect
      compact
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={selectedOptionLabel(options, value) || label}
    />
  );
}
