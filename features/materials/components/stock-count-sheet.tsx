"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  FormField,
  FormRiskNotice,
  FormSection,
  QuantityStepper,
  SheetSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { MaterialUnsavedChangesModal } from "@/features/materials/components/material-form-patterns";
import type { SelectOption } from "@/features/materials/components/material-operation-dialog-types";
import {
  formatMaterialQuantity,
  summarizeStockCountVariance,
} from "@/features/materials/lib/material-ui-utils";

type StockCountSheetProps = {
  readonly open: boolean;
  readonly pending: boolean;
  readonly inventory: MaterialOperationsDashboard["inventory"];
  readonly existingDrafts: MaterialOperationsDashboard["counts"];
  readonly stockCountId: string | null;
  readonly locationOptions: readonly SelectOption[];
  readonly documentNumber: string;
  readonly note: string;
  readonly locationId: string;
  readonly counted: Record<string, string>;
  readonly onDocumentNumberChange: (value: string) => void;
  readonly onNoteChange: (value: string) => void;
  readonly onLocationChange: (value: string) => void;
  readonly onCountedChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  readonly onLoadDraft: (draftId: string) => void;
  readonly onClose: () => void;
  readonly onSaveDraft: () => void;
  readonly onSubmit: () => void;
};

export function StockCountSheet({
  open,
  pending,
  inventory,
  existingDrafts,
  stockCountId,
  locationOptions,
  documentNumber,
  note,
  locationId,
  counted,
  onDocumentNumberChange,
  onNoteChange,
  onLocationChange,
  onCountedChange,
  onLoadDraft,
  onClose,
  onSaveDraft,
  onSubmit,
}: StockCountSheetProps): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const locationInventory = inventory.filter((row) => row.locationId === locationId);
  const rows = locationInventory.map((row) => {
    const countedQuantity = Number(counted[row.materialId] ?? row.currentStock);
    return {
      ...row,
      countedQuantity,
      variance: countedQuantity - row.currentStock,
    };
  });
  const valid = Boolean(
    locationId &&
    documentNumber.trim().length >= 3 &&
    rows.length > 0 &&
    rows.every(
      (row) => Number.isFinite(row.countedQuantity) && row.countedQuantity >= row.reservedStock,
    ),
  );
  const changedRows = rows.filter((row) => row.variance !== 0);
  const varianceSummary = summarizeStockCountVariance(
    rows.map((row) => ({
      systemQuantity: row.currentStock,
      countedQuantity: row.countedQuantity,
      unitCost: row.averageCost,
    })),
  );
  const totalVarianceValue = varianceSummary.totalValue;
  const disabledReason = !locationId
    ? "Pilih lokasi yang akan dihitung."
    : documentNumber.trim().length < 3
      ? "Nomor dokumen minimal 3 karakter."
      : rows.length === 0
        ? "Tidak ada material aktif di lokasi ini."
        : rows.some((row) => row.countedQuantity < row.reservedStock)
          ? "Jumlah fisik tidak boleh lebih kecil dari stok yang sudah direservasi."
          : undefined;

  return (
    <>
      <WorkflowFormSheet
        open={open}
        title={
          reviewing
            ? "Tinjau Stock Opname"
            : stockCountId
              ? "Lanjutkan Draft Opname"
              : "Stock Opname"
        }
        onClose={() =>
          reviewing ? setReviewing(false) : locationId ? setConfirmClose(true) : onClose()
        }
        primaryLabel={reviewing ? "Kirim" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : "Draft"}
        pendingLabel={reviewing ? "Mengirim…" : "Menyimpan…"}
        pending={pending}
        disabled={!valid}
        secondaryDisabled={!valid && !reviewing}
        disabledReason={disabledReason}
        onPrimary={() => {
          if (reviewing) {
            setReviewing(false);
            onSubmit();
          } else setReviewing(true);
        }}
        onSecondary={() => (reviewing ? setReviewing(false) : onSaveDraft())}
      >
        {reviewing ? (
          <div className="space-y-md">
            <FormSection
              title="Tinjau hasil opname"
              helper="Periksa nomor dokumen dan dampak selisih sebelum mengirim."
            >
              <ReviewFact label="Nomor dokumen" value={documentNumber} />
              <ReviewFact
                label="Lokasi"
                value={locationOptions.find((o) => o.value === locationId)?.label ?? "–"}
              />
              <ReviewFact label="Material berubah" value={`${varianceSummary.changedCount} item`} />
              <ReviewFact
                label="Dampak nilai"
                value={
                  <span className={totalVarianceValue < 0 ? "text-error" : "text-primary"}>
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(totalVarianceValue)}
                  </span>
                }
              />
              {note.trim() && <ReviewFact label="Catatan audit" value={note} />}
            </FormSection>

            {changedRows.length === 0 ? (
              <FormRiskNotice title="Tidak ada selisih" tone="default">
                Semua jumlah fisik sama dengan snapshot sistem. Dokumen tetap dapat dikirim sebagai
                bukti pemeriksaan.
              </FormRiskNotice>
            ) : (
              <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
                <div className="bg-surface-container-low/50 px-4 py-2.5">
                  <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                    Rincian Selisih ({changedRows.length} item)
                  </p>
                </div>
                {changedRows.map((row) => (
                  <div
                    key={row.materialId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-on-surface">
                        {row.materialName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-on-surface-variant">
                        Sistem {formatMaterialQuantity(row.currentStock)} → fisik{" "}
                        {formatMaterialQuantity(row.countedQuantity)} {row.unit}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-xs font-bold ${row.variance < 0 ? "text-error" : "text-primary"}`}
                    >
                      {row.variance > 0 ? "+" : ""}
                      {formatMaterialQuantity(row.variance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <FormRiskNotice title="Persetujuan tetap diperlukan" tone="warning">
              Pengiriman tidak langsung mengubah stok. Owner atau Finance Admin akan meninjau
              snapshot sebelum perubahan diposting.
            </FormRiskNotice>
          </div>
        ) : (
          <div className="space-y-md">
            {!stockCountId && existingDrafts.length > 0 ? (
              <section className="space-y-2">
                <p className="px-1 text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                  Draft yang dapat dilanjutkan
                </p>
                {existingDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => onLoadDraft(draft.id)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-primary/5 px-4 py-3 text-left ring-1 ring-primary/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-primary">
                        {draft.countNumber}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-on-surface-variant">
                        {draft.locationName} · {draft.items.length} material
                      </span>
                    </span>
                    <span className="text-xs font-bold text-primary">Lanjutkan</span>
                  </button>
                ))}
              </section>
            ) : null}
            <FormSection
              title="Dokumen opname"
              helper="Nomor dokumen dan catatan menjadi jejak pemeriksaan stok."
            >
              <FormField label="Nomor dokumen">
                <TextInput value={documentNumber} onChange={onDocumentNumberChange} />
              </FormField>
              <FormField label="Catatan audit">
                <Textarea rows={3} value={note} onChange={onNoteChange} />
              </FormField>
            </FormSection>
            <FormSection
              title="Lokasi inventori"
              helper="Pilih lokasi fisik yang sedang diperiksa."
            >
              <SheetSelect
                label="Lokasi"
                value={locationId}
                onChange={onLocationChange}
                options={locationOptions}
                placeholder="Pilih lokasi"
              />
            </FormSection>
            {locationId ? (
              <FormSection
                title="Jumlah fisik"
                helper="Nilai awal mengikuti snapshot sistem. Ubah hanya jika hasil hitung berbeda."
                action={
                  <span className="shrink-0 text-[10px] font-bold text-primary">
                    {changedRows.length} berubah
                  </span>
                }
              >
                {rows.map((row) => (
                  <div key={row.inventoryId} className="space-y-2.5 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs leading-[1.15] font-bold">
                          {row.materialName}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] leading-tight text-on-surface-variant">
                          Sistem {formatMaterialQuantity(row.currentStock)} · reservasi{" "}
                          {formatMaterialQuantity(row.reservedStock)} {row.unit}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-[10px] font-bold ${row.variance === 0 ? "text-on-surface-variant" : row.variance < 0 ? "text-error" : "text-primary"}`}
                      >
                        {row.variance === 0
                          ? "Sama"
                          : `${row.variance > 0 ? "+" : ""}${formatMaterialQuantity(row.variance)}`}
                      </p>
                    </div>
                    <QuantityStepper
                      value={counted[row.materialId] ?? String(row.currentStock)}
                      min={0}
                      step={1}
                      onChange={(value) =>
                        onCountedChange((current) => ({
                          ...current,
                          [row.materialId]: value,
                        }))
                      }
                    />
                  </div>
                ))}
              </FormSection>
            ) : null}
          </div>
        )}
      </WorkflowFormSheet>
      <MaterialUnsavedChangesModal
        open={confirmClose}
        pending={pending}
        onSave={() => {
          setConfirmClose(false);
          onSaveDraft();
        }}
        onDiscard={() => {
          setConfirmClose(false);
          onClose();
        }}
        onContinue={() => setConfirmClose(false)}
      />
    </>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
