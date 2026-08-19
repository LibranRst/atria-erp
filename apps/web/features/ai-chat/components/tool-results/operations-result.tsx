"use client";

import { MoneyValue, StatusBadge } from "@/components/ui";
import type { StatusBadgeTone } from "@/components/ui";
import {
  getExpenseCategoriesOutputSchema,
  getMaterialShortageOutputSchema,
  getPendingApprovalsOutputSchema,
  getRecentExpensesOutputSchema,
  type PendingApproval,
} from "@/lib/ai/tool-output";
import * as React from "react";

import { approvalsHref, expensesHref, materialsHref } from "../../utils/deep-links";
import { ResultRow, ResultShell } from "./result-shell";
import { EMPTY_TOOL_RESULT_CONTEXT, resolveProjectName, type ToolResultProps } from "./types";

/**
 * Kartu untuk antrean persetujuan, kebutuhan material, pengeluaran terakhir,
 * dan kategori biaya. Empat bentuk yang sama-sama berupa daftar baris pendek.
 */

const MAX_ROWS = 6;

// ==========================================
// Antrean persetujuan
// ==========================================

const PRIORITY_TONE: Record<PendingApproval["priority"], StatusBadgeTone> = {
  CRITICAL: "critical",
  WARNING: "warning",
  NORMAL: "neutral",
};

const PRIORITY_LABEL: Record<PendingApproval["priority"], string> = {
  CRITICAL: "Kritis",
  WARNING: "Perhatian",
  NORMAL: "Normal",
};

const PRIORITY_RANK: Record<PendingApproval["priority"], number> = {
  CRITICAL: 0,
  WARNING: 1,
  NORMAL: 2,
};

function waitingLabel(days: number): string {
  if (days <= 0) return "Baru masuk";
  if (days === 1) return "Menunggu 1 hari";
  return `Menunggu ${days} hari`;
}

export function PendingApprovalsResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getPendingApprovalsOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  if (data.approvals.length === 0) return null;

  const sorted = [...data.approvals].sort((left, right) => {
    const rank = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    return rank !== 0 ? rank : right.waitingDays - left.waitingDays;
  });
  const shown = sorted.slice(0, MAX_ROWS);
  const hidden = sorted.length - shown.length;

  return (
    <ResultShell
      eyebrow="Menunggu keputusan"
      title={`${data.totalWaiting} persetujuan`}
      appliedFilters={data.appliedFilters}
      href={approvalsHref()}
      linkLabel="Buka persetujuan"
      onNavigate={context.onNavigate}
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((approval, index) => (
          <ResultRow
            key={`${approval.projectName}-${index}`}
            label={approval.description}
            meta={`${approval.projectName} · ${approval.requestedBy} · ${waitingLabel(approval.waitingDays)}`}
            value={
              <div className="flex flex-col items-end gap-1">
                <MoneyValue
                  amount={approval.amount.amount}
                  variant="compact"
                  size="sm"
                  align="right"
                />
                <StatusBadge
                  tone={PRIORITY_TONE[approval.priority]}
                  label={PRIORITY_LABEL[approval.priority]}
                />
              </div>
            }
          />
        ))}
      </div>

      {hidden > 0 && <HiddenNote>{hidden} persetujuan lain tidak ditampilkan.</HiddenNote>}
    </ResultShell>
  );
}

// ==========================================
// Kebutuhan material
// ==========================================

export function MaterialShortageResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getMaterialShortageOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  if (data.shortages.length === 0) return null;

  const shown = data.shortages.slice(0, MAX_ROWS);
  const hidden = data.shortages.length - shown.length;
  const projectName = resolveProjectName(context, undefined, data.projectId);
  const itemCount = data.shortageCount ?? data.shortages.length;

  return (
    <ResultShell
      eyebrow={projectName ? `Kebutuhan material · ${projectName}` : "Kebutuhan material"}
      title={`${itemCount} item perlu dibeli`}
      href={materialsHref()}
      linkLabel="Buka material"
      onNavigate={context.onNavigate}
      trailing={
        data.estimatedTotalPurchaseCost && (
          <MoneyValue
            amount={data.estimatedTotalPurchaseCost.amount}
            variant="compact"
            size="sm"
            align="right"
            tone="muted"
          />
        )
      }
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((item) => (
          <ResultRow
            key={item.materialName}
            label={item.materialName}
            meta={`Perlu beli ${formatQuantity(item.needToBuyQuantity)} ${item.unit} dari kebutuhan ${formatQuantity(item.requiredQuantity)}`}
            value={
              <MoneyValue
                amount={item.estimatedPurchaseCost.amount}
                variant="compact"
                size="sm"
                align="right"
              />
            }
          />
        ))}
      </div>

      {hidden > 0 && <HiddenNote>{hidden} item lain tidak ditampilkan.</HiddenNote>}
    </ResultShell>
  );
}

/** Kuantitas material sering bulat; desimal nol hanya menambah derau. */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

// ==========================================
// Pengeluaran terakhir
// ==========================================

const EXPENSE_STATUS_TONE: Record<string, StatusBadgeTone> = {
  SUBMITTED: "pending",
  VERIFIED: "pending",
  APPROVED: "completed",
  REJECTED: "critical",
  PAID: "completed",
};

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Diajukan",
  VERIFIED: "Diverifikasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  PAID: "Lunas",
};

export function RecentExpensesResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getRecentExpensesOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const expenses = parsed.data.expenses;
  if (expenses.length === 0) return null;

  const shown = expenses.slice(0, MAX_ROWS);
  const hidden = expenses.length - shown.length;

  return (
    <ResultShell
      eyebrow="Pengeluaran terakhir"
      title={`${expenses.length} pengeluaran`}
      appliedFilters={parsed.data.appliedFilters}
      href={expensesHref()}
      linkLabel="Buka pengeluaran"
      onNavigate={context.onNavigate}
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((expense, index) => (
          <ResultRow
            key={`${expense.description}-${index}`}
            label={expense.description}
            meta={`${expense.projectName} · ${expense.categoryName} · ${expense.expenseDate}`}
            value={
              <div className="flex flex-col items-end gap-1">
                <MoneyValue
                  amount={expense.amount.amount}
                  variant="compact"
                  size="sm"
                  align="right"
                />
                <StatusBadge
                  tone={EXPENSE_STATUS_TONE[expense.status] ?? "neutral"}
                  label={EXPENSE_STATUS_LABEL[expense.status] ?? expense.status}
                />
              </div>
            }
          />
        ))}
      </div>

      {hidden > 0 && <HiddenNote>{hidden} pengeluaran lain tidak ditampilkan.</HiddenNote>}
    </ResultShell>
  );
}

// ==========================================
// Kategori biaya
// ==========================================

export function ExpenseCategoriesResult({ output }: ToolResultProps): React.JSX.Element | null {
  const parsed = getExpenseCategoriesOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const categories = parsed.data.categories;
  if (categories.length === 0) return null;

  return (
    <ResultShell eyebrow="Pengaturan" title="Kategori biaya">
      <div className="flex flex-wrap gap-1.5 border-t border-black/5.5 px-4 py-3">
        {categories.map((category) => (
          <span
            key={category.code}
            className="inline-flex min-h-8 items-center rounded-full bg-surface-container-low px-3 text-support font-semibold text-on-surface"
          >
            {category.name}
          </span>
        ))}
      </div>
    </ResultShell>
  );
}

function HiddenNote({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="border-t border-black/5.5 px-4 py-2.5 text-meta font-semibold text-on-surface-variant">
      {children}
    </p>
  );
}
