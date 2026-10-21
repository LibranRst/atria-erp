"use client";

import React from "react";
import { saveVendor } from "@/app/actions/administration-vendors";
import { FormField, FormSection, OperationalFormSheet, Textarea, TextInput } from "@/components/ui";
import { toast } from "sonner";
import { VendorDraftSummary } from "./vendor-draft-summary";

type VendorFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
};

const INITIAL_STATE: VendorFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountHolder: "",
};

type VendorCreateSheetProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: (vendor: { readonly id: string; readonly name: string }) => void;
};

export function VendorCreateSheet({
  open,
  onClose,
  onSuccess,
}: VendorCreateSheetProps): React.JSX.Element {
  const [form, setForm] = React.useState<VendorFormState>(INITIAL_STATE);
  const [pending, setPending] = React.useState(false);

  const trimmedName = form.name.trim();
  const trimmedPhone = form.phone.trim();
  const isValid = trimmedName.length >= 2 && trimmedPhone.length >= 3;
  const dirty = JSON.stringify(form) !== JSON.stringify(INITIAL_STATE);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValid || pending) return;

    setPending(true);
    try {
      const result = await saveVendor({
        name: trimmedName,
        phone: trimmedPhone,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankAccountHolder: form.bankAccountHolder.trim() || null,
        isActive: true,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success(`Vendor "${trimmedName}" berhasil ditambahkan.`);
      onSuccess({ id: result.data.id, name: trimmedName });
      setForm(INITIAL_STATE);
      onClose();
    } catch {
      toast.error("Gagal menambahkan vendor. Silakan coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <OperationalFormSheet
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: () => setForm(INITIAL_STATE),
        description: "Data vendor yang belum ditambahkan akan hilang.",
      }}
      open={open}
      title="Tambah Vendor Baru"
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={<VendorDraftSummary {...form} status="Vendor baru" />}
      onClose={() => {
        if (!pending) {
          setForm(INITIAL_STATE);
          onClose();
        }
      }}
      formId="quick-vendor-form"
      submitLabel="Tambah"
      pending={pending}
      disabled={!isValid}
    >
      <form id="quick-vendor-form" onSubmit={handleSubmit} className="space-y-md">
        <FormSection
          title="Identitas vendor"
          helper="Kontak ini digunakan saat menyiapkan tagihan dan pembelian."
        >
          <FormField label="Nama vendor" htmlFor="quick-vendor-name" required>
            <TextInput
              id="quick-vendor-name"
              name="name"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              placeholder="Contoh: PT Sumber Interior"
              required
              autoFocus
            />
          </FormField>
          <FormField label="Telepon" htmlFor="quick-vendor-phone" required>
            <TextInput
              id="quick-vendor-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              placeholder="Contoh: 0812 3456 7890"
              autoComplete="tel"
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="quick-vendor-email" optional>
            <TextInput
              id="quick-vendor-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              placeholder="vendor@perusahaan.com"
              autoComplete="email"
            />
          </FormField>
          <FormField label="Alamat" htmlFor="quick-vendor-address" optional>
            <Textarea
              id="quick-vendor-address"
              name="address"
              value={form.address}
              onChange={(value) => setForm((current) => ({ ...current, address: value }))}
              placeholder="Alamat kantor atau gudang vendor"
              rows={2}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Rekening pembayaran"
          helper="Opsional. Isi sesuai rekening tujuan pembayaran vendor."
        >
          <FormField label="Bank" htmlFor="quick-vendor-bank" optional>
            <TextInput
              id="quick-vendor-bank"
              name="bankName"
              value={form.bankName}
              onChange={(value) => setForm((current) => ({ ...current, bankName: value }))}
              placeholder="Contoh: BCA"
            />
          </FormField>
          <FormField label="Nomor rekening" htmlFor="quick-vendor-account-number" optional>
            <TextInput
              id="quick-vendor-account-number"
              name="bankAccountNumber"
              value={form.bankAccountNumber}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  bankAccountNumber: value,
                }))
              }
              placeholder="Nomor rekening tujuan"
              inputMode="numeric"
            />
          </FormField>
          <FormField label="Nama pemilik rekening" htmlFor="quick-vendor-account-holder" optional>
            <TextInput
              id="quick-vendor-account-holder"
              name="bankAccountHolder"
              value={form.bankAccountHolder}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  bankAccountHolder: value,
                }))
              }
              placeholder="Sesuai nama pada rekening"
            />
          </FormField>
        </FormSection>
      </form>
    </OperationalFormSheet>
  );
}
