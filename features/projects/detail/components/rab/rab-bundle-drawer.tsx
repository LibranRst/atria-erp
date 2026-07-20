"use client";

import React from "react";
import { motion } from "framer-motion";

import {
  BottomSheet,
  ConfirmationModal,
  ChoiceRow,
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  TextInput,
  ValuePreviewStrip,
} from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type { RabEstimateView } from "../shared/rap-rab-manager";
import type { RabBundleForm } from "./rab-drawer-types";

export function RabBundleDrawer({
  bundleEditorOpen,
  setBundleEditorOpen,
  editingBundleId,
  bundleForm,
  toggleBundleItem,
  handleSaveBundle,
  handleDeleteBundle,
  isPending,
  rabEstimate,
  setBundleForm,
}: {
  readonly bundleEditorOpen: boolean;
  readonly setBundleEditorOpen: (open: boolean) => void;
  readonly editingBundleId: string | null;
  readonly bundleForm: RabBundleForm;
  readonly toggleBundleItem: (id: string) => void;
  readonly handleSaveBundle: () => void;
  readonly handleDeleteBundle: (id: string) => void;
  readonly isPending: boolean;
  readonly rabEstimate: RabEstimateView | null;
  readonly setBundleForm: React.Dispatch<React.SetStateAction<RabBundleForm>>;
}): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const bundleTotal = Number(bundleForm.quantity) * Number(bundleForm.unitPrice);
  const editable = rabEstimate?.status === "DRAFT";
  
  const bundleItems = rabEstimate?.items.filter(
    (item) => item.bundleId === editingBundleId
  ) ?? [];

  if (!editable && bundleEditorOpen) {
    return (
      <BottomSheet
        open={bundleEditorOpen}
        title="Detail Paket RAB"
        onClose={() => setBundleEditorOpen(false)}
      >
        <div className="space-y-md">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-base font-bold text-on-surface">{bundleForm.clientLabel}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Paket RAB · {bundleItems.length} item terbundel
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15 divide-y divide-outline-variant/15">
            {bundleForm.description && (
              <div className="px-4 py-3.5 bg-surface-container-low/20">
                <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Deskripsi Paket</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface">{bundleForm.description}</p>
              </div>
            )}

            <DetailRow label="Jumlah Paket" value={`${bundleForm.quantity} ${bundleForm.unit}`} />
            <DetailRow 
              label="Harga per Paket" 
              value={<MoneyValue amount={Number(bundleForm.unitPrice)} variant="compactWithFull" size="sm" align="right" />} 
            />
            <DetailRow 
              label="Total Nilai Paket" 
              value={<MoneyValue amount={bundleTotal} variant="compactWithFull" size="sm" align="right" tone="default" />} 
            />
          </div>

          {bundleItems.length > 0 && (
            <div className="space-y-sm">
              <p className="px-1 text-xs font-bold text-on-surface-variant">Item Anggota Paket</p>
              <div className="overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15 divide-y divide-outline-variant/15">
                {bundleItems.map((item) => (
                  <DetailRow 
                    key={item.id} 
                    label={item.clientLabel} 
                    value={`${item.quantity} ${item.unit}`} 
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    );
  }

  return (
    <>
      <OperationalFormSheet
        open={bundleEditorOpen}
        title={editingBundleId ? "Edit Paket RAB" : "Buat Paket RAB"}
        onClose={() => setBundleEditorOpen(false)}
        pending={isPending}
        disabled={bundleForm.clientLabel.trim().length < 3 || Number(bundleForm.quantity) <= 0 || (!editingBundleId && bundleForm.itemIds.length < 2)}
        disabledReason={bundleForm.clientLabel.trim().length < 3 ? "Isi nama paket minimal 3 karakter." : Number(bundleForm.quantity) <= 0 ? "Jumlah harus lebih dari 0." : !editingBundleId && bundleForm.itemIds.length < 2 ? "Pilih minimal dua item untuk membuat paket." : undefined}
        submitLabel={editingBundleId ? "Perbarui" : "Simpan"}
        submittingLabel="Menyimpan…"
        onSubmit={handleSaveBundle}
        statusText={`${editingBundleId ? "Paket tersimpan" : `${bundleForm.itemIds.length} item`} · ${bundleForm.quantity} ${bundleForm.unit} · Rp ${bundleTotal.toLocaleString("id-ID")}`}
        statusTone={(editingBundleId || bundleForm.itemIds.length >= 2) && bundleTotal > 0 ? "success" : "warning"}
      >
        <div className="space-y-md">
          <FormSection title="Tampilan paket" helper="Nama dan deskripsi ini akan dibaca klien di RAB.">
            <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
              <FormField label="Nama paket">
                <TextInput
                  value={bundleForm.clientLabel}
                  onChange={(value) =>
                    setBundleForm((curr) => ({ ...curr, clientLabel: value }))
                  }
                  placeholder="Nama paket untuk klien"
                />
              </FormField>
              <FormField label="Deskripsi untuk klien" optional>
                <Textarea
                  rows={3}
                  value={bundleForm.description}
                  onChange={(value) =>
                    setBundleForm((curr) => ({ ...curr, description: value }))
                  }
                  placeholder="Deskripsi lingkup paket"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Jumlah & harga" helper="Harga paket menggantikan tampilan harga tiap item anggota.">
            <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
              <FormField label="Jumlah">
                <NumericInput
                  min={0.01}
                  value={bundleForm.quantity}
                  onChange={(value) =>
                    setBundleForm((curr) => ({ ...curr, quantity: value }))
                  }
                />
              </FormField>
              <ComboboxField
                label="Satuan"
                value={bundleForm.unit}
                onChange={(value) =>
                  setBundleForm((curr) => ({ ...curr, unit: value }))
                }
                options={COMMON_UNIT_OPTIONS}
                placeholder="Pilih satuan"
              />
              <FormField label="Harga paket untuk klien">
                <MoneyInput
                  value={bundleForm.unitPrice}
                  onChange={(value) =>
                    setBundleForm((curr) => ({ ...curr, unitPrice: value }))
                  }
                  showPreview={false}
                />
              </FormField>
            </div>
            <div className="p-3">
              <ValuePreviewStrip items={[{ label: "Total paket", amount: bundleTotal, tone: bundleTotal > 0 ? "success" : "warning" }]} />
            </div>
          </FormSection>

          {!editingBundleId && (
            <FormSection title="Item anggota" helper="Pilih sedikitnya dua item yang ingin ditampilkan sebagai satu paket.">
              <fieldset className="space-y-2">
                {rabEstimate?.items
                  .filter((item) => !item.isHidden && !item.bundleId)
                  .map((item) => (
                    <ChoiceRow
                      key={item.id}
                      checked={bundleForm.itemIds.includes(item.id)}
                      onChange={() => toggleBundleItem(item.id)}
                      title={item.clientLabel}
                    />
                  ))}
              </fieldset>
            </FormSection>
          )}
          {editingBundleId ? (
            <FormSection title="Tindakan lain" helper="Membongkar paket mengembalikan item sebagai baris terpisah tanpa menghapus data.">
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmDelete(true)} className="min-h-12 w-full rounded-full bg-error-container/25 px-5 text-xs font-bold text-error">Bongkar Paket</motion.button>
            </FormSection>
          ) : null}
        </div>
      </OperationalFormSheet>
      <ConfirmationModal
        open={confirmDelete}
        title="Bongkar paket RAB?"
        description="Item anggota kembali tampil sebagai baris terpisah. Nilai dan sumber item tidak dihapus."
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        actions={(
          <div className="grid grid-cols-2 gap-2">
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmDelete(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Batal</motion.button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending} onClick={() => { if (editingBundleId) handleDeleteBundle(editingBundleId); setConfirmDelete(false); setBundleEditorOpen(false); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white disabled:opacity-40">Bongkar Paket</motion.button>
          </div>
        )}
      />
    </>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 text-xs">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
