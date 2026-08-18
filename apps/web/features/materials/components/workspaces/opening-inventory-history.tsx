import React from "react";
import type { InventoryOpeningBatchView } from "@/app/actions/material/opening-inventory";
import { AppIcon, GroupedSurface, InlineStateRow, MainSection, MoneyValue } from "@/components/ui";
import { MaterialStatusLabel } from "@/features/materials/components/shared/material-page-primitives";
import { statusPresentation } from "./opening-inventory-utils";

type Props = {
  readonly show: boolean;
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly onSelect: (batch: InventoryOpeningBatchView) => void;
};

export function OpeningInventoryHistory({ show, batches, onSelect }: Props): React.JSX.Element {
  return show ? (
    <MainSection title="Riwayat saldo awal" count={batches.length} countLabel="Batch">
      <GroupedSurface>
        {batches.length === 0 ? (
          <InlineStateRow
            icon="history"
            title="Belum ada pengajuan"
            description="Batch yang diajukan atau diputus akan tercatat di sini."
          />
        ) : (
          <div className="divide-y divide-black/5.5">
            {batches.map((batch) => {
              const status = statusPresentation(batch.status);
              return (
                <button
                  type="button"
                  key={batch.id}
                  onClick={() => onSelect(batch)}
                  className="flex min-h-19 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
                >
                  <AppIcon
                    name="inventory"
                    className="flex! icon-lg h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-on-surface">
                      {batch.batchNumber}
                    </span>
                    <span className="mt-0.5 block text-meta text-on-surface-variant">
                      {batch.itemCount} item ·{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                      }).format(new Date(batch.cutoverDate))}
                    </span>
                    <MaterialStatusLabel
                      label={status.label}
                      tone={status.tone}
                      className="mt-1.5"
                    />
                  </span>
                  <MoneyValue amount={batch.totalValue} variant="compact" size="sm" align="right" />
                  <AppIcon
                    name="chevron_right"
                    className="icon-md shrink-0 text-on-surface-variant/60"
                  />
                </button>
              );
            })}
          </div>
        )}
      </GroupedSurface>
    </MainSection>
  ) : (
    <></>
  );
}
