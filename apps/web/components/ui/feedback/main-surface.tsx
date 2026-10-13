import React from "react";

import { cn } from "@/lib/utils/cn";
import { SectionCountPill, StatusBadge, type StatusBadgeTone } from "../badge/badge";
import { SectionAction } from "../button/button";
import { DuotoneIconTile } from "../icon/icon-tile";
import { MoneyValue, type MoneyValueVariant } from "./page-primitives";

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
  positive: "bg-surface-container-low text-on-surface ring-ring-subtle",
  warning: "bg-warning/9 text-warning ring-warning/8",
  critical: "bg-error/7.5 text-error ring-error/8",
  pending: "bg-surface-container-low text-on-surface ring-ring-subtle",
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
      className="relative isolate overflow-hidden rounded-owner bg-surface-container-lowest p-2 shadow-surface ring-1 ring-ring-subtle"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <DuotoneIconTile name={icon} className="h-8 w-8" iconClassName="icon-sm" />
          <p className="min-w-0 truncate text-meta font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
            {eyebrow}
          </p>
        </div>
        {action ??
          (status ? <StatusBadge tone={summaryBadgeTone[statusTone]} label={status} /> : null)}
      </div>
      <div className="mt-1 rounded-inset bg-surface-container-low">{children}</div>
    </section>
  );
}

export function GroupedSurface({
  as: Component = "div",
  children,
  className = "",
  variant = "default",
}: {
  readonly as?: "article" | "div" | "section";
  readonly variant?: "default" | "desktopPanel";
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <Component
      className={`relative isolate overflow-hidden bg-surface-container-lowest ${variant === "desktopPanel" ? "rounded-desktop-panel ring-1 ring-ring-subtle" : "rounded-owner shadow-surface ring-1 ring-ring-subtle"} ${className}`}
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
          className="min-w-0 truncate text-section font-bold tracking-[-0.015em] text-on-surface"
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
      <h3 className="px-1 text-support font-bold tracking-wide text-on-surface-variant uppercase">
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
  variant = "default",
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly variant?: "default" | "desktopPanel";
}): React.JSX.Element {
  return (
    <section
      className={`bg-white p-4 ring-1 ring-ring-subtle ${variant === "desktopPanel" ? "rounded-desktop-panel" : "rounded-owner shadow-surface"} ${className}`}
    >
      <div className="mb-sm flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
              {eyebrow}
            </p>
          )}
          <h3
            className={`${variant === "desktopPanel" ? "text-section" : "text-title"} font-semibold text-on-surface`}
          >
            {title}
          </h3>
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
  wrapLabel = false,
  layout = "inline",
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly inset?: boolean;
  readonly wrapLabel?: boolean;
  /** Stacked facts keep long labels/values legible in narrow form asides. */
  readonly layout?: "inline" | "stacked";
}): React.JSX.Element {
  if (layout === "stacked")
    return (
      <div className={`grid min-w-0 gap-1 py-3 text-xs ${inset ? "px-4" : ""}`}>
        <span className="text-on-surface-variant">{label}</span>
        <span className="min-w-0 font-semibold wrap-anywhere text-on-surface">{value}</span>
      </div>
    );
  return (
    <div
      className={`flex ${wrapLabel ? "items-center" : "items-start"} justify-between gap-4 py-3.5 text-xs ${inset ? "px-4" : ""}`}
    >
      <span
        className={`${wrapLabel ? "min-w-0 flex-1 wrap-anywhere" : "shrink-0"} text-on-surface-variant`}
      >
        {label}
      </span>
      <span
        className={`${wrapLabel ? "max-w-[70%] min-w-0 shrink-0" : "min-w-0"} text-right font-bold text-on-surface`}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryFact({
  label,
  value,
  amount,
  variant,
  tone = "default",
  children,
}: {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
  readonly variant?: MoneyValueVariant;
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

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-inset bg-white px-2.5 py-2 max-[430px]:px-2">
      <p className="line-clamp-2 text-[9px] leading-[1.35] font-bold tracking-wide text-on-surface-variant/55 uppercase">
        {label}
      </p>
      {children ??
        (amount !== undefined ? (
          <MoneyValue
            amount={amount}
            variant={variant ?? "fullDynamic"}
            tone={tone === "positive" ? "success" : tone}
            size="md"
          />
        ) : (
          <span className="money-value-fit block min-w-0">
            <span
              className={cn(
                "financial-amount money-value-fit__primary block font-sans font-extrabold tracking-[-0.02em] tabular-nums",
                toneClass,
              )}
              title={value}
            >
              {value}
            </span>
          </span>
        ))}
    </div>
  );
}

export function InlineStateRow({
  icon,
  title,
  description,
  tone = "neutral",
  action,
  actionPlacement = "trailing",
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly tone?: InlineStateTone;
  readonly action?: React.ReactNode;
  readonly actionPlacement?: "trailing" | "below";
}): React.JSX.Element {
  return (
    <div
      className={`flex min-h-19 gap-3 px-3.5 py-3 ${actionPlacement === "below" ? "items-start" : "items-center"}`}
    >
      <DuotoneIconTile
        name={icon}
        tone={tone === "critical" ? "critical" : tone === "warning" ? "attention" : "neutral"}
        className={`h-9 w-9 ring-1 ${inlineStateToneClass[tone]}`}
        iconClassName="icon-sm"
      />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-row font-bold text-on-surface">{title}</span>
        <span className="text-support text-on-surface-variant">{description}</span>
        {action && actionPlacement === "below" ? (
          <span className="mt-1 justify-self-start">{action}</span>
        ) : null}
      </span>
      {action && actionPlacement === "trailing" ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}
