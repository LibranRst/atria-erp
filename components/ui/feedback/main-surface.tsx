import React from "react";

import { cn } from "@/lib/utils/cn";
import { SectionCountPill, StatusBadge, type StatusBadgeTone } from "../badge/badge";
import { SectionAction } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { MoneyValue } from "./page-primitives";

export type SummarySurfaceTone = "critical" | "warning" | "positive" | "neutral";
export type InlineStateTone = "neutral" | "positive" | "warning" | "critical" | "pending";

const summaryBadgeTone: Record<SummarySurfaceTone, StatusBadgeTone> = {
  critical: "critical",
  warning: "warning",
  positive: "healthy",
  neutral: "neutral",
};

const inlineStateToneClass: Record<InlineStateTone, string> = {
  neutral: "bg-surface-container-high/65 text-on-surface-variant ring-ring-subtle",
  positive: "bg-success/8 text-success ring-success/8",
  warning: "bg-warning/9 text-warning ring-warning/8",
  critical: "bg-error/7.5 text-error ring-error/8",
  pending: "bg-primary/8 text-primary ring-primary/8",
};

export function SummarySurface({
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
  readonly statusTone?: SummarySurfaceTone;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-2 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant ring-1 ring-ring-subtle">
            <AppIcon name={icon} className="text-[17px]" />
          </span>
          <p className="min-w-0 truncate text-[10px] font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
            {eyebrow}
          </p>
        </div>
        {action ??
          (status ? <StatusBadge tone={summaryBadgeTone[statusTone]} label={status} /> : null)}
      </div>
      <div className="mt-1 rounded-2xl bg-surface-container-low">{children}</div>
    </section>
  );
}

export function GroupedSurface({
  as: Component = "div",
  children,
  className = "",
}: {
  readonly as?: "article" | "div" | "section";
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <Component
      className={`relative isolate overflow-hidden rounded-3xl bg-white/88 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl max-[430px]:rounded-3xl ${className}`}
    >
      {children}
    </Component>
  );
}

export function SectionHeader({
  id,
  title,
  meta,
  count,
  countLabel,
  action,
  className = "",
}: {
  readonly id?: string;
  readonly title: string;
  readonly meta?: string;
  readonly count?: number;
  readonly countLabel?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div className={`flex items-center justify-between gap-3 px-1 pt-2 ${className}`}>
      <h2
        id={id}
        className="min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5"
      >
        {title}
      </h2>
      {count !== undefined || meta || action ? (
        <div className="flex shrink-0 items-center gap-2">
          {count !== undefined ? (
            <SectionCountPill count={count} label={countLabel ?? "Item"} />
          ) : meta ? (
            <span className="text-[9px] leading-3 font-semibold text-on-surface-variant/65">
              {meta}
            </span>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function MainSection({
  title,
  meta,
  count,
  countLabel,
  action,
  children,
  className = "",
}: {
  readonly title: string;
  readonly meta?: string;
  readonly count?: number;
  readonly countLabel?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <section className={`space-y-2 ${className}`}>
      <SectionHeader
        title={title}
        meta={meta}
        count={count}
        countLabel={countLabel}
        action={action}
      />
      {children}
    </section>
  );
}

export function DetailSection({
  title,
  count,
  countLabel,
  href,
  actionLabel = "Lihat semua",
  children,
  contentClassName = "",
}: {
  readonly title: string;
  readonly count?: number;
  readonly countLabel?: string;
  readonly href?: string;
  readonly actionLabel?: string;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <MainSection
      title={title}
      count={count}
      countLabel={countLabel}
      action={href ? <SectionAction href={href} label={actionLabel} /> : undefined}
    >
      <GroupedSurface className={contentClassName}>{children}</GroupedSurface>
    </MainSection>
  );
}

export function RowGroup({
  children,
  connected = false,
}: {
  readonly children: React.ReactNode;
  readonly connected?: boolean;
}): React.JSX.Element {
  if (connected) {
    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-13.5 w-px bg-black/11 max-[430px]:left-12.5"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </div>
    );
  }

  return <div className="divide-y divide-black/5.5">{children}</div>;
}

export function SummaryFact({
  label,
  value,
  amount,
  tone = "default",
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
  readonly tone?: "default" | "danger" | "warning" | "positive";
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  const toneClass =
    tone === "danger"
      ? "text-error"
      : tone === "warning"
        ? "text-warning"
        : tone === "positive"
          ? "text-success"
          : "text-on-surface";
  const moneyTone = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "default";

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-white px-2.5 py-2">
      <p className="truncate text-[9px] leading-4 font-bold tracking-wide text-on-surface-variant/55 uppercase">
        {label}
      </p>
      {amount !== undefined ? (
        <MoneyValue amount={amount} variant="compactWithFull" size="sm" tone={moneyTone} />
      ) : children ? (
        children
      ) : (
        <p className={cn("truncate font-mono text-sm leading-4 font-black", toneClass)}>{value}</p>
      )}
    </div>
  );
}

export function InlineStateRow({
  icon,
  title,
  description,
  tone = "neutral",
  action,
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly tone?: InlineStateTone;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-19 items-center gap-3 px-3.5 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${inlineStateToneClass[tone]}`}
      >
        <AppIcon name={icon} className="text-[17px]" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[13px] leading-4 font-bold text-on-surface">{title}</span>
        <span className="text-[11px] leading-[1.3] text-on-surface-variant">{description}</span>
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
