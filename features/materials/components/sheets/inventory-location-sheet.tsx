"use client";

import {
  FormField,
  FormRiskNotice,
  FormSection,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";

type InventoryLocationSheetProps = {
  readonly open: boolean;
  readonly pending: boolean;
  readonly name: string;
  readonly activeMaterialCount: number;
  readonly onNameChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
};

export function InventoryLocationSheet({
  open,
  pending,
  name,
  activeMaterialCount,
  onNameChange,
  onClose,
  onSubmit,
}: InventoryLocationSheetProps): React.JSX.Element {
  const trimmedName = name.trim();
  const valid = trimmedName.length >= 3;

  return (
    <WorkflowFormSheet
      open={open}
      title="Lokasi inventory baru"
      primaryLabel="Tambah"
      pendingLabel="Menambahkan…"
      pending={pending}
      disabled={!valid}
      disabledReason={valid ? undefined : "Nama lokasi minimal 3 karakter."}
      actionLayout="stacked"
      onClose={onClose}
      onExitComplete={() => onNameChange("")}
      onPrimary={onSubmit}
    >
      <div className="space-y-md">
        <FormSection
          title="Identitas lokasi"
          helper="Gunakan nama yang mudah dikenali saat menerima, memindahkan, dan menghitung stok."
        >
          <FormField label="Nama lokasi" required>
            <TextInput
              value={name}
              onChange={onNameChange}
              placeholder="Contoh: Gudang UAT Utama"
              autoComplete="off"
              autoFocus
              required
              aria-label="Nama lokasi inventory"
            />
          </FormField>
        </FormSection>

        <FormRiskNotice title="Inventory material disiapkan otomatis">
          {activeMaterialCount > 0
            ? `${activeMaterialCount.toLocaleString("id-ID")} material aktif akan mendapat row inventory bersaldo nol di lokasi ini.`
            : "Lokasi akan siap dipilih saat Material Master pertama dibuat. Tidak ada saldo atau transaksi kas yang dibuat."}
        </FormRiskNotice>
      </div>
    </WorkflowFormSheet>
  );
}
