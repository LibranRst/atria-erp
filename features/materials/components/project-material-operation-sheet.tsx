"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationSheet,
  FormRiskNotice,
  FormField,
  QuantityStepper,
  SheetSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/material-form-patterns";
import { Error } from "@/features/materials/components/material-operation-sheets";
import {
  formatMaterialQuantity,
  type WarehouseAction,
} from "@/features/materials/lib/material-ui-utils";

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
  const operationLabels: Record<string, string> = {
    RESERVE: "Reservasi",
    USE: "Pemakaian",
    RETURN: "Pengembalian",
    WASTE: "Material Terbuang",
  };
  const operationLabel = action ? operationLabels[action] ?? action : "Operasi Material";
  const impactBefore = action === "RESERVE" ? inventory?.availableStock ?? 0 : inventory?.currentStock ?? 0;
  const impactDelta = action === "RETURN" ? numericQuantity : -numericQuantity;
  const impactAfter = impactBefore + impactDelta;
  return (
    <>
    <WorkflowFormSheet
      open={open}
      title={reviewing ? `Tinjau ${operationLabel}` : operationLabel}
      onClose={() => reviewing ? setReviewing(false) : projectId || rapItemId || locationId || quantity || note ? setConfirmClose(true) : onClose()}
      primaryLabel={reviewing ? `Catat ${operationLabel}` : `Tinjau ${operationLabel}`}
      secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}
      pendingLabel="Memproses…"
      pending={pending}
      disabled={!valid}
      danger={action === "WASTE" && reviewing}
      onPrimary={() => {
        if (reviewing) { setReviewing(false); onSubmit(); }
        else setReviewing(true);
      }}
      onSecondary={() => setReviewing(false)}
    >
      {reviewing ? (
        <div className="space-y-md">
          <div className="rounded-2xl bg-primary/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Project dan RAP</p>
            <p className="mt-1 text-sm font-bold">{projects.find((row) => row.id === projectId)?.name}</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">{selectedProject?.rapItems.find((row) => row.id === rapItemId)?.name}</p>
          </div>
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
              ? "Stok fisik tidak berubah, tetapi stok tersedia untuk project lain akan berkurang."
              : action === "USE"
                ? "Stok fisik berkurang dan pemakaian ditautkan ke RAP project ini."
                : action === "RETURN"
                  ? "Stok fisik bertambah kembali dari pemakaian project ini."
                  : "Stok fisik berkurang dan alasan audit disimpan pada movement."}
          </FormRiskNotice>
          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Catatan</p>
            <p className="mt-1 text-xs leading-5">{note}</p>
          </div>
        </div>
      ) : (
      <div className="space-y-sm">
        {message && <Error text={message} />}
        <SheetSelect
          label="Project"
          value={projectId}
          onChange={onProjectChange}
          options={projects.map((row) => ({ value: row.id, label: row.name }))}
          placeholder="Pilih project"
        />
        <SheetSelect
          label="RAP Material"
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
          placeholder="Pilih RAP item"
        />
        <SheetSelect
          label="Lokasi inventori"
          value={locationId}
          onChange={onLocationChange}
          options={selectedMaterial.map((row) => ({
            value: row.locationId,
            label: row.locationName,
            description: `Tersedia ${formatMaterialQuantity(row.availableStock)} ${row.unit}`,
          }))}
          placeholder="Pilih lokasi"
        />
        {inventory ? <StockImpactRow label={action === "RESERVE" ? "Stok tersedia" : "Stok fisik"} before={impactBefore} delta={impactDelta} after={impactAfter} reserved={action === "RESERVE" ? undefined : inventory.reservedStock} unit={inventory.unit} /> : null}
        <FormField label="Jumlah">
          <QuantityStepper
            value={quantity}
            min={0}
            step={1}
            onChange={onQuantityChange}
          />
        </FormField>
        <FormField
          label={action === "WASTE" ? "Catatan audit" : "Catatan"}
          helper={action === "WASTE" ? "Minimal 10 karakter." : undefined}
        >
          <Textarea rows={3} value={note} onChange={onNoteChange} />
        </FormField>
      </div>
      )}
    </WorkflowFormSheet>
    <ConfirmationSheet open={confirmClose} title="Buang perubahan operasi material?" description="Data yang belum dicatat akan hilang." confirmLabel="Buang Perubahan" danger onClose={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); onClose(); }} />
    </>
  );
}
