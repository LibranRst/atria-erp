"use client";

import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { BottomSheet } from "./bottom-sheet";
import { FormField } from "./basic-form-controls";
import { cx, formatDateLabel, formatIsoDate, parseIsoDate } from "./form-control-utils";
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
  const grouped = useFormPresentation() === "grouped";
  const parsed = parseIsoDate(value);
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState<Date>(parsed ?? new Date());
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const blanks = monthStart.getDay();
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(viewDate);
  const selectedDate = parsed ? formatIsoDate(parsed) : "";

  return (
    <FormField label={label} helper={helper} error={error} htmlFor={id} required={required}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cx(
          grouped
            ? "flex min-h-8 w-full items-center justify-between gap-3 border-0 bg-transparent px-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-55"
            : "border-outline-variant/35 bg-surface-container-lowest flex min-h-12 w-full items-center justify-between gap-3 rounded-full border px-5 text-left transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55",
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
        <CalendarDays className="text-on-surface-variant h-4 w-4" />
      </button>
      <BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
        <div className="bg-surface-container-lowest ring-outline-variant/15 rounded-[24px] p-3 ring-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              className="flex h-11 w-11 items-center justify-center rounded-full text-blue-600 transition active:bg-blue-50"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-on-surface text-sm font-bold">{monthLabel}</p>
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              className="flex h-11 w-11 items-center justify-center rounded-full text-blue-600 transition active:bg-blue-50"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-on-surface-variant grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: blanks }).map((_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const iso = formatIsoDate(date);
              const active = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex aspect-square items-center justify-center rounded-full text-xs font-bold transition active:scale-95",
                    active
                      ? "bg-blue-500 text-white"
                      : "text-on-surface hover:bg-surface-container-low",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </FormField>
  );
}
