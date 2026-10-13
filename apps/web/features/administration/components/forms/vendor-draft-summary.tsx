import React from "react";
import { FactRow, GroupedSurface } from "@/components/ui";

export function VendorDraftSummary({
  name,
  phone,
  bankName,
  bankAccountNumber,
  bankAccountHolder,
  status,
}: {
  readonly name: string;
  readonly phone: string;
  readonly bankName: string;
  readonly bankAccountNumber: string;
  readonly bankAccountHolder: string;
  readonly status: string;
}): React.JSX.Element {
  const paymentFields = [bankName, bankAccountNumber, bankAccountHolder];
  const filledPaymentFields = paymentFields.filter((value) => value.trim()).length;
  return (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <FactRow layout="stacked" label="Vendor" wrapLabel value={name.trim() || "Belum diisi"} />
        <FactRow layout="stacked" label="Kontak" wrapLabel value={phone.trim() || "Belum diisi"} />
        <FactRow layout="stacked" label="Status" wrapLabel value={status} />
        <FactRow
          layout="stacked"
          label="Rekening"
          wrapLabel
          value={
            filledPaymentFields === 0
              ? "Belum diisi · opsional"
              : filledPaymentFields === paymentFields.length
                ? bankName.trim()
                : `${filledPaymentFields}/${paymentFields.length} rincian diisi`
          }
        />
        <p className="px-4 py-3 text-support text-on-surface-variant">
          Menyimpan kontak vendor tidak mencatat tagihan atau pembayaran.
        </p>
      </div>
    </GroupedSurface>
  );
}
