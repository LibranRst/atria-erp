"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import type { DashboardCategory } from "@/features/finance-dashboard/types/dashboard-types";
import { categoryTone } from "@/features/finance-dashboard/components/shared/dashboard-tone";
import { UsageBlockMeter } from "@/components/ui/feedback/usage-block-meter";
import { AppIcon } from "@/components/ui/icon/app-icon";

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
      <div className="rounded-[20px] px-2 py-2.5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${danger ? "bg-error/7.5 text-error ring-error/5" : category.status === "WATCH" ? "bg-warning/9 text-warning ring-warning/6" : "bg-success/8 text-success ring-success/6"}`}
          >
            <AppIcon name="category" className="text-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-on-surface">{category.name}</p>
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
          <span className="text-[10px] font-bold text-on-surface-variant">Sisa budget</span>
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
