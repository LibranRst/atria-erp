"use client";

import React from "react";
import { toast } from "sonner";

import { updateApprovalThresholds } from "@/app/actions/settings/approval-thresholds";
import {
  Button,
  FormField,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  MoneyInput,
  MoneyValue,
  OperationalFormSheet,
} from "@/components/ui";
import { SettingsInverseSurface } from "../shared/settings-inverse-surface";

/**
 * Kontrol persetujuan: ambang nominal yang memaksa keputusan Owner.
 *
 * Ini kontrol finansial perusahaan, bukan konfigurasi peran — ia menjawab
 * "berapa besar sebelum Owner harus tanda tangan", bukan "siapa boleh apa".
 * Karena itu ia tinggal di Settings, terpisah dari pengaturan akses.
 *
 * Nilai disimpan dalam sen mengikuti aturan uang aplikasi; formulir bekerja
 * dalam rupiah karena itu yang dibaca manusia.
 */
export function ApprovalControlManager({
  fieldCostCents,
  vendorPaymentCents,
  canManage,
}: {
  readonly fieldCostCents: number;
  readonly vendorPaymentCents: number;
  readonly canManage: boolean;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fieldCost, setFieldCost] = React.useState(String(fieldCostCents / 100));
  const [vendorPayment, setVendorPayment] = React.useState(String(vendorPaymentCents / 100));

  const fieldCostNext = Math.round(Number(fieldCost || 0) * 100);
  const vendorPaymentNext = Math.round(Number(vendorPayment || 0) * 100);
  const dirty = fieldCostNext !== fieldCostCents || vendorPaymentNext !== vendorPaymentCents;

  async function submit(): Promise<void> {
    setPending(true);
    const result = await updateApprovalThresholds({
      fieldCostCents: fieldCostNext,
      vendorPaymentCents: vendorPaymentNext,
    });
    setPending(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      result.data.updated
        ? "Ambang persetujuan diperbarui untuk pengajuan berikutnya."
        : "Tidak ada perubahan.",
    );
    setOpen(false);
  }

  return (
    <section className="space-y-2">
      <SettingsInverseSurface label="Kontrol persetujuan">
        <p className="text-eyebrow font-bold tracking-[0.16em] text-on-primary/70 uppercase">
          Kontrol persetujuan
        </p>
        <h2 className="mt-1.5 text-[19px] leading-[1.15] font-bold tracking-[-0.02em]">
          Ambang keputusan Owner
        </h2>
        <p className="mt-2 text-support text-on-primary/75">
          Pengajuan yang mencapai ambang ini berhenti untuk diputus Owner.
        </p>
      </SettingsInverseSurface>

      <GroupedSurface>
        <div className="divide-y divide-black/5.5">
          <ThresholdRow
            title="Pengeluaran lapangan"
            description="Biaya yang diajukan dari lokasi proyek."
            amount={fieldCostCents / 100}
          />
          <ThresholdRow
            title="Pembayaran vendor"
            description="Pencairan tagihan supplier dan subcon."
            amount={vendorPaymentCents / 100}
          />
          <InlineStateRow
            icon="info"
            title="Berlaku untuk pengajuan berikutnya"
            description="Pengajuan yang sudah menunggu keputusan tidak berpindah jalur."
          />
        </div>
      </GroupedSurface>

      {canManage ? (
        <div className="px-1">
          <Button type="button" variant="secondary" fullWidth onClick={() => setOpen(true)}>
            Ubah ambang
          </Button>
        </div>
      ) : null}

      <OperationalFormSheet
        open={open}
        title="Ubah ambang persetujuan"
        submitLabel="Simpan ambang"
        submittingLabel="Menyimpan…"
        pending={pending}
        disabled={!dirty}
        disabledReason={dirty ? undefined : "Belum ada perubahan."}
        statusText="Perubahan hanya menilai pengajuan baru, bukan yang sedang menunggu."
        onClose={() => setOpen(false)}
        onSubmit={() => void submit()}
      >
        <FormSection helper="Isi 0 bila setiap pengajuan harus diputus Owner.">
          <FormField label="Pengeluaran lapangan" htmlFor="approval-threshold-field-cost" required>
            <MoneyInput
              id="approval-threshold-field-cost"
              value={fieldCost}
              onChange={setFieldCost}
            />
          </FormField>
          <FormField label="Pembayaran vendor" htmlFor="approval-threshold-vendor" required>
            <MoneyInput
              id="approval-threshold-vendor"
              value={vendorPayment}
              onChange={setVendorPayment}
            />
          </FormField>
        </FormSection>
      </OperationalFormSheet>
    </section>
  );
}

function ThresholdRow({
  title,
  description,
  amount,
}: {
  readonly title: string;
  readonly description: string;
  readonly amount: number;
}): React.JSX.Element {
  return (
    <div className="flex min-h-16 min-w-0 items-center gap-3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-row font-bold text-on-surface">{title}</p>
        <p className="mt-1 truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {description}
        </p>
      </div>
      <MoneyValue amount={amount} variant="fullDynamic" />
    </div>
  );
}
