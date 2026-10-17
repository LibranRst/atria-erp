"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import {
  GroupedSurface,
  DesktopTable,
  DesktopTablePagination,
  type DesktopTableColumn,
  MoneyValue,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

import {
  settingsTablePageRows,
  type SettingsTableState,
} from "../../hooks/use-settings-table-state";

type LibraryTemplateListProps = {
  readonly items: readonly PricingTemplateRow[];
  readonly presentation?: "settings" | "onboarding";
  readonly onOpen: (item: PricingTemplateRow) => void;
  readonly table?: SettingsTableState<PricingTemplateRow>;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
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

function templateMargin(item: PricingTemplateRow): number {
  return item.defaultClientPrice > 0
    ? ((item.defaultClientPrice - item.defaultInternalCost) / item.defaultClientPrice) * 100
    : 0;
}

const libraryColumns: readonly DesktopTableColumn<PricingTemplateRow>[] = [
  {
    key: "item",
    label: "Item",
    sortable: true,
    sortValue: (item) => item.name,
    render: (item) => (
      <div>
        <p className="font-semibold">{item.name}</p>
        <p className="text-meta text-on-surface-variant">
          {item.itemCategory} · {item.unit}
        </p>
      </div>
    ),
  },
  {
    key: "type",
    label: "Tipe",
    sortable: true,
    sortValue: (item) => itemTypeLabel(item.itemType),
    render: (item) => itemTypeLabel(item.itemType),
  },
  {
    key: "internal",
    label: "Biaya internal",
    sortable: true,
    sortValue: (item) => item.defaultInternalCost,
    align: "end",
    render: (item) => <MoneyValue amount={item.defaultInternalCost} variant="compact" size="sm" />,
  },
  {
    key: "client",
    label: "Harga klien",
    sortable: true,
    sortValue: (item) => item.defaultClientPrice,
    align: "end",
    render: (item) => <MoneyValue amount={item.defaultClientPrice} variant="compact" size="sm" />,
  },
  {
    key: "margin",
    label: "Margin",
    sortable: true,
    sortValue: templateMargin,
    align: "end",
    render: (item) =>
      `${templateMargin(item).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (item) => Number(item.isActive),
    render: (item) => (
      <WorkspaceStatusLabel
        label={item.isActive ? "Aktif" : "Arsip"}
        tone={item.isActive ? "neutral" : "inactive"}
      />
    ),
  },
];

export function LibraryTemplateList({
  items,
  onOpen,
  table,
  emptyTitle,
  emptyDescription,
}: LibraryTemplateListProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop)
    return (
      <DesktopTable
        ariaLabel="Library item dan harga"
        rows={table ? settingsTablePageRows(items, libraryColumns, table) : items}
        rowKey={(item) => item.id}
        onRowAction={onOpen}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        columns={
          table ? libraryColumns : libraryColumns.map((column) => ({ ...column, sortable: false }))
        }
        sortDescriptor={table?.sortDescriptor}
        onSortChange={table?.onSortChange}
        footer={
          table ? (
            <DesktopTablePagination
              page={table.page}
              pageSize={table.pageSize}
              total={items.length}
              onPageChange={table.onPageChange}
              onPageSizeChange={table.onPageSizeChange}
              ariaLabel="Halaman library harga"
            />
          ) : undefined
        }
      />
    );
  return (
    <GroupedSurface>
      <div className="divide-y divide-black/5.5">
        {items.map((item) => {
          const margin = templateMargin(item);
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
