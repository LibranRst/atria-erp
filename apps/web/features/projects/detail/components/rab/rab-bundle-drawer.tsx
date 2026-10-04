"use client";

import React from "react";
import { motion } from "framer-motion";

import {
  DetailSheet,
  ChoiceRow,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  ConfirmationDialog,
  FactRow,
  FormField,
  FormSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  TextInput,
  ValuePreviewStrip,
  useFormDirtySnapshot,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import type { RabEstimateView } from "../shared/rap-rab-manager";
import type { RabBundleForm } from "../../types/rab-drawer-types";

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
  const dirty = useFormDirtySnapshot(
    bundleEditorOpen,
    editingBundleId ?? "new-bundle",
    JSON.stringify(bundleForm),
  );

  const bundleItems = rabEstimate?.items.filter((item) => item.bundleId === editingBundleId) ?? [];

  if (!editable && bundleEditorOpen) {
    return (
      <DetailSheet
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

          <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
            {bundleForm.description && (
              <div className="bg-surface-container-low/20 px-4 py-3.5">
                <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
                  Deskripsi Paket
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface">
                  {bundleForm.description}
                </p>
              </div>
            )}

            <FactRow label="Jumlah Paket" value={`${bundleForm.quantity} ${bundleForm.unit}`} />
            <FactRow
              label="Harga per Paket"
              value={
                <MoneyValue
                  amount={Number(bundleForm.unitPrice)}
                  variant="compact"
                  size="sm"
                  align="right"
                />
              }
            />
            <FactRow
              label="Total Nilai Paket"
              value={
                <MoneyValue
                  amount={bundleTotal}
                  variant="compact"
                  size="sm"
                  align="right"
                  tone="default"
                />
              }
            />
          </div>

          {bundleItems.length > 0 && (
            <div className="space-y-sm">
              <p className="px-1 text-xs font-bold text-on-surface-variant">Item Anggota Paket</p>
              <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
                {bundleItems.map((item) => (
                  <FactRow
                    key={item.id}
                    label={item.clientLabel}
                    value={`${item.quantity} ${item.unit}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DetailSheet>
    );
  }

  return (
    <>
      <OperationalFormSheet
        dismissal={{
          mode: "confirm",
          dirty,
          onDiscard: () => undefined,
          description: "Perubahan paket RAB yang belum disimpan akan hilang.",
        }}
        open={bundleEditorOpen}
        title={editingBundleId ? "Edit Paket RAB" : "Buat Paket RAB"}
        onClose={() => setBundleEditorOpen(false)}
        pending={isPending}
        disabled={
          bundleForm.clientLabel.trim().length < 3 ||
          Number(bundleForm.quantity) <= 0 ||
          (!editingBundleId && bundleForm.itemIds.length < 2)
        }
        disabledReason={
          bundleForm.clientLabel.trim().length < 3
            ? "Isi nama paket minimal 3 karakter."
            : Number(bundleForm.quantity) <= 0
              ? "Jumlah harus lebih dari 0."
              : !editingBundleId && bundleForm.itemIds.length < 2
                ? "Pilih minimal dua item untuk membuat paket."
                : undefined
        }
        submitLabel={editingBundleId ? "Perbarui" : "Simpan"}
        submittingLabel="Menyimpan…"
        onSubmit={handleSaveBundle}
        statusText={`${editingBundleId ? "Paket tersimpan" : `${bundleForm.itemIds.length} item`} · ${bundleForm.quantity} ${bundleForm.unit} · Rp ${bundleTotal.toLocaleString("id-ID")}`}
        statusTone={
          (editingBundleId || bundleForm.itemIds.length >= 2) && bundleTotal > 0
            ? "success"
            : "warning"
        }
      >
        <div className="space-y-md">
          <FormSection
            title="Tampilan paket"
            helper="Nama dan deskripsi ini akan dibaca klien di RAB."
          >
            <FormField label="Nama paket">
              <TextInput
                value={bundleForm.clientLabel}
                onChange={(value) => setBundleForm((curr) => ({ ...curr, clientLabel: value }))}
                placeholder="Nama paket untuk klien"
              />
            </FormField>
            <FormField label="Deskripsi untuk klien" optional>
              <Textarea
                rows={3}
                value={bundleForm.description}
                onChange={(value) => setBundleForm((curr) => ({ ...curr, description: value }))}
                placeholder="Deskripsi lingkup paket"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Jumlah & harga"
            helper="Harga paket menggantikan tampilan harga tiap item anggota."
          >
            <FormField label="Jumlah">
              <NumericInput
                min={0.01}
                value={bundleForm.quantity}
                onChange={(value) => setBundleForm((curr) => ({ ...curr, quantity: value }))}
              />
            </FormField>
            <ComboboxField
              label="Satuan"
              value={bundleForm.unit}
              onChange={(value) => setBundleForm((curr) => ({ ...curr, unit: value }))}
              options={COMMON_UNIT_OPTIONS}
              placeholder="Pilih satuan"
            />
            <FormField label="Harga paket untuk klien">
              <MoneyInput
                value={bundleForm.unitPrice}
                onChange={(value) => setBundleForm((curr) => ({ ...curr, unitPrice: value }))}
                showPreview={false}
              />
            </FormField>
            <div className="p-3">
              <ValuePreviewStrip
                items={[
                  {
                    label: "Total paket",
                    amount: bundleTotal,
                    tone: bundleTotal > 0 ? "success" : "warning",
                  },
                ]}
              />
            </div>
          </FormSection>

          {!editingBundleId && (
            <FormSection
              title="Item anggota"
              helper="Pilih sedikitnya dua item yang ingin ditampilkan sebagai satu paket."
            >
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
            <FormSection
              title="Tindakan lain"
              helper="Membongkar paket mengembalikan item sebagai baris terpisah tanpa menghapus data."
            >
              <motion.button
                type="button"
                whileTap={{ scale: 1.05 }}
                transition={transitionSpringSnappy}
                onClick={() => setConfirmDelete(true)}
                className="min-h-12 w-full rounded-full bg-error-container/25 px-5 text-xs font-bold text-error outline-none active:shadow-raised active:z-10"
              >
                Bongkar Paket
              </motion.button>
            </FormSection>
          ) : null}
        </div>
      </OperationalFormSheet>
      <ConfirmationDialog
        open={confirmDelete}
        title="Bongkar paket RAB?"
        description="Item anggota kembali tampil sebagai baris terpisah. Nilai dan sumber item tidak dihapus."
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 1.05 }}
              transition={transitionSpringSnappy}
              onClick={() => setConfirmDelete(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold active:shadow-raised active:z-10"
            >
              Batal
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 1.05 }}
              transition={transitionSpringSnappy}
              disabled={isPending}
              onClick={() => {
                if (editingBundleId) handleDeleteBundle(editingBundleId);
                setConfirmDelete(false);
                setBundleEditorOpen(false);
              }}
              className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white outline-none active:shadow-raised active:z-10 disabled:opacity-40"
            >
              Bongkar Paket
            </motion.button>
          </div>
        }
      />
    </>
  );
}
