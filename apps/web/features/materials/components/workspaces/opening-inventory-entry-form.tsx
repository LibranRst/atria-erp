"use client";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { toast } from "sonner";
import {
  createInventoryOpening,
  previewInitialStockImport,
  type InitialStockCandidate,
  type InitialStockImportPreview,
} from "@/app/actions/material/opening-inventory";
import {
  AppIcon,
  ConfirmationDialog,
  DuotoneIconTile,
  FactRow,
  GroupedSurface,
  MoneyValue,
  OperationalFormSheet,
  SegmentedTabs,
  SheetFooterActions,
  Button,
} from "@/components/ui";
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
  readonly presentation?: "page" | "sheet";
  readonly open?: boolean;
  readonly onClose?: () => void;
}

export function OpeningInventoryEntryForm({
  eligibleInventory,
  onMutationComplete,
  presentation = "page",
  open = false,
  onClose,
}: OpeningInventoryEntryFormProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const router = useRouter();
  const [mode, setMode] = React.useState<EntryMode>("MANUAL");
  const [metadata, setMetadata] = React.useState<Metadata>(EMPTY_METADATA);
  const [lines, setLines] = React.useState<readonly DraftLine[]>([newLine()]);
  const [preview, setPreview] = React.useState<InitialStockImportPreview | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

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
  const dirty =
    mode !== "MANUAL" ||
    metadata.balanceDate !== EMPTY_METADATA.balanceDate ||
    metadata.referenceNumber !== EMPTY_METADATA.referenceNumber ||
    metadata.note !== EMPTY_METADATA.note ||
    fileName.length > 0 ||
    preview !== null ||
    lines.length > 1 ||
    lines.some(
      (line) =>
        line.materialInventoryId.length > 0 || line.quantity.length > 0 || line.unitCost.length > 0,
    );

  function resetForm(): void {
    setMode("MANUAL");
    setMetadata(EMPTY_METADATA);
    setLines([newLine()]);
    setPreview(null);
    setFileName("");
  }

  function requestClose(): void {
    if (pending || !onClose) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
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
    resetForm();
    onMutationComplete?.();
    router.refresh();
  }

  const content = (
    <>
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

      <GroupedSurface className={presentation === "sheet" && desktop ? "hidden" : ""}>
        <div className="divide-y divide-outline-variant/20">
          <div className="flex min-h-16 items-center gap-3.5 px-4 py-3.5">
            <DuotoneIconTile name="inventory_2" tone="accent" />
            <div className="min-w-0 flex-1">
              <p className="text-row font-bold text-on-surface">Total saldo awal</p>
              <p className="mt-0.5 text-meta text-on-surface-variant">
                {submittedItems.length} item siap diajukan
              </p>
            </div>
            <MoneyValue
              amount={total}
              variant="fullDynamic"
              size="md"
              align="right"
              className="shrink-0 font-bold"
            />
          </div>
          <div className="flex items-center gap-2.5 bg-surface-container-low/40 px-4 py-3 text-meta text-on-surface-variant">
            <AppIcon name="shield" className="icon-sm shrink-0 text-on-surface-variant/70" />
            <p className="min-w-0 flex-1">
              Perlu persetujuan Finance Admin · Kas & stok fisik belum aktif sampai disetujui.
            </p>
          </div>
        </div>
      </GroupedSurface>
    </>
  );

  if (presentation === "sheet") {
    return (
      <>
        <OperationalFormSheet
          desktopSize="wide"
          desktopFooterPlacement="aside"
          desktopAsideSummary={
            <div className="space-y-4">
              <GroupedSurface>
                <div className="divide-y divide-outline-variant/20">
                  <FactRow
                    layout="stacked"
                    label="Cara pengisian"
                    wrapLabel
                    value={mode === "CSV" ? "Import CSV" : "Isi manual"}
                  />
                  <FactRow
                    layout="stacked"
                    label="Tanggal saldo awal"
                    wrapLabel
                    value={metadata.balanceDate || "Belum dipilih"}
                  />
                  <FactRow
                    layout="stacked"
                    label="Dokumen sumber"
                    wrapLabel
                    value={metadata.referenceNumber || "Tidak ada"}
                  />
                  {mode === "CSV" ? (
                    <FactRow
                      layout="stacked"
                      label="File"
                      wrapLabel
                      value={fileName || "Belum dipilih"}
                    />
                  ) : null}
                  <FactRow
                    layout="stacked"
                    label="Baris draft"
                    wrapLabel
                    value={submittedItems.length}
                  />
                  <FactRow
                    layout="stacked"
                    label="Nilai draft"
                    wrapLabel
                    value={
                      Number.isFinite(total) ? (
                        <MoneyValue
                          fractionDigits={Number.isInteger(total) ? 0 : 2}
                          amount={total}
                          variant="fullDynamic"
                          size="sm"
                        />
                      ) : (
                        "Periksa jumlah dan harga"
                      )
                    }
                  />
                  {mode === "CSV" ? (
                    <FactRow
                      layout="stacked"
                      label="Validasi CSV"
                      wrapLabel
                      value={
                        preview
                          ? `${preview.errors.length} baris perlu diperbaiki`
                          : "Belum divalidasi"
                      }
                    />
                  ) : null}
                </div>
              </GroupedSurface>
              <p className="text-support leading-relaxed text-on-surface-variant">
                Saldo awal diajukan untuk persetujuan. Kas dan stok fisik belum berubah sampai
                disetujui.
              </p>
            </div>
          }
          dismissal={{ mode: "managed" }}
          open={open}
          title="Catat saldo awal stok"
          formId="onboarding-opening-inventory-form"
          submitLabel="Ajukan saldo awal"
          submittingLabel="Mengajukan…"
          pending={pending}
          disabled={!formComplete}
          disabledReason={submitDisabledReason}
          statusText={
            desktop
              ? undefined
              : `${submittedItems.length} item · Rp ${total.toLocaleString("id-ID")} · Perlu persetujuan`
          }
          statusTone={formComplete ? "success" : "default"}
          onClose={requestClose}
        >
          <form id="onboarding-opening-inventory-form" onSubmit={submit} className="space-y-4">
            {content}
          </form>
        </OperationalFormSheet>

        <ConfirmationDialog
          open={confirmDiscard}
          title="Buang isian saldo awal?"
          description="Item, tanggal, dan catatan yang belum diajukan akan hilang."
          tone="warning"
          pending={pending}
          onClose={() => setConfirmDiscard(false)}
          actions={
            <SheetFooterActions
              secondary={{ label: "Lanjut isi", onClick: () => setConfirmDiscard(false) }}
              primary={{
                label: "Buang isian",
                variant: "critical",
                onClick: () => {
                  setConfirmDiscard(false);
                  resetForm();
                  onClose?.();
                },
              }}
            />
          }
        />
      </>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {content}

      {!formComplete && submitDisabledReason ? (
        <div className="flex items-center gap-2 rounded-2xl bg-warning/8 px-3.5 py-2.5 text-meta text-on-surface-variant ring-1 ring-warning/12">
          <AppIcon name="info" className="icon-sm shrink-0 text-warning" />
          <span className="min-w-0 flex-1">{submitDisabledReason}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !formComplete}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-row font-bold text-on-primary shadow-primary active:z-10 active:shadow-raised disabled:cursor-not-allowed disabled:opacity-40"
        variant="primary"
      >
        {pending ? (
          <>
            <AppIcon name="progress_activity" className="icon-sm animate-spin" />
            <span>Mengajukan saldo awal…</span>
          </>
        ) : (
          <span>Ajukan saldo awal</span>
        )}
      </Button>
    </form>
  );
}
