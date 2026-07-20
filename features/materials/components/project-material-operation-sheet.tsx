"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationSheet,
  FieldContextLine,
  FormRiskNotice,
  FormField,
  FormSection,
  QuantityStepper,
  SheetSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/material-form-patterns";
import { Error } from "@/features/materials/components/material-operation-sheets";
import {
  formatMaterialQuantity,
  type ProjectOperation,
  type WarehouseAction,
} from "@/features/materials/lib/material-ui-utils";

type OperationCopy = {
  readonly label: string;
  readonly contextHelper: string;
  readonly detailHelper: string;
  readonly noteLabel: string;
  readonly noteHelper: string;
  readonly notePlaceholder: string;
};

const OPERATION_COPY: Record<ProjectOperation, OperationCopy> = {
  RESERVE: {
    label: "Reservasi Material",
    contextHelper: "Tautkan stok ke kebutuhan RAP proyek dan pilih lokasi penyimpanan.",
    detailHelper: "Reservasi mengurangi stok tersedia tanpa mengubah stok fisik.",
    noteLabel: "Catatan reservasi",
    noteHelper: "Jelaskan tujuan reservasi, minimal 3 karakter.",
    notePlaceholder: "Contoh: Disiapkan untuk pemasangan area utama",
  },
  USE: {
    label: "Pakai Material",
    contextHelper: "Tautkan pemakaian ke kebutuhan RAP dan lokasi asal yang benar.",
    detailHelper: "Pemakaian mengurangi stok fisik dan dicatat sebagai biaya proyek.",
    noteLabel: "Catatan pemakaian",
    noteHelper: "Jelaskan pemakaian material, minimal 3 karakter.",
    notePlaceholder: "Contoh: Dipasang di area ruang keluarga",
  },
  RETURN: {
    label: "Kembalikan Sisa",
    contextHelper: "Pilih kebutuhan RAP dan lokasi penerima sisa material proyek.",
    detailHelper: "Pengembalian menambah stok fisik dan membalik biaya pemakaian terkait.",
    noteLabel: "Catatan pengembalian",
    noteHelper: "Jelaskan asal sisa material, minimal 3 karakter.",
    notePlaceholder: "Contoh: Sisa pemasangan dikembalikan ke gudang",
  },
  WASTE: {
    label: "Material Terbuang",
    contextHelper: "Tautkan material terbuang ke RAP dan lokasi stok yang terdampak.",
    detailHelper: "Stok fisik berkurang permanen dan alasan disimpan pada audit trail.",
    noteLabel: "Alasan material terbuang",
    noteHelper: "Wajib spesifik, minimal 10 karakter.",
    notePlaceholder: "Jelaskan penyebab, kondisi, dan lokasi material terbuang",
  },
};

function isProjectOperation(action: WarehouseAction | null): action is ProjectOperation {
  return action === "RESERVE" || action === "USE" || action === "RETURN" || action === "WASTE";
}

type ProjectMaterialOperationSheetProps = {
  readonly action: WarehouseAction | null;
  readonly open: boolean;
  readonly pending: boolean;
  readonly valid: boolean;
  readonly message: string | null;
  readonly projects: MaterialOperationsDashboard["projects"];
  readonly selectedProject: MaterialOperationsDashboard["projects"][number] | undefined;
  readonly selectedMaterial: MaterialOperationsDashboard["inventory"];
  readonly projectId: string;
  readonly rapItemId: string;
  readonly locationId: string;
  readonly quantity: string;
  readonly note: string;
  readonly onProjectChange: (value: string) => void;
  readonly onRapItemChange: (value: string) => void;
  readonly onLocationChange: (value: string) => void;
  readonly onQuantityChange: (value: string) => void;
  readonly onNoteChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
};

export function ProjectMaterialOperationSheet({
  action,
  open,
  pending,
  valid,
  message,
  projects,
  selectedProject,
  selectedMaterial,
  projectId,
  rapItemId,
  locationId,
  quantity,
  note,
  onProjectChange,
  onRapItemChange,
  onLocationChange,
  onQuantityChange,
  onNoteChange,
  onClose,
  onSubmit,
}: ProjectMaterialOperationSheetProps): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const inventory = selectedMaterial.find((row) => row.locationId === locationId);
  const numericQuantity = Number(quantity || 0);
  const operation = isProjectOperation(action) ? action : null;
  const operationCopy = operation ? OPERATION_COPY[operation] : null;
  const operationLabel = operationCopy?.label ?? "Operasi Material";
  const impactBefore = action === "RESERVE" ? inventory?.availableStock ?? 0 : inventory?.currentStock ?? 0;
  const impactDelta = action === "RETURN" ? numericQuantity : -numericQuantity;
  const impactAfter = impactBefore + impactDelta;
  const disabledReason = !projectId
    ? "Pilih proyek yang menerima perubahan stok."
    : !rapItemId
      ? "Pilih kebutuhan material pada RAP proyek."
      : !locationId
        ? "Pilih lokasi inventori yang terdampak."
        : numericQuantity <= 0
          ? "Isi jumlah material lebih dari 0."
          : note.trim().length < (action === "WASTE" ? 10 : 3)
            ? action === "WASTE"
              ? "Alasan material terbuang minimal 10 karakter."
              : "Catatan operasi minimal 3 karakter."
            : !valid
              ? "Periksa kembali detail operasi material."
              : undefined;
  return (
    <>
    <WorkflowFormSheet
      open={open}
      title={reviewing ? `Tinjau ${operationLabel}` : operationLabel}
      onClose={() => reviewing ? setReviewing(false) : projectId || rapItemId || locationId || quantity || note ? setConfirmClose(true) : onClose()}
      primaryLabel={reviewing ? "Catat" : "Tinjau"}
      secondaryLabel={reviewing ? "Ubah" : undefined}
      pendingLabel="Memproses…"
      pending={pending}
      disabled={!valid}
      disabledReason={disabledReason}
      danger={action === "WASTE" && reviewing}
      onPrimary={() => {
        if (reviewing) { setReviewing(false); onSubmit(); }
        else setReviewing(true);
      }}
      onSecondary={() => setReviewing(false)}
    >
      {reviewing ? (
        <div className="space-y-md">
          <FormSection title="Tinjau operasi material" helper="Periksa proyek dan detail operasi sebelum mencatat.">
            <ReviewFact label="Proyek" value={projects.find((row) => row.id === projectId)?.name ?? "–"} />
            <ReviewFact label="RAP material" value={selectedProject?.rapItems.find((row) => row.id === rapItemId)?.name ?? "–"} />
            <ReviewFact label="Lokasi" value={inventory?.locationName ?? "–"} />
            <ReviewFact label="Jumlah" value={`${formatMaterialQuantity(numericQuantity)} ${inventory?.unit ?? "unit"}`} />
            {note.trim() && <ReviewFact label="Catatan" value={note} />}
          </FormSection>
          <StockImpactRow
            label={action === "RESERVE" ? "Stok tersedia" : "Stok fisik"}
            before={impactBefore}
            delta={impactDelta}
            after={impactAfter}
            reserved={action === "RESERVE" ? undefined : inventory?.reservedStock}
            unit={inventory?.unit}
          />
          <FormRiskNotice
            title={action === "WASTE" ? "Material terbuang tercatat permanen" : "Perubahan stok siap dicatat"}
            tone={action === "WASTE" ? "danger" : action === "USE" ? "warning" : "default"}
          >
            {action === "RESERVE"
              ? "Stok fisik tidak berubah, tetapi stok tersedia untuk proyek lain akan berkurang."
              : action === "USE"
                ? "Stok fisik berkurang dan pemakaian ditautkan ke RAP proyek ini."
                : action === "RETURN"
                  ? "Stok fisik bertambah kembali dari pemakaian proyek ini."
                  : "Stok fisik berkurang dan alasan audit disimpan pada pergerakan stok."}
          </FormRiskNotice>
        </div>
      ) : (
      <div className="space-y-md">
        {message && <Error text={message} />}
        <FormSection
          title="Proyek dan material"
          helper={operationCopy?.contextHelper ?? "Pilih konteks operasi material."}
        >
          <SheetSelect
            label="Proyek"
            value={projectId}
            onChange={onProjectChange}
            options={projects.map((row) => ({ value: row.id, label: row.name }))}
            placeholder="Pilih proyek"
            required
          />
          <SheetSelect
            label="RAP material"
            value={rapItemId}
            onChange={onRapItemChange}
            options={
              selectedProject?.rapItems
                .filter((row) => row.materialId)
                .map((row) => ({
                  value: row.id,
                  label: row.name,
                  description: row.area,
                })) ?? []
            }
            placeholder={projectId ? "Pilih kebutuhan material" : "Pilih proyek lebih dulu"}
            disabled={!projectId}
            required
          />
          <SheetSelect
            label="Lokasi inventori"
            value={locationId}
            onChange={onLocationChange}
            options={selectedMaterial.map((row) => ({
              value: row.locationId,
              label: row.locationName,
              description: `Tersedia ${formatMaterialQuantity(row.availableStock)} ${row.unit}`,
              meta: `Fisik ${formatMaterialQuantity(row.currentStock)} · reservasi ${formatMaterialQuantity(row.reservedStock)}`,
            }))}
            placeholder={rapItemId ? "Pilih lokasi" : "Pilih RAP material lebih dulu"}
            disabled={!rapItemId}
            required
          />
        </FormSection>
        {inventory ? (
          <FieldContextLine tone={inventory.availableStock <= 0 ? "danger" : "success"}>
            Fisik {formatMaterialQuantity(inventory.currentStock)} · reservasi {formatMaterialQuantity(inventory.reservedStock)} · tersedia {formatMaterialQuantity(inventory.availableStock)} {inventory.unit}
          </FieldContextLine>
        ) : null}
        {inventory ? <StockImpactRow label={action === "RESERVE" ? "Stok tersedia" : "Stok fisik"} before={impactBefore} delta={impactDelta} after={impactAfter} reserved={action === "RESERVE" ? undefined : inventory.reservedStock} unit={inventory.unit} /> : null}
        <FormSection
          title="Jumlah dan catatan"
          helper={operationCopy?.detailHelper ?? "Lengkapi jumlah dan catatan operasi."}
        >
          <FormField label={inventory?.unit ? `Jumlah (${inventory.unit})` : "Jumlah"} required>
            <QuantityStepper
              value={quantity}
              unit={inventory?.unit}
              min={0}
              step={1}
              onChange={onQuantityChange}
            />
          </FormField>
          <FormField
            label={operationCopy?.noteLabel ?? "Catatan"}
            helper={operationCopy?.noteHelper}
            required
          >
            <Textarea
              rows={3}
              value={note}
              onChange={onNoteChange}
              placeholder={operationCopy?.notePlaceholder}
              required
            />
          </FormField>
        </FormSection>
      </div>
      )}
    </WorkflowFormSheet>
    <ConfirmationSheet open={confirmClose} title="Buang perubahan operasi material?" description="Data yang belum dicatat akan hilang." confirmLabel="Buang Perubahan" danger onClose={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); onClose(); }} />
    </>
  );
}

function ReviewFact({ label, value }: { readonly label: string; readonly value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
