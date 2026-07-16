"use client";

import Link from "next/link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/features/finance-dashboard/lib/dashboard-formatters";
import type {
  DashboardAction,
  DashboardTransaction,
} from "@/features/finance-dashboard/lib/dashboard-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { dashboardToneClasses, severityTone } from "./dashboard-tone";

const dashboardPressScale = { scale: 0.985 } as const;

function priorityActionIcon(id: string): string {
  if (id === "approvals") return "approval";
  if (id === "project-risk") return "analytics";
  if (id === "overdue-payables") return "request_quote";
  if (id === "overdue-receivables") return "payments";
  if (id === "material-risk") return "inventory_2";
  return "notification_important";
}

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
  const reduceMotion = useReducedMotion();

  return (
    <div className="divide-y divide-black/[0.055] px-2.5">
      {actions.map((action) => {
        const isCritical = action.severity === "CRITICAL";
        return (
          <motion.div
            key={action.id}
            whileTap={reduceMotion ? undefined : dashboardPressScale}
            transition={transitionSpringSnappy}
          >
            <Link
              href={action.href}
              className="flex min-h-[64px] items-center gap-3 rounded-[20px] px-1.5 py-2.5 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 max-[430px]:min-h-[60px] max-[430px]:gap-2.5"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${isCritical ? "bg-error/[0.075] text-error ring-error/[0.05]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {priorityActionIcon(action.id)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-normal tracking-[-0.01em] text-on-surface">
                  {action.title}
                </span>
                <span className="mt-0.5 block truncate text-[10px] leading-normal text-on-surface-variant/75">
                  {action.description}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className={`text-[9px] font-semibold ${isCritical ? "text-error" : "text-warning"}`}>
                  {isCritical ? "Kritis" : "Perhatian"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]" aria-hidden="true">
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </span>
              </span>
            </Link>
          </motion.div>
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
    <div className="flex min-h-16 items-center gap-2.5 px-4 py-3 text-xs leading-5 text-on-surface-variant">
      <span className="material-symbols-outlined text-[18px] text-success" aria-hidden="true">
        check_circle
      </span>
      <span>{children}</span>
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
    <div className="divide-y divide-black/[0.055] px-3">
      {latestTransactions.map((transaction) => {
        const incoming = transaction.type === "DEBIT";
        return (
          <div key={transaction.id} className={`${rowClassName} px-1`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                incoming
                  ? "bg-primary/[0.09] text-primary ring-1 ring-primary/[0.06]"
                  : "bg-error/[0.08] text-error ring-1 ring-error/[0.05]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {incoming ? "south_west" : "north_east"}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-on-surface">
                {transaction.description}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-on-surface-variant/70">
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
