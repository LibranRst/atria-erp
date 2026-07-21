"use client";

import React from "react";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationSheet,
  FormField,
  FormRiskNotice,
  FormSection,
  SheetSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/material-form-patterns";
import { ItemRows } from "@/features/materials/components/material-operation-sheets";
import type {
  MaterialOption,
  SelectOption,
} from "@/features/materials/components/material-operation-dialog-types";
import { createSimpleItem, type SimpleItem } from "@/features/materials/lib/material-ui-utils";

type TransferSheetProps = {
  readonly open: boolean;
  readonly pending: boolean;
  readonly locations: readonly MaterialOption[];
  readonly locationOptions: readonly SelectOption[];
  readonly materials: readonly MaterialOption[];
  readonly inventory: MaterialOperationsDashboard["inventory"];
  readonly documentNumber: string;
  readonly note: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly items: readonly SimpleItem[];
  readonly newLocationName: string;
  readonly onDocumentNumberChange: (value: string) => void;
  readonly onNoteChange: (value: string) => void;
  readonly onFromLocationChange: (value: string) => void;
  readonly onToLocationChange: (value: string) => void;
  readonly onItemsChange: (items: readonly SimpleItem[]) => void;
  readonly onNewLocationNameChange: (value: string) => void;
  readonly onAddLocation: () => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
};

export function TransferSheet({
  open,
  pending,
  locations,
  locationOptions,
  materials,
  inventory,
  documentNumber,
  note,
  fromLocationId,
  toLocationId,
  items,
  newLocationName,
  onDocumentNumberChange,
  onNoteChange,
  onFromLocationChange,
  onToLocationChange,
  onItemsChange,
  onNewLocationNameChange,
  onAddLocation,
  onClose,
  onSubmit,
}: TransferSheetProps): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const duplicateMaterial =
    new Set(items.map((item) => item.materialId).filter(Boolean)).size !==
    items.filter((item) => item.materialId).length;
  const itemImpacts = items.map((item) => {
    const source = inventory.find(
      (row) => row.locationId === fromLocationId && row.materialId === item.materialId,
    );
    const destination = inventory.find(
      (row) => row.locationId === toLocationId && row.materialId === item.materialId,
    );
    const quantity = Number(item.quantity || 0);
    return {
      item,
      source,
      destination,
      quantity,
      unsafe: Boolean(source && source.currentStock - quantity < source.reservedStock),
    };
  });
  const valid =
    locations.length >= 2 &&
    Boolean(fromLocationId) &&
    Boolean(toLocationId) &&
    fromLocationId !== toLocationId &&
    note.trim().length >= 10 &&
    !items.some((row) => !row.materialId || Number(row.quantity) <= 0) &&
    !duplicateMaterial &&
    !itemImpacts.some((impact) => !impact.source || !impact.destination || impact.unsafe);
  const disabledReason =
    locations.length < 2
      ? "Transfer membutuhkan minimal dua lokasi aktif."
      : !fromLocationId
        ? "Pilih lokasi sumber."
        : !toLocationId
          ? "Pilih lokasi tujuan."
          : fromLocationId === toLocationId
            ? "Lokasi sumber dan tujuan harus berbeda."
            : note.trim().length < 10
              ? "Audit note minimal 10 karakter."
              : duplicateMaterial
                ? "Satu material hanya boleh muncul sekali dalam transfer."
                : items.some((row) => !row.materialId || Number(row.quantity) <= 0)
                  ? "Setiap item harus punya material dan quantity lebih dari 0."
                  : itemImpacts.some((impact) => impact.unsafe)
                    ? "Jumlah transfer memakai stok yang sudah direservasi. Kurangi jumlahnya."
                    : itemImpacts.some((impact) => !impact.source || !impact.destination)
                      ? "Inventory material belum tersedia di lokasi sumber atau tujuan."
                      : undefined;
  const fromLocationName = locationOptions.find((option) => option.value === fromLocationId)?.label;
  const toLocationName = locationOptions.find((option) => option.value === toLocationId)?.label;
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <>
      <WorkflowFormSheet
        open={open}
        title={reviewing ? "Tinjau Transfer Stok" : "Transfer Antar Lokasi"}
        onClose={() => {
          if (reviewing) setReviewing(false);
          else if (
            note ||
            fromLocationId ||
            toLocationId ||
            items.some((item) => item.materialId || item.quantity !== "1")
          )
            setConfirmClose(true);
          else onClose();
        }}
        pending={pending}
        disabled={!valid}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Posting" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Memposting…"
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
            <FormSection
              title="Tinjau rencana transfer"
              helper="Periksa detail perpindahan sebelum memposting."
            >
              <ReviewFact label="Lokasi asal" value={fromLocationName ?? "–"} />
              <ReviewFact label="Lokasi tujuan" value={toLocationName ?? "–"} />
              <ReviewFact
                label="Total barang"
                value={`${items.length} material · ${totalQuantity.toLocaleString("id-ID")} unit`}
              />
              {note.trim() && <ReviewFact label="Catatan" value={note} />}
            </FormSection>
            <div className="space-y-2">
              {itemImpacts.map(({ item, source, destination, quantity }) => (
                <div key={item.key} className="space-y-2">
                  <StockImpactRow
                    label={`${source?.materialName ?? "Material"} · ${source?.locationName ?? "Sumber"}`}
                    before={source?.currentStock ?? 0}
                    delta={-quantity}
                    after={(source?.currentStock ?? 0) - quantity}
                    reserved={source?.reservedStock}
                    unit={source?.unit}
                  />
                  <StockImpactRow
                    label={`${destination?.materialName ?? "Material"} · ${destination?.locationName ?? "Tujuan"}`}
                    before={destination?.currentStock ?? 0}
                    delta={quantity}
                    after={(destination?.currentStock ?? 0) + quantity}
                    reserved={destination?.reservedStock}
                    unit={destination?.unit}
                  />
                </div>
              ))}
            </div>
            <p className="text-on-surface-variant px-1 text-xs leading-5">
              Posting akan membuat movement keluar dan masuk dalam satu transaksi. Transfer yang
              sudah diposting tidak dapat diedit langsung.
            </p>
          </div>
        ) : (
          <div className="space-y-md">
            {locations.length < 2 && (
              <section className="space-y-2.5">
                <FormRiskNotice title="Lokasi transfer belum cukup" tone="warning">
                  Tambahkan satu lokasi aktif lagi sebelum memindahkan stok.
                </FormRiskNotice>
                <div className="flex items-center gap-2">
                  <TextInput
                    value={newLocationName}
                    onChange={onNewLocationNameChange}
                    className="bg-surface-container-lowest min-h-12 flex-1"
                    placeholder="Nama lokasi baru"
                    aria-label="Nama lokasi inventory baru"
                  />
                  <button
                    type="button"
                    onClick={onAddLocation}
                    disabled={pending || newLocationName.trim().length < 3}
                    className="bg-primary text-on-primary min-h-12 shrink-0 rounded-full px-4 text-xs font-bold disabled:opacity-40"
                  >
                    Tambah
                  </button>
                </div>
              </section>
            )}
            <FormSection
              title="Dokumen dan audit"
              helper="Catatan audit wajib untuk transfer stok."
            >
              <FormField label="Nomor dokumen">
                <TextInput value={documentNumber} onChange={onDocumentNumberChange} />
              </FormField>
              <FormField label="Catatan audit">
                <Textarea rows={3} value={note} onChange={onNoteChange} />
              </FormField>
            </FormSection>
            <FormSection title="Lokasi transfer" helper="Sumber dan tujuan harus berbeda.">
              <div className="divide-outline-variant/20 grid grid-cols-2 divide-x">
                <SheetSelect
                  label="Dari"
                  value={fromLocationId}
                  onChange={onFromLocationChange}
                  options={locationOptions}
                  placeholder="Dari"
                />
                <SheetSelect
                  label="Tujuan"
                  value={toLocationId}
                  onChange={onToLocationChange}
                  options={locationOptions}
                  placeholder="Tujuan"
                />
              </div>
            </FormSection>
            <FormSection
              title="Material dipindahkan"
              helper="Material dan jumlah fisik yang bergerak."
              presentation="plain"
            >
              <ItemRows
                items={items}
                setItems={onItemsChange}
                materials={materials}
                createItem={createSimpleItem}
              />
            </FormSection>
          </div>
        )}
      </WorkflowFormSheet>
      <ConfirmationSheet
        open={confirmClose}
        title="Buang perubahan transfer?"
        description="Data transfer yang belum diposting akan hilang."
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
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-on-surface text-right font-bold">{value}</span>
    </div>
  );
}
