"use client";

import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";

import { CalendarDialog } from "../overlay/dialogs";
import { FormField } from "./basic-form-controls";
import { cx, formatDateLabel } from "./form-control-utils";
import { useFormPresentation } from "./form-presentation-context";

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  disabled,
  helper,
  required,
  error,
}: {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly helper?: string;
  readonly required?: boolean;
  readonly error?: string;
}): React.JSX.Element {
  const generatedId = React.useId();
  const controlId = id ?? `${generatedId}-control`;
  const messageId = helper || error ? `${generatedId}-message` : undefined;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const grouped = useFormPresentation() === "grouped";
  const [open, setOpen] = React.useState(false);

  return (
    <FormField
      label={label}
      helper={helper}
      error={error}
      htmlFor={controlId}
      helperId={messageId}
      required={required}
    >
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        aria-label={`${label}: ${value ? formatDateLabel(value) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={messageId}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cx(
          grouped
            ? "flex min-h-8 w-full items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-55"
            : "flex min-h-12 w-full items-center justify-between gap-3 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 text-left shadow-control transition focus:border-accent focus:ring-2 focus:ring-focus-ring focus:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55",
        )}
      >
        <span
          className={cx(
            "text-sm font-bold",
            value ? "text-on-surface" : "text-on-surface-variant/65",
          )}
        >
          {value ? formatDateLabel(value) : placeholder}
        </span>
        <AppIcon name="event" className="icon-sm text-on-surface-variant" />
      </button>
      <CalendarDialog
        open={open}
        title={label}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
      />
    </FormField>
  );
}
