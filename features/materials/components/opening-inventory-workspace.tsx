"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  createInventoryOpening,
  previewInitialStockImport,
  reverseInventoryOpening,
  type InitialStockCandidate,
  type InitialStockImportPreview,
  type InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import { OperationalFormSheet } from "@/components/ui/guided-form";
import { useSheetPresenceValue } from "@/components/ui";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import {
  DatePickerField,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  NumericInput,
  SheetSelect,
  Textarea,
  TextInput,
  type SelectOption,
} from "@/components/ui/form-controls";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { MoneyValue } from "@/components/ui/page-primitives";
import { parseCsvTable } from "@/lib/import/csv";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  MaterialGroupSurface,
  MaterialInlineState,
  MaterialSection,
  MaterialStatusLabel,
  type MaterialTone,
} from "./material-page-primitives";

type DraftLine = {
  readonly key: string;
  readonly materialInventoryId: string;
  readonly quantity: string;
  readonly unitCost: string;
};
type Metadata = {
  readonly balanceDate: string;
  readonly referenceNumber: string;
  readonly note: string;
};
type EntryMode = "MANUAL" | "CSV";

const EMPTY_METADATA: Metadata = {
  balanceDate: "",
  referenceNumber: "",
  note: "",
};

function newLine(materialInventoryId = ""): DraftLine {
  return {
    key: crypto.randomUUID(),
    materialInventoryId,
    quantity: "",
    unitCost: "",
  };
}

function statusPresentation(status: string): {
  readonly label: string;
  readonly tone: MaterialTone;
} {
  if (status === "POSTED") return { label: "Sudah diposting", tone: "positive" };
  if (status === "PENDING_APPROVAL") return { label: "Menunggu persetujuan", tone: "pending" };
  if (status === "REJECTED") return { label: "Ditolak", tone: "critical" };
  if (status === "REVERSED") return { label: "Sudah dibalik", tone: "neutral" };
  return { label: formatBusinessLabel(status), tone: "neutral" };
}

function parseImportRows(source: string): {
  readonly rows: readonly {
    readonly rowNumber: number;
    readonly materialName: string;
    readonly materialCode: string;
    readonly locationName: string;
    readonly quantity: number;
    readonly unitCost: number;
  }[];
} {
  const table = parseCsvTable(source);
  const index = (name: string): number => table.headers.indexOf(name);
  const required = ["location_name", "quantity", "unit_cost"];
  const missing = required.filter((header) => index(header) < 0);
  if (missing.length > 0 || (index("material_name") < 0 && index("material_code") < 0)) {
    throw new Error(
      "Header wajib: material_name atau material_code, location_name, quantity, unit_cost.",
    );
  }
  return {
    rows: table.rows.map((row, rowIndex) => ({
      rowNumber: rowIndex + 2,
      materialName: index("material_name") >= 0 ? (row[index("material_name")] ?? "") : "",
      materialCode: index("material_code") >= 0 ? (row[index("material_code")] ?? "") : "",
      locationName: row[index("location_name")] ?? "",
      quantity: Number.isFinite(Number(row[index("quantity")] ?? 0))
        ? Number(row[index("quantity")] ?? 0)
        : 0,
      unitCost: Number.isFinite(Number(row[index("unit_cost")] ?? 0))
        ? Number(row[index("unit_cost")] ?? 0)
        : 0,
    })),
  };
}

function MetadataFields({
  value,
  pending,
  onChange,
}: {
  readonly value: Metadata;
  readonly pending: boolean;
  readonly onChange: (next: Metadata) => void;
}): React.JSX.Element {
  return (
    <FormSection
      title="Sumber saldo"
      helper="Tanggal dan catatan ini menjadi referensi persetujuan serta audit."
    >
      <DatePickerField
        label="Tanggal saldo awal"
        value={value.balanceDate}
        onChange={(balanceDate) => onChange({ ...value, balanceDate })}
        placeholder="Pilih tanggal posisi stok"
        disabled={pending}
        required
      />
      <FormField label="Dokumen referensi" optional>
        <TextInput
          value={value.referenceNumber}
          onChange={(referenceNumber) => onChange({ ...value, referenceNumber })}
          placeholder="Contoh: Stock opname 17 Juli 2026"
          disabled={pending}
        />
      </FormField>
      <FormField
        label="Catatan sumber data"
        helper="Minimal 10 karakter. Jelaskan sumber hitungan fisik."
        required
      >
        <Textarea
          value={value.note}
          onChange={(note) => onChange({ ...value, note })}
          placeholder="Contoh: Sesuai hasil hitung fisik Gudang Utama per 17 Juli 2026."
          disabled={pending}
          required
        />
      </FormField>
    </FormSection>
  );
}

export function OpeningInventoryWorkspace({
  inventory,
  batches,
  embedded = false,
  showHeader = true,
  showHistory = true,
  setupOnly = false,
  onMutationComplete,
}: {
  readonly inventory: readonly InitialStockCandidate[];
  readonly batches: readonly InventoryOpeningBatchView[];
  readonly embedded?: boolean;
  readonly showHeader?: boolean;
  readonly showHistory?: boolean;
  readonly setupOnly?: boolean;
  readonly onMutationComplete?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const eligible = inventory.filter((row) => row.eligible);
  const [mode, setMode] = React.useState<EntryMode>("MANUAL");
  const [metadata, setMetadata] = React.useState<Metadata>(EMPTY_METADATA);
  const [lines, setLines] = React.useState<readonly DraftLine[]>([newLine()]);
  const [preview, setPreview] = React.useState<InitialStockImportPreview | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [selectedBatch, setSelectedBatch] = React.useState<InventoryOpeningBatchView | null>(null);
  const [reversalMode, setReversalMode] = React.useState(false);
  const [reversalReason, setReversalReason] = React.useState("");
  const {
    presentedValue: presentedBatch,
    open: batchDetailOpen,
    handleExitComplete: handleBatchDetailExitComplete,
  } = useSheetPresenceValue(selectedBatch, selectedBatch?.id);
  const duplicateIds = lines
    .map((line) => line.materialInventoryId)
    .filter((id, position, all) => Boolean(id) && all.indexOf(id) !== position);
  const selectedInventoryCount = new Set(
    lines.map((line) => line.materialInventoryId).filter(Boolean),
  ).size;
  const canAddManualLine = lines.length < eligible.length;
  const allEligibleSelected = selectedInventoryCount === eligible.length;
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

  function downloadTemplate(): void {
    const content =
      "material_name,material_code,location_name,quantity,unit_cost\nMultipleks 18mm,PLY-18,Gudang Utama,10,250000\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-saldo-awal-stok.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

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
      if (result.data.errors.length > 0)
        toast.warning(`${result.data.errors.length} baris perlu diperbaiki.`);
      else toast.success(`${result.data.items.length} baris valid dan belum mengubah stok.`);
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

  function closeBatchDetail(): void {
    if (pending) return;
    setSelectedBatch(null);
    setReversalMode(false);
    setReversalReason("");
  }

  async function reverseSelectedBatch(): Promise<void> {
    if (!selectedBatch || !selectedBatch.canReverse || reversalReason.trim().length < 10) return;
    setPending(true);
    const result = await reverseInventoryOpening({
      batchId: selectedBatch.id,
      reason: reversalReason,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Saldo awal stok berhasil dibalik dan tercatat di audit log.");
    closeBatchDetail();
    router.refresh();
  }

  function inventoryOptionsForLine(lineKey: string): readonly SelectOption[] {
    const selectedByOtherLines = new Set(
      lines
        .filter((line) => line.key !== lineKey)
        .map((line) => line.materialInventoryId)
        .filter(Boolean),
    );
    return eligible.map((row) => ({
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
    <section className={`space-y-5 ${embedded ? "" : "pb-8"}`}>
      {showHeader ? (
        <header className="space-y-1 px-1">
          <p className="text-on-surface-variant text-[9px] font-bold tracking-[0.14em] uppercase">
            Fondasi inventory
          </p>
          <h2 className="text-on-surface text-[20px] font-bold tracking-tight">Saldo awal stok</h2>
          <p className="text-on-surface-variant text-[11px] leading-4">
            Catat stok fisik yang sudah dimiliki sebelum aktivitas gudang berjalan di Atria.
          </p>
        </header>
      ) : null}

      {inventory.length > eligible.length ? (
        <MaterialSection
          title="Tidak dapat diberi saldo awal"
          meta={`${inventory.length - eligible.length} inventory`}
        >
          <MaterialGroupSurface>
            <div className="divide-y divide-black/5.5">
              {inventory
                .filter((row) => !row.eligible)
                .slice(0, 5)
                .map((row) => (
                  <div
                    key={row.inventoryId}
                    className="flex min-h-[58px] items-center gap-3 px-4 py-3"
                  >
                    <span
                      className="material-symbols-outlined bg-surface-container-low text-on-surface-variant flex! h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px]"
                      aria-hidden="true"
                    >
                      lock
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-on-surface block truncate text-[11px] leading-5 font-bold">
                        {row.materialName} · {row.locationName}
                      </span>
                      <span className="text-on-surface-variant block text-[9px] leading-3">
                        {row.ineligibleReason}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </MaterialGroupSurface>
        </MaterialSection>
      ) : null}

      {eligible.length === 0 ? (
        <MaterialGroupSurface>
          <MaterialInlineState
            icon="inventory_2"
            title="Belum ada inventory yang dapat diisi"
            description="Buat lokasi dan Material Master terlebih dahulu. Inventory yang pernah memiliki saldo, reservation, atau movement tidak dapat dimasukkan ulang."
            tone="warning"
          />
          {setupOnly ? (
            <p className="text-on-surface-variant border-t border-black/5.5 px-4 py-3 text-[10px] leading-4">
              Kembali ke tab Lokasi & Material pada onboarding untuk melengkapi prasyarat.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 border-t border-black/5.5 p-3">
              <Link
                href="/materials?action=LOCATION"
                className="text-on-surface flex min-h-12 items-center justify-center rounded-full bg-white px-3 text-[10px] font-bold ring-1 ring-black/5.5"
              >
                Buat lokasi
              </Link>
              <Link
                href="/settings?tab=materials"
                className="bg-primary text-on-primary flex min-h-12 items-center justify-center rounded-full px-3 text-[10px] font-bold"
              >
                Material Master
              </Link>
            </div>
          )}
        </MaterialGroupSurface>
      ) : (
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
          <MetadataFields value={metadata} onChange={setMetadata} pending={pending} />

          {mode === "MANUAL" ? (
            <MaterialSection
              title="Stok fisik"
              meta={`${selectedInventoryCount} dari ${eligible.length} dipilih`}
            >
              <MaterialGroupSurface>
                <MaterialInlineState
                  icon="playlist_add"
                  title="Satu pengajuan dapat memuat banyak item"
                  description="Tambahkan setiap kombinasi material dan lokasi yang memiliki stok fisik sebelum Atria digunakan."
                  tone="neutral"
                />
                <div className="border-t border-black/5.5 p-3">
                  <motion.button
                    type="button"
                    whileTap={pending || !canAddManualLine ? undefined : { scale: 0.97 }}
                    transition={transitionSpringSnappy}
                    onClick={() => setLines((current) => [...current, newLine()])}
                    disabled={pending || !canAddManualLine}
                    className="disabled:text-on-surface-variant flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007AFF]/8 px-5 text-xs font-bold text-[#007AFF] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 disabled:opacity-55"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      add
                    </span>
                    {canAddManualLine
                      ? "Tambah baris item stok"
                      : allEligibleSelected
                        ? "Semua inventory sudah ditambahkan"
                        : "Lengkapi baris item di bawah"}
                  </motion.button>
                </div>
              </MaterialGroupSurface>
              <div className="space-y-3">
                {lines.map((line, index) => {
                  const duplicate = duplicateIds.includes(line.materialInventoryId);
                  const selectedInventory = eligible.find(
                    (row) => row.inventoryId === line.materialInventoryId,
                  );
                  const unit = selectedInventory?.unit;
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
                            onClick={() =>
                              setLines((current) => current.filter((item) => item.key !== line.key))
                            }
                            className="text-error focus-visible:ring-error/25 min-h-12 rounded-full px-3 text-[10px] font-bold outline-none focus-visible:ring-2"
                          >
                            Hapus
                          </button>
                        ) : undefined
                      }
                    >
                      <SheetSelect
                        label="Material & lokasi"
                        value={line.materialInventoryId}
                        onChange={(materialInventoryId) =>
                          patchLine(line.key, { materialInventoryId })
                        }
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
                          onChange={(quantity) => patchLine(line.key, { quantity })}
                          min={0}
                          placeholder="Contoh: 25"
                          suffix={unit}
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
                          onChange={(unitCost) => patchLine(line.key, { unitCost })}
                          placeholder="Contoh: 125000"
                          disabled={pending}
                        />
                      </FormField>
                      <FormField
                        label="Nilai awal item"
                        helper="Jumlah fisik × harga pokok rata-rata."
                        readOnly
                      >
                        <MoneyValue
                          amount={subtotal}
                          variant="compactWithFull"
                          size="sm"
                          align="right"
                        />
                      </FormField>
                    </FormSection>
                  );
                })}
              </div>
              {canAddManualLine ? (
                <motion.button
                  type="button"
                  whileTap={pending ? undefined : { scale: 0.97 }}
                  transition={transitionSpringSnappy}
                  onClick={() => setLines((current) => [...current, newLine()])}
                  disabled={pending}
                  className="text-on-surface min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold ring-1 ring-black/5.5 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 disabled:opacity-40"
                >
                  Tambah item stok lainnya
                </motion.button>
              ) : allEligibleSelected ? (
                <p className="text-on-surface-variant px-3 text-center text-[10px] leading-4">
                  Semua inventory yang memenuhi syarat sudah tersedia di batch ini.
                </p>
              ) : (
                <p className="text-on-surface-variant px-3 text-center text-[10px] leading-4">
                  Pilih material dan lokasi pada baris yang tersedia sebelum menambah data lain.
                </p>
              )}
            </MaterialSection>
          ) : (
            <section className="space-y-3">
              <div className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-black/4">
                <p className="text-on-surface text-[13px] font-bold">Upload CSV saldo stok</p>
                <p className="text-on-surface-variant mt-1 text-[10px] leading-4">
                  Header: material_name atau material_code, location_name, quantity, unit_cost.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-3 min-h-12 rounded-full px-3 text-[10px] font-bold text-[#007AFF]"
                >
                  Unduh template CSV
                </button>
                <label className="bg-surface-container-low text-on-surface mt-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-xs font-bold ring-1 ring-black/4">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    upload_file
                  </span>
                  {fileName || "Pilih file CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    disabled={pending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void readCsv(file);
                    }}
                  />
                </label>
              </div>
              {preview ? (
                <MaterialGroupSurface>
                  <div className="divide-y divide-black/5.5">
                    {preview.items.map((item) => (
                      <div
                        key={`${item.rowNumber}-${item.materialInventoryId}`}
                        className="flex min-h-[64px] items-center gap-3 px-4 py-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
                          {item.rowNumber}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-on-surface block truncate text-[12px] font-bold">
                            {item.materialName}
                          </span>
                          <span className="text-on-surface-variant mt-0.5 block text-[10px]">
                            {item.locationName} · {item.quantity.toLocaleString("id-ID")}
                          </span>
                        </span>
                        <MoneyValue
                          amount={item.quantity * item.unitCost}
                          variant="compactWithFull"
                          size="sm"
                          align="right"
                        />
                      </div>
                    ))}
                    {preview.errors.map((error) => (
                      <div
                        key={`${error.rowNumber}-${error.message}`}
                        className="bg-error/[0.035] flex min-h-[58px] items-center gap-3 px-4 py-3"
                      >
                        <span className="bg-error/10 text-error flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                          {error.rowNumber}
                        </span>
                        <p className="text-error text-[10px] leading-4">{error.message}</p>
                      </div>
                    ))}
                  </div>
                </MaterialGroupSurface>
              ) : null}
            </section>
          )}

          <MaterialGroupSurface>
            <div className="divide-y divide-black/5.5">
              <div className="flex min-h-[76px] items-center gap-3 px-4 py-3.5">
                <span
                  className="bg-primary/8 text-primary ring-primary/6 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] ring-1"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-on-surface block text-[12px] leading-4 font-bold">
                    Total saldo awal
                  </span>
                  <span className="text-on-surface-variant mt-0.5 block text-[10px] leading-4">
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
              <div className="flex min-h-[64px] items-start gap-3 px-4 py-3.5">
                <span
                  className="material-symbols-outlined text-on-surface-variant/65 mt-0.5 shrink-0 text-[18px]"
                  aria-hidden="true"
                >
                  info
                </span>
                <span className="min-w-0">
                  <span className="text-on-surface block text-[11px] leading-4 font-semibold">
                    Belum ada mutasi yang diposting
                  </span>
                  <span className="text-on-surface-variant mt-0.5 block text-[10px] leading-4">
                    Stok, kas, utang vendor, dan biaya aktual proyek tetap sama sampai pengajuan
                    disetujui.
                  </span>
                </span>
              </div>
            </div>
          </MaterialGroupSurface>
          <FormRiskNotice title="Memerlukan pemeriksa terpisah">
            Finance Admin atau pemeriksa lain yang berwenang perlu memutus batch ini. Pembuat batch
            tidak dapat menyetujui pengajuannya sendiri.
          </FormRiskNotice>
          {!formComplete && submitDisabledReason ? (
            <p className="bg-warning/8 text-on-surface-variant ring-warning/8 flex min-h-12 items-center gap-2 rounded-[18px] px-3.5 py-2.5 text-[10px] leading-4 ring-1">
              <span
                className="material-symbols-outlined text-warning shrink-0 text-[17px]"
                aria-hidden="true"
              >
                info
              </span>
              {submitDisabledReason}
            </p>
          ) : null}
          <motion.button
            type="submit"
            whileTap={pending || !formComplete ? undefined : { scale: 0.97 }}
            transition={transitionSpringSnappy}
            disabled={pending || !formComplete}
            className="bg-primary text-on-primary min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-40"
          >
            {pending ? "Mengajukan…" : "Ajukan saldo awal"}
          </motion.button>
        </form>
      )}

      {showHistory ? (
        <MaterialSection title="Riwayat saldo awal" meta={`${batches.length} batch`}>
          <MaterialGroupSurface>
            {batches.length === 0 ? (
              <MaterialInlineState
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
                      onClick={() => setSelectedBatch(batch)}
                      className="active:bg-surface-container-low focus-visible:bg-surface-container-low flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left outline-none"
                    >
                      <span
                        className="material-symbols-outlined bg-surface-container-low text-primary flex! h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[20px]"
                        aria-hidden="true"
                      >
                        inventory
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-on-surface block truncate text-[12px] font-bold">
                          {batch.batchNumber}
                        </span>
                        <span className="text-on-surface-variant mt-0.5 block text-[10px]">
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
                      <MoneyValue
                        amount={batch.totalValue}
                        variant="compactWithFull"
                        size="sm"
                        align="right"
                      />
                      <span
                        className="material-symbols-outlined text-on-surface-variant/60 shrink-0 text-[18px]"
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </MaterialGroupSurface>
        </MaterialSection>
      ) : null}

      <OperationalFormSheet
        open={batchDetailOpen}
        title={
          reversalMode
            ? "Konfirmasi pembalikan"
            : (presentedBatch?.batchNumber ?? "Detail saldo awal")
        }
        submitLabel="Balik"
        submittingLabel="Membalik…"
        pending={pending}
        danger
        hideSubmit={!reversalMode}
        disabled={reversalReason.trim().length < 10}
        disabledReason={
          reversalMode && reversalReason.trim().length < 10
            ? "Alasan audit minimal 10 karakter."
            : undefined
        }
        onClose={closeBatchDetail}
        onExitComplete={handleBatchDetailExitComplete}
        onSubmit={() => void reverseSelectedBatch()}
      >
        {presentedBatch ? (
          <div className="space-y-4 pb-1">
            <div className="flex items-center gap-3 px-1">
              <span
                className="material-symbols-outlined bg-surface-container-low text-primary flex! h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[20px]"
                aria-hidden="true"
              >
                inventory
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-on-surface block truncate text-[14px] leading-5 font-bold">
                  Saldo awal stok
                </span>
                <span className="text-on-surface-variant mt-0.5 block truncate text-[10px] leading-4">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "long",
                  }).format(new Date(presentedBatch.cutoverDate))}
                </span>
              </span>
              <MaterialStatusLabel
                label={statusPresentation(presentedBatch.status).label}
                tone={statusPresentation(presentedBatch.status).tone}
              />
            </div>

            <OpeningDetailSection title="Ringkasan batch">
              <div className="divide-outline-variant/15 divide-y px-3">
                <OpeningDetailRow label="Nomor batch" value={presentedBatch.batchNumber} />
                <OpeningDetailRow label="Jumlah item" value={`${presentedBatch.itemCount} item`} />
                <OpeningDetailRow
                  label="Nilai inventory"
                  value={
                    <MoneyValue
                      amount={presentedBatch.totalValue}
                      variant="compactWithFull"
                      size="sm"
                      align="right"
                    />
                  }
                />
              </div>
            </OpeningDetailSection>

            <OpeningDetailSection title="Item stok awal">
              {presentedBatch.items.length > 0 ? (
                <div className="divide-outline-variant/15 divide-y px-3">
                  {presentedBatch.items.map((item) => (
                    <OpeningBatchItemRow key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <MaterialInlineState
                  icon="inventory_2"
                  title="Rincian item tidak tersedia"
                  description="Batch tidak memiliki item saldo awal yang dapat ditampilkan."
                  tone="warning"
                />
              )}
            </OpeningDetailSection>

            <OpeningDetailSection title="Sumber & audit">
              <div className="divide-outline-variant/15 divide-y px-3">
                <OpeningDetailRow
                  label="Dokumen"
                  value={presentedBatch.referenceNumber || "Tidak ada"}
                />
                <OpeningDetailRow label="Diajukan oleh" value={presentedBatch.requestedByName} />
                {presentedBatch.approvedByName ? (
                  <OpeningDetailRow
                    label={
                      presentedBatch.status === "REJECTED" ? "Diputuskan oleh" : "Disetujui oleh"
                    }
                    value={presentedBatch.approvedByName}
                  />
                ) : null}
                {presentedBatch.reversedByName ? (
                  <OpeningDetailRow label="Dibalik oleh" value={presentedBatch.reversedByName} />
                ) : null}
                <div className="py-3.5">
                  <p className="text-on-surface-variant text-[10px] font-medium">Catatan sumber</p>
                  <p className="text-on-surface mt-1.5 text-[12px] leading-5 font-semibold whitespace-pre-wrap">
                    {presentedBatch.note}
                  </p>
                </div>
              </div>
            </OpeningDetailSection>

            {reversalMode ? (
              <>
                <FormRiskNotice title="Pastikan belum ada movement berikutnya" tone="danger">
                  Pembalikan hanya berhasil jika saldo, reservation, dan urutan pergerakan stok
                  masih persis seperti saat saldo awal diposting.
                </FormRiskNotice>
                <FormSection
                  title="Alasan audit"
                  helper="Alasan disimpan bersama movement pembalikan dan audit log."
                >
                  <FormField label="Alasan pembalikan" required>
                    <Textarea
                      value={reversalReason}
                      onChange={setReversalReason}
                      placeholder="Contoh: Saldo awal salah lokasi dan belum ada transaksi stok lanjutan."
                      disabled={pending}
                      required
                    />
                  </FormField>
                </FormSection>
              </>
            ) : (
              <OpeningBatchStateNotice
                batch={presentedBatch}
                reversalAvailable={presentedBatch.canReverse && !setupOnly}
              />
            )}

            {!reversalMode && presentedBatch.canReverse && !setupOnly ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setReversalMode(true)}
                className="bg-error/10 text-error focus-visible:ring-error/30 min-h-12 w-full rounded-full px-5 text-xs font-bold outline-none focus-visible:ring-2"
              >
                Balik saldo awal
              </motion.button>
            ) : null}
          </div>
        ) : null}
      </OperationalFormSheet>
    </section>
  );
}

function OpeningDetailSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-on-surface-variant px-1 text-[12px] font-bold tracking-wide uppercase">
        {title}
      </h3>
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-black/[0.035]">
        {children}
      </div>
    </section>
  );
}

function OpeningDetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 py-3.5 text-xs">
      <span className="text-on-surface-variant shrink-0 font-medium">{label}</span>
      <span className="text-on-surface min-w-0 text-right font-bold">{value}</span>
    </div>
  );
}

function OpeningBatchItemRow({
  item,
}: {
  readonly item: InventoryOpeningBatchView["items"][number];
}): React.JSX.Element {
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-3 py-3">
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-on-surface truncate text-[13px] leading-4 font-bold">
          {item.materialName}
        </p>
        <p className="text-on-surface-variant truncate text-[10px] leading-[1.3]">
          {item.locationName} · {formatOpeningQuantity(item.quantity)} {item.unit}
        </p>
      </div>
      <div className="max-w-[46%] shrink-0 text-right">
        <MoneyValue amount={item.totalValue} variant="compactWithFull" align="right" size="sm" />
        <p className="text-on-surface-variant mt-1 truncate text-[9px] tabular-nums">
          @ Rp {item.unitCost.toLocaleString("id-ID")}/{item.unit}
        </p>
      </div>
    </div>
  );
}

function OpeningBatchStateNotice({
  batch,
  reversalAvailable,
}: {
  readonly batch: InventoryOpeningBatchView;
  readonly reversalAvailable: boolean;
}): React.JSX.Element {
  if (batch.status === "PENDING_APPROVAL") {
    return (
      <FormRiskNotice title="Menunggu persetujuan" tone="warning">
        Stok belum berubah. Buka Approval Center menggunakan Finance Admin atau Owner lain untuk
        meninjau batch ini.
      </FormRiskNotice>
    );
  }
  if (batch.status === "REJECTED") {
    return (
      <FormRiskNotice title="Pengajuan ditolak" tone="warning">
        {batch.rejectedReason ||
          "Batch ditolak tanpa alasan tambahan. Tidak ada stok yang berubah."}
      </FormRiskNotice>
    );
  }
  if (batch.status === "REVERSED") {
    return (
      <FormRiskNotice title="Saldo awal sudah dibalik">
        {batch.reversalReason ||
          "Nilai pembukaan telah dikembalikan ke nol dan tercatat pada audit log."}
      </FormRiskNotice>
    );
  }
  if (batch.status === "POSTED") {
    return (
      <FormRiskNotice title={reversalAvailable ? "Sudah masuk inventory" : "Sudah diposting"}>
        {reversalAvailable
          ? "Stok dan average cost sudah diperbarui. Pembalikan tetap ditolak jika ada movement lanjutan."
          : "Stok dan average cost sudah diperbarui. Pembalikan hanya tersedia untuk Owner dan tetap diperiksa ulang oleh server."}
      </FormRiskNotice>
    );
  }
  return (
    <FormRiskNotice title="Status batch">
      Status operasional batch ini adalah {formatBusinessLabel(batch.status)}.
    </FormRiskNotice>
  );
}

function formatOpeningQuantity(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
