"use client";

import { BudgetSplitIndicator, MoneyValue, StatusBadge } from "@/components/ui";
import { getProjectBudgetOutputSchema, type ProjectBudgetCategory } from "@/lib/ai/tool-output";
import type { IndicatorTone } from "@/lib/types/indicator-tone";
import type { StatusBadgeTone } from "@/components/ui";
import * as React from "react";

import { projectBudgetHref } from "../../utils/deep-links";
import { EMPTY_TOOL_RESULT_CONTEXT, resolveProjectName, type ToolResultProps } from "./types";
import { ResultShell } from "./result-shell";

/**
 * Budget per kategori untuk satu proyek.
 *
 * Kategori diurutkan dari yang paling terdesak, bukan dari urutan aslinya —
 * pertanyaan yang membuat kartu ini muncul hampir selalu "mana yang bermasalah",
 * dan jawabannya harus berada di baris pertama tanpa perlu menggulir.
 *
 * Yang ditampilkan hanya kategori yang berstatus tidak aman, ditambah beberapa
 * kategori teratas menurut pemakaian. Sisanya diringkas menjadi satu baris.
 * Alasannya: satu jawaban lintas proyek memicu beberapa kartu sekaligus, dan
 * kategori yang pemakaiannya nol tidak menjawab pertanyaan apa pun — memangkasnya
 * membuat tiap kartu bisa dibaca sekali pandang alih-alih digulir.
 */

/** Jumlah kategori aman yang tetap ikut tampil sebagai konteks. */
const SAFE_CONTEXT_ROWS = 2;

const STATUS_TONE: Record<string, StatusBadgeTone> = {
  SAFE: "healthy",
  WATCH: "warning",
  CRITICAL: "critical",
  OVER_BUDGET: "critical",
};

const STATUS_LABEL: Record<string, string> = {
  SAFE: "Aman",
  WATCH: "Perhatian",
  CRITICAL: "Kritis",
  OVER_BUDGET: "Lewat budget",
};

const INDICATOR_TONE: Record<string, IndicatorTone> = {
  SAFE: "positive",
  WATCH: "warning",
  CRITICAL: "critical",
  OVER_BUDGET: "critical",
};

/** Paling mendesak lebih dulu: lewat budget, lalu persentase pemakaian tertinggi. */
function urgencyRank(category: ProjectBudgetCategory): number {
  if (category.status === "OVER_BUDGET" || category.remaining.amount < 0) return 0;
  if (category.status === "CRITICAL") return 1;
  if (category.status === "WATCH") return 2;
  return 3;
}

function needsAttention(category: ProjectBudgetCategory): boolean {
  return urgencyRank(category) < 3;
}

/**
 * Memilih kategori yang layak ditampilkan penuh.
 *
 * Seluruh kategori bermasalah selalu masuk — menyembunyikannya akan menghilangkan
 * justru bagian yang menuntut tindakan. Sisa ruang diisi kategori aman dengan
 * pemakaian tertinggi, sekadar sebagai konteks bahwa yang lain memang berjalan.
 */
export function selectVisibleCategories(categories: readonly ProjectBudgetCategory[]): {
  readonly shown: readonly ProjectBudgetCategory[];
  readonly hidden: readonly ProjectBudgetCategory[];
} {
  const sorted = [...categories].sort((left, right) => {
    const rank = urgencyRank(left) - urgencyRank(right);
    return rank !== 0 ? rank : right.usedPercentage - left.usedPercentage;
  });

  const attention = sorted.filter(needsAttention);
  const calm = sorted.filter((category) => !needsAttention(category));
  const shown = [...attention, ...calm.slice(0, SAFE_CONTEXT_ROWS)];

  return { shown, hidden: calm.slice(SAFE_CONTEXT_ROWS) };
}

export function ProjectBudgetResult({
  output,
  context = EMPTY_TOOL_RESULT_CONTEXT,
}: ToolResultProps): React.JSX.Element | null {
  const parsed = getProjectBudgetOutputSchema.safeParse(output);
  if (!parsed.success) return null;

  const data = parsed.data;
  if (data.categories.length === 0) return null;

  const { shown, hidden } = selectVisibleCategories(data.categories);
  const projectId = data.projectId ?? context.projectId;
  const projectName = resolveProjectName(context, data.projectName, projectId);

  return (
    <ResultShell
      eyebrow="Budget per kategori"
      title={projectName ?? "Budget proyek"}
      href={projectBudgetHref(projectId)}
      linkLabel="Buka budget proyek"
      trailing={
        <MoneyValue
          amount={data.internalBudget.amount}
          variant="compact"
          size="sm"
          align="right"
          tone="muted"
        />
      }
    >
      <div className="divide-y divide-black/5.5 border-t border-black/5.5">
        {shown.map((category) => (
          <div key={category.categoryCode} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-row font-semibold text-on-surface">
                  {category.categoryName}
                </p>
                <p className="mt-0.5 text-meta font-semibold text-on-surface-variant">
                  Alokasi {category.allocated.formatted}
                </p>
              </div>
              <StatusBadge
                tone={STATUS_TONE[category.status] ?? "neutral"}
                label={STATUS_LABEL[category.status] ?? category.status}
              />
            </div>

            <BudgetSplitIndicator
              value={category.usedPercentage}
              tone={INDICATOR_TONE[category.status] ?? "positive"}
              usedAmount={category.actual.amount}
              remainingAmount={category.remaining.amount}
            />
          </div>
        ))}
      </div>

      {hidden.length > 0 && (
        <p className="border-t border-black/5.5 px-4 py-2.5 text-meta font-semibold text-on-surface-variant">
          {/* Menyebut bahwa sisanya aman jauh lebih berguna daripada sekadar
              memberi tahu ada yang disembunyikan. */}
          {hidden.length} kategori lain masih aman
          {hidden.every((category) => category.actual.amount === 0) ? " dan belum terpakai." : "."}
        </p>
      )}
    </ResultShell>
  );
}
