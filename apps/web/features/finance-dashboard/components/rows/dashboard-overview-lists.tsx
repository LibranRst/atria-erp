"use client";

import Link from "@/lib/navigation/workspace-link";
import React from "react";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, Badge, DuotoneIconTile, MoneyValue } from "@/components/ui";
import { formatShortDate } from "@/features/finance-dashboard/utils/dashboard-formatters";
import type {
  DashboardAction,
  DashboardTransaction,
} from "@/features/finance-dashboard/types/dashboard-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { dashboardToneClasses, severityTone } from "../shared/dashboard-tone";
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
              <AppIcon
                name={action.severity === "CRITICAL" ? "priority_high" : "notification_important"}
                className="text-[17px]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-on-surface">
                {action.title}
              </span>
              <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
                {action.description}
              </span>
            </span>
            <Badge status={action.severity === "CRITICAL" ? "CRITICAL" : "WARNING"}>
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
    <div className="divide-y divide-black/5.5 px-2.5">
      {actions.map((action) => {
        const isCritical = action.severity === "CRITICAL";
        return (
          <motion.div
            tabIndex={-1}
            key={action.id}
            whileTap={reduceMotion ? undefined : dashboardPressScale}
            transition={transitionSpringSnappy}
          >
            <Link
              href={action.href}
              className="flex min-h-16 items-center gap-3 rounded-inset px-1.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 max-[430px]:min-h-15 max-[430px]:gap-2.5"
            >
              <DuotoneIconTile
                name={priorityActionIcon(action.id)}
                tone={isCritical ? "critical" : "attention"}
                className="h-9 w-9"
                iconClassName="icon-md"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-normal font-semibold tracking-[-0.01em] text-on-surface">
                  {action.title}
                </span>
                <span className="mt-0.5 block truncate text-[10px] leading-normal text-on-surface-variant/75">
                  {action.description}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`text-eyebrow font-semibold ${isCritical ? "text-error" : "text-warning"}`}
                >
                  {isCritical ? "Kritis" : "Perhatian"}
                </span>
                <AppIcon name="chevron_right" className="icon-sm text-on-surface-variant/55" />
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
    <div className="flex items-center gap-2.5 px-4 py-3 text-xs leading-5 text-on-surface-variant">
      <AppIcon name="check_circle" weight="duotone" className="icon-md text-on-surface" />
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
  const { openActivityDetail } = useActivityDetail();
  const latestTransactions = transactions.slice(0, 4);
  return (
    <div className="divide-y divide-black/5.5 px-3">
      {latestTransactions.map((transaction) => {
        const incoming = transaction.type === "INFLOW";
        return (
          <button
            type="button"
            onClick={() => openActivityDetail({ kind: "CASH_TRANSACTION", id: transaction.id })}
            key={transaction.id}
            className={`${rowClassName} w-full px-1 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70`}
          >
            <DuotoneIconTile
              name={incoming ? "south_west" : "north_east"}
              tone={incoming ? "neutral" : "critical"}
              className="h-8 w-8"
              iconClassName="icon-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-row font-semibold tracking-[-0.01em] text-on-surface">
                {transaction.description}
              </span>
              <span className="mt-0.5 block text-meta font-semibold text-on-surface-variant/70">
                {formatShortDate(transaction.createdAt)}
              </span>
            </span>
            <MoneyValue
              amount={transaction.amount}
              variant="fullDynamic"
              prefix={incoming ? "+" : "-"}
              tone={incoming ? "primary" : "default"}
              align="right"
              size="sm"
              className="shrink-0"
            />
            <ActivityDetailChevron />
          </button>
        );
      })}
    </div>
  );
}

export function EmptyRow({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-surface-container-low py-8 text-center text-xs leading-5 text-on-surface-variant">
      {children}
    </div>
  );
}
