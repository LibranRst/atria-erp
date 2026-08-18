"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, DuotoneIconTile, MoneyValue } from "@/components/ui";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@atria/core/finance/budget-indicator";
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
        className="min-h-12 w-full rounded-inset px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <DuotoneIconTile
            name={
              item.type === "project_cost"
                ? "receipt_long"
                : item.type === "inventory_opening"
                  ? "inventory"
                  : "request_quote"
            }
            tone={critical ? "critical" : "attention"}
            className="h-9 w-9"
            iconClassName="icon-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <MoneyValue amount={item.amount} variant="compact" size="lg" />
              <span
                className={`shrink-0 text-eyebrow font-semibold ${critical ? "text-error" : "text-warning"}`}
              >
                {item.priority === "NORMAL" ? approvalLabel : item.priorityReason}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] leading-5 font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="truncate text-meta text-on-surface-variant/75">{item.projectName}</p>
          </div>
          <AppIcon
            name="chevron_right"
            className="mt-1 icon-sm shrink-0 text-on-surface-variant/55"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-eyebrow font-semibold text-on-surface-variant/70">
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
  // Lihat catatan pada `consumesBudgetActual`: pembelian persediaan tidak
  // menaikkan realisasi kategori, jadi proyeksinya harus datar.
  const consumesActual = item.consumesBudgetActual;
  const nextSpent = consumesActual ? item.actualSpent + item.amount : item.actualSpent;
  const impact = getApprovalBudgetImpact(
    item.allocatedAmount,
    item.actualSpent,
    consumesActual ? item.amount : 0,
  );
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const impactLabel = !consumesActual
    ? "Menjadi nilai persediaan, bukan realisasi"
    : critical
      ? impact.overflowPercentage > 0
        ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
        : "Pengajuan menambah risiko budget"
      : warning
        ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
        : "Masih dalam batas budget";

  return (
    <section className="overflow-hidden rounded-owner bg-surface-container-lowest ring-1 ring-ring-subtle">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-meta font-extrabold tracking-wide text-on-surface-variant/60 uppercase">
            Konteks budget
          </p>
          <p className="mt-1 truncate text-xs font-bold text-on-surface">{item.budgetItemName}</p>
        </div>
        <span
          className={`financial-amount shrink-0 text-xs font-extrabold ${critical ? "text-error" : "text-on-surface"}`}
        >
          {impact.afterPercentage.toFixed(0)}%
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-outline-variant/20 px-4 py-3.5 text-meta font-semibold text-on-surface-variant">
        <div className="min-w-0">
          <span>Sekarang</span>
          <MoneyValue amount={item.actualSpent} variant="compact" size="sm" className="mt-0.5" />
          <p className="mt-1 font-mono text-eyebrow font-bold">
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
            variant="compact"
            tone={critical ? "danger" : "default"}
            align="right"
            size="sm"
            className="mt-0.5"
          />
          <p
            className={`mt-1 font-mono text-eyebrow font-bold ${critical ? "text-error" : warning ? "text-warning" : ""}`}
          >
            {impact.afterPercentage.toFixed(0)}% budget
          </p>
        </div>
      </div>
      <div
        className={`flex min-h-10 items-center justify-between gap-2 border-t border-outline-variant/20 px-4 py-2.5 text-eyebrow font-bold ${critical ? "text-error" : warning ? "text-warning" : ""}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <AppIcon
            name={critical ? "report" : warning ? "warning" : "check_circle"}
            className="icon-xs shrink-0"
          />
          <span className="truncate">{impactLabel}</span>
        </span>
        <span className="shrink-0 font-mono">+{shortMoney(item.amount)}</span>
      </div>
    </section>
  );
}
