"use client";

import Link from "next/link";
import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/features/finance-dashboard/lib/dashboard-formatters";
import type {
  DashboardAction,
  DashboardTransaction,
} from "@/features/finance-dashboard/lib/dashboard-types";
import { dashboardToneClasses, severityTone } from "./dashboard-tone";

export function RiskBriefList({
  actions,
}: {
  readonly actions: readonly DashboardAction[];
}): React.JSX.Element {
  return (
    <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-2xl bg-surface-container-low">
      {actions.map((action) => {
        const classes = dashboardToneClasses(severityTone(action.severity));
        return (
          <Link
            key={action.id}
            href={action.href}
            className="flex min-h-12 items-center gap-2.5 px-3 py-2.5 transition hover:bg-surface-container/30 active:bg-surface-container"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${classes.icon}`}
            >
              <span className="material-symbols-outlined text-[17px]">
                {action.severity === "CRITICAL"
                  ? "priority_high"
                  : "notification_important"}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-on-surface">
                {action.title}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-on-surface-variant">
                {action.description}
              </span>
            </span>
            <Badge
              status={action.severity === "CRITICAL" ? "CRITICAL" : "WARNING"}
            >
              {action.severity}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

export function OverviewPriorityList({
  actions,
}: {
  readonly actions: readonly DashboardAction[];
}): React.JSX.Element {
  return (
    <div className="divide-y divide-outline-variant/35">
      {actions.map((action, index) => {
        const isCritical = action.severity === "CRITICAL";
        return (
          <Link
            key={action.id}
            href={action.href}
            className="flex min-h-[52px] items-center gap-3 py-2.5 transition active:scale-[0.99]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-[14px] font-semibold leading-none">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold leading-normal text-on-surface">
                {action.title}
              </span>
              <span className="block truncate text-[10px] leading-normal text-on-surface-variant/80">
                {action.description}
              </span>
            </span>
            <Badge status={isCritical ? "CRITICAL" : "WARNING"}>
              {isCritical ? "Critical" : "Warning"}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

export function OverviewPreviewEmpty({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-3 py-7 text-center text-xs leading-5 text-on-surface-variant">
      {children}
    </div>
  );
}

export function OverviewCashRows({
  transactions,
  rowClassName = "flex min-h-[52px] items-center gap-3 py-2.5",
}: {
  readonly transactions: readonly DashboardTransaction[];
  readonly rowClassName?: string;
}): React.JSX.Element {
  const latestTransactions = transactions.slice(0, 4);
  return (
    <div className="divide-y divide-outline-variant/35">
      {latestTransactions.map((transaction) => {
        const incoming = transaction.type === "DEBIT";
        return (
          <div key={transaction.id} className={rowClassName}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                incoming
                  ? "bg-primary/10 text-primary"
                  : "bg-error/10 text-error"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {incoming ? "south_west" : "north_east"}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-on-surface">
                {transaction.description}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-on-surface-variant/70">
                {formatShortDate(transaction.createdAt)}
              </span>
            </span>
            <MoneyValue
              amount={transaction.amount}
              variant="compactWithFull"
              prefix={incoming ? "+" : "-"}
              tone={incoming ? "primary" : "default"}
              align="right"
              size="sm"
              className="shrink-0"
            />
          </div>
        );
      })}
    </div>
  );
}

export function EmptyRow({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-surface-container-low py-8 text-center text-xs leading-5 text-on-surface-variant">
      {children}
    </div>
  );
}
