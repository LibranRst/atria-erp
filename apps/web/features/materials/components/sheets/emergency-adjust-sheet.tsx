"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationDialog,
  FormField,
  FormRiskNotice,
  FormSection,
  OptionChoiceGroup,
  QuantityStepper,
  AdaptiveSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/shared/stock-impact-row";
import type {
  MaterialOption,
  SelectOption,
} from "@/features/materials/types/material-operation-dialog-types";
import type { SimpleItem } from "@/features/materials/utils/material-ui-utils";

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
  const selectedInventory = inventory.find(
    (row) => row.locationId === locationId && row.materialId === item?.materialId,
  );
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
        onClose={() =>
          reviewing
            ? setReviewing(false)
            : locationId || item?.materialId || note
              ? setConfirmClose(true)
              : onClose()
        }
        primaryLabel={reviewing ? "Posting" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Memposting…"
        pending={pending}
        disabled={!valid}
        disabledReason={disabledReason}
        danger={reviewing}
        onPrimary={() => {
          if (reviewing) {
            setReviewing(false);
            onSubmit();
          } else setReviewing(true);
        }}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-md">
            <FormRiskNotice title="Aksi Owner dengan audit permanen" tone="danger">
              Penyesuaian darurat langsung mengubah stok fisik. Gunakan hanya untuk koreksi yang
              tidak dapat diselesaikan lewat penerimaan, transfer, atau opname.
            </FormRiskNotice>
            <StockImpactRow
              label={`${selectedInventory?.materialName ?? "Material"} · ${selectedInventory?.locationName ?? "Lokasi"}`}
              before={selectedInventory?.currentStock ?? 0}
              delta={delta}
              after={after}
              reserved={selectedInventory?.reservedStock}
              unit={selectedInventory?.unit}
            />
            {note.trim() && (
              <FormSection
                title="Detail audit"
                helper="Alasan penyesuaian darurat dicatat pada log audit."
              >
                <ReviewFact label="Alasan audit" value={note} />
              </FormSection>
            )}
          </div>
        ) : (
          <div className="space-y-md">
            <OptionChoiceGroup
              label="Arah penyesuaian"
              value={adjustDirection}
              onChange={onAdjustDirectionChange}
              options={[
                {
                  value: "INCREASE",
                  label: "Tambah stok",
                  description: "Jumlah fisik lebih besar dari catatan sistem.",
                },
                {
                  value: "DECREASE",
                  label: "Kurangi stok",
                  description: "Jumlah fisik lebih kecil dari catatan sistem.",
                },
              ]}
            />
            <FormSection
              title="Material dan lokasi"
              helper="Pastikan stok dikoreksi pada material dan lokasi fisik yang tepat."
            >
              <AdaptiveSelect
                label="Lokasi inventori"
                value={locationId}
                onChange={onLocationChange}
                options={locationOptions}
                placeholder="Pilih lokasi"
                required
              />
              <AdaptiveSelect
                label="Material"
                value={item?.materialId ?? ""}
                onChange={(value) =>
                  onItemsChange([
                    { ...(item ?? { key: "emergency-adjust", quantity: "1" }), materialId: value },
                  ])
                }
                options={materials.map((material) => ({
                  value: material.id,
                  label: material.name,
                }))}
                placeholder={locationId ? "Pilih material" : "Pilih lokasi lebih dulu"}
                disabled={!locationId}
                required
              />
            </FormSection>
            {selectedInventory ? (
              <StockImpactRow
                label="Pratinjau stok"
                before={selectedInventory.currentStock}
                delta={delta}
                after={after}
                reserved={selectedInventory.reservedStock}
                unit={selectedInventory.unit}
              />
            ) : null}
            <FormSection
              title="Jumlah dan audit"
              helper="Penyesuaian darurat mengubah stok fisik langsung dan selalu meninggalkan audit trail."
            >
              <FormField
                label={selectedInventory?.unit ? `Jumlah (${selectedInventory.unit})` : "Jumlah"}
                required
              >
                <QuantityStepper
                  value={item?.quantity ?? ""}
                  unit={selectedInventory?.unit}
                  min={0}
                  step={1}
                  onChange={(value) =>
                    onItemsChange([
                      { ...(item ?? { key: "emergency-adjust", materialId: "" }), quantity: value },
                    ])
                  }
                />
              </FormField>
              <FormField
                label="Alasan audit"
                helper="Wajib dan spesifik, minimal 10 karakter."
                required
              >
                <Textarea
                  rows={3}
                  value={note}
                  onChange={onNoteChange}
                  placeholder="Jelaskan penyebab selisih dan bukti pemeriksaan fisik"
                  required
                />
              </FormField>
            </FormSection>
          </div>
        )}
      </WorkflowFormSheet>
      <ConfirmationDialog
        open={confirmClose}
        title="Buang perubahan penyesuaian?"
        description="Data yang belum diposting akan hilang."
        confirmLabel="Buang Perubahan"
        danger
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
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
