import React from "react";
import {
  CompactFormDialog,
  FormField,
  FormSection,
  SheetFooterActions,
  TextInput,
} from "@/components/ui";
type MaterialCategoryComposerDialogProps = {
  readonly open: boolean;
  readonly name: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onNameChange: (name: string) => void;
  readonly onSubmit: () => void;
};

export function MaterialCategoryComposerDialog({
  open,
  name,
  pending,
  onClose,
  onNameChange,
  onSubmit,
}: MaterialCategoryComposerDialogProps): React.JSX.Element {
  const trimmedName = name.trim();
  return (
    <CompactFormDialog
      open={open}
      title="Kategori Material Baru"
      onClose={onClose}
      pending={pending}
      actions={
        <SheetFooterActions
          disabledReason={!trimmedName ? "Isi nama kategori material." : undefined}
          secondary={{ label: "Batal", onClick: onClose, disabled: pending }}
          primary={{
            label: "Tambah",
            pendingLabel: "Menambahkan…",
            pending,
            disabled: !trimmedName,
            onClick: onSubmit,
          }}
        />
      }
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
    </CompactFormDialog>
  );
}
