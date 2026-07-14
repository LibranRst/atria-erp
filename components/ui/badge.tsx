import type { ComponentPropsWithoutRef, ReactNode } from "react";

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
  const maps: Record<string, string> = {
    FINANCE_ADMIN: "Finance Admin",
    PROJECT_MANAGER: "Project Manager",
    OWNER: "Owner",
    PURCHASING: "Purchasing",
    SALES: "Sales",
    DESIGNER: "Designer",
    MARKETING: "Marketing",
    OVER_BUDGET: "Over Budget",
    PENDING_APPROVAL: "Pending Approval",
    READY_TO_SEND: "Ready to Send",
    WAITING_PURCHASE: "Waiting Purchase",
    PARTIALLY_PAID: "Partially Paid",
    STOCK_IN: "Stock In",
    STOCK_OUT: "Stock Out",
    NEEDS_VERIFICATION: "Needs Verification",
    NEEDS_APPROVAL: "Needs Approval",
    READY_TO_PAY: "Ready to Pay",
    PENDING_REVIEW: "Pending Review",
    ON_HOLD: "On Hold",
    OUT_OF_STOCK: "Out of Stock",
    LOW_STOCK: "Low Stock",
  };

  if (maps[val]) return maps[val];

  return val
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  status: BadgeStatus;
  children?: ReactNode;
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
      className={`inline-flex min-h-5 items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${variantClasses[variant]} ${voidClass} ${className ?? ""}`}
      {...props}
    >
      {typeof children === "string" ? formatStatus(children) : (children ?? formatStatus(status))}
    </span>
  );
}
