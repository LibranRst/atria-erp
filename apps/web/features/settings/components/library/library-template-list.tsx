"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import {
  GroupedSurface,
  DesktopTable,
  MoneyValue,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

type LibraryTemplateListProps = {
  readonly items: readonly PricingTemplateRow[];
  readonly presentation?: "settings" | "onboarding";
  readonly onOpen: (item: PricingTemplateRow) => void;
};

function itemTypeLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    CLIENT_LINE: "Baris klien",
    MATERIAL_ITEM: "Material",
    WORK_PACKAGE: "Paket Tukang",
    SUBCON_PACKAGE: "Paket Subcon",
  };
  return labels[value] ?? formatBusinessLabel(value);
}

export function LibraryTemplateList({
  items,
  onOpen,
}: LibraryTemplateListProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop)
    return (
      <DesktopTable
        ariaLabel="Library item dan harga"
        rows={items}
        rowKey={(item) => item.id}
        onRowAction={onOpen}
        columns={[
          {
            key: "item",
            label: "Item",
            render: (item) => (
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-meta text-on-surface-variant">
                  {item.itemCategory} · {item.unit}
                </p>
              </div>
            ),
          },
          { key: "type", label: "Tipe", render: (item) => itemTypeLabel(item.itemType) },
          {
            key: "internal",
            label: "Biaya internal",
            align: "end",
            render: (item) => (
              <MoneyValue amount={item.defaultInternalCost} variant="compact" size="sm" />
            ),
          },
          {
            key: "client",
            label: "Harga klien",
            align: "end",
            render: (item) => (
              <MoneyValue amount={item.defaultClientPrice} variant="compact" size="sm" />
            ),
          },
          {
            key: "margin",
            label: "Margin",
            align: "end",
            render: (item) =>
              `${(item.defaultClientPrice > 0 ? ((item.defaultClientPrice - item.defaultInternalCost) / item.defaultClientPrice) * 100 : 0).toFixed(1)}%`,
          },
          {
            key: "status",
            label: "Status",
            render: (item) => (
              <WorkspaceStatusLabel
                label={item.isActive ? "Aktif" : "Arsip"}
                tone={item.isActive ? "neutral" : "inactive"}
              />
            ),
          },
        ]}
      />
    );
  return (
    <GroupedSurface>
      <div className="divide-y divide-black/5.5">
        {items.map((item) => {
          const margin =
            item.defaultClientPrice > 0
              ? ((item.defaultClientPrice - item.defaultInternalCost) / item.defaultClientPrice) *
                100
              : 0;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onOpen(item)}
              className="flex min-h-20 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-row font-bold text-on-surface">{item.name}</span>
                  <WorkspaceStatusLabel
                    label={item.isActive ? itemTypeLabel(item.itemType) : "Arsip"}
                    tone={item.isActive ? "neutral" : "inactive"}
                  />
                </div>

                <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                  {item.itemCategory} · Satuan {item.unit}
                  {item.code ? ` · ${item.code}` : ""}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2 text-meta">
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface-variant">Klien:</span>
                    <MoneyValue
                      amount={item.defaultClientPrice}
                      variant="compact"
                      size="xs"
                      tone="primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-on-surface-variant">Biaya:</span>
                    <MoneyValue amount={item.defaultInternalCost} variant="compact" size="xs" />
                    <span className="font-mono text-xs font-bold text-accent">
                      ({margin.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>

              <WorkspaceRowChevron />
            </button>
          );
        })}
      </div>
    </GroupedSurface>
  );
}
