import React from "react";

export type MaterialTone = "neutral" | "positive" | "warning" | "critical" | "pending";

const toneClasses: Record<MaterialTone, string> = {
  neutral: "bg-surface-container-high/65 text-on-surface-variant ring-black/[0.035]",
  positive: "bg-success/8 text-success ring-success/8",
  warning: "bg-warning/9 text-warning ring-warning/8",
  critical: "bg-error/7.5 text-error ring-error/8",
  pending: "bg-primary/8 text-primary ring-primary/8",
};

export function MaterialGroupSurface({
  children,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`relative isolate overflow-hidden rounded-[24px] bg-white/92 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_12px_28px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[22px] ${className}`}
    >
      {children}
    </div>
  );
}

export function MaterialSectionHeader({
  title,
  meta,
  action,
}: {
  readonly title: string;
  readonly meta?: string;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <h2 className="text-on-surface min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] max-[430px]:text-[15px] max-[430px]:leading-5">
        {title}
      </h2>
      {action ??
        (meta ? (
          <span className="text-on-surface-variant/65 shrink-0 text-[9px] font-semibold">
            {meta}
          </span>
        ) : null)}
    </div>
  );
}

export function MaterialSection({
  title,
  meta,
  action,
  children,
  className = "",
}: {
  readonly title: string;
  readonly meta?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <section className={`space-y-2 ${className}`}>
      <MaterialSectionHeader title={title} meta={meta} action={action} />
      {children}
    </section>
  );
}

export function MaterialStatusLabel({
  label,
  tone = "neutral",
  className = "",
}: {
  readonly label: string;
  readonly tone?: MaterialTone;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-semibold ring-1 ${toneClasses[tone]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function MaterialInlineState({
  icon,
  title,
  description,
  tone = "neutral",
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly tone?: MaterialTone;
}): React.JSX.Element {
  return (
    <div className="flex min-h-[76px] items-center gap-3 px-3.5 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${toneClasses[tone]}`}
      >
        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-on-surface text-[13px] leading-4 font-bold">{title}</span>
        <span className="text-on-surface-variant text-[11px] leading-[1.3]">{description}</span>
      </span>
    </div>
  );
}

export function MaterialTextAction({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-[#007AFF]/8 px-3 text-[10px] font-semibold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30 active:bg-[#007AFF]/[0.14]"
    >
      {label}
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        chevron_right
      </span>
    </button>
  );
}
