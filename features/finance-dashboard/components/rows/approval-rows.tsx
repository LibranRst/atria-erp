"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, MoneyValue } from "@/components/ui";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/lib/finance/budget-indicator";
import { transitionSpringSnappy } from "@/lib/utils/motion";
const dashboardRowPressScale = { scale: 0.985 } as const;

export function ApprovalWorkbenchRow({
  item,
  pending,
  onOpen,
}: {
  readonly item: ApprovalDetail;
  readonly pending: boolean;
  readonly onOpen: (item: ApprovalDetail) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const approvalLabel =
    item.type === "project_cost"
      ? "Dana Lapangan"
      : item.type === "inventory_opening"
        ? "Saldo Stok"
        : "Vendor Payment";
  const counterpartyLabel = item.requestedBy;
  const critical = item.priority === "CRITICAL";

  return (
    <div className="px-2.5 py-1.5">
      <motion.button
        type="button"
        onClick={() => onOpen(item)}
        disabled={pending}
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
        className="min-h-12 w-full rounded-[20px] px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${critical ? "bg-error/7.5 text-error ring-error/5" : "bg-warning/9 text-warning ring-warning/6"}`}
          >
            <AppIcon
              name={
                item.type === "project_cost"
                  ? "receipt_long"
                  : item.type === "inventory_opening"
                    ? "inventory"
                    : "request_quote"
              }
              className="text-[18px]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <MoneyValue amount={item.amount} variant="compactWithFull" size="lg" />
              <span
                className={`shrink-0 text-[9px] font-semibold ${critical ? "text-error" : "text-warning"}`}
              >
                {item.priority === "NORMAL" ? approvalLabel : item.priorityReason}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] leading-5 font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="truncate text-meta text-on-surface-variant/75">{item.projectName}</p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[16px]" />
          </span>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
          <span className="max-w-full truncate">{counterpartyLabel}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
          <span className="max-w-full truncate">{item.budgetItemName}</span>
          {item.receiptImageUrl ? (
            <>
              <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
              <span className="inline-flex items-center gap-1 text-primary">
                <AppIcon name="receipt_long" className="text-[13px]" />
                Nota
              </span>
            </>
          ) : null}
        </div>
      </motion.button>
    </div>
  );
}

export function ApprovalBudgetContext({
  item,
}: {
  readonly item: ApprovalDetail;
}): React.JSX.Element {
  const nextSpent = item.actualSpent + item.amount;
  const impact = getApprovalBudgetImpact(item.allocatedAmount, item.actualSpent, item.amount);
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const impactLabel = critical
    ? impact.overflowPercentage > 0
      ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
      : "Pengajuan menambah risiko budget"
    : warning
      ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
      : "Masih dalam batas budget";

  return (
    <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-extrabold tracking-wide text-on-surface-variant/60 uppercase">
            Konteks budget
          </p>
          <p className="mt-1 truncate text-xs font-bold text-on-surface">{item.budgetItemName}</p>
        </div>
        <span
          className={`financial-amount shrink-0 font-mono text-xs font-black ${critical ? "text-error" : "text-on-surface"}`}
        >
          {impact.afterPercentage.toFixed(0)}%
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-outline-variant/20 px-4 py-3.5 text-[10px] font-semibold text-on-surface-variant">
        <div className="min-w-0">
          <span>Sekarang</span>
          <MoneyValue
            amount={item.actualSpent}
            variant="compactWithFull"
            size="sm"
            className="mt-0.5"
          />
          <p className="mt-1 font-mono text-[9px] font-bold">
            {impact.beforePercentage.toFixed(0)}% budget
          </p>
        </div>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant/55 ring-1 ring-ring-subtle"
          aria-hidden="true"
        >
          <AppIcon name="arrow_forward" className="text-[15px]" />
        </span>
        <div className="min-w-0 text-right">
          <span>Setelah disetujui</span>
          <MoneyValue
            amount={nextSpent}
            variant="compactWithFull"
            tone={critical ? "danger" : "default"}
            align="right"
            size="sm"
            className="mt-0.5"
          />
          <p
            className={`mt-1 font-mono text-[9px] font-bold ${critical ? "text-error" : warning ? "text-warning" : ""}`}
          >
            {impact.afterPercentage.toFixed(0)}% budget
          </p>
        </div>
      </div>
      <div
        className={`flex min-h-10 items-center justify-between gap-2 border-t border-outline-variant/20 px-4 py-2.5 text-[9px] font-bold ${critical ? "text-error" : warning ? "text-warning" : ""}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AppIcon
            name={critical ? "report" : warning ? "warning" : "check_circle"}
            className="shrink-0 text-[14px]"
          />
          <span className="truncate">{impactLabel}</span>
        </span>
        <span className="shrink-0 font-mono">+{shortMoney(item.amount)}</span>
      </div>
    </section>
  );
}
