"use client";

import React from "react";
import Link from "@/lib/navigation/workspace-link";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, MoneyValue } from "@/components/ui";
import type { DashboardCashDue } from "@/features/finance-dashboard/types/dashboard-types";
import { formatShortDate } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { transitionSpringSnappy } from "@/lib/utils/motion";
const dashboardRowPressScale = { scale: 0.985 } as const;

export function CashDueRow({
  item,
  referenceDate,
  compact = false,
}: {
  readonly item: DashboardCashDue;
  readonly referenceDate: Date;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  void referenceDate;
  const timing =
    item.dayOffset < 0
      ? `Terlambat ${Math.abs(item.dayOffset)} hari`
      : item.dayOffset === 0
        ? "Hari ini"
        : item.dayOffset === 1
          ? "Besok"
          : `${item.dayOffset} hari lagi`;
  const dueDay = item.dueDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const dueMonth = item.dueDate.toLocaleDateString("id-ID", {
    month: "short",
    timeZone: "Asia/Jakarta",
  });
  return (
    <motion.div
      tabIndex={-1}
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="p-1"
    >
      <Link
        href={item.href}
        className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-inset px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-black/2.5 max-[430px]:px-3 max-[430px]:py-3"
      >
        <span className="relative flex flex-col items-start pt-0.5 text-left" aria-hidden="true">
          <span className="font-mono text-[13px] leading-none font-black text-on-surface">
            {dueDay}
          </span>
          <span className="mt-1 text-[8px] font-bold text-on-surface-variant uppercase">
            {dueMonth}
          </span>
          <span
            className={`absolute top-1.5 -right-px z-10 h-2 w-2 rounded-full ring-[3px] ring-white/90 ${item.dayOffset < 0 ? "bg-critical" : item.dayOffset <= 7 ? "bg-warning/55" : "bg-outline"}`}
          />
        </span>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-meta font-semibold ${item.type === "payable" ? "text-error" : "text-primary"}`}
              >
                {item.type === "payable" ? "Hutang vendor" : "Piutang klien"}
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold tracking-[-0.01em] text-on-surface max-[430px]:text-row">
                {item.documentNumber}
              </p>
              <p className="mt-1 truncate text-support text-on-surface-variant">
                {item.projectName} • {item.counterpartyName}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch text-right">
              <MoneyValue
                amount={item.outstandingAmount}
                variant="compact"
                align="right"
                size="sm"
              />
              <span className="flex items-center justify-end gap-1.5">
                <span
                  className={`text-[9px] leading-4 font-semibold ${item.dayOffset < 0 ? "text-error" : item.dayOffset <= 7 ? "text-warning" : "text-on-surface-variant"}`}
                >
                  {timing}
                </span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant/55"
                  aria-hidden="true"
                >
                  <AppIcon name="chevron_right" className="icon-sm leading-none" />
                </span>
              </span>
            </div>
          </div>
          {!compact ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-meta font-semibold text-on-surface-variant">
              <span>Jatuh tempo {formatShortDate(item.dueDate)}</span>
              <span className="text-right">
                Dibayar
                <MoneyValue
                  amount={item.paidAmount}
                  variant="compact"
                  align="right"
                  size="sm"
                  className="mt-0.5"
                />
              </span>
            </div>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
