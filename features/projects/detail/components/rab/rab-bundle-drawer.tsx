"use client";

import React from "react";
import { motion } from "framer-motion";

import {
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
  return (
    <>
    <OperationalFormSheet
      open={bundleEditorOpen}
      title={editingBundleId ? "Edit Paket RAB" : "Buat Paket RAB"}
      onClose={() => setBundleEditorOpen(false)}
      pending={isPending}
      disabled={bundleForm.clientLabel.trim().length < 3 || Number(bundleForm.quantity) <= 0 || (!editingBundleId && bundleForm.itemIds.length < 2)}
      disabledReason={bundleForm.clientLabel.trim().length < 3 ? "Isi nama paket minimal 3 karakter." : Number(bundleForm.quantity) <= 0 ? "Jumlah harus lebih dari 0." : !editingBundleId && bundleForm.itemIds.length < 2 ? "Pilih minimal dua item untuk membuat paket." : undefined}
      submitLabel={editingBundleId ? "Perbarui Paket RAB" : "Simpan Paket RAB"}
      submittingLabel="Menyimpan…"
      onSubmit={handleSaveBundle}
      statusText={`${editingBundleId ? "Paket tersimpan" : `${bundleForm.itemIds.length} item`} · ${bundleForm.quantity} ${bundleForm.unit} · Rp ${bundleTotal.toLocaleString("id-ID")}`}
      statusTone={(editingBundleId || bundleForm.itemIds.length >= 2) && bundleTotal > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FormSection title="1 · Tampilan paket" helper="Nama dan deskripsi ini akan dibaca klien di RAB.">
        <FormField label="Nama paket">
          <TextInput
            value={bundleForm.clientLabel}
            onChange={(value) =>
              setBundleForm((curr) => ({ ...curr, clientLabel: value }))
            }
          />
        </FormField>
        <FormField label="Deskripsi untuk klien" optional>
          <Textarea
            rows={3}
            value={bundleForm.description}
            onChange={(value) =>
              setBundleForm((curr) => ({ ...curr, description: value }))
            }
          />
        </FormField>
        </FormSection>
        <FormSection title="2 · Jumlah & harga" helper="Harga paket menggantikan tampilan harga tiap item anggota.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          />
        </div>
        <FormField label="Harga paket untuk klien">
          <MoneyInput
            value={bundleForm.unitPrice}
            onChange={(value) =>
              setBundleForm((curr) => ({ ...curr, unitPrice: value }))
            }
            showPreview={false}
          />
        </FormField>
        <ValuePreviewStrip items={[{ label: "Total paket", amount: bundleTotal, tone: bundleTotal > 0 ? "success" : "warning" }]} />
        </FormSection>
        {!editingBundleId && (
          <FormSection title="3 · Item anggota" helper="Pilih sedikitnya dua item yang ingin ditampilkan sebagai satu paket.">
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
