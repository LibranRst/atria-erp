"use client";

import React from "react";

export type FilterPillOption = {
  readonly value: string;
  readonly label: string;
};

type FilterPillsProps = {
  readonly label?: string;
  readonly value: string;
  readonly options: readonly FilterPillOption[];
  readonly onChange: (value: string) => void;
};

export function FilterPills({
  label = "Filter",
  value,
  options,
  onChange,
}: FilterPillsProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="sr-only">{label}</p>
      <div
        className="no-scrollbar flex w-full gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`h-9 shrink-0 rounded-full px-4 text-support font-bold transition active:z-10 active:scale-[1.05] active:shadow-raised ${
              value === option.value
                ? "bg-primary text-on-primary shadow-primary"
                : "bg-surface-container text-on-surface-variant ring-1 ring-ring-control"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
