import React from "react";
import {
  CompactFormDialog,
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
      description="Kategori baru langsung dipilih pada material yang sedang dibuat."
      onClose={onClose}
      pending={pending}
      actions={
        <SheetFooterActions
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
      <div className="py-1">
        <TextInput
          autoFocus
          value={name}
          onChange={onNameChange}
          placeholder="Contoh: Hardware, Finishing, Sanitair"
          aria-label="Nama kategori material"
        />
      </div>
    </CompactFormDialog>
  );
}
