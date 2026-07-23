import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/badge/badge";

export type MaterialTone = "neutral" | "positive" | "warning" | "critical" | "pending";

const toneClasses: Record<MaterialTone, string> = {
  neutral: "bg-surface-container-high/65 text-on-surface-variant ring-black/[0.035]",
  positive: "bg-success/8 text-success ring-success/8",
  warning: "bg-warning/9 text-warning ring-warning/8",
  critical: "bg-error/7.5 text-error ring-error/8",
  pending: "bg-primary/8 text-primary ring-primary/8",
};

const materialBadgeTone: Record<MaterialTone, StatusBadgeTone> = {
  neutral: "neutral",
  positive: "healthy",
  warning: "warning",
  critical: "critical",
  pending: "pending",
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
      className={`relative isolate overflow-hidden rounded-3xl bg-white/92 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_12px_28px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[22px] ${className}`}
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
      <h2 className="min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
        {title}
      </h2>
      {action ??
        (meta ? (
          <span className="shrink-0 text-[9px] font-semibold text-on-surface-variant/65">
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
  return <StatusBadge className={className} tone={materialBadgeTone[tone]} label={label} />;
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
    <div className="flex min-h-19 items-center gap-3 px-3.5 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${toneClasses[tone]}`}
      >
        <AppIcon name={icon} className="text-[17px]" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[13px] leading-4 font-bold text-on-surface">{title}</span>
        <span className="text-[11px] leading-[1.3] text-on-surface-variant">{description}</span>
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
      className="relative inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-accent/8 px-3 text-[10px] font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent/30 active:bg-accent/[0.14]"
    >
      {label}
      <AppIcon name="chevron_right" className="text-[14px]" />
    </button>
  );
}
