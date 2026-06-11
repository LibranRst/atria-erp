import type { ComponentPropsWithoutRef } from "react";

export type BadgeStatus =
  | "APPROVED"
  | "PAID"
  | "PENDING"
  | "SUBMITTED"
  | "UNPAID"
  | "WARNING"
  | "PARTIALLY_PAID"
  | "CRITICAL"
  | "OVERDUE"
  | "REJECTED"
  | "VOID"
  | "DRAFT";

export type BadgeVariant = "success" | "warning" | "primary" | "critical" | "muted";

const statusVariantMap: Record<BadgeStatus, BadgeVariant> = {
  APPROVED: "success",
  PAID: "success",
  PENDING: "warning",
  SUBMITTED: "warning",
  UNPAID: "warning",
  WARNING: "warning",
  PARTIALLY_PAID: "primary",
  CRITICAL: "critical",
  OVERDUE: "critical",
  REJECTED: "critical",
  VOID: "muted",
  DRAFT: "muted",
};

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-light text-success border-success/30",
  warning: "bg-warning-light text-warning border-warning/30",
  primary: "bg-primary-light text-primary border-primary/30",
  critical: "bg-critical-light text-critical border-critical/30",
  muted: "bg-elevated text-muted border-border",
};

type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  status: BadgeStatus;
  children?: string;
};

export function Badge({
  className,
  status,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  const variant = statusVariantMap[status];
  const voidClass = status === "VOID" ? "line-through" : "";

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${variantClasses[variant]} ${voidClass} ${className ?? ""}`}
      {...props}
    >
      {children ?? status.replaceAll("_", " ")}
    </span>
  );
}
