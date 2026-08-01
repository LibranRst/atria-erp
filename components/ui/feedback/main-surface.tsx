import React from "react";

import { cn } from "@/lib/utils/cn";
import { formatIdr, formatTightIdr } from "@/lib/utils/money";
import { SectionCountPill, StatusBadge, type StatusBadgeTone } from "../badge/badge";
import { SectionAction } from "../button/button";
import { AppIcon } from "../icon/app-icon";

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
      className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-2 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl"
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
  titleAction,
  meta,
  count,
  countLabel,
  action,
  className = "",
}: {
  readonly id?: string;
  readonly title: string;
  /** Elemen kecil yang menempel pada judul, misalnya badge status seksi. */
  readonly titleAction?: React.ReactNode;
  readonly meta?: string;
  readonly count?: number;
  readonly countLabel?: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div className={`flex items-center justify-between gap-3 px-1 pt-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <h2
          id={id}
          className="min-w-0 truncate text-title font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5"
        >
          {title}
        </h2>
        {titleAction}
      </div>
      {count !== undefined || meta || action ? (
        <div className="flex shrink-0 items-center gap-2">
          {count !== undefined ? (
            <SectionCountPill count={count} label={countLabel ?? "Item"} />
          ) : meta ? (
            <span className="text-eyebrow font-semibold text-on-surface-variant/65">{meta}</span>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function MainSection({
  title,
  titleAction,
  meta,
  count,
  countLabel,
  action,
  children,
  className = "",
}: {
  readonly title: string;
  readonly titleAction?: React.ReactNode;
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
        titleAction={titleAction}
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
  titleAction,
  count,
  countLabel,
  href,
  actionLabel = "Lihat semua",
  children,
  className = "",
  contentClassName = "",
}: {
  readonly title: string;
  readonly titleAction?: React.ReactNode;
  readonly count?: number;
  readonly countLabel?: string;
  readonly href?: string;
  readonly actionLabel?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <MainSection
      title={title}
      titleAction={titleAction}
      count={count}
      countLabel={countLabel}
      action={href ? <SectionAction href={href} label={actionLabel} /> : undefined}
      className={className}
    >
      <GroupedSurface className={contentClassName}>{children}</GroupedSurface>
    </MainSection>
  );
}

/**
 * Seksi di dalam bottom sheet: label seksi di luar kartu, lalu satu permukaan
 * putih yang menampung baris-barisnya. Dipakai bersama oleh sheet detail
 * material, penerimaan, dan sheet lain dengan struktur yang sama.
 */
export function SheetSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[12px] font-bold tracking-wide text-on-surface-variant uppercase">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-ring-subtle">
        {children}
      </div>
    </section>
  );
}

/**
 * Panel putih dengan header ber-padding di dalam permukaannya sendiri. Dipakai
 * untuk blok kerja seperti RAP/RAB yang butuh judul, eyebrow, dan aksi menempel
 * pada konten — berbeda dari `MainSection` yang judulnya berada di luar kartu.
 */
export function PanelSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <section
      className={`rounded-3xl bg-white p-4 shadow-surface ring-1 ring-ring-subtle ${className}`}
    >
      <div className="mb-sm flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
              {eyebrow}
            </p>
          )}
          <h3 className="text-title font-semibold text-on-surface">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
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

/**
 * Baris fakta satu baris: label di kiri, nilai di kanan. Dipakai di dalam sheet
 * detail dan permukaan grouped. Gunakan `inset={false}` bila kontainer induknya
 * sudah punya padding horizontal sendiri.
 */
export function FactRow({
  label,
  value,
  inset = true,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly inset?: boolean;
}): React.JSX.Element {
  return (
    <div className={`flex items-start justify-between gap-4 py-3.5 text-xs ${inset ? "px-4" : ""}`}>
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="min-w-0 text-right font-bold text-on-surface">{value}</span>
    </div>
  );
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

  const displayValue = amount !== undefined ? formatTightIdr(amount) : value;
  const exactValue = amount !== undefined ? formatIdr(amount) : value;

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-white px-2.5 py-2 max-[430px]:px-2">
      <p className="line-clamp-2 text-[9px] leading-[1.35] font-bold tracking-wide text-on-surface-variant/55 uppercase">
        {label}
      </p>
      {children ?? (
        <span className="money-value-fit block min-w-0">
          <span
            className={cn(
              "financial-amount money-value-fit__primary block font-mono font-black tabular-nums",
              toneClass,
            )}
            title={exactValue}
          >
            {displayValue}
          </span>
        </span>
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
        <span className="text-row font-bold text-on-surface">{title}</span>
        <span className="text-[11px] leading-[1.3] text-on-surface-variant">{description}</span>
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
