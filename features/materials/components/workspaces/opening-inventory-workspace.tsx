"use client";

import Link from "next/link";
import React from "react";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { GroupedSurface, InlineStateRow, MainSection } from "@/components/ui/feedback/main-surface";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { OpeningInventoryBatchDetailSheet } from "./opening-inventory-batch-detail-sheet";
import { OpeningInventoryEntryForm } from "./opening-inventory-entry-form";
import { OpeningInventoryHistory } from "./opening-inventory-history";

interface OpeningInventoryWorkspaceProps {
  readonly inventory: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly embedded?: boolean;
  readonly showHeader?: boolean;
  readonly showHistory?: boolean;
  readonly setupOnly?: boolean;
  readonly onMutationComplete?: () => void;
}

export function OpeningInventoryWorkspace({
  inventory,
  batches,
  embedded = false,
  showHeader = true,
  showHistory = true,
  setupOnly = false,
  onMutationComplete,
}: OpeningInventoryWorkspaceProps): React.JSX.Element {
  const eligibleInventory = inventory.filter((row) => row.eligible);
  const [selectedBatch, setSelectedBatch] = React.useState<InventoryOpeningBatchView | null>(null);

  return (
    <section className={`space-y-5 ${embedded ? "" : "pb-8"}`}>
      {showHeader ? (
        <header className="space-y-1 px-1">
          <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Fondasi inventory
          </p>
          <h2 className="text-[20px] font-bold tracking-tight text-on-surface">Saldo awal stok</h2>
          <p className="text-support text-on-surface-variant">
            Catat stok fisik yang sudah dimiliki sebelum aktivitas gudang berjalan di Atria.
          </p>
        </header>
      ) : null}

      {inventory.length > eligibleInventory.length ? (
        <MainSection
          title="Tidak dapat diberi saldo awal"
          count={inventory.length - eligibleInventory.length}
          countLabel="Inventory"
        >
          <GroupedSurface>
            <div className="divide-y divide-black/5.5">
              {inventory
                .filter((row) => !row.eligible)
                .slice(0, 5)
                .map((row) => (
                  <div
                    key={row.inventoryId}
                    className="flex min-h-14.5 items-center gap-3 px-4 py-3"
                  >
                    <AppIcon
                      name="lock"
                      className="flex! h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-[16px] text-on-surface-variant"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] leading-5 font-bold text-on-surface">
                        {row.materialName} · {row.locationName}
                      </span>
                      <span className="block text-eyebrow text-on-surface-variant">
                        {row.ineligibleReason}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </GroupedSurface>
        </MainSection>
      ) : null}

      {eligibleInventory.length === 0 ? (
        <GroupedSurface>
          <InlineStateRow
            icon="inventory_2"
            title="Belum ada inventory yang dapat diisi"
            description="Buat lokasi dan Material Master terlebih dahulu. Inventory yang pernah memiliki saldo, reservation, atau movement tidak dapat dimasukkan ulang."
            tone="warning"
          />
          {setupOnly ? (
            <p className="border-t border-black/5.5 px-4 py-3 text-meta text-on-surface-variant">
              Kembali ke tab Lokasi & Material pada onboarding untuk melengkapi prasyarat.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 border-t border-black/5.5 p-3">
              <Link
                href="/materials?action=LOCATION"
                className="flex min-h-12 items-center justify-center rounded-full bg-white px-3 text-[10px] font-bold text-on-surface ring-1 ring-ring-subtle"
              >
                Buat lokasi
              </Link>
              <Link
                href="/settings?tab=materials"
                className="flex min-h-12 items-center justify-center rounded-full bg-primary px-3 text-[10px] font-bold text-on-primary"
              >
                Material Master
              </Link>
            </div>
          )}
        </GroupedSurface>
      ) : (
        <OpeningInventoryEntryForm
          eligibleInventory={eligibleInventory}
          onMutationComplete={onMutationComplete}
        />
      )}

      <OpeningInventoryHistory show={showHistory} batches={batches} onSelect={setSelectedBatch} />
      <OpeningInventoryBatchDetailSheet
        selectedBatch={selectedBatch}
        setupOnly={setupOnly}
        onDismiss={() => setSelectedBatch(null)}
        onMutationComplete={onMutationComplete}
      />
    </section>
  );
}
