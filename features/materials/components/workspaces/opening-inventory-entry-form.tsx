"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import {
  createInventoryOpening,
  previewInitialStockImport,
  type InitialStockCandidate,
  type InitialStockImportPreview,
} from "@/app/actions/material/opening-inventory";
import { FormRiskNotice } from "@/components/ui/form/form-controls";
import { GroupedSurface } from "@/components/ui/feedback/main-surface";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { OpeningInventoryCsvEntry } from "./opening-inventory-csv-entry";
import { OpeningInventoryManualEntry } from "./opening-inventory-manual-entry";
import { OpeningInventoryMetadataFields } from "./opening-inventory-metadata-fields";
import {
  EMPTY_METADATA,
  newLine,
  parseImportRows,
  type DraftLine,
  type EntryMode,
  type Metadata,
} from "./opening-inventory-utils";

interface OpeningInventoryEntryFormProps {
  readonly eligibleInventory: readonly InitialStockCandidate[];
  readonly onMutationComplete?: () => void;
}

export function OpeningInventoryEntryForm({
  eligibleInventory,
  onMutationComplete,
}: OpeningInventoryEntryFormProps): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<EntryMode>("MANUAL");
  const [metadata, setMetadata] = React.useState<Metadata>(EMPTY_METADATA);
  const [lines, setLines] = React.useState<readonly DraftLine[]>([newLine()]);
  const [preview, setPreview] = React.useState<InitialStockImportPreview | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const duplicateIds = lines
    .map((line) => line.materialInventoryId)
    .filter((id, position, all) => Boolean(id) && all.indexOf(id) !== position);
  const manualItems = lines.map((line) => ({
    materialInventoryId: line.materialInventoryId,
    quantity: Number(line.quantity),
    unitCost: Number(line.unitCost),
  }));
  const submittedItems =
    mode === "CSV"
      ? (preview?.items.map((item) => ({
          materialInventoryId: item.materialInventoryId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })) ?? [])
      : manualItems;
  const total = submittedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const formComplete =
    Boolean(metadata.balanceDate) &&
    metadata.note.trim().length >= 10 &&
    submittedItems.length > 0 &&
    submittedItems.every(
      (item) => Boolean(item.materialInventoryId) && item.quantity > 0 && item.unitCost > 0,
    ) &&
    duplicateIds.length === 0 &&
    (mode === "MANUAL" || preview?.errors.length === 0);
  const submitDisabledReason = !metadata.balanceDate
    ? "Pilih tanggal saldo awal."
    : metadata.note.trim().length < 10
      ? "Isi catatan sumber data minimal 10 karakter."
      : submittedItems.length === 0
        ? mode === "CSV"
          ? "Upload dan validasi file CSV terlebih dahulu."
          : "Tambahkan minimal satu item stok fisik."
        : submittedItems.some((item) => !item.materialInventoryId)
          ? "Pilih material dan lokasi untuk setiap item."
          : submittedItems.some((item) => item.quantity <= 0)
            ? "Jumlah fisik setiap item harus lebih besar dari 0."
            : submittedItems.some((item) => item.unitCost <= 0)
              ? "Harga pokok setiap item harus lebih besar dari Rp0."
              : duplicateIds.length > 0
                ? "Hapus pilihan material dan lokasi yang duplikat."
                : mode === "CSV" && (preview?.errors.length ?? 0) > 0
                  ? "Perbaiki seluruh baris CSV yang masih bermasalah."
                  : undefined;

  function patchLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function readCsv(file: File): Promise<void> {
    setFileName(file.name);
    setPreview(null);

    try {
      const parsed = parseImportRows(await file.text());
      setPending(true);
      const result = await previewInitialStockImport(parsed);
      setPending(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      setPreview(result.data);
      if (result.data.errors.length > 0) {
        toast.warning(`${result.data.errors.length} baris perlu diperbaiki.`);
      } else {
        toast.success(`${result.data.items.length} baris valid dan belum mengubah stok.`);
      }
    } catch (error) {
      setPending(false);
      toast.error(error instanceof Error ? error.message : "CSV tidak dapat dibaca.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!formComplete) return;

    setPending(true);
    const result = await createInventoryOpening({
      cutoverDate: new Date(`${metadata.balanceDate}T00:00:00`),
      note: metadata.note,
      referenceNumber: metadata.referenceNumber,
      items: submittedItems,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Saldo awal stok diajukan. Stok belum berubah sampai disetujui.");
    setMetadata(EMPTY_METADATA);
    setLines([newLine()]);
    setPreview(null);
    setFileName("");
    onMutationComplete?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SegmentedTabs<EntryMode>
        value={mode}
        onChange={(next) => {
          setMode(next);
          setPreview(null);
        }}
        ariaLabel="Cara memasukkan saldo awal stok"
        options={[
          { value: "MANUAL", label: "Isi manual" },
          { value: "CSV", label: "Import CSV" },
        ]}
      />
      <OpeningInventoryMetadataFields value={metadata} onChange={setMetadata} pending={pending} />

      {mode === "MANUAL" ? (
        <OpeningInventoryManualEntry
          eligibleInventory={eligibleInventory}
          lines={lines}
          pending={pending}
          onAddLine={() => setLines((current) => [...current, newLine()])}
          onRemoveLine={(key) => setLines((current) => current.filter((item) => item.key !== key))}
          onPatchLine={patchLine}
        />
      ) : (
        <OpeningInventoryCsvEntry
          preview={preview}
          fileName={fileName}
          pending={pending}
          onFileSelected={readCsv}
        />
      )}

      <GroupedSurface>
        <div className="divide-y divide-black/5.5">
          <div className="flex min-h-19 items-center gap-3 px-4 py-3.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-primary/8 text-primary ring-1 ring-primary/6"
              aria-hidden="true"
            >
              <AppIcon name="inventory_2" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-4 font-bold text-on-surface">
                Total saldo awal
              </span>
              <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                {submittedItems.length} item siap diajukan
              </span>
            </span>
            <MoneyValue
              amount={total}
              variant="compactWithFull"
              size="md"
              align="right"
              className="shrink-0"
            />
          </div>
          <div className="flex min-h-16 items-start gap-3 px-4 py-3.5">
            <AppIcon
              name="info"
              className="mt-0.5 shrink-0 text-[18px] text-on-surface-variant/65"
            />
            <span className="min-w-0">
              <span className="block text-[11px] leading-4 font-semibold text-on-surface">
                Belum ada mutasi yang diposting
              </span>
              <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                Stok, kas, utang vendor, dan biaya aktual proyek tetap sama sampai pengajuan
                disetujui.
              </span>
            </span>
          </div>
        </div>
      </GroupedSurface>

      <FormRiskNotice title="Memerlukan pemeriksa terpisah">
        Finance Admin atau pemeriksa lain yang berwenang perlu memutus batch ini. Pembuat batch
        tidak dapat menyetujui pengajuannya sendiri.
      </FormRiskNotice>
      {!formComplete && submitDisabledReason ? (
        <p className="flex min-h-12 items-center gap-2 rounded-[18px] bg-warning/8 px-3.5 py-2.5 text-[10px] leading-4 text-on-surface-variant ring-1 ring-warning/8">
          <AppIcon name="info" className="shrink-0 text-[17px] text-warning" />
          {submitDisabledReason}
        </p>
      ) : null}
      <motion.button
        type="submit"
        whileTap={pending || !formComplete ? undefined : { scale: 0.97 }}
        transition={transitionSpringSnappy}
        disabled={pending || !formComplete}
        className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-40"
      >
        {pending ? "Mengajukan…" : "Ajukan saldo awal"}
      </motion.button>
    </form>
  );
}
