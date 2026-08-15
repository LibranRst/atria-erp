"use client";

import React from "react";

import { BudgetSplitIndicator, DuotoneIconTile } from "@/components/ui";
import type { DashboardCategory } from "@/features/finance-dashboard/types/dashboard-types";
import { categoryTone } from "@/features/finance-dashboard/components/shared/dashboard-tone";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
function categoryStatusLabel(status: DashboardCategory["status"]): string {
  if (status === "OVER_BUDGET") return "Melebihi budget";
  if (status === "CRITICAL") return "Kritis";
  if (status === "WATCH") return "Perhatian";
  return "Terkendali";
}

export function CategoryUsageRow({
  category,
}: {
  readonly category: DashboardCategory;
}): React.JSX.Element {
  const tone = categoryTone(category);
  const danger = category.status === "OVER_BUDGET" || category.status === "CRITICAL";
  return (
    <div className="px-2.5 py-1.5">
      <div className="rounded-inset px-2 py-2.5">
        <div className="flex items-start gap-3">
          <DuotoneIconTile
            name="category"
            tone={danger ? "critical" : category.status === "WATCH" ? "attention" : "neutral"}
            className="h-9 w-9"
            iconClassName="icon-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-row font-semibold text-on-surface">{category.name}</p>
              <span
                className={`shrink-0 text-eyebrow font-semibold ${danger ? "text-error" : category.status === "WATCH" ? "text-warning" : "text-on-surface-variant"}`}
              >
                {categoryStatusLabel(category.status)}
              </span>
            </div>
            <p className="mt-0.5 text-meta font-semibold text-on-surface-variant/75">
              Alokasi {shortMoney(category.allocatedAmount)}
            </p>
          </div>
        </div>
        <div className="mt-2 pl-12">
          <BudgetSplitIndicator
            value={category.usedPercentage}
            danger={danger}
            tone={tone}
            usedAmount={category.actualAmount}
            remainingAmount={category.remainingAmount}
          />
        </div>
      </div>
    </div>
  );
}
