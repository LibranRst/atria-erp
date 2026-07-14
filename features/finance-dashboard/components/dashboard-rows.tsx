"use client";

import Link from "next/link";
import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge } from "@/components/ui/badge";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { badgeStatus, formatShortDate } from "@/features/finance-dashboard/lib/dashboard-formatters";
import { ProgressBar, categoryTone, projectTone } from "@/features/finance-dashboard/components/dashboard-cards";
import type {
  DashboardCashDue,
  DashboardCategory,
  DashboardMaterialIssue,
  DashboardRiskyProject,
} from "@/features/finance-dashboard/lib/dashboard-types";

export function ApprovalWorkbenchRow({
  item,
  pending,
  onOpen,
  onDecide,
}: {
  readonly item: ApprovalDetail;
  readonly pending: boolean;
  readonly onOpen: (item: ApprovalDetail) => void;
  readonly onDecide: (
    item: ApprovalDetail,
    status: "APPROVED" | "REJECTED",
  ) => void;
}): React.JSX.Element {
  const approvalLabel =
    item.type === "project_cost" ? "Dana Lapangan" : "Vendor Payment";
  const counterpartyLabel = item.requestedBy;

  return (
    <div className="px-4 py-3.5">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full rounded-2xl text-left transition active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <MoneyValue
              amount={item.amount}
              variant="compactWithFull"
              size="lg"
            />
            <p className="mt-1 line-clamp-1 text-xs font-bold leading-5 text-on-surface">
              {item.description}
            </p>
            <p className="mt-1 truncate text-[11px] leading-4 text-on-surface-variant">
              {item.projectName}
            </p>
          </div>
          <Badge status={item.type === "project_cost" ? "WARNING" : "PRIMARY"}>
            {approvalLabel}
          </Badge>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-on-surface-variant/75">
          <span className="max-w-full truncate">{counterpartyLabel}</span>
          <span
            className="h-1 w-1 rounded-full bg-outline-variant/60"
            aria-hidden="true"
          />
          <span className="max-w-full truncate">{item.budgetItemName}</span>
          {item.receiptImageUrl ? (
            <>
              <span
                className="h-1 w-1 rounded-full bg-outline-variant/60"
                aria-hidden="true"
              />
              <span className="inline-flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-[13px]">
                  receipt_long
                </span>
                Nota
              </span>
            </>
          ) : null}
        </div>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide(item, "REJECTED")}
          className="min-h-11 rounded-full bg-error-container/25 px-3 text-[11px] font-bold text-error transition active:scale-[0.97] disabled:opacity-45"
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide(item, "APPROVED")}
          className="min-h-11 rounded-full bg-primary px-3 text-[11px] font-bold text-on-primary transition active:scale-[0.97] disabled:opacity-45"
        >
          Setujui
        </button>
      </div>
    </div>
  );
}

export function ApprovalBudgetContext({
  item,
}: {
  readonly item: ApprovalDetail;
}): React.JSX.Element {
  const nextSpent = item.actualSpent + item.amount;
  const usedPercentage =
    item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
  const critical = item.budgetOverrun || usedPercentage >= 100;

  return (
    <div className="rounded-2xl bg-surface-container-low p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant/60">
            Konteks budget
          </p>
          <p className="mt-1 truncate text-xs font-bold text-on-surface">
            {item.budgetItemName}
          </p>
        </div>
        <span
          className={`financial-amount shrink-0 font-mono text-xs font-black ${critical ? "text-error" : "text-on-surface"}`}
        >
          {usedPercentage.toFixed(0)}%
        </span>
      </div>
      <ProgressBar
        value={usedPercentage}
        tone={critical ? "critical" : "positive"}
        className="mt-2"
      />
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-on-surface-variant">
        <span>
          Terpakai sekarang
          <MoneyValue
            amount={item.actualSpent}
            variant="compactWithFull"
            size="sm"
            className="mt-0.5"
          />
        </span>
        <span className="text-right">
          Setelah approval
          <MoneyValue
            amount={nextSpent}
            variant="compactWithFull"
            tone={critical ? "danger" : "default"}
            align="right"
            size="sm"
            className="mt-0.5"
          />
        </span>
      </div>
    </div>
  );
}

export function MiniSignal({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-white px-3 py-2 shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
      <p className="truncate text-[8px] font-extrabold uppercase tracking-wide text-on-surface-variant/60">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[11px] font-bold ${danger ? "text-error" : "text-on-surface"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function DashboardTabEmpty({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-4 py-8 text-center text-xs leading-5 text-on-surface-variant">
      {children}
    </div>
  );
}

export function ProjectRiskRow({
  project,
}: {
  readonly project: DashboardRiskyProject;
}): React.JSX.Element {
  const tone = projectTone(project);
  return (
    <Link
      href={`/projects/${project.projectId}?tab=overview`}
      className="block px-4 py-3.5 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">
            {project.projectName}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">
            {project.riskReason}
          </p>
        </div>
        <Badge status={badgeStatus(project.effectiveHealth)}>
          {project.effectiveHealth}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-on-surface-variant">
          Budget terpakai {project.usedPercentage.toFixed(0)}%
        </span>
        <MoneyValue
          amount={project.remainingBudget}
          variant="compactWithFull"
          tone={project.remainingBudget < 0 ? "danger" : "default"}
          align="right"
          size="sm"
          className="shrink-0"
        />
      </div>
      <ProgressBar
        value={project.usedPercentage}
        tone={tone}
        className="mt-2"
      />
    </Link>
  );
}

export function CategoryUsageRow({
  category,
}: {
  readonly category: DashboardCategory;
}): React.JSX.Element {
  const tone = categoryTone(category);
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">
            {category.name}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
            Terpakai {category.usedPercentage.toFixed(0)}% dari alokasi
          </p>
        </div>
        <Badge status={badgeStatus(category.status)}>
          {category.status === "OVER_BUDGET" ? "Over" : category.status}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-on-surface-variant">
          Sisa budget
        </span>
        <MoneyValue
          amount={category.remainingAmount}
          variant="compactWithFull"
          tone={category.remainingAmount < 0 ? "danger" : "default"}
          align="right"
          size="sm"
        />
      </div>
      <ProgressBar
        value={category.usedPercentage}
        tone={tone}
        className="mt-2"
      />
    </div>
  );
}

export function CashDueRow({
  item,
  referenceDate,
}: {
  readonly item: DashboardCashDue;
  readonly referenceDate: Date;
}): React.JSX.Element {
  const overdueDays = Math.max(
    0,
    Math.ceil(
      (referenceDate.getTime() - new Date(item.dueDate).getTime()) / 86_400_000,
    ),
  );
  return (
    <Link
      href={item.href}
      className="block px-4 py-3.5 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Badge status={item.type === "payable" ? "CRITICAL" : "WARNING"}>
            {item.type === "payable" ? "Hutang Vendor" : "Piutang Klien"}
          </Badge>
          <p className="mt-2 truncate text-sm font-bold text-on-surface">
            {item.documentNumber}
          </p>
          <p className="mt-1 truncate text-[11px] text-on-surface-variant">
            {item.projectName} • {item.counterpartyName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <MoneyValue
            amount={item.outstandingAmount}
            variant="compactWithFull"
            align="right"
            size="sm"
          />
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-error">
            {overdueDays} hari
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-on-surface-variant">
        <span>Jatuh tempo {formatShortDate(item.dueDate)}</span>
        <span className="text-right">
          Dibayar
          <MoneyValue
            amount={item.paidAmount}
            variant="compactWithFull"
            align="right"
            size="sm"
            className="mt-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

export function MaterialIssueRow({
  item,
}: {
  readonly item: DashboardMaterialIssue;
}): React.JSX.Element {
  return (
    <Link
      href={item.href}
      className="block px-4 py-3.5 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Badge status={item.severity === "CRITICAL" ? "CRITICAL" : "WARNING"}>
            {item.type === "RAP_SHORTAGE" ? "RAP Shortage" : "Low Stock"}
          </Badge>
          <p className="mt-2 truncate text-sm font-bold text-on-surface">
            {item.materialName}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">
            {item.description}
          </p>
        </div>
        <span
          className={`financial-amount shrink-0 font-mono text-[11px] font-extrabold ${item.availableStock <= 0 ? "text-error" : "text-on-surface"}`}
        >
          {item.availableStock.toLocaleString("id-ID")} {item.unit}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-on-surface-variant">
        <span className="truncate">
          {item.projectName ?? item.locationName ?? "-"}
        </span>
        <span className="shrink-0">
          {item.type === "RAP_SHORTAGE"
            ? `Butuh ${(item.requiredStock ?? 0).toLocaleString("id-ID")}`
            : `Min ${(item.minimumStock ?? 0).toLocaleString("id-ID")}`}
        </span>
      </div>
    </Link>
  );
}
