import React from "react";
import { FormField, FormSection, OperationalFormSheet, TextInput } from "@/components/ui";

type MaterialCategoryComposerSheetProps = {
  readonly open: boolean;
  readonly name: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onNameChange: (name: string) => void;
  readonly onSubmit: () => void;
};

export function MaterialCategoryComposerSheet({
  open,
  name,
  pending,
  onClose,
  onNameChange,
  onSubmit,
}: MaterialCategoryComposerSheetProps): React.JSX.Element {
  const trimmedName = name.trim();
  return (
    <OperationalFormSheet
      open={open}
      title="Kategori Material Baru"
      onClose={onClose}
      pending={pending}
      disabled={!trimmedName}
      disabledReason={!trimmedName ? "Isi nama kategori material." : undefined}
      submitLabel="Tambah"
      submittingLabel="Menambahkan…"
      onSubmit={onSubmit}
      statusText={trimmedName ? `${trimmedName} · Siap ditambahkan` : "Nama kategori belum diisi"}
      statusTone={trimmedName ? "success" : "warning"}
    >
      <FormSection
        title="Nama kategori"
        helper="Kategori baru langsung dipilih pada Material yang sedang dibuat."
      >
        <FormField label="Nama kategori material" required>
          <TextInput
            autoFocus
            value={name}
            onChange={onNameChange}
            placeholder="Contoh: Hardware"
          />
        </FormField>
      </FormSection>
    </OperationalFormSheet>
  );
}
