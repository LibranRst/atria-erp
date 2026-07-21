import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

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
  | "DRAFT"
  | "HEALTHY"
  | "PRIMARY";

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
  HEALTHY: "success",
  PRIMARY: "primary",
};

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  primary: "bg-primary-light text-primary",
  critical: "bg-critical-light text-critical",
  muted: "bg-surface-container text-on-surface-variant",
};

export function formatStatus(val: string): string {
  return formatBusinessLabel(val);
}

type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  status: BadgeStatus;
  children?: ReactNode;
};

export function Badge({ className, status, children, ...props }: BadgeProps): React.JSX.Element {
  const variant = statusVariantMap[status];
  const voidClass = status === "VOID" ? "line-through" : "";

  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${variantClasses[variant]} ${voidClass} ${className ?? ""}`}
      {...props}
    >
      {typeof children === "string" ? formatStatus(children) : (children ?? formatStatus(status))}
    </span>
  );
}
