"use client";

import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { motion } from "framer-motion";
import { transitionSpringBouncy } from "@/lib/utils/motion";

import { type FormFieldLayout, useFormPresentation } from "./form-presentation-context";
import {
  FormFieldAssociationProvider,
  mergeAriaIds,
  useFormFieldAssociation,
} from "./form-field-association-context";

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
  const generatedId = React.useId();
  const adornment = fieldAdornment(required, optional);
  const presentation = useFormPresentation();
  const grouped = presentation === "grouped";
  const message = error ?? helper;
  const messageClass = error ? errorClass : helperClass;
  const controlId = htmlFor ?? `${generatedId}-control`;
  const labelId = `${generatedId}-label`;
  const messageId = message ? (helperId ?? `${generatedId}-message`) : undefined;
  const association = React.useMemo(
    () => ({
      controlId,
      describedBy: messageId,
      invalid: Boolean(error),
      required: Boolean(required),
    }),
    [controlId, error, messageId, required],
  );

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
                id={labelId}
                className={cx(
                  labelClass,
                  grouped &&
                    "ml-0 text-meta tracking-[0.08em] transition-colors group-focus-within/form:text-accent",
                )}
                htmlFor={controlId}
              >
                {label}
              </label>
              {readOnly ? (
                <AppIcon
                  name="lock"
                  className="icon-xs shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            {message ? (
              <p id={messageId} className={cx(messageClass, grouped && "mt-1 ml-0")}>
                {message}
              </p>
            ) : null}
          </div>
          <FormFieldAssociationProvider value={association}>
            <div className="min-w-0 shrink-0">{children}</div>
          </FormFieldAssociationProvider>
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
          id={labelId}
          className={cx(
            labelClass,
            grouped && "ml-0 transition-colors group-focus-within/form:text-accent",
          )}
          htmlFor={controlId}
        >
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          {readOnly && (
            <AppIcon name="lock" className="icon-xs text-on-surface-variant" aria-hidden="true" />
          )}
          {adornment && (
            <span className="text-[8px] font-bold tracking-wide text-on-surface-variant/75 uppercase">
              {adornment}
            </span>
          )}
        </div>
      </div>
      <FormFieldAssociationProvider value={association}>{children}</FormFieldAssociationProvider>
      {error ? (
        <p id={messageId} className={cx(errorClass, grouped && "ml-0")}>
          {error}
        </p>
      ) : helper ? (
        <p id={messageId} className={cx(helperClass, grouped && "ml-0")}>
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
  onFocus,
  onBlur,
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
  readonly onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  readonly onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
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
  const association = useFormFieldAssociation();
  const resolvedId = id ?? association?.controlId;
  const resolvedDescribedBy = mergeAriaIds(ariaDescribedBy, association?.describedBy);
  const resolvedInvalid = ariaInvalid ?? association?.invalid;
  const resolvedRequired = required ?? association?.required;
  const grouped = useFormPresentation() === "grouped";
  return (
    <div
      className={cx(
        grouped
          ? "flex min-h-8 w-full min-w-0 items-center gap-2 border-0 bg-transparent px-0 focus-within:ring-0"
          : "flex min-h-12 w-full min-w-0 items-center gap-2 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 shadow-control transition focus-within:border-accent focus-within:ring-2 focus-within:ring-focus-ring",
        disabled && "opacity-55",
        readOnly && (grouped ? "opacity-70" : "bg-surface-container"),
        className,
      )}
    >
      {prefix && (
        <span className="shrink-0 text-xs font-bold text-on-surface-variant">{prefix}</span>
      )}
      <input
        id={resolvedId}
        name={name}
        type={type}
        aria-label={ariaLabel}
        aria-describedby={resolvedDescribedBy}
        aria-invalid={resolvedInvalid || undefined}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={resolvedRequired}
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
  const association = useFormFieldAssociation();
  const resolvedId = id ?? association?.controlId;
  const resolvedDescribedBy = mergeAriaIds(ariaDescribedBy, association?.describedBy);
  const resolvedInvalid = ariaInvalid ?? association?.invalid;
  const resolvedRequired = required ?? association?.required;
  const grouped = useFormPresentation() === "grouped";
  return (
    <textarea
      id={resolvedId}
      name={name}
      rows={rows}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      required={resolvedRequired}
      aria-label={ariaLabel}
      aria-describedby={resolvedDescribedBy}
      aria-invalid={resolvedInvalid || undefined}
      className={cx(
        grouped
          ? "min-h-20 w-full min-w-0 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-5 font-semibold text-on-surface caret-accent outline-none placeholder:text-on-surface-variant/55 disabled:cursor-not-allowed disabled:opacity-55"
          : cx(
              controlClass,
              "min-h-24 resize-none rounded-2xl bg-surface-container-lowest py-3 shadow-control placeholder:text-on-surface-variant/55 focus:border-accent focus:ring-2 focus:ring-focus-ring",
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
  onBlur,
  min,
  max,
  placeholder,
  disabled,
  suffix,
  prefix,
  className,
  required,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly suffix?: React.ReactNode;
  readonly prefix?: React.ReactNode;
  readonly className?: string;
  readonly required?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  return (
    <TextInput
      id={id}
      name={name}
      value={toNumberString(value)}
      onFocus={(event) => event.target.select()}
      onBlur={(event) => {
        if (value !== "" && min !== undefined && Number(value) < min) {
          onChange(String(min));
        }
        onBlur?.(event);
      }}
      onChange={(nextValue) => {
        const cleaned = decimalValue(nextValue);
        if (cleaned === "") {
          onChange("");
          return;
        }
        const numeric = Number(cleaned);
        if (Number.isNaN(numeric)) return;
        if (min !== undefined && min <= 0 && numeric < min) {
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
      required={required}
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
  showPreview,
  required,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly showPreview?: boolean;
  readonly required?: boolean;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  const presentation = useFormPresentation();
  const effectiveShowPreview = showPreview ?? presentation !== "grouped";
  const numeric = Number(value || 0);
  return (
    <div className={effectiveShowPreview ? "space-y-1" : undefined}>
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
        required={required}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      />
      {effectiveShowPreview && (
        <p className="financial-amount font-mono text-meta wrap-anywhere text-on-surface-variant">
          Rp {numeric.toLocaleString("id-ID")}
        </p>
      )}
    </div>
  );
}

export function QuantityStepper({
  id,
  name,
  value,
  onChange,
  unit,
  min = 0,
  max,
  step = 1,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  readonly id?: string;
  readonly name?: string;
  readonly value: string | number;
  readonly onChange: (value: string) => void;
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
}): React.JSX.Element {
  const association = useFormFieldAssociation();
  const resolvedId = id ?? association?.controlId;
  const resolvedDescribedBy = mergeAriaIds(ariaDescribedBy, association?.describedBy);
  const resolvedInvalid = ariaInvalid ?? association?.invalid;
  const resolvedRequired = required ?? association?.required;
  const grouped = useFormPresentation() === "grouped";

  function adjust(delta: number): void {
    const current = Number(value || 0);
    let next = Number((current + delta).toFixed(2));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(String(next));
  }

  return (
    <div
      className={cx(
        "grid grid-cols-[44px_1fr_44px] overflow-hidden focus-within:ring-2 focus-within:ring-focus-ring",
        grouped
          ? "min-h-10 rounded-full bg-surface-container-low"
          : "min-h-12 rounded-full border border-outline-variant/35 bg-surface-container-lowest shadow-control",
      )}
    >
      <button
        type="button"
        aria-label="Kurangi jumlah"
        disabled={disabled || Number(value || 0) <= min}
        onClick={() => adjust(-step)}
        className="flex items-center justify-center border-r border-outline-variant/25 text-on-surface-variant transition active:scale-95 disabled:opacity-35"
      >
        <AppIcon name="remove" className="icon-sm" />
      </button>
      <div className="flex min-w-0 items-center justify-center gap-1 px-2">
        <input
          id={resolvedId}
          name={name}
          value={toNumberString(value)}
          disabled={disabled}
          inputMode="decimal"
          required={resolvedRequired}
          aria-describedby={resolvedDescribedBy}
          aria-invalid={resolvedInvalid || undefined}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const cleaned = decimalValue(event.target.value);
            if (cleaned === "") {
              onChange("");
              return;
            }
            const numeric = Number(cleaned);
            if (Number.isNaN(numeric)) return;
            if (max !== undefined && numeric > max) {
              onChange(String(max));
              return;
            }
            onChange(cleaned);
          }}
          onBlur={() => {
            if (value === "" || Number.isNaN(Number(value))) {
              onChange(String(min));
            } else if (min !== undefined && Number(value) < min) {
              onChange(String(min));
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm font-bold text-on-surface tabular-nums outline-none"
        />
        {unit && (
          <span className="shrink-0 text-meta font-bold text-on-surface-variant">{unit}</span>
        )}
      </div>
      <button
        type="button"
        aria-label="Tambah jumlah"
        disabled={disabled || (max !== undefined && Number(value || 0) >= max)}
        onClick={() => adjust(step)}
        className="flex items-center justify-center border-l border-outline-variant/25 text-on-surface-variant transition active:scale-95 disabled:opacity-35"
      >
        <AppIcon name="add" className="icon-sm" />
      </button>
    </div>
  );
}

/**
 * Baris pilihan dalam daftar.
 *
 * `selectionMode="radio"` untuk pilihan yang saling meniadakan: indikatornya
 * menjadi titik, semantiknya `role="radio"` + `aria-checked` (bungkus dengan
 * `role="radiogroup"` di sisi pemanggil), dan menekan baris yang sudah terpilih
 * tidak membatalkannya — pada pilihan tunggal, "tidak memilih apa pun" bukan
 * keadaan yang sah.
 */
export function ChoiceRow({
  checked,
  onChange,
  title,
  description,
  disabled,
  selectionMode = "checkbox",
  emphasis = "accent",
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly selectionMode?: "checkbox" | "radio";
  /**
   * `neutral` menahan warna aksen pada indikatornya saja.
   *
   * Untuk daftar pendek, label beraksen menegaskan pilihan. Untuk matriks padat
   * — daftar izin sebuah peran bisa 54 baris menyala — mewarnai seluruh label
   * mengubah aksen menjadi latar, dan justru baris yang MATI yang menonjol.
   */
  readonly emphasis?: "accent" | "neutral";
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  const radio = selectionMode === "radio";
  const tintLabel = emphasis === "accent";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(radio ? true : !checked)}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? checked : undefined}
      aria-pressed={radio ? undefined : checked}
      className={cx(
        grouped
          ? "flex min-h-14 w-full items-center gap-3 bg-surface-container-lowest px-4 py-3 text-left transition active:bg-surface-container-low disabled:opacity-45"
          : "flex min-h-12 w-full items-center gap-3 rounded-full border px-5 py-3 text-left shadow-control transition active:scale-[0.99] disabled:opacity-45",
        checked
          ? grouped
            ? tintLabel
              ? "text-accent"
              : "text-on-surface"
            : tintLabel
              ? "border-accent bg-accent-container text-accent"
              : "border-accent/40 bg-surface-container-lowest text-on-surface"
          : grouped
            ? "text-on-surface"
            : "border-outline-variant/15 bg-surface-container-lowest text-on-surface",
      )}
    >
      <span
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          checked
            ? radio
              ? "border-accent bg-surface"
              : "border-accent bg-accent text-white"
            : "border-outline-variant bg-surface",
        )}
        aria-hidden="true"
      >
        {checked ? (
          radio ? (
            <span className="block h-2.5 w-2.5 rounded-full bg-accent" />
          ) : (
            <AppIcon name="check" className="h-3 w-3" />
          )
        ) : null}
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
  trailing,
  switchLabel,
  className,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly disabled?: boolean;
  /** Nilai/status ringkas di antara label dan sakelar (mis. nominal uang). */
  readonly trailing?: React.ReactNode;
  /** Label aksesibel sakelar; default memakai `title`. */
  readonly switchLabel?: string;
  readonly className?: string;
}): React.JSX.Element {
  const grouped = useFormPresentation() === "grouped";
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 transition-opacity",
        grouped ? "min-h-14 bg-surface-container-lowest px-4 py-3" : "bg-surface-container-lowest",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-row font-bold text-on-surface">{title}</span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-on-surface-variant">
            {description}
          </span>
        )}
      </div>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={switchLabel ?? title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        /*
         * Sakelarnya digambar 44×24, tetapi area sentuhnya dilebarkan lewat
         * `after:` menjadi 52×48 sesuai aturan target sentuh 48 px. Tanpa ini
         * ia jadi kontrol tersulit disentuh di aplikasi — dan layar peran
         * menampilkan 71 di antaranya.
         */
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
