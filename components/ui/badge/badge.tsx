import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { formatBusinessLabel } from "@/lib/presentation/business-labels";

export type StatusBadgeTone =
  "healthy" | "warning" | "critical" | "pending" | "completed" | "neutral" | "inactive";

export type StatusPresentation = {
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export type BadgeStatus =
  | "ACTIVE"
  | "APPROVED"
  | "AVAILABLE"
  | "CANCELLED"
  | "COMPLETED"
  | "CONSUMED"
  | "CRITICAL"
  | "DISCARDED"
  | "DRAFT"
  | "FAILED"
  | "HEALTHY"
  | "INACTIVE"
  | "INCOMPLETE"
  | "IN_PROGRESS"
  | "LOCKED"
  | "LOW_STOCK"
  | "NOT_APPLICABLE"
  | "OUT_OF_STOCK"
  | "OVER_BUDGET"
  | "OVERDUE"
  | "PAID"
  | "PARTIALLY_PAID"
  | "PAUSED"
  | "PENDING"
  | "PENDING_APPROVAL"
  | "POSTED"
  | "PRIMARY"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "RESERVED"
  | "REVERSED"
  | "REVERSAL_REQUESTED"
  | "SAFE"
  | "SHORTAGE"
  | "SKIPPED"
  | "SUBMITTED"
  | "SUBMITTING"
  | "SUPERSEDED"
  | "UNPAID"
  | "VERIFIED"
  | "VOID"
  | "WAITING_PURCHASE"
  | "WARNING"
  | "WATCH";

export type BadgeVariant = StatusBadgeTone;

const statusPresentation: Record<BadgeStatus, StatusPresentation> = {
  ACTIVE: { label: "Aktif", tone: "healthy" },
  APPROVED: { label: "Disetujui", tone: "completed" },
  AVAILABLE: { label: "Tersedia", tone: "healthy" },
  CANCELLED: { label: "Dibatalkan", tone: "inactive" },
  COMPLETED: { label: "Selesai", tone: "completed" },
  CONSUMED: { label: "Digunakan", tone: "completed" },
  CRITICAL: { label: "Kritis", tone: "critical" },
  DISCARDED: { label: "Dibuang", tone: "inactive" },
  DRAFT: { label: "Draf", tone: "inactive" },
  FAILED: { label: "Gagal", tone: "critical" },
  HEALTHY: { label: "Sehat", tone: "healthy" },
  INACTIVE: { label: "Tidak aktif", tone: "inactive" },
  INCOMPLETE: { label: "Belum lengkap", tone: "warning" },
  IN_PROGRESS: { label: "Berlangsung", tone: "pending" },
  LOCKED: { label: "Terkunci", tone: "neutral" },
  LOW_STOCK: { label: "Stok menipis", tone: "warning" },
  NOT_APPLICABLE: { label: "Tidak berlaku", tone: "inactive" },
  OUT_OF_STOCK: { label: "Stok habis", tone: "critical" },
  OVER_BUDGET: { label: "Melebihi budget", tone: "critical" },
  OVERDUE: { label: "Jatuh tempo", tone: "critical" },
  PAID: { label: "Lunas", tone: "completed" },
  PARTIALLY_PAID: { label: "Dibayar sebagian", tone: "pending" },
  PAUSED: { label: "Dijeda", tone: "inactive" },
  PENDING: { label: "Menunggu", tone: "pending" },
  PENDING_APPROVAL: { label: "Menunggu persetujuan", tone: "pending" },
  POSTED: { label: "Tercatat", tone: "completed" },
  PRIMARY: { label: "Utama", tone: "neutral" },
  PROCESSING: { label: "Diproses", tone: "pending" },
  READY: { label: "Siap", tone: "healthy" },
  REJECTED: { label: "Ditolak", tone: "critical" },
  RESERVED: { label: "Direservasi", tone: "neutral" },
  REVERSED: { label: "Dibalik", tone: "inactive" },
  REVERSAL_REQUESTED: { label: "Pembalikan diminta", tone: "pending" },
  SAFE: { label: "Aman", tone: "healthy" },
  SHORTAGE: { label: "Kekurangan", tone: "warning" },
  SKIPPED: { label: "Dilewati", tone: "inactive" },
  SUBMITTED: { label: "Diajukan", tone: "pending" },
  SUBMITTING: { label: "Mengajukan", tone: "pending" },
  SUPERSEDED: { label: "Digantikan", tone: "inactive" },
  UNPAID: { label: "Belum lunas", tone: "warning" },
  VERIFIED: { label: "Terverifikasi", tone: "completed" },
  VOID: { label: "Dibatalkan", tone: "inactive" },
  WAITING_PURCHASE: { label: "Menunggu pembelian", tone: "warning" },
  WARNING: { label: "Perlu perhatian", tone: "warning" },
  WATCH: { label: "Perlu dipantau", tone: "warning" },
};

const toneClass: Record<StatusBadgeTone, string> = {
  healthy: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  critical: "bg-critical-container text-critical",
  pending: "bg-accent-container text-accent",
  completed: "bg-success-container text-success",
  neutral: "bg-surface-container text-on-surface-variant",
  inactive: "bg-surface-container-low text-on-surface-variant/75",
};

export function getStatusPresentation(status: BadgeStatus): StatusPresentation {
  return statusPresentation[status];
}

function isBadgeStatus(status: string): status is BadgeStatus {
  return Object.hasOwn(statusPresentation, status);
}

export function resolveStatusPresentation(status: string): StatusPresentation {
  if (isBadgeStatus(status)) return getStatusPresentation(status);
  return { label: formatBusinessLabel(status), tone: "neutral" };
}

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
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-[9px] leading-3 font-bold tracking-wide uppercase ${toneClass[tone]} ${className}`}
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
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[8px] leading-none font-black ${tone === "attention" ? "bg-critical-container text-critical" : "bg-surface-container-high text-on-surface-variant"} ${className}`}
    >
      {displayedCount}
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
      className={`inline-flex min-h-6 items-center rounded-full bg-surface-container px-2.5 text-[9px] leading-3 font-semibold text-on-surface-variant ${className}`}
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
