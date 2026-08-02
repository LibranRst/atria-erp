import React from "react";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import {
  GroupedSurface,
  MoneyValue,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

type LibraryTemplateListProps = {
  readonly items: readonly PricingTemplateRow[];
  readonly presentation: "settings" | "onboarding";
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

function priceSourceLabel(value: string): string {
  if (value === "COST_BREAKDOWN") return "Rincian biaya";
  if (value === "VENDOR_QUOTE") return "Penawaran vendor";
  if (value === "HISTORICAL") return "Riwayat harga";
  if (value === "LEGACY_BACKFILL") return "Data lama";
  return formatBusinessLabel(value);
}

export function LibraryTemplateList({
  items,
  presentation,
  onOpen,
}: LibraryTemplateListProps): React.JSX.Element {
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
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75 ${presentation === "onboarding" ? "min-h-19" : "min-h-26"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] leading-5 font-bold text-on-surface">
                    {item.name}
                  </span>
                </span>
                <span className="block truncate text-meta text-on-surface-variant">
                  {item.itemCategory} · {item.unit}
                  {item.code ? ` · ${item.code}` : ""}
                </span>
                {presentation === "settings" ? (
                  <span className="mt-2 grid grid-cols-2 gap-3">
                    <span className="min-w-0">
                      <span className="block text-[8px] font-bold tracking-wide text-on-surface-variant/60 uppercase">
                        Harga klien
                      </span>
                      <MoneyValue
                        amount={item.defaultClientPrice}
                        variant="compactWithFull"
                        size="xs"
                        tone="primary"
                        className="mt-1"
                      />
                    </span>
                    <span className="min-w-0 text-right">
                      <span className="block text-[8px] font-bold tracking-wide text-on-surface-variant/60 uppercase">
                        Biaya internal
                      </span>
                      <MoneyValue
                        amount={item.defaultInternalCost}
                        variant="compactWithFull"
                        size="xs"
                        align="right"
                        className="mt-1"
                      />
                    </span>
                  </span>
                ) : (
                  <MoneyValue
                    amount={item.defaultClientPrice}
                    variant="compactWithFull"
                    size="xs"
                    tone="primary"
                    className="mt-1.5"
                  />
                )}
                {presentation === "settings" ? (
                  <span className="mt-2 flex justify-between gap-3 text-eyebrow text-on-surface-variant">
                    <span className="truncate">
                      {item.components.length} komponen · {priceSourceLabel(item.priceSourceType)}
                    </span>
                    <span className="shrink-0 font-bold text-primary">
                      Margin {margin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                    </span>
                  </span>
                ) : null}
              </span>
              <div className="flex flex-row items-center gap-2">
                <WorkspaceStatusLabel
                  label={item.isActive ? itemTypeLabel(item.itemType) : "Diarsipkan"}
                  tone={item.isActive ? "neutral" : "inactive"}
                />
                <WorkspaceRowChevron />
              </div>
            </button>
          );
        })}
      </div>
    </GroupedSurface>
  );
}
