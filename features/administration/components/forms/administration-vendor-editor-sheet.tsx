"use client";

import React from "react";
import type { AdministrationOverview } from "@/app/actions/administration";
import { BottomSheet, SheetFooterActions } from "@/components/ui";
import { FormField, FormSection, Textarea, TextInput } from "@/components/ui/form/form-controls";
import type { EditorMode, VendorFormState } from "./administration-editor-types";

type Props = {
  readonly editorMode: EditorMode;
  readonly selectedVendor: AdministrationOverview["vendors"][number] | undefined;
  readonly form: VendorFormState;
  readonly pending: boolean;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly onFormChange: React.Dispatch<React.SetStateAction<VendorFormState>>;
  readonly onToggle: () => void;
};

export function AdministrationVendorEditorSheet({
  editorMode,
  selectedVendor,
  form: vendorForm,
  pending,
  open,
  onClose: closeEditor,
  onSubmit: submitVendor,
  onFormChange: setVendorForm,
  onToggle: toggleSelectedVendor,
}: Props): React.JSX.Element {
  return (
    <BottomSheet
      open={open}
      title={editorMode === "EDIT_VENDOR" ? "Edit vendor" : "Tambah vendor"}
      onClose={closeEditor}
      footer={
        <SheetFooterActions
          secondary={
            editorMode === "EDIT_VENDOR" && selectedVendor
              ? {
                  label: selectedVendor.isActive ? "Arsipkan" : "Aktifkan",
                  disabled: pending,
                  onClick: () => void toggleSelectedVendor(),
                }
              : undefined
          }
          primary={{
            label: editorMode === "EDIT_VENDOR" ? "Simpan" : "Tambah",
            pending,
            form: "administration-vendor-form",
            type: "submit",
          }}
        />
      }
    >
      <form id="administration-vendor-form" onSubmit={submitVendor} className="space-y-md">
        <FormSection
          title="Identitas vendor"
          helper="Kontak ini digunakan saat menyiapkan tagihan dan pembelian."
        >
          <FormField label="Nama vendor" htmlFor="administration-vendor-name" required>
            <TextInput
              id="administration-vendor-name"
              name="name"
              value={vendorForm.name}
              onChange={(value) => setVendorForm((current) => ({ ...current, name: value }))}
              placeholder="Contoh: PT Sumber Interior"
              required
            />
          </FormField>
          <FormField label="Telepon" htmlFor="administration-vendor-phone" required>
            <TextInput
              id="administration-vendor-phone"
              name="phone"
              type="tel"
              value={vendorForm.phone}
              onChange={(value) => setVendorForm((current) => ({ ...current, phone: value }))}
              placeholder="Contoh: 0812 3456 7890"
              autoComplete="tel"
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="administration-vendor-email" optional>
            <TextInput
              id="administration-vendor-email"
              name="email"
              type="email"
              value={vendorForm.email}
              onChange={(value) => setVendorForm((current) => ({ ...current, email: value }))}
              placeholder="vendor@perusahaan.com"
              autoComplete="email"
            />
          </FormField>
          <FormField label="Alamat" htmlFor="administration-vendor-address" optional>
            <Textarea
              id="administration-vendor-address"
              name="address"
              value={vendorForm.address}
              onChange={(value) => setVendorForm((current) => ({ ...current, address: value }))}
              placeholder="Alamat kantor atau gudang vendor"
              rows={2}
            />
          </FormField>
        </FormSection>
        <FormSection
          title="Rekening pembayaran"
          helper="Opsional. Isi sesuai rekening tujuan pembayaran vendor."
        >
          <FormField label="Bank" htmlFor="administration-vendor-bank" optional>
            <TextInput
              id="administration-vendor-bank"
              name="bankName"
              value={vendorForm.bankName}
              onChange={(value) => setVendorForm((current) => ({ ...current, bankName: value }))}
              placeholder="Contoh: BCA"
            />
          </FormField>
          <FormField label="Nomor rekening" htmlFor="administration-vendor-account-number" optional>
            <TextInput
              id="administration-vendor-account-number"
              name="bankAccountNumber"
              value={vendorForm.bankAccountNumber}
              onChange={(value) =>
                setVendorForm((current) => ({
                  ...current,
                  bankAccountNumber: value,
                }))
              }
              placeholder="Nomor rekening tujuan"
              inputMode="numeric"
            />
          </FormField>
          <FormField
            label="Nama pemilik rekening"
            htmlFor="administration-vendor-account-holder"
            optional
          >
            <TextInput
              id="administration-vendor-account-holder"
              name="bankAccountHolder"
              value={vendorForm.bankAccountHolder}
              onChange={(value) =>
                setVendorForm((current) => ({
                  ...current,
                  bankAccountHolder: value,
                }))
              }
              placeholder="Sesuai nama pada rekening"
            />
          </FormField>
        </FormSection>
      </form>
    </BottomSheet>
  );
}
