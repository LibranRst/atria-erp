"use client";

import { motion } from "framer-motion";
import type { InitialStockCandidate } from "@/app/actions/material/opening-inventory";
import {
  AppIcon,
  FormField,
  FormSection,
  MainSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  type SelectOption,
  AdaptiveSelect,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type { DraftLine } from "./opening-inventory-utils";

interface OpeningInventoryManualEntryProps {
  readonly eligibleInventory: readonly InitialStockCandidate[];
  readonly lines: readonly DraftLine[];
  readonly pending: boolean;
  readonly onAddLine: () => void;
  readonly onRemoveLine: (key: string) => void;
  readonly onPatchLine: (key: string, patch: Partial<DraftLine>) => void;
}

export function OpeningInventoryManualEntry({
  eligibleInventory,
  lines,
  pending,
  onAddLine,
  onRemoveLine,
  onPatchLine,
}: OpeningInventoryManualEntryProps): React.JSX.Element {
  const selectedInventoryCount = new Set(
    lines.map((line) => line.materialInventoryId).filter(Boolean),
  ).size;
  const canAddLine = lines.length < eligibleInventory.length;
  const allEligibleSelected = selectedInventoryCount === eligibleInventory.length;
  const duplicateIds = lines
    .map((line) => line.materialInventoryId)
    .filter((id, position, all) => Boolean(id) && all.indexOf(id) !== position);

  function inventoryOptionsForLine(lineKey: string): readonly SelectOption[] {
    const selectedByOtherLines = new Set(
      lines
        .filter((line) => line.key !== lineKey)
        .map((line) => line.materialInventoryId)
        .filter(Boolean),
    );

    return eligibleInventory.map((row) => ({
      value: row.inventoryId,
      label: row.materialName,
      description: row.locationName,
      meta: row.code ? `Kode ${row.code}` : `Satuan ${row.unit}`,
      disabled: selectedByOtherLines.has(row.inventoryId),
      disabledReason: selectedByOtherLines.has(row.inventoryId)
        ? "Sudah ditambahkan ke item lain dalam batch ini."
        : undefined,
    }));
  }

  return (
    <MainSection
      title="Daftar item stok fisik"
      meta={`${selectedInventoryCount} dari ${eligibleInventory.length} dipilih`}
      action={
        canAddLine ? (
          <motion.button
            type="button"
            whileTap={pending ? undefined : { scale: 0.96 }}
            transition={transitionSpringSnappy}
            onClick={onAddLine}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/8 px-3 text-meta font-bold text-primary transition-colors active:bg-primary/12 disabled:opacity-40"
          >
            <AppIcon name="add" className="icon-xs" />
            Tambah item
          </motion.button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {lines.map((line, index) => {
          const duplicate = duplicateIds.includes(line.materialInventoryId);
          const selectedInventory = eligibleInventory.find(
            (row) => row.inventoryId === line.materialInventoryId,
          );
          const subtotal = Number(line.quantity || 0) * Number(line.unitCost || 0);

          return (
            <FormSection
              key={line.key}
              title={`Item stok ${index + 1}`}
              helper={
                selectedInventory
                  ? `${selectedInventory.materialName} · ${selectedInventory.locationName}`
                  : "Pilih material dan lokasi, lalu isi hasil hitung fisik."
              }
              action={
                lines.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Hapus item stok ${index + 1}`}
                    onClick={() => onRemoveLine(line.key)}
                    className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-meta font-bold text-error transition-colors active:bg-error/10"
                  >
                    <AppIcon name="delete" className="icon-xs" />
                    Hapus
                  </button>
                ) : undefined
              }
            >
              <AdaptiveSelect
                label="Material & lokasi"
                value={line.materialInventoryId}
                onChange={(materialInventoryId) => onPatchLine(line.key, { materialInventoryId })}
                options={inventoryOptionsForLine(line.key)}
                placeholder="Pilih material dan lokasi"
                searchPlaceholder="Cari material atau lokasi..."
                error={duplicate ? "Material dan lokasi ini sudah dipilih." : undefined}
                disabled={pending}
                required
              />
              <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
                <FormField label="Jumlah fisik" required>
                  <NumericInput
                    value={line.quantity}
                    onChange={(quantity) => onPatchLine(line.key, { quantity })}
                    min={0}
                    placeholder="0"
                    suffix={selectedInventory?.unit}
                    disabled={pending}
                  />
                </FormField>
                <FormField label="Harga pokok unit" required>
                  <MoneyInput
                    value={line.unitCost}
                    onChange={(unitCost) => onPatchLine(line.key, { unitCost })}
                    placeholder="0"
                    showPreview={false}
                    disabled={pending}
                  />
                </FormField>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3 bg-surface-container-low/40 px-4 py-2.5">
                <span className="text-meta font-medium text-on-surface-variant">Subtotal item</span>
                <MoneyValue amount={subtotal} variant="fullDynamic" size="sm" align="right" />
              </div>
            </FormSection>
          );
        })}
      </div>

      {canAddLine ? (
        <motion.button
          type="button"
          whileTap={pending ? undefined : { scale: 0.97 }}
          transition={transitionSpringSnappy}
          onClick={onAddLine}
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-5 text-row font-bold text-on-surface shadow-xs ring-1 ring-ring-subtle transition-transform outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.98] disabled:opacity-40"
        >
          <AppIcon name="add" className="icon-md text-on-surface-variant" />
          Tambah item stok lainnya
        </motion.button>
      ) : allEligibleSelected ? (
        <p className="px-3 text-center text-meta text-on-surface-variant">
          Semua {eligibleInventory.length} inventory yang memenuhi syarat sudah dimasukkan.
        </p>
      ) : (
        <p className="px-3 text-center text-meta text-on-surface-variant">
          Pilih material dan lokasi pada baris yang tersedia sebelum menambah data lain.
        </p>
      )}
    </MainSection>
  );
}
