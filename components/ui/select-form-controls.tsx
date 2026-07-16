"use client";

import React from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

import { BottomSheet } from "./bottom-sheet";
import { FormField } from "./basic-form-controls";
import type { SelectOption } from "./form-control-types";
import { cx, selectedOptionLabel } from "./form-control-utils";
import { useFormPresentation } from "./form-presentation-context";

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
  const grouped = useFormPresentation() === "grouped";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pendingValue, setPendingValue] = React.useState<string | null>(null);
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
          grouped
            ? "flex min-h-8 w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55"
            : "flex w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left transition active:scale-[0.99] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55",
          !grouped && (compact ? "min-h-11" : "min-h-12"),
          !grouped && compact && "bg-surface-container-low",
          readOnly && (grouped ? "opacity-70" : "bg-surface-container"),
        )}
      >
        <span className="min-w-0">
          <span
            className={cx(
              "block truncate text-sm font-bold leading-4",
              selected ? "text-on-surface" : "text-on-surface-variant/65",
            )}
          >
            {selected?.label || placeholder}
          </span>
          {(selected?.description || selected?.meta) && (
            <span className="mt-0.5 block truncate text-[10px] leading-4 text-on-surface-variant">
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
        onExitComplete={() => {
          const nextValue = pendingValue;
          if (nextValue === null) return;
          setPendingValue(null);
          onChange(nextValue);
        }}
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
                  <p className="ml-1 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {group}
                  </p>
                )}
                <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-[22px] bg-surface-container-lowest ring-1 ring-outline-variant/15">
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
                            setPendingValue(option.value);
                            setOpen(false);
                          }}
                          className={cx(
                            "flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition active:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50",
                            active ? "bg-blue-50 text-blue-600" : "text-on-surface",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold leading-4">
                              {option.label}
                            </span>
                            {(option.description || option.meta || option.disabledReason) ? (
                              <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                                {option.disabledReason ?? option.description ?? option.meta}
                              </span>
                            ) : null}
                          </span>
                          {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                        </button>
                      );
                    })}
                </div>
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
  const grouped = useFormPresentation() === "grouped";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pendingValue, setPendingValue] = React.useState<string | null>(null);
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
        className={cx(
          grouped
            ? "flex min-h-8 w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55"
            : "flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left transition active:scale-[0.99] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55",
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
        <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
      </button>
      <BottomSheet
        open={open}
        title={label}
        onClose={() => setOpen(false)}
        onExitComplete={() => {
          const nextValue = pendingValue;
          if (nextValue === null) return;
          setPendingValue(null);
          onChange(nextValue);
        }}
      >
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
          {(filteredOptions.length > 0 || canUseCustomValue) ? (
            <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-[22px] bg-surface-container-lowest ring-1 ring-outline-variant/15">
              {filteredOptions.map((option) => {
                const active = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setPendingValue(option);
                      setOpen(false);
                    }}
                    className={cx(
                      "flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition active:bg-surface-container-low",
                      active ? "bg-blue-50 text-blue-600" : "text-on-surface",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{option}</span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
              {canUseCustomValue ? (
                <button
                  type="button"
                  onClick={() => {
                    setPendingValue(customValue);
                    setOpen(false);
                  }}
                  className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 bg-blue-50 px-4 py-3 text-left text-blue-600 transition active:bg-blue-100"
                >
                  <span className="min-w-0 truncate text-xs font-bold">Gunakan &quot;{customValue}&quot;</span>
                  <Plus className="h-4 w-4 shrink-0" />
                </button>
              ) : null}
            </div>
          ) : null}
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
        "flex min-h-12 items-center gap-2 rounded-full bg-surface-container-lowest px-5 shadow-[0_5px_16px_rgba(17,17,17,0.045)] ring-1 ring-outline-variant/20 transition-shadow focus-within:ring-2 focus-within:ring-blue-500/25",
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
