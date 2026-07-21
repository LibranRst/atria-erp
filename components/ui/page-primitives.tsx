import type { JSX, ReactNode } from "react";

import { formatIdr, formatShortIdr } from "@/lib/utils/money";

type PageHeaderProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly eyebrow?: string;
  readonly action?: ReactNode;
  readonly badge?: ReactNode;
  readonly className?: string;
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  badge,
  className = "",
}: PageHeaderProps): JSX.Element {
  return (
    <header className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-primary mb-1 text-[9px] font-bold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-on-surface text-[28px] leading-8 font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-on-surface-variant mt-1 text-xs leading-4">{subtitle}</p>}
      </div>
      {(action || badge) && <div className="shrink-0 pt-1">{action ?? badge}</div>}
    </header>
  );
}

type NativeSectionProps = {
  readonly eyebrow?: string;
  readonly title?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
};

export function NativeSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
  contentClassName = "",
}: NativeSectionProps): JSX.Element {
  const hasHeader = Boolean(eyebrow || title || action);
  return (
    <section
      className={`p-md rounded-[28px] bg-white shadow-[0_14px_34px_rgba(17,17,17,0.045)] ${className}`}
    >
      {hasHeader && (
        <div className="mb-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-on-surface text-[17px] leading-6 font-semibold">{title}</h2>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

type MetricTone = "default" | "primary" | "muted" | "warning" | "danger";
type MoneyValueTone = MetricTone | "inverse" | "inherit";
type MoneyValueSize = "xs" | "sm" | "md" | "lg" | "hero";

function metricToneClass(tone: MetricTone = "default"): string {
  if (tone === "primary") return "text-primary";
  if (tone === "muted") return "text-on-surface-variant";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-error";
  return "text-on-surface";
}

function moneyToneClass(tone: MoneyValueTone = "default"): string {
  if (tone === "inherit") return "";
  if (tone === "inverse") return "text-white";
  return metricToneClass(tone);
}

function moneySecondaryToneClass(tone: MoneyValueTone = "default"): string {
  if (tone === "inherit") return "opacity-70";
  if (tone === "inverse") return "text-white/60";
  return "text-on-surface-variant/75";
}

function moneyCompactSizeClass(size: MoneyValueSize = "md"): string {
  if (size === "hero") return "text-[30px] leading-9";
  if (size === "lg") return "text-[15px] leading-5";
  if (size === "xs") return "text-[10px] leading-3";
  if (size === "sm") return "text-[12px] leading-4";
  return "text-[13px] leading-4";
}

function moneyDynamicSizeClass(size: MoneyValueSize = "lg"): string {
  if (size === "hero") return "money-value-dynamic--hero";
  if (size === "md") return "money-value-dynamic--md";
  if (size === "sm" || size === "xs") return "money-value-dynamic--sm";
  return "money-value-dynamic--lg";
}

function moneySecondarySizeClass(size: MoneyValueSize = "md"): string {
  if (size === "xs") return "text-[8px] leading-[10px]";
  return "text-[9px] leading-3";
}

export type MoneyValueVariant = "compactWithFull" | "fullDynamic";

type MoneyValueProps = {
  readonly amount: number;
  readonly variant: MoneyValueVariant;
  readonly prefix?: string;
  readonly tone?: MoneyValueTone;
  readonly align?: "left" | "right";
  readonly size?: MoneyValueSize;
  readonly className?: string;
};

export function MoneyValue({
  amount,
  variant,
  prefix = "",
  tone = "default",
  align = "left",
  size = "md",
  className = "",
}: MoneyValueProps): JSX.Element {
  const compactValue = `${prefix}${formatShortIdr(amount)}`;
  const fullValue = `${prefix}${formatIdr(amount)}`;
  const alignClass = align === "right" ? "text-right" : "text-left";
  const valueClass = moneyToneClass(tone);

  if (variant === "fullDynamic") {
    return (
      <span
        className={`money-value-dynamic leading-5 ${moneyDynamicSizeClass(size)} ${alignClass} ${className}`}
        title={fullValue}
      >
        <span
          className={`financial-amount money-value-dynamic__text block font-mono leading-4 font-bold tabular-nums ${valueClass}`}
        >
          {fullValue}
        </span>
      </span>
    );
  }

  return (
    <span className={`money-value-compact block min-w-0 ${alignClass} ${className}`}>
      <span
        className={`financial-amount block font-mono leading-5 font-bold whitespace-nowrap tabular-nums ${moneyCompactSizeClass(size)} ${valueClass}`}
        title={fullValue}
      >
        {compactValue}
      </span>
      {compactValue !== fullValue && (
        <span
          className={`financial-amount money-value-exact block font-mono leading-4 tabular-nums ${moneySecondarySizeClass(size)} ${moneySecondaryToneClass(tone)}`}
        >
          {fullValue}
        </span>
      )}
    </span>
  );
}

type MetricPillProps = {
  readonly label: string;
  readonly value: string;
  readonly fullValue?: string;
  readonly tone?: MetricTone;
  readonly valueSize?: "sm" | "md" | "lg";
  readonly align?: "left" | "right";
  readonly wrapMode?: "wrap" | "truncate";
};

export function MetricPill({
  label,
  value,
  fullValue,
  tone = "default",
  valueSize = "md",
  align = "left",
  wrapMode = "wrap",
}: MetricPillProps): JSX.Element {
  const valueClass = metricToneClass(tone);
  const sizeClass =
    valueSize === "lg"
      ? "text-[15px] leading-5"
      : valueSize === "sm"
        ? "text-[12px] leading-4"
        : "text-[13px] leading-4";
  const alignClass = align === "right" ? "text-right" : "text-left";
  const wrapClass = wrapMode === "truncate" ? "truncate" : "wrap-break-word wrap-anywhere";

  return (
    <div className={`bg-surface-container-low min-w-0 rounded-2xl px-3 py-2.5 ${alignClass}`}>
      <p className="text-on-surface-variant truncate text-[9px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`financial-amount mt-0.5 font-mono font-bold tabular-nums ${sizeClass} ${wrapClass} ${valueClass}`}
      >
        {value}
      </p>
      {fullValue && fullValue !== value && (
        <p className="financial-amount text-on-surface-variant/75 mt-1 font-mono text-[9px] leading-3 wrap-anywhere wrap-break-word tabular-nums">
          {fullValue}
        </p>
      )}
    </div>
  );
}

type MoneyMetricPillProps = {
  readonly label: string;
  readonly amount: number;
  readonly prefix?: string;
  readonly detail?: string;
  readonly variant?: MoneyValueVariant;
  readonly tone?: MoneyValueTone;
  readonly valueSize?: MoneyValueSize;
  readonly align?: "left" | "right";
  readonly className?: string;
};

export function MoneyMetricPill({
  label,
  amount,
  prefix,
  detail,
  variant = "compactWithFull",
  tone = "default",
  valueSize = "md",
  align = "left",
  className = "",
}: MoneyMetricPillProps): JSX.Element {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <div
      className={`bg-surface-container-low min-w-0 rounded-2xl px-3 py-2.5 ${alignClass} ${className}`}
    >
      <p className="text-on-surface-variant truncate text-[9px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <MoneyValue
        amount={amount}
        variant={variant}
        prefix={prefix}
        tone={tone}
        align={align}
        size={valueSize}
        className="mt-0.5"
      />
      {detail && (
        <p className="text-on-surface-variant/75 mt-1 text-[9px] leading-3 font-bold wrap-anywhere wrap-break-word">
          {detail}
        </p>
      )}
    </div>
  );
}

type MetricGridProps = {
  readonly children: ReactNode;
  readonly minColumnWidth?: number;
  readonly balanceLastRow?: boolean;
  readonly className?: string;
};

export function MetricGrid({
  children,
  minColumnWidth = 128,
  balanceLastRow = false,
  className = "",
}: MetricGridProps): JSX.Element {
  if (balanceLastRow) {
    return (
      <div
        className={`grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2 ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

export type PillTabOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

type PillTabsProps<TValue extends string> = {
  readonly value: TValue;
  readonly options: readonly PillTabOption<TValue>[];
  readonly onChange: (value: TValue) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly contained?: boolean;
};

export function PillTabs<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  contained = false,
}: PillTabsProps<TValue>): JSX.Element {
  const inner = (
    <div className="flex min-w-max gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[11px] font-bold transition active:scale-95 disabled:opacity-50 ${
              active
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant ring-outline-variant/35 hover:text-on-surface ring-1"
            }`}
          >
            {option.icon}
            <span>
              {option.label}
              {typeof option.count === "number" ? ` (${option.count})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${contained ? "rounded-[28px] bg-white p-2 shadow-[0_14px_34px_rgba(17,17,17,0.045)]" : ""} ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="no-scrollbar overflow-x-auto">{inner}</div>
    </div>
  );
}

type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly icon?: string;
  readonly className?: string;
};

export function EmptyState({
  title,
  description,
  icon = "inbox",
  className = "",
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[28px] bg-white px-6 py-14 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)] ${className}`}
    >
      <div className="bg-surface-container-low text-on-surface-variant flex h-14 w-14 items-center justify-center rounded-3xl shadow-sm">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>
      <h3 className="text-on-surface mt-5 text-lg leading-6 font-semibold">{title}</h3>
      <p className="text-on-surface-variant mx-auto mt-2 max-w-xs text-sm leading-6">
        {description}
      </p>
    </div>
  );
}
