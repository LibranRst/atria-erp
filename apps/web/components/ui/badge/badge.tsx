import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  getStatusPresentation,
  resolveStatusPresentation,
} from "@atria/core/presentation/status-presentation";
import type {
  BadgeStatus,
  BadgeVariant,
  StatusBadgeTone,
  StatusPresentation,
} from "@atria/core/presentation/status-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

export type { BadgeStatus, BadgeVariant, StatusBadgeTone, StatusPresentation };
export { getStatusPresentation, resolveStatusPresentation };

const toneClass: Record<StatusBadgeTone, string> = {
  healthy: "bg-surface-container-low text-on-surface",
  warning: "bg-warning-container text-warning-on-container",
  critical: "bg-critical-container text-critical",
  pending: "bg-surface-container-low text-on-surface-variant",
  completed: "bg-surface-container-low text-on-surface",
  neutral: "bg-surface-container text-on-surface-variant",
  inactive: "bg-surface-container-low text-on-surface-variant/75",
};

/** Compatibility formatter for presentation code that has not moved to a typed mapping yet. */
export function formatStatus(value: string): string {
  return formatBusinessLabel(value);
}

type StatusBadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly tone: StatusBadgeTone;
  readonly label: string;
  readonly marker?: "auto" | boolean;
};

export function StatusBadge({
  className = "",
  tone,
  label,
  marker = "auto",
  ...props
}: StatusBadgeProps): React.JSX.Element {
  const showMarker =
    marker === "auto" ? tone === "warning" || tone === "critical" || tone === "pending" : marker;
  return (
    <span
      {...props}
      className={`inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-eyebrow font-bold tracking-wide whitespace-nowrap uppercase shadow-control ${toneClass[tone]} ${className}`}
    >
      {showMarker ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}

type CountBadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly count: number;
  readonly label: string;
  readonly tone?: "attention" | "neutral";
};

export function CountBadge({
  count,
  label,
  tone = "attention",
  className = "",
  ...props
}: CountBadgeProps): React.JSX.Element {
  const displayedCount = count > 99 ? "99+" : String(count);
  return (
    <span
      {...props}
      aria-label={`${count} ${label}`}
      className={`inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-sans text-[8px] leading-none font-extrabold tabular-nums ${tone === "attention" ? "bg-warning-container text-warning-on-container" : "bg-surface-container-high text-on-surface-variant"} ${className}`}
    >
      <span className="translate-y-px">{displayedCount}</span>
    </span>
  );
}

type SectionCountPillProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly count: number;
  readonly label: string;
};

export function SectionCountPill({
  count,
  label,
  className = "",
  ...props
}: SectionCountPillProps): React.JSX.Element {
  return (
    <span
      {...props}
      aria-label={`${count} ${label.toLowerCase()}`}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-container-low px-3 text-support font-bold text-on-surface-variant ${className}`}
    >
      <span>{label}</span>
      <CountBadge
        count={count}
        label={label.toLowerCase()}
        tone="neutral"
        aria-hidden="true"
        className="bg-surface-container-lowest text-eyebrow ring-1 ring-ring-subtle"
      />
    </span>
  );
}

type MetadataChipProps = ComponentPropsWithoutRef<"span"> & {
  readonly children: ReactNode;
};

export function MetadataChip({
  className = "",
  children,
  ...props
}: MetadataChipProps): React.JSX.Element {
  return (
    <span
      {...props}
      className={`inline-flex min-h-6 items-center rounded-full bg-surface-container px-2.5 text-eyebrow font-semibold text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
}

type LegacyBadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  readonly status: BadgeStatus;
  readonly children?: ReactNode;
};

/** Compatibility alias while call sites migrate to explicit status presentations. */
export function Badge({
  className,
  status,
  children,
  ...props
}: LegacyBadgeProps): React.JSX.Element {
  const presentation = getStatusPresentation(status);
  const label = typeof children === "string" ? children : (children ?? presentation.label);
  return (
    <StatusBadge
      {...props}
      className={className}
      tone={presentation.tone}
      label={typeof label === "string" ? label : presentation.label}
    />
  );
}
