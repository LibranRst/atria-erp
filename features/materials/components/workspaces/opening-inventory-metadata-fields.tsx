import React from "react";
import {
  DatePickerField,
  FormField,
  FormSection,
  Textarea,
  TextInput,
} from "@/components/ui/form/form-controls";
import type { Metadata } from "./opening-inventory-utils";

export function OpeningInventoryMetadataFields({
  value,
  pending,
  onChange,
}: {
  readonly value: Metadata;
  readonly pending: boolean;
  readonly onChange: (next: Metadata) => void;
}): React.JSX.Element {
  return (
    <FormSection
      title="Sumber saldo"
      helper="Tanggal dan catatan ini menjadi referensi persetujuan serta audit."
    >
      <DatePickerField
        label="Tanggal saldo awal"
        value={value.balanceDate}
        onChange={(balanceDate) => onChange({ ...value, balanceDate })}
        placeholder="Pilih tanggal posisi stok"
        disabled={pending}
        required
      />
      <FormField label="Dokumen referensi" optional>
        <TextInput
          value={value.referenceNumber}
          onChange={(referenceNumber) => onChange({ ...value, referenceNumber })}
          placeholder="Contoh: Stock opname 17 Juli 2026"
          disabled={pending}
        />
      </FormField>
      <FormField
        label="Catatan sumber data"
        helper="Minimal 10 karakter. Jelaskan sumber hitungan fisik."
        required
      >
        <Textarea
          value={value.note}
          onChange={(note) => onChange({ ...value, note })}
          placeholder="Contoh: Sesuai hasil hitung fisik Gudang Utama per 17 Juli 2026."
          disabled={pending}
          required
        />
      </FormField>
    </FormSection>
  );
}
