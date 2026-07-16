"use client";

import Link from "next/link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { MoneyValue } from "@/components/ui/page-primitives";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import {
  formatShortDate,
  shortMoney,
} from "@/features/finance-dashboard/lib/dashboard-formatters";
import { categoryTone } from "@/features/finance-dashboard/components/dashboard-cards";
import {
  BudgetSplitIndicator,
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
  UsageBlockMeter,
} from "@/features/finance-dashboard/components/dashboard-budget-indicators";
import type {
  DashboardCashDue,
  DashboardCategory,
  DashboardMaterialIssue,
  DashboardRiskyProject,
} from "@/features/finance-dashboard/lib/dashboard-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";

const dashboardRowPressScale = { scale: 0.985 } as const;

function projectHealthLabel(
  health: DashboardRiskyProject["effectiveHealth"],
): string {
  if (health === "CRITICAL") return "Kritis";
  if (health === "WARNING") return "Perhatian";
  return "Terkendali";
}

function categoryStatusLabel(status: DashboardCategory["status"]): string {
  if (status === "OVER_BUDGET") return "Melebihi budget";
  if (status === "CRITICAL") return "Kritis";
  if (status === "WATCH") return "Perhatian";
  return "Terkendali";
}

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
    item.type === "project_cost" ? "Dana Lapangan" : "Vendor Payment";
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
        className="min-h-12 w-full rounded-[20px] px-2 py-2.5 text-left outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${critical ? "bg-error/[0.075] text-error ring-error/[0.05]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              {item.type === "project_cost" ? "receipt_long" : "request_quote"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <MoneyValue
                amount={item.amount}
                variant="compactWithFull"
                size="lg"
              />
              <span
                className={`shrink-0 text-[9px] font-semibold ${critical ? "text-error" : "text-warning"}`}
              >
                {item.priority === "NORMAL"
                  ? approvalLabel
                  : item.priorityReason}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-on-surface-variant/75">
              {item.projectName}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </span>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
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
  const impact = getApprovalBudgetImpact(
    item.allocatedAmount,
    item.actualSpent,
    item.amount,
  );
  const critical =
    item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const impactLabel = critical
    ? impact.overflowPercentage > 0
      ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
      : "Pengajuan menambah risiko budget"
    : warning
      ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
      : "Masih dalam batas budget";

  return (
    <section className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
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
          {impact.afterPercentage.toFixed(0)}%
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-outline-variant/20 bg-surface-container-low/55 px-4 py-3.5 text-[10px] font-semibold text-on-surface-variant">
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
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant/55 ring-1 ring-outline-variant/15"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[15px]">
            arrow_forward
          </span>
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
        className={`flex min-h-10 items-center justify-between gap-2 border-t border-outline-variant/20 px-4 py-2.5 text-[9px] font-bold ${critical ? "bg-error-container/15 text-error" : warning ? "bg-warning-light/55 text-warning" : "bg-primary/5 text-primary"}`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className="material-symbols-outlined shrink-0 text-[14px]"
            aria-hidden="true"
          >
            {critical ? "report" : warning ? "warning" : "check_circle"}
          </span>
          <span className="truncate">{impactLabel}</span>
        </span>
        <span className="shrink-0 font-mono">+{shortMoney(item.amount)}</span>
      </div>
    </section>
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
    <div className="min-w-0 border-l border-outline-variant/45 px-3 py-1 first:border-l-0">
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
  compact = false,
}: {
  readonly project: DashboardRiskyProject;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const overBudget = project.remainingBudget < 0;

  if (compact) {
    return (
      <motion.div
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
      >
        <Link
          href={`/projects/${project.projectId}?tab=overview`}
          className="block rounded-[22px] px-3.5 py-3 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 max-[430px]:px-3"
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${overBudget ? "bg-error/[0.075] text-error ring-error/[0.05]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                monitoring
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-on-surface">
                  {project.projectName}
                </p>
                <span
                  className={`shrink-0 text-[9px] font-semibold leading-4 ${overBudget ? "text-error" : "text-warning"}`}
                >
                  {projectHealthLabel(project.effectiveHealth)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10px] leading-4 text-on-surface-variant/75">
                {project.riskReason}
              </p>
            </div>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[16px]">
                chevron_right
              </span>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 divide-x divide-black/[0.06] rounded-[17px] bg-surface-container-low/70 px-3 py-2.5">
            <div className="min-w-0 pr-3">
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/55">
                Aktual
              </p>
              <MoneyValue
                amount={project.actualCost}
                variant="compactWithFull"
                size="sm"
                className="mt-1"
              />
            </div>
            <div className="min-w-0 pl-3 text-right">
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/55">
                Internal budget
              </p>
              <MoneyValue
                amount={project.internalBudget}
                variant="compactWithFull"
                size="sm"
                align="right"
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 text-[10px] font-semibold">
            <span className="text-on-surface-variant">
              Terpakai {project.usedPercentage.toFixed(0)}%
            </span>
            <span className={overBudget ? "text-error" : "text-on-surface"}>
              {overBudget ? "Melebihi" : "Sisa"}{" "}
              {shortMoney(Math.abs(project.remainingBudget))}
            </span>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="px-2.5 py-1.5"
    >
      <Link
        href={`/projects/${project.projectId}?tab=overview`}
        className="block rounded-[20px] px-2 py-2.5 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${overBudget ? "bg-error/[0.075] text-error ring-error/[0.05]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              monitoring
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-on-surface">
                {project.projectName}
              </p>
              <span
                className={`shrink-0 text-[9px] font-semibold leading-4 ${overBudget ? "text-error" : "text-warning"}`}
              >
                {projectHealthLabel(project.effectiveHealth)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-on-surface-variant/75">
              {project.riskReason}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </span>
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
        <BudgetSplitIndicator
          value={project.usedPercentage}
          danger={overBudget}
          tone={project.effectiveHealth === "CRITICAL" ? "critical" : "warning"}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-semibold text-on-surface-variant">
          <span>
            Aktual
            <MoneyValue
              amount={project.actualCost}
              variant="compactWithFull"
              size="sm"
              className="mt-0.5"
            />
          </span>
          <span className="text-right">
            Internal budget
            <MoneyValue
              amount={project.internalBudget}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="mt-0.5"
            />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-outline-variant/35 pt-2 text-[10px] font-semibold text-on-surface-variant">
          <span>
            Margin target {project.targetMarginPercentage.toFixed(1)}%
          </span>
          <span
            className={
              project.projectedMarginPercentage < project.targetMarginPercentage
                ? "text-error"
                : "text-on-surface"
            }
          >
            Proyeksi {project.projectedMarginPercentage.toFixed(1)}%
          </span>
        </div>
        {project.riskyCategories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.riskyCategories.map((category) => (
              <span
                key={category.code}
                className="rounded-full bg-warning-light px-2.5 py-1 text-[9px] font-bold text-warning"
              >
                {category.name} {category.usedPercentage.toFixed(0)}%
              </span>
            ))}
          </div>
        ) : null}
      </Link>
    </motion.div>
  );
}

export function CategoryUsageRow({
  category,
}: {
  readonly category: DashboardCategory;
}): React.JSX.Element {
  const tone = categoryTone(category);
  const danger =
    category.status === "OVER_BUDGET" || category.status === "CRITICAL";
  return (
    <div className="px-2.5 py-1.5">
      <div className="rounded-[20px] px-2 py-2.5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${danger ? "bg-error/[0.075] text-error ring-error/[0.05]" : category.status === "WATCH" ? "bg-warning/[0.09] text-warning ring-warning/[0.06]" : "bg-success/[0.08] text-success ring-success/[0.06]"}`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              category
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-on-surface">
                {category.name}
              </p>
              <span
                className={`shrink-0 text-[9px] font-semibold ${danger ? "text-error" : category.status === "WATCH" ? "text-warning" : "text-success"}`}
              >
                {categoryStatusLabel(category.status)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-on-surface-variant/75">
              Terpakai {category.usedPercentage.toFixed(0)}% dari alokasi
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pl-12">
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
        <div className="pl-12">
          <UsageBlockMeter value={category.usedPercentage} tone={tone} />
        </div>
      </div>
    </div>
  );
}

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
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
    >
      <Link
        href={item.href}
        className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-[20px] px-4 py-3.5 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007AFF]/25 max-[430px]:px-3 max-[430px]:py-3"
      >
        <span
          className="relative flex flex-col items-start pt-0.5 text-left"
          aria-hidden="true"
        >
          <span className="font-mono text-[13px] font-black leading-none text-on-surface">
            {dueDay}
          </span>
          <span className="mt-1 text-[8px] font-bold uppercase text-on-surface-variant">
            {dueMonth}
          </span>
          <span
            className={`absolute -right-1 top-1.5 z-10 h-2 w-2 rounded-full ring-[3px] ring-white/90 ${item.dayOffset < 0 ? "bg-error" : item.dayOffset <= 7 ? "bg-warning" : "bg-outline"}`}
          />
        </span>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-[10px] font-semibold ${item.type === "payable" ? "text-error" : "text-primary"}`}
              >
                {item.type === "payable" ? "Hutang vendor" : "Piutang klien"}
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold tracking-[-0.01em] text-on-surface max-[430px]:text-[13px]">
                {item.documentNumber}
              </p>
              <p className="mt-1 truncate text-[11px] text-on-surface-variant">
                {item.projectName} • {item.counterpartyName}
              </p>
            </div>
            <div className="flex shrink-0 self-stretch flex-col items-end justify-between gap-2 text-right">
              <MoneyValue
                amount={item.outstandingAmount}
                variant="compactWithFull"
                align="right"
                size="sm"
              />
              <span className="flex items-center justify-end gap-1.5">
                <span
                  className={`text-[9px] font-semibold leading-4 ${item.dayOffset < 0 ? "text-error" : item.dayOffset <= 7 ? "text-warning" : "text-on-surface-variant"}`}
                >
                  {timing}
                </span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">
                    chevron_right
                  </span>
                </span>
              </span>
            </div>
          </div>
          {!compact ? (
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
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

export function MaterialIssueRow({
  item,
  compact = false,
}: {
  readonly item: DashboardMaterialIssue;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const label =
    item.type === "RAP_SHORTAGE"
      ? "RAP belum terpenuhi"
      : item.type === "LOW_STOCK"
        ? "Stok rendah"
        : item.type === "REVERSAL_REQUEST"
          ? "Perlu keputusan"
          : item.type === "WASTE"
            ? "Material terbuang"
            : "Penyesuaian stok";
  const quantityLabel =
    item.type === "RAP_SHORTAGE"
      ? `${Math.max(0, (item.requiredStock ?? 0) - item.availableStock).toLocaleString("id-ID")} ${item.unit}`
      : item.type === "LOW_STOCK"
        ? `${item.availableStock.toLocaleString("id-ID")} ${item.unit}`
        : item.quantity !== null
          ? `${item.quantity.toLocaleString("id-ID")} ${item.unit}`
          : null;
  const fulfillmentTarget =
    item.type === "RAP_SHORTAGE"
      ? item.requiredStock
      : item.type === "LOW_STOCK"
        ? item.minimumStock
        : null;

  if (compact) {
    return (
      <motion.div
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
      >
        <Link
          href={item.href}
          className="block rounded-[22px] px-3.5 py-3 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 max-[430px]:px-3"
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${item.severity === "CRITICAL" ? "bg-error/[0.075] text-error ring-error/[0.05]" : "bg-warning/[0.09] text-warning ring-warning/[0.06]"}`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                inventory_2
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`truncate text-[10px] font-semibold ${item.severity === "CRITICAL" ? "text-error" : "text-warning"}`}
                >
                  {label}
                </p>
                {quantityLabel ? (
                  <span className="financial-amount shrink-0 font-mono text-[10px] font-bold text-on-surface">
                    Kurang {quantityLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
                {item.materialName}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-on-surface-variant/75">
                {item.description}
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-9 items-center gap-3 rounded-[15px] bg-surface-container-low/70 px-3 py-2 text-[9px] font-semibold text-on-surface-variant">
            <span className="min-w-0 flex-1 truncate">
              Tersedia{" "}
              <strong className="font-mono text-on-surface">
                {item.availableStock.toLocaleString("id-ID")} {item.unit}
              </strong>
            </span>
            {fulfillmentTarget !== null ? (
              <span className="shrink-0">
                Dibutuhkan{" "}
                <strong className="font-mono text-on-surface">
                  {fulfillmentTarget.toLocaleString("id-ID")} {item.unit}
                </strong>
              </span>
            ) : null}
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#007AFF] shadow-sm"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[15px]">
                chevron_right
              </span>
            </span>
          </div>
        </Link>
      </motion.div>
    );
  }

  const issueToneClass =
    item.severity === "CRITICAL"
      ? "bg-error/[0.075] text-error ring-error/[0.05]"
      : item.severity === "WARNING"
        ? "bg-warning/[0.09] text-warning ring-warning/[0.06]"
        : "bg-surface-container-high/70 text-on-surface-variant ring-black/[0.035]";

  return (
    <motion.div
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="px-2.5 py-1.5"
    >
      <Link
        href={item.href}
        className="block rounded-[20px] px-2 py-2.5 outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${issueToneClass}`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              {item.type === "WASTE" || item.type === "ADJUSTMENT"
                ? "history"
                : "inventory_2"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`truncate text-[9px] font-semibold ${item.severity === "CRITICAL" ? "text-error" : item.severity === "WARNING" ? "text-warning" : "text-on-surface-variant"}`}
              >
                {label}
              </p>
              {quantityLabel ? (
                <span className="financial-amount shrink-0 font-mono text-[10px] font-bold text-on-surface">
                  {quantityLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
              {item.materialName}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-on-surface-variant/75">
              {item.description}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
          <span className="truncate">
            {item.projectName ?? item.locationName ?? "-"}
          </span>
          <span className="shrink-0">
            {item.type === "RAP_SHORTAGE"
              ? `Tersedia ${item.availableStock.toLocaleString("id-ID")}`
              : item.type === "LOW_STOCK"
                ? `Minimum ${(item.minimumStock ?? 0).toLocaleString("id-ID")}`
                : item.createdAt
                  ? formatShortDate(item.createdAt)
                  : "Tinjau"}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
