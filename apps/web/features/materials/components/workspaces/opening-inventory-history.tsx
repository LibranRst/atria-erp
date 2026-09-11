import React from "react";
import type { InventoryOpeningBatchView } from "@/app/actions/material/opening-inventory";
import {
  DuotoneIconTile,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyValue,
  WorkspaceRowChevron,
} from "@/components/ui";
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
                  className="flex min-h-18 w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
                >
                  <DuotoneIconTile name="inventory_2" tone="neutral" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-row font-bold text-on-surface">
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
                  <WorkspaceRowChevron />
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
