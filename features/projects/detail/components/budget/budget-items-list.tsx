"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { MetadataChip, resolveStatusPresentation, StatusBadge } from "@/components/ui/badge/badge";
import type { BudgetItem } from "../../types/budget-manager-types";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function BudgetItemsList({
  status,
  budgetItems,
  itemsByCategory,
}: {
  readonly status: string;
  readonly budgetItems: readonly BudgetItem[];
  readonly itemsByCategory: Record<string, BudgetItem[]>;
}): React.JSX.Element {
  const statusPresentation = resolveStatusPresentation(status);
  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-[8px] leading-4 font-bold tracking-wider text-on-surface-variant uppercase">
          Rincian Project Budget
        </h2>
        <StatusBadge tone={statusPresentation.tone} label={statusPresentation.label} />
      </div>

      {budgetItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-outline-variant/20 bg-white p-md py-8 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
          <AppIcon name="list" className="mb-1 text-[24px] text-on-surface-variant" />
          <p className="font-body-xs text-on-surface-variant">
            Belum ada item dalam draft Project Budget ini.
          </p>
        </div>
      ) : (
        Object.keys(itemsByCategory).map((categoryName) => (
          <BudgetCategoryGroup
            key={categoryName}
            categoryName={categoryName}
            items={itemsByCategory[categoryName]}
          />
        ))
      )}
    </div>
  );
}

function BudgetCategoryGroup({
  categoryName,
  items,
}: {
  readonly categoryName: string;
  readonly items: readonly BudgetItem[];
}): React.JSX.Element {
  return (
    <div className="space-y-sm">
      <div className="flex items-center">
        <MetadataChip className="font-sans font-bold tracking-wider text-primary uppercase">
          Area pekerjaan: {categoryName}
        </MetadataChip>
      </div>

      <div className="space-y-sm">
        {items.map((item) => (
          <BudgetItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function BudgetItemCard({ item }: { readonly item: BudgetItem }): React.JSX.Element {
  const allocated = Number(item.allocatedAmount);
  const spent = Number(item.actualSpent);
  const remaining = allocated - spent;
  const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const isOverrun = spent > allocated;

  return (
    <div className="space-y-md rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-colors hover:bg-surface-container-low">
      <div className="flex flex-col gap-sm">
        <div className="flex items-start justify-between gap-md">
          <div className="min-w-0 space-y-base">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="max-w-50 truncate font-sans text-[14px] leading-margin-mobile font-bold text-on-surface">
                {item.name}
              </h3>
              {item.costCategory && (
                <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-primary uppercase">
                  {item.costCategory.name}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-on-surface-variant">
              {Number(item.quantity).toLocaleString("id-ID")} {item.unit} @ Rp{" "}
              {Number(item.unitPrice).toLocaleString("id-ID")}
            </p>
            <p className="font-sans text-[9px] leading-4 font-bold tracking-tight text-on-surface-variant uppercase">
              Total Plafon: Rp {allocated.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <MoneyValue
              amount={Math.abs(remaining)}
              variant="fullDynamic"
              prefix={isOverrun ? "-" : ""}
              tone={isOverrun ? "danger" : "primary"}
              align="right"
              size="md"
            />
            <span className="block font-sans text-[8px] leading-4 font-bold tracking-wider text-on-surface-variant uppercase">
              {isOverrun ? "Overrun" : "Sisa Plafon"}
            </span>
          </div>
        </div>

        <div className="space-y-xs">
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-outline-variant/10 bg-surface-container">
            <div
              className={`h-full rounded-full transition-colors duration-300 ${
                isOverrun ? "bg-error" : percent >= 90 ? "bg-secondary" : "bg-primary"
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
            <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
            <span>{percent.toFixed(1)}% terpakai</span>
          </div>
        </div>
      </div>
    </div>
  );
}
