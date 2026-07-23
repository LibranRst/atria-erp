import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/badge/badge";

type ExpenseStatusTone = "critical" | "warning" | "positive" | "neutral";

const statusBadgeTone: Record<ExpenseStatusTone, StatusBadgeTone> = {
  critical: "critical",
  warning: "warning",
  positive: "healthy",
  neutral: "neutral",
};

export function ExpensesSummarySurface({
  ariaLabel,
  eyebrow,
  icon,
  status,
  statusTone = "neutral",
  action,
  children,
}: {
  readonly ariaLabel: string;
  readonly eyebrow: string;
  readonly icon: string;
  readonly status?: string;
  readonly statusTone?: ExpenseStatusTone;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]">
            <AppIcon name={icon} className="text-[17px] leading-none" />
          </span>
          <p className="min-w-0 truncate text-[10px] leading-4 font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
            {eyebrow}
          </p>
        </div>
        {action ??
          (status ? <StatusBadge tone={statusBadgeTone[statusTone]} label={status} /> : null)}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export function ExpensesGroupSurface({
  children,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl ${className}`}
    >
      {children}
    </div>
  );
}

export function ExpensesSectionHeader({
  title,
  meta,
}: {
  readonly title: string;
  readonly meta?: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-1">
      <h2 className="min-w-0 truncate text-[17px] leading-5 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px]">
        {title}
      </h2>
      {meta ? (
        <span className="shrink-0 text-[9px] leading-3 font-semibold text-on-surface-variant/65">
          {meta}
        </span>
      ) : null}
    </div>
  );
}
