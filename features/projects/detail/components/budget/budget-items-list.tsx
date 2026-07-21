"use client";

import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge, type BadgeStatus } from "@/components/ui/badge";
import type { BudgetItem } from "./budget-manager-types";

export function BudgetItemsList({
  status,
  budgetItems,
  itemsByCategory,
}: {
  readonly status: string;
  readonly budgetItems: readonly BudgetItem[];
  readonly itemsByCategory: Record<string, BudgetItem[]>;
}): React.JSX.Element {
  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="text-on-surface-variant font-sans text-[8px] leading-[16px] font-bold tracking-wider uppercase">
          Rincian Project Budget
        </h2>
        <Badge status={status as BadgeStatus}>{status}</Badge>
      </div>

      {budgetItems.length === 0 ? (
        <div className="border-outline-variant/20 p-md flex flex-col items-center justify-center rounded-[28px] border bg-white py-8 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
          <span className="material-symbols-outlined text-on-surface-variant mb-1 text-[24px]">
            list
          </span>
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
        <span className="border-outline-variant/20 bg-surface-container text-primary rounded-full border px-2.5 py-1 font-sans text-[10px] leading-[16px] font-bold tracking-wider uppercase">
          Area pekerjaan: {categoryName}
        </span>
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
    <div className="space-y-md border-outline-variant/20 p-md hover:bg-surface-container-low rounded-[28px] border bg-white shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-colors">
      <div className="gap-sm flex flex-col">
        <div className="gap-md flex items-start justify-between">
          <div className="space-y-base min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="leading-margin-mobile text-on-surface max-w-[200px] truncate font-sans text-[14px] font-bold">
                {item.name}
              </h3>
              {item.costCategory && (
                <span className="border-primary/20 bg-primary/10 text-primary rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase">
                  {item.costCategory.name}
                </span>
              )}
            </div>
            <p className="text-on-surface-variant text-[11px] leading-relaxed">
              {Number(item.quantity).toLocaleString("id-ID")} {item.unit} @ Rp{" "}
              {Number(item.unitPrice).toLocaleString("id-ID")}
            </p>
            <p className="text-on-surface-variant font-sans text-[9px] leading-[16px] font-bold tracking-tight uppercase">
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
            <span className="text-on-surface-variant block font-sans text-[8px] leading-[16px] font-bold tracking-wider uppercase">
              {isOverrun ? "Overrun" : "Sisa Plafon"}
            </span>
          </div>
        </div>

        <div className="space-y-xs">
          <div className="border-outline-variant/10 bg-surface-container h-1.5 w-full overflow-hidden rounded-full border">
            <div
              className={`h-full rounded-full transition-colors duration-300 ${
                isOverrun ? "bg-error" : percent >= 90 ? "bg-secondary" : "bg-primary"
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="text-on-surface-variant flex items-center justify-between text-[10px]">
            <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
            <span>{percent.toFixed(1)}% terpakai</span>
          </div>
        </div>
      </div>
    </div>
  );
}
