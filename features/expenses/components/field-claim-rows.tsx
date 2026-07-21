"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { MoneyValue } from "@/components/ui/page-primitives";
import { ExpensesGroupSurface } from "@/features/expenses/components/expenses-primitives";
import type { ExpenseCostItem } from "@/features/expenses/components/expense-list-types";
import { fieldClaimStatusLabel } from "@/features/expenses/components/expense-list-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

const expenseRowPressScale = { scale: 0.975 } as const;

export function FieldClaimRow({
  cost,
  isOwnerOrFinance,
  pending,
  onVerify,
  onDisburse,
  onOpenReceipt,
}: {
  readonly cost: ExpenseCostItem;
  readonly isOwnerOrFinance: boolean;
  readonly pending: boolean;
  readonly onVerify: (cost: ExpenseCostItem) => void;
  readonly onDisburse: (cost: ExpenseCostItem) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const { openActivityDetail } = useActivityDetail();
  const amountNum = Number(cost.amount);
  const allocated = Number(cost.budgetItem?.allocatedAmount || 0);
  const spent = Number(cost.budgetItem?.actualSpent || 0);
  const utilizationPercent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const isCompact = cost.status === "PAID" || cost.status === "REJECTED";

  if (isCompact) {
    return <CompactClaimRow cost={cost} amount={amountNum} onOpenReceipt={onOpenReceipt} />;
  }

  const statusTone =
    cost.status === "APPROVED"
      ? "text-success"
      : cost.status === "SUBMITTED" || cost.status === "VERIFIED"
        ? "text-warning"
        : "text-on-surface-variant";
  const showBudgetRisk = Boolean(
    cost.budgetItem && (cost.budgetOverrun || utilizationPercent >= 90),
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openActivityDetail({ kind: "PROJECT_COST", id: cost.id })}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.currentTarget === event.target) {
          event.preventDefault();
          openActivityDetail({ kind: "PROJECT_COST", id: cost.id });
        }
      }}
      className="focus-visible:bg-surface-container-low active:bg-surface-container-low/70 min-h-[96px] px-3 py-3.5 text-left transition-colors outline-none hover:bg-black/1.5 max-[430px]:px-2.5"
      aria-label={`Lihat detail pengeluaran ${cost.description}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${cost.status === "APPROVED" ? "bg-success/8 text-success ring-success/6" : "bg-warning/9 text-warning ring-warning/6"}`}
        >
          <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
            {cost.status === "APPROVED" ? "payments" : "receipt_long"}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-[9px] leading-3 font-bold ${statusTone}`}>
              {fieldClaimStatusLabel(cost.status)}
            </span>
            <span className="text-on-surface-variant/60 shrink-0 text-[9px] leading-3 font-semibold">
              {new Date(cost.createdAt).toLocaleDateString("id-ID", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="text-on-surface line-clamp-2 min-w-0 flex-1 text-[13px] leading-5 font-semibold tracking-[-0.01em]">
              {cost.description}
            </p>
            <MoneyValue
              amount={amountNum}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="shrink-0"
            />
          </div>
          <p className="text-on-surface-variant/75 mt-0.5 truncate text-[10px] leading-4 font-medium">
            {cost.project?.name || "Proyek"} · {cost.budgetItem?.name || "Belum ditentukan"}
          </p>
          {showBudgetRisk ? (
            <p className="text-error mt-1 flex min-w-0 items-center gap-1 text-[9px] leading-3 font-bold">
              <span
                className="material-symbols-outlined shrink-0 text-[13px] leading-none"
                aria-hidden="true"
              >
                warning
              </span>
              <span className="truncate">
                {cost.budgetOverrun ? "Melebihi budget" : "Mendekati batas budget"} ·{" "}
                {utilizationPercent.toFixed(0)}%
              </span>
            </p>
          ) : null}
        </div>
        <ActivityDetailChevron />
      </div>

      <div className="mt-2 flex min-h-8 items-center gap-2 pr-8 pl-12">
        <span className="text-on-surface-variant/60 min-w-0 flex-1 truncate text-[9px] leading-3 font-semibold">
          Diajukan {cost.requestedBy?.name || "-"}
        </span>
        {cost.receiptImageUrl ? (
          <ReceiptButton imageUrl={cost.receiptImageUrl} onOpenReceipt={onOpenReceipt} />
        ) : null}
        {cost.status === "SUBMITTED" && isOwnerOrFinance && (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onVerify(cost);
            }}
            disabled={pending}
            whileTap={reduceMotion ? undefined : expenseRowPressScale}
            transition={transitionSpringSnappy}
            className="bg-primary text-on-primary focus-visible:ring-primary/30 relative flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[10px] leading-4 font-bold outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
              fact_check
            </span>
            Verifikasi
          </motion.button>
        )}

        {cost.status === "APPROVED" && isOwnerOrFinance && (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDisburse(cost);
            }}
            disabled={pending}
            whileTap={reduceMotion ? undefined : expenseRowPressScale}
            transition={transitionSpringSnappy}
            className="bg-primary text-on-primary focus-visible:ring-primary/30 relative flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[10px] leading-4 font-bold outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">
              payments
            </span>
            Cairkan
          </motion.button>
        )}
      </div>
    </div>
  );
}

export function FieldClaimHistory({
  costs,
  expanded,
  onExpandedChange,
  onOpenReceipt,
}: {
  readonly costs: readonly ExpenseCostItem[];
  readonly expanded: boolean;
  readonly onExpandedChange: (value: boolean) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
}): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const historyCosts = costs.filter((cost) => cost.status === "PAID" || cost.status === "REJECTED");
  if (historyCosts.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <motion.button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        whileTap={reduceMotion ? undefined : expenseRowPressScale}
        transition={transitionSpringSnappy}
        className="bg-surface-container-low/70 flex min-h-12 w-full items-center justify-between rounded-full px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/25"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none"
            aria-hidden="true"
          >
            history
          </span>
          <span className="text-on-surface truncate text-xs leading-4 font-semibold">
            Riwayat pengeluaran
          </span>
          <span className="bg-outline-variant/20 text-on-surface-variant inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-4 font-bold">
            {historyCosts.length}
          </span>
        </div>
        <motion.span
          animate={reduceMotion ? undefined : { rotate: expanded ? 180 : 0 }}
          transition={transitionSpringSnappy}
          className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none"
        >
          keyboard_arrow_down
        </motion.span>
      </motion.button>

      {expanded && (
        <ExpensesGroupSurface>
          <div className="divide-y divide-black/5.5">
            {historyCosts.map((cost) => (
              <CompactClaimRow
                key={cost.id}
                cost={cost}
                amount={Number(cost.amount)}
                onOpenReceipt={onOpenReceipt}
              />
            ))}
          </div>
        </ExpensesGroupSurface>
      )}
    </div>
  );
}

function CompactClaimRow({
  cost,
  amount,
  onOpenReceipt,
}: {
  readonly cost: ExpenseCostItem;
  readonly amount: number;
  readonly onOpenReceipt: (imageUrl: string) => void;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const statusTone = cost.status === "PAID" ? "text-success" : "text-error";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openActivityDetail({ kind: "PROJECT_COST", id: cost.id })}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && event.currentTarget === event.target) {
          event.preventDefault();
          openActivityDetail({ kind: "PROJECT_COST", id: cost.id });
        }
      }}
      className="focus-visible:bg-surface-container-low active:bg-surface-container-low/70 min-h-[78px] w-full px-3 py-3 text-left transition-colors outline-none hover:bg-black/1.5"
      aria-label={`Lihat detail pengeluaran ${cost.description}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <StatusIcon status={cost.status} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className={`truncate text-[9px] leading-3 font-bold ${statusTone}`}>
              {cost.status === "PAID" ? "Lunas" : "Ditolak"}
            </span>
            <span className="text-on-surface-variant/60 shrink-0 text-[9px] leading-3 font-semibold">
              {new Date(cost.createdAt).toLocaleDateString("id-ID", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-start justify-between gap-3">
            <p className="text-on-surface min-w-0 flex-1 truncate text-xs leading-4 font-semibold">
              {cost.description}
            </p>
            <MoneyValue
              amount={amount}
              variant="compactWithFull"
              align="right"
              size="sm"
              className="shrink-0"
            />
          </div>
          <p className="text-on-surface-variant/70 mt-0.5 truncate text-[10px] leading-4 font-medium">
            {cost.project?.name || "Proyek"}
          </p>
        </div>
        <ActivityDetailChevron />
      </div>
      {cost.receiptImageUrl ? (
        <div className="mt-1 flex justify-end pr-8">
          <ReceiptButton imageUrl={cost.receiptImageUrl} onOpenReceipt={onOpenReceipt} />
        </div>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { readonly status: ExpenseCostItem["status"] }): React.JSX.Element {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        status === "PAID"
          ? "bg-primary-container/20 text-primary"
          : "bg-error-container/20 text-error"
      }`}
    >
      <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
        {status === "PAID" ? "check_circle" : "cancel"}
      </span>
    </div>
  );
}

function ReceiptButton({
  imageUrl,
  onOpenReceipt,
}: {
  readonly imageUrl: string;
  readonly onOpenReceipt: (imageUrl: string) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenReceipt(imageUrl);
      }}
      whileTap={reduceMotion ? undefined : expenseRowPressScale}
      transition={transitionSpringSnappy}
      className="bg-surface-container-high/70 relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#007AFF] outline-none after:absolute after:-inset-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25"
      title="Lihat Nota"
      aria-label="Lihat nota"
    >
      <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
        image
      </span>
    </motion.button>
  );
}
