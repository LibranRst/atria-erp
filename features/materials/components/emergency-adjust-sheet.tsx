"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationSheet,
  FormRiskNotice,
  FormField,
  OptionChoiceGroup,
  SheetSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/material-form-patterns";
import { ItemRows } from "@/features/materials/components/material-operation-sheets";
import type {
  MaterialOption,
  SelectOption,
} from "@/features/materials/components/material-operation-dialog-types";
import {
  createSimpleItem,
  type SimpleItem,
} from "@/features/materials/lib/material-ui-utils";

type EmergencyAdjustSheetProps = {
  readonly open: boolean;
  readonly pending: boolean;
  readonly locationOptions: readonly SelectOption[];
  readonly materials: readonly MaterialOption[];
  readonly inventory: MaterialOperationsDashboard["inventory"];
  readonly locationId: string;
  readonly items: readonly SimpleItem[];
  readonly note: string;
  readonly adjustDirection: "INCREASE" | "DECREASE";
  readonly onLocationChange: (value: string) => void;
  readonly onItemsChange: (items: readonly SimpleItem[]) => void;
  readonly onNoteChange: (value: string) => void;
  readonly onAdjustDirectionChange: (value: "INCREASE" | "DECREASE") => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
};

export function EmergencyAdjustSheet({
  open,
  pending,
  locationOptions,
  materials,
  inventory,
  locationId,
  items,
  note,
  adjustDirection,
  onLocationChange,
  onItemsChange,
  onNoteChange,
  onAdjustDirectionChange,
  onClose,
  onSubmit,
}: EmergencyAdjustSheetProps): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const item = items[0];
  const selectedInventory = inventory.find((row) => row.locationId === locationId && row.materialId === item?.materialId);
  const quantity = Number(item?.quantity ?? 0);
  const delta = adjustDirection === "INCREASE" ? quantity : -quantity;
  const after = (selectedInventory?.currentStock ?? 0) + delta;
  const valid = Boolean(
    locationId &&
    item?.materialId &&
    quantity > 0 &&
    note.trim().length >= 10 &&
    selectedInventory &&
    after >= selectedInventory.reservedStock,
  );
  const disabledReason = !locationId
    ? "Pilih lokasi inventori."
    : !item?.materialId
      ? "Pilih material yang akan disesuaikan."
      : quantity <= 0
        ? "Isi jumlah penyesuaian."
        : note.trim().length < 10
          ? "Alasan audit minimal 10 karakter."
          : !selectedInventory
            ? "Inventory material belum tersedia di lokasi ini."
            : after < selectedInventory.reservedStock
              ? "Hasil penyesuaian lebih kecil dari stok yang sudah direservasi."
              : undefined;
  return (
    <>
    <WorkflowFormSheet
      open={open}
      title={reviewing ? "Tinjau Penyesuaian Darurat" : "Penyesuaian Stok Darurat"}
      onClose={() => reviewing ? setReviewing(false) : locationId || item?.materialId || note ? setConfirmClose(true) : onClose()}
      primaryLabel={reviewing ? "Posting Penyesuaian Stok" : "Tinjau Penyesuaian"}
      secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}
      pendingLabel="Memposting…"
      pending={pending}
      disabled={!valid}
      disabledReason={disabledReason}
      danger={reviewing}
      onPrimary={() => {
        if (reviewing) { setReviewing(false); onSubmit(); }
        else setReviewing(true);
      }}
      onSecondary={() => setReviewing(false)}
    >
      {reviewing ? (
        <div className="space-y-md">
          <FormRiskNotice title="Aksi Owner dengan audit permanen" tone="danger">
            Penyesuaian darurat langsung mengubah stok fisik. Gunakan hanya untuk koreksi yang tidak dapat diselesaikan lewat penerimaan, transfer, atau opname.
          </FormRiskNotice>
          <StockImpactRow label={`${selectedInventory?.materialName ?? "Material"} · ${selectedInventory?.locationName ?? "Lokasi"}`} before={selectedInventory?.currentStock ?? 0} delta={delta} after={after} reserved={selectedInventory?.reservedStock} unit={selectedInventory?.unit} />
          <div className="rounded-2xl bg-surface-container-low px-4 py-3">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Alasan audit</p>
            <p className="mt-1 text-xs leading-5 text-on-surface">{note}</p>
          </div>
        </div>
      ) : (
      <div className="space-y-md">
      <OptionChoiceGroup
        label="Arah penyesuaian"
        value={adjustDirection}
        onChange={onAdjustDirectionChange}
        options={[
          { value: "INCREASE", label: "Tambah stok", description: "Jumlah fisik lebih besar dari catatan sistem." },
          { value: "DECREASE", label: "Kurangi stok", description: "Jumlah fisik lebih kecil dari catatan sistem." },
        ]}
      />
      <SheetSelect
        label="Lokasi inventori"
        value={locationId}
        onChange={onLocationChange}
        options={locationOptions}
        placeholder="Pilih lokasi"
      />
      <ItemRows
        items={items.slice(0, 1)}
        setItems={onItemsChange}
        materials={materials}
        createItem={createSimpleItem}
        single
      />
      {selectedInventory ? <StockImpactRow label="Pratinjau stok" before={selectedInventory.currentStock} delta={delta} after={after} reserved={selectedInventory.reservedStock} unit={selectedInventory.unit} /> : null}
      <FormField label="Alasan audit" helper="Wajib dan spesifik, minimal 10 karakter.">
        <Textarea rows={3} value={note} onChange={onNoteChange} />
      </FormField>
      </div>
      )}
    </WorkflowFormSheet>
    <ConfirmationSheet open={confirmClose} title="Buang perubahan penyesuaian?" description="Data yang belum diposting akan hilang." confirmLabel="Buang Perubahan" danger onClose={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); onClose(); }} />
    </>
  );
}
