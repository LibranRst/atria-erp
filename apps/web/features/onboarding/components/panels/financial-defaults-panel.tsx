"use client";

import React from "react";

import type {
  BudgetAllocationSettingRow,
  ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import { SegmentedTabs } from "@/components/ui";
import { CategorySettingsManager } from "@/features/settings/components/categories/category-settings-manager";
import {
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
  OnboardingToolbar,
} from "../shared/onboarding-primitives";
import { OnboardingBudgetDefaultsSheet } from "./onboarding-budget-defaults-sheet";

export function FinancialDefaultsPanel({
  budgetSetting,
  categories,
  canManageBudget,
  canManageCategories,
  onMutationComplete,
}: {
  readonly budgetSetting: BudgetAllocationSettingRow | null;
  readonly categories: readonly ExpenseCategorySettingRow[];
  readonly canManageBudget: boolean;
  readonly canManageCategories: boolean;
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<"BUDGET" | "CATEGORIES">("BUDGET");
  const [editingBudget, setEditingBudget] = React.useState(false);
  const [budgetEditorSession, setBudgetEditorSession] = React.useState(0);
  const budget = budgetSetting;
  const allocation =
    budget?.categories
      .filter((row) => row.isEnabled)
      .reduce((sum, row) => sum + row.ratioPercentage, 0) ?? 0;
  const buffer = Math.max(0, 1 - allocation);

  return (
    <OnboardingStage>
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        ariaLabel="Default finansial onboarding"
        density="compact"
        options={[
          { value: "BUDGET", label: "Budget" },
          { value: "CATEGORIES", label: "Kategori" },
        ]}
      />

      {tab === "BUDGET" ? (
        <div className="space-y-3">
          <OnboardingToolbar
            title="Komposisi default"
            /* Tanpa pengaturan alokasi, panel di bawah menampilkan 0% di semua
               kolom dan tombolnya mati; sebutkan sebabnya di slot detail yang
               memang sudah ada, bukan biarkan angka nol berbicara sendiri. */
            detail={
              budget
                ? "Berlaku saat proyek baru dibuat."
                : "Pengaturan alokasi default belum tersedia."
            }
            actionLabel="Sesuaikan"
            disabled={!budget}
            onAction={() => {
              setBudgetEditorSession((current) => current + 1);
              setEditingBudget(true);
            }}
          />
          <OnboardingSurface>
            <div className="grid grid-cols-3 divide-x divide-black/5.5 px-2 py-4 text-center">
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                  Internal
                </p>
                <p className="font-numeral mt-1 text-title font-bold text-on-surface tabular-nums">
                  {Math.round((budget?.budgetCapRatio ?? 0) * 100)}%
                </p>
              </div>
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                  Terbagi
                </p>
                <p className="font-numeral mt-1 text-title font-bold text-on-surface tabular-nums">
                  {Math.round(allocation * 100)}%
                </p>
              </div>
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold tracking-[0.08em] text-on-surface-variant/65 uppercase">
                  Buffer
                </p>
                <p className="font-numeral mt-1 text-title font-bold text-warning tabular-nums">
                  {Math.round(buffer * 100)}%
                </p>
              </div>
            </div>
          </OnboardingSurface>
          <OnboardingNotice>
            Nilai ini tidak mengubah proyek aktif. Ia hanya menjadi titik awal saat proyek baru
            dibuat.
          </OnboardingNotice>
        </div>
      ) : (
        <CategorySettingsManager
          initialCategories={categories}
          canManage={canManageCategories}
          presentation="onboarding"
          onMutationComplete={onMutationComplete}
        />
      )}

      {budget ? (
        <OnboardingBudgetDefaultsSheet
          key={`budget-defaults-${budgetEditorSession}`}
          open={editingBudget}
          initialSetting={budget}
          canManage={canManageBudget}
          onClose={() => setEditingBudget(false)}
          onMutationComplete={onMutationComplete}
        />
      ) : null}
    </OnboardingStage>
  );
}
