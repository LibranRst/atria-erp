"use client";

import React from "react";

import type { SettingsOverview } from "@/app/actions/settings/system";
import { BottomSheet, ConfirmationModal } from "@/components/ui";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { BudgetSettingsManager } from "@/features/settings/components/budget-settings-manager";
import { CategorySettingsManager } from "@/features/settings/components/category-settings-manager";
import {
  OnboardingNotice,
  OnboardingStage,
  OnboardingSurface,
  OnboardingToolbar,
} from "./onboarding-primitives";

export function FinancialDefaultsPanel({
  settings,
  onMutationComplete,
}: {
  readonly settings: SettingsOverview;
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<"BUDGET" | "CATEGORIES">("BUDGET");
  const [editingBudget, setEditingBudget] = React.useState(false);
  const [budgetDirty, setBudgetDirty] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const budget = settings.budgetAllocationSetting;
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
            detail="Berlaku saat proyek baru dibuat."
            actionLabel="Sesuaikan"
            disabled={!budget}
            onAction={() => setEditingBudget(true)}
          />
          <OnboardingSurface>
            <div className="grid grid-cols-3 divide-x divide-black/[0.055] px-2 py-4 text-center">
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/65">
                  Internal
                </p>
                <p className="mt-1 font-numeral text-[17px] font-bold tabular-nums text-on-surface">
                  {Math.round((budget?.budgetCapRatio ?? 0) * 100)}%
                </p>
              </div>
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/65">
                  Terbagi
                </p>
                <p className="mt-1 font-numeral text-[17px] font-bold tabular-nums text-on-surface">
                  {Math.round(allocation * 100)}%
                </p>
              </div>
              <div className="min-w-0 px-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/65">
                  Buffer
                </p>
                <p className="mt-1 font-numeral text-[17px] font-bold tabular-nums text-warning">
                  {Math.round(buffer * 100)}%
                </p>
              </div>
            </div>
          </OnboardingSurface>
          <OnboardingNotice>
            Nilai ini tidak mengubah proyek aktif. Ia hanya menjadi titik awal saat proyek baru dibuat.
          </OnboardingNotice>
        </div>
      ) : (
        <CategorySettingsManager
          initialCategories={settings.expenseCategories}
          roleName={settings.roleName}
          canManage={settings.permissions.canManageExpenseCategories}
          presentation="onboarding"
          hideHeader
          onMutationComplete={onMutationComplete}
        />
      )}

      {budget ? (
        <BottomSheet
          open={editingBudget}
          title="Sesuaikan default budget"
          initialExpanded
          onClose={() =>
            budgetDirty ? setConfirmClose(true) : setEditingBudget(false)
          }
        >
          <BudgetSettingsManager
            initialSetting={budget}
            roleName={settings.roleName}
            canManage={settings.permissions.canManageBudgetSettings}
            presentation="onboarding"
            hideHeader
            onMutationComplete={() => {
              setBudgetDirty(false);
              setEditingBudget(false);
              onMutationComplete();
            }}
            onDirtyChange={setBudgetDirty}
          />
        </BottomSheet>
      ) : null}

      <ConfirmationModal
        open={confirmClose}
        title="Buang perubahan?"
        description="Perubahan default budget yang belum disimpan akan hilang."
        tone="warning"
        onClose={() => setConfirmClose(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirmClose(false)}
              className="min-h-12 flex-1 rounded-full bg-surface-container-low px-4 text-xs font-bold text-on-surface"
            >
              Lanjut edit
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClose(false);
                setBudgetDirty(false);
                setEditingBudget(false);
              }}
              className="min-h-12 flex-1 rounded-full bg-warning px-4 text-xs font-bold text-white"
            >
              Buang perubahan
            </button>
          </>
        }
      />
    </OnboardingStage>
  );
}
