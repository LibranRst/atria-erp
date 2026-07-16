import React from "react";

type ExpenseStatusTone = "critical" | "warning" | "positive" | "neutral";

const statusToneClass: Record<ExpenseStatusTone, string> = {
  critical: "bg-error/[0.075] text-error ring-error/[0.08]",
  warning: "bg-warning/[0.09] text-warning ring-warning/[0.08]",
  positive: "bg-success/[0.08] text-success ring-success/[0.08]",
  neutral: "bg-surface-container-high/70 text-on-surface-variant ring-black/[0.035]",
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
      className="relative isolate overflow-hidden rounded-[26px] bg-white/[0.88] p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/[0.025] backdrop-blur-xl max-[430px]:rounded-[24px] max-[430px]:p-3.5"
      aria-label={ariaLabel}
    >
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]">
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">{icon}</span>
          </span>
          <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/60">{eyebrow}</p>
        </div>
        {action ?? (status ? (
          <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-semibold ring-1 ${statusToneClass[statusTone]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {status}
          </span>
        ) : null)}
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
    <div className={`relative isolate overflow-hidden rounded-[26px] bg-white/[0.88] shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/[0.025] backdrop-blur-xl max-[430px]:rounded-[24px] ${className}`}>
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
      <h2 className="min-w-0 truncate text-[17px] font-bold leading-6 tracking-[-0.015em] text-on-surface max-[430px]:text-[15px]">{title}</h2>
      {meta ? <span className="shrink-0 text-[9px] font-semibold text-on-surface-variant/65">{meta}</span> : null}
    </div>
  );
}
