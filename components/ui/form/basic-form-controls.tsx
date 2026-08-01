"use client";

import React from "react";
import { Check, LockKeyhole, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { transitionSpringBouncy } from "@/lib/utils/motion";

import { type FormFieldLayout, useFormPresentation } from "./form-presentation-context";

import {
  controlClass,
  cx,
  decimalValue,
  errorClass,
  fieldAdornment,
  fieldShell,
  helperClass,
  labelClass,
  toNumberString,
} from "./form-control-utils";

export function FormField({
  label,
  helper,
  error,
  htmlFor,
  helperId,
  required,
  optional,
  readOnly,
  layout = "stacked",
  children,
  className,
}: {
  readonly label: string;
  readonly helper?: string;
  readonly error?: string;
  readonly htmlFor?: string;
  readonly helperId?: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly readOnly?: boolean;
  readonly layout?: FormFieldLayout;
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  const adornment = fieldAdornment(required, optional);
  const presentation = useFormPresentation();
  const grouped = presentation === "grouped";
  const message = error ?? helper;
  const messageClass = error ? errorClass : helperClass;

  if (layout === "inline") {
    return (
      <div
        className={cx(
          grouped ? "group/form min-w-0 bg-surface-container-lowest px-4 py-3" : fieldShell,
          error && grouped && "bg-error-container/10",
          className,
        )}
      >
        <div className="flex min-h-8 min-w-0 items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <label
                className={cx(
                  labelClass,
                  grouped &&
                    "ml-0 text-[10px] tracking-[0.08em] transition-colors group-focus-within/form:text-accent",
                )}
                htmlFor={htmlFor}
              >
                {label}
              </label>
              {readOnly ? (
                <LockKeyhole
                  className="h-3.5 w-3.5 shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            {message ? (
              <p id={helperId} className={cx(messageClass, grouped && "mt-1 ml-0")}>
                {message}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 shrink-0">{children}</div>
          {adornment ? (
            <span className="shrink-0 text-[8px] font-bold tracking-wide text-on-surface-variant/75 uppercase">
              {adornment}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        grouped ? "group/form min-w-0 space-y-1 bg-surface-container-lowest px-4 py-3" : fieldShell,
        error && grouped && "bg-error-container/10",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <label
          className={cx(
            labelClass,
            grouped && "ml-0 transition-colors group-focus-within/form:text-accent",
          )}
          htmlFor={htmlFor}
        >
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          {readOnly && (
            <LockKeyhole className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden="true" />
          )}
          {adornment && (
            <span className="text-[8px] font-bold tracking-wide text-on-surface-variant/75 uppercase">
              {adornment}
            </span>
          )}
        </div>
      </div>
      {children}
      {error ? (
        <p id={helperId} className={cx(errorClass, grouped && "ml-0")}>
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className={cx(helperClass, grouped && "ml-0")}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type TextInputType = "email" | "password" | "search" | "tel" | "text" | "url";

export function TextInput({
  id,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  prefix,
  suffix,
  inputMode,
  autoComplete,
  autoFocus,
  required,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly type?: TextInputType;
  readonly value: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly prefix?: React.ReactNode;
  readonly suffix?: React.ReactNode;
  readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly autoComplete?: string;
  readonly autoFocus?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  return (
    <div
      className={cx(
        grouped
          ? "flex min-h-8 w-full min-w-0 items-center gap-2 border-0 bg-transparent px-0 focus-within:ring-0"
          : "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring",
        disabled && "opacity-55",
        readOnly && (grouped ? "opacity-70" : "bg-surface-container"),
        className,
      )}
    >
      {prefix && (
        <span className="shrink-0 text-xs font-bold text-on-surface-variant">{prefix}</span>
      )}
      <input
        id={id}
        name={name}
        type={type}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        inputMode={inputMode}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-on-surface caret-accent outline-none placeholder:text-on-surface-variant/55 disabled:cursor-not-allowed"
      />
      {suffix && (
        <span className="shrink-0 text-xs font-bold text-on-surface-variant">{suffix}</span>
      )}
    </div>
  );
}

export function Textarea({
  id,
  name,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  autoFocus,
  rows = 3,
  required,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly autoFocus?: boolean;
  readonly rows?: number;
  readonly required?: boolean;
  readonly className?: string;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      required={required}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className={cx(
        grouped
          ? "min-h-20 w-full min-w-0 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-5 font-semibold text-on-surface caret-accent outline-none placeholder:text-on-surface-variant/55 disabled:cursor-not-allowed disabled:opacity-55"
          : cx(
              controlClass,
              "min-h-24 resize-none rounded-2xl bg-surface-container-lowest py-3 placeholder:text-on-surface-variant/55 focus:border-accent focus:ring-2 focus:ring-focus-ring",
            ),
        readOnly && (grouped ? "opacity-70" : "bg-surface-container"),
        className,
      )}
    />
  );
}

export function NumericInput({
  id,
  name,
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  suffix,
  prefix,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly suffix?: React.ReactNode;
  readonly prefix?: React.ReactNode;
  readonly className?: string;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  return (
    <TextInput
      id={id}
      name={name}
      value={toNumberString(value)}
      onChange={(nextValue) => {
        const cleaned = decimalValue(nextValue);
        if (cleaned === "") {
          onChange("");
          return;
        }
        const numeric = Number(cleaned);
        if (Number.isNaN(numeric)) return;
        if (min !== undefined && numeric < min) {
          onChange(String(min));
          return;
        }
        if (max !== undefined && numeric > max) {
          onChange(String(max));
          return;
        }
        onChange(cleaned);
      }}
      placeholder={placeholder}
      disabled={disabled}
      prefix={prefix}
      suffix={suffix}
      inputMode="decimal"
      className={cx("font-mono tabular-nums", className)}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
    />
  );
}

export function MoneyInput({
  id,
  name,
  value,
  onChange,
  disabled,
  placeholder = "0",
  showPreview = true,
  "aria-describedby": ariaDescribedBy,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly showPreview?: boolean;
  readonly "aria-describedby"?: string;
}): React.JSX.Element {
  const numeric = Number(value || 0);
  return (
    <div className="space-y-1">
      <NumericInput
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        min={0}
        disabled={disabled}
        prefix="Rp"
        placeholder={placeholder}
        className="financial-amount"
        aria-describedby={ariaDescribedBy}
      />
      {showPreview && (
        <p className="financial-amount font-mono text-[10px] wrap-anywhere text-on-surface-variant">
          Rp {numeric.toLocaleString("id-ID")}
        </p>
      )}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  unit,
  min = 0,
  step = 1,
  disabled,
}: {
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly unit?: string;
  readonly min?: number;
  readonly step?: number;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";

  function adjust(delta: number): void {
    const current = Number(value || 0);
    const next = Math.max(min, Number((current + delta).toFixed(2)));
    onChange(String(next));
  }

  return (
    <div
      className={cx(
        "grid grid-cols-[44px_1fr_44px] overflow-hidden focus-within:ring-2 focus-within:ring-focus-ring",
        grouped
          ? "min-h-10 rounded-full bg-surface-container-low"
          : "min-h-12 rounded-full border border-outline-variant/35 bg-surface-container-lowest",
      )}
    >
      <button
        type="button"
        disabled={disabled || Number(value || 0) <= min}
        onClick={() => adjust(-step)}
        className="flex items-center justify-center border-r border-outline-variant/25 text-on-surface-variant transition active:scale-95 disabled:opacity-35"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 items-center justify-center gap-1 px-2">
        <input
          value={toNumberString(value)}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) => onChange(decimalValue(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm font-bold text-on-surface tabular-nums outline-none"
        />
        {unit && (
          <span className="shrink-0 text-[10px] font-bold text-on-surface-variant">{unit}</span>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => adjust(step)}
        className="flex items-center justify-center border-l border-outline-variant/25 text-on-surface-variant transition active:scale-95 disabled:opacity-35"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ChoiceRow({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cx(
        grouped
          ? "flex min-h-14 w-full items-center gap-3 bg-surface-container-lowest px-4 py-3 text-left transition active:bg-surface-container-low disabled:opacity-45"
          : "flex min-h-12 w-full items-center gap-3 rounded-full border px-5 py-3 text-left transition active:scale-[0.99] disabled:opacity-45",
        checked
          ? grouped
            ? "text-accent"
            : "border-accent bg-accent-container text-accent"
          : grouped
            ? "text-on-surface"
            : "border-outline-variant/15 bg-surface-container-lowest text-on-surface",
      )}
    >
      <span
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-accent bg-accent text-white" : "border-outline-variant bg-surface",
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{title}</span>
        {description && (
          <span className="mt-0.5 block text-meta text-on-surface-variant">{description}</span>
        )}
      </span>
    </button>
  );
}

export function SwitchRow({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 bg-white transition-opacity",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-bold text-on-surface">{title}</span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-on-surface-variant">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          checked ? "bg-success" : "bg-surface-container-high",
        )}
      >
        <motion.span
          transition={transitionSpringBouncy}
          className="absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow-control"
          animate={{ x: checked ? 20 : 0 }}
        />
      </button>
    </div>
  );
}
