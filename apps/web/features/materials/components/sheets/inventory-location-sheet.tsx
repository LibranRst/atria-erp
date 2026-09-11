"use client";

import React from "react";
import { toast } from "sonner";
import { createInventoryLocation } from "@/app/actions/material/warehouse";
import {
  FormField,
  FormRiskNotice,
  FormSection,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";

type ControlledProps = {
  readonly open: boolean;
  readonly pending: boolean;
  readonly name: string;
  readonly activeMaterialCount?: number;
  readonly onNameChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly onSuccess?: never;
};

type StandaloneProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: (location: { readonly id: string; readonly name: string }) => void;
  readonly activeMaterialCount?: number;
  readonly pending?: never;
  readonly name?: never;
  readonly onNameChange?: never;
  readonly onSubmit?: never;
};

export type InventoryLocationSheetProps = ControlledProps | StandaloneProps;

export function InventoryLocationSheet(props: InventoryLocationSheetProps): React.JSX.Element {
  const [internalName, setInternalName] = React.useState("");
  const [internalPending, setInternalPending] = React.useState(false);

  const isStandalone = "onSuccess" in props && typeof props.onSuccess === "function";
  const name = isStandalone ? internalName : props.name;
  const pending = isStandalone ? internalPending : props.pending;
  const onNameChange = isStandalone ? setInternalName : props.onNameChange;
  const activeMaterialCount = props.activeMaterialCount ?? 0;

  const trimmedName = name.trim();
  const valid = trimmedName.length >= 3;

  async function handlePrimary(): Promise<void> {
    if (isStandalone) {
      if (!valid || internalPending) return;
      setInternalPending(true);
      try {
        const result = await createInventoryLocation({
          name: trimmedName,
          description: null,
        });
        if (!result.success) {
          toast.error(result.error.message);
          return;
        }
        toast.success(`Lokasi "${trimmedName}" berhasil ditambahkan.`);
        props.onSuccess({ id: result.data.id, name: trimmedName });
        setInternalName("");
        props.onClose();
      } catch {
        toast.error("Gagal menambahkan lokasi inventori.");
      } finally {
        setInternalPending(false);
      }
    } else {
      props.onSubmit();
    }
  }

  return (
    <WorkflowFormSheet
      dismissal={{
        mode: "confirm",
        dirty: trimmedName.length > 0,
        onDiscard: () => onNameChange(""),
        description: "Nama lokasi yang belum ditambahkan akan hilang.",
      }}
      open={props.open}
      title="Lokasi inventory baru"
      primaryLabel="Tambah"
      pendingLabel="Menambahkan…"
      pending={pending}
      disabled={!valid}
      disabledReason={valid ? undefined : "Nama lokasi minimal 3 karakter."}
      onClose={props.onClose}
      onExitComplete={() => {
        if (isStandalone) setInternalName("");
        else onNameChange("");
      }}
      onPrimary={handlePrimary}
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
