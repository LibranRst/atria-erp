"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge } from "@/components/ui/badge";
import type { ExpenseCostItem } from "@/features/expenses/components/expense-list-types";
import { fieldClaimStatusLabel } from "@/features/expenses/components/expense-list-utils";

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
  const amountNum = Number(cost.amount);
  const allocated = Number(cost.budgetItem?.allocatedAmount || 0);
  const spent = Number(cost.budgetItem?.actualSpent || 0);
  const utilizationPercent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const isCompact = cost.status === "PAID" || cost.status === "REJECTED";

  if (isCompact) {
    return (
      <CompactClaimRow
        cost={cost}
        amount={amountNum}
        onOpenReceipt={onOpenReceipt}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-[28px] border border-outline-variant/20 bg-white px-3 py-3.5 shadow-[0_8px_22px_rgba(17,17,17,0.04)] transition-colors hover:bg-surface-container-low/45">
      <div className="flex items-start justify-between gap-3">
        <Badge
          status={
            cost.status === "SUBMITTED" || cost.status === "VERIFIED"
              ? "PENDING"
              : cost.status
          }
        >
          {fieldClaimStatusLabel(cost.status)}
        </Badge>
        <div className="flex items-center gap-1 font-sans text-[9px] font-bold uppercase leading-[16px] tracking-wider text-on-surface-variant">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {new Date(cost.createdAt).toLocaleDateString("id-ID", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0 flex-1">
          <MoneyValue amount={amountNum} variant="compactWithFull" size="md" />
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-on-surface">
            {cost.description}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
            {cost.project?.name || "Proyek"} •{" "}
            {cost.budgetItem?.name || "Belum Ditentukan"}
          </p>
          <p className="mt-0.5 text-[10px] text-on-surface-variant">
            PM {cost.requestedBy?.name || "-"}
          </p>
        </div>

        {cost.receiptImageUrl && (
          <ReceiptButton
            imageUrl={cost.receiptImageUrl}
            onOpenReceipt={onOpenReceipt}
            large
          />
        )}
      </div>

      {cost.budgetItem && (cost.budgetOverrun || utilizationPercent >= 90) && (
        <div className="rounded-2xl bg-error-container/15 p-sm text-[11px] font-semibold text-error">
          <div className="flex items-center justify-between gap-3">
            <span>Budget risk</span>
            <span>{utilizationPercent.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-error"
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {(cost.status === "SUBMITTED" || cost.status === "APPROVED") && isOwnerOrFinance ? (
      <div className="flex items-center justify-end gap-sm border-t border-outline-variant/10 pt-sm">
        {cost.status === "SUBMITTED" && isOwnerOrFinance && (
          <button
            type="button"
            onClick={() => onVerify(cost)}
            disabled={pending}
            className="flex h-10 min-w-[105px] cursor-pointer items-center justify-center gap-1 rounded-full bg-primary px-sm py-2 text-xs font-bold text-on-primary shadow transition-all hover:bg-primary/95 active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              fact_check
            </span>
            Verifikasi
          </button>
        )}

        {cost.status === "APPROVED" && isOwnerOrFinance && (
          <button
            type="button"
            onClick={() => onDisburse(cost)}
            disabled={pending}
            className="flex h-10 min-w-[90px] cursor-pointer items-center justify-center gap-1 rounded-full bg-primary px-sm py-2 text-xs font-bold text-on-primary shadow transition-all hover:bg-primary/95 active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              payments
            </span>
            Cairkan
          </button>
        )}
      </div>
      ) : null}
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
  const historyCosts = costs.filter(
    (cost) => cost.status === "PAID" || cost.status === "REJECTED",
  );
  if (historyCosts.length === 0) return null;

  return (
    <div className="space-y-sm pt-xs">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-outline-variant/15 bg-surface-container-low p-sm transition-all hover:bg-surface-container active:scale-[0.99]"
      >
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[20px] text-primary">
            history
          </span>
          <span className="text-xs font-bold text-on-surface">
            Riwayat Pengeluaran (Lunas & Ditolak)
          </span>
          <span className="inline-flex items-center justify-center rounded-full bg-outline-variant/20 px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
            {historyCosts.length}
          </span>
        </div>
        <span
          className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          keyboard_arrow_down
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {historyCosts.map((cost) => (
            <CompactClaimRow
              key={cost.id}
              cost={cost}
              amount={Number(cost.amount)}
              onOpenReceipt={onOpenReceipt}
            />
          ))}
        </div>
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
  return (
    <div className="flex items-center justify-between gap-md rounded-[28px] border border-outline-variant/20 bg-white p-sm shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-colors hover:bg-surface-container-low">
      <div className="flex min-w-0 items-center gap-sm">
        <StatusIcon status={cost.status} />
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-xs">
            <span className="max-w-[125px] truncate text-xs font-semibold text-on-surface">
              {cost.project?.name || "Proyek"}
            </span>
            <span className="text-[10px] text-on-surface-variant">•</span>
            <span className="text-[10px] text-on-surface-variant">
              {new Date(cost.createdAt).toLocaleDateString("id-ID", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="max-w-[180px] truncate text-[11px] text-on-surface-variant">
            {cost.description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-sm">
        <StatusAmount status={cost.status} amount={amount} />
        {cost.receiptImageUrl && (
          <ReceiptButton
            imageUrl={cost.receiptImageUrl}
            onOpenReceipt={onOpenReceipt}
          />
        )}
      </div>
    </div>
  );
}

function StatusIcon({
  status,
}: {
  readonly status: ExpenseCostItem["status"];
}): React.JSX.Element {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        status === "PAID"
          ? "bg-primary-container/20 text-primary"
          : "bg-error-container/20 text-error"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {status === "PAID" ? "check_circle" : "cancel"}
      </span>
    </div>
  );
}

function StatusAmount({
  status,
  amount,
}: {
  readonly status: ExpenseCostItem["status"];
  readonly amount: number;
}): React.JSX.Element {
  return (
    <div className="text-right">
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        align="right"
        size="sm"
      />
      <span
        className={`text-[9px] font-bold uppercase ${
          status === "PAID" ? "text-primary" : "text-error"
        }`}
      >
        {status === "PAID" ? "Lunas" : "Ditolak"}
      </span>
    </div>
  );
}

function ReceiptButton({
  imageUrl,
  onOpenReceipt,
  large = false,
}: {
  readonly imageUrl: string;
  readonly onOpenReceipt: (imageUrl: string) => void;
  readonly large?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpenReceipt(imageUrl)}
      className={
        large
          ? "group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant bg-surface-container transition-transform active:scale-95"
          : "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container text-on-surface-variant transition-transform hover:bg-surface-container-high active:scale-90"
      }
      title="Lihat Nota"
    >
      <span
        className={`material-symbols-outlined text-on-surface-variant ${large ? "text-[20px]" : "text-[16px]"}`}
      >
        image
      </span>
    </button>
  );
}
