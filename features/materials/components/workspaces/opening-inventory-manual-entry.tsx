"use client";

import { motion } from "framer-motion";
import type { InitialStockCandidate } from "@/app/actions/material/opening-inventory";
import {
  AppIcon,
  FormField,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  type SelectOption,
  SheetSelect,
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
      title="Stok fisik"
      meta={`${selectedInventoryCount} dari ${eligibleInventory.length} dipilih`}
    >
      <GroupedSurface>
        <InlineStateRow
          icon="playlist_add"
          title="Satu pengajuan dapat memuat banyak item"
          description="Tambahkan setiap kombinasi material dan lokasi yang memiliki stok fisik sebelum Atria digunakan."
          tone="neutral"
        />
        <div className="border-t border-black/5.5 p-3">
          <motion.button
            type="button"
            whileTap={pending || !canAddLine ? undefined : { scale: 0.97 }}
            transition={transitionSpringSnappy}
            onClick={onAddLine}
            disabled={pending || !canAddLine}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent/8 px-5 text-xs font-bold text-accent outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:text-on-surface-variant disabled:opacity-55"
          >
            <AppIcon name="add" className="icon-md" />
            {canAddLine
              ? "Tambah baris item stok"
              : allEligibleSelected
                ? "Semua inventory sudah ditambahkan"
                : "Lengkapi baris item di bawah"}
          </motion.button>
        </div>
      </GroupedSurface>

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
                    className="min-h-12 rounded-full px-3 text-meta font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Hapus
                  </button>
                ) : undefined
              }
            >
              <SheetSelect
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
              <FormField label="Jumlah fisik" required>
                <NumericInput
                  value={line.quantity}
                  onChange={(quantity) => onPatchLine(line.key, { quantity })}
                  min={0}
                  placeholder="Contoh: 25"
                  suffix={selectedInventory?.unit}
                  disabled={pending}
                />
              </FormField>
              <FormField
                label="Harga pokok rata-rata"
                helper="Harga per unit berdasarkan catatan terakhir."
                required
              >
                <MoneyInput
                  value={line.unitCost}
                  onChange={(unitCost) => onPatchLine(line.key, { unitCost })}
                  placeholder="Contoh: 125000"
                  disabled={pending}
                />
              </FormField>
              <FormField
                label="Nilai awal item"
                helper="Jumlah fisik × harga pokok rata-rata."
                readOnly
              >
                <MoneyValue amount={subtotal} variant="compactWithFull" size="sm" align="right" />
              </FormField>
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
          className="min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold text-on-surface ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
        >
          Tambah item stok lainnya
        </motion.button>
      ) : allEligibleSelected ? (
        <p className="px-3 text-center text-meta text-on-surface-variant">
          Semua inventory yang memenuhi syarat sudah tersedia di batch ini.
        </p>
      ) : (
        <p className="px-3 text-center text-meta text-on-surface-variant">
          Pilih material dan lokasi pada baris yang tersedia sebelum menambah data lain.
        </p>
      )}
    </MainSection>
  );
}
