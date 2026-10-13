"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { toast } from "sonner";

import { updateApprovalThresholds } from "@/app/actions/settings/approval-thresholds";
import {
  FormField,
  FactRow,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyInput,
  MoneyValue,
  OperationalFormSheet,
  RowGroup,
  SectionAction,
  WorkspaceStatusLabel,
} from "@/components/ui";

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
  onMutationComplete,
}: {
  readonly fieldCostCents: number;
  readonly vendorPaymentCents: number;
  readonly canManage: boolean;
  readonly onMutationComplete?: () => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
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
    if (result.data.updated) {
      onMutationComplete?.();
    }
  }

  return (
    <MainSection
      title="Persetujuan"
      titleAction={
        canManage ? undefined : <WorkspaceStatusLabel label="Hanya baca" tone="inactive" />
      }
      action={
        canManage ? <SectionAction label="Ubah ambang" onClick={() => setOpen(true)} /> : undefined
      }
    >
      <GroupedSurface>
        <RowGroup>
          <InlineStateRow
            icon="verified_user"
            title="Ambang keputusan Owner"
            description="Pengajuan yang mencapai nominal ini berhenti untuk diputus Owner."
          />
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
        </RowGroup>
      </GroupedSurface>

      <OperationalFormSheet
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-4">
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  label="Pengeluaran lapangan draft"
                  wrapLabel
                  value={
                    <MoneyValue
                      fractionDigits={Number.isInteger(fieldCostNext / 100) ? 0 : 2}
                      amount={fieldCostNext / 100}
                      variant="fullDynamic"
                      size="sm"
                    />
                  }
                />
                <FactRow
                  layout="stacked"
                  label="Pembayaran vendor draft"
                  wrapLabel
                  value={
                    <MoneyValue
                      fractionDigits={Number.isInteger(vendorPaymentNext / 100) ? 0 : 2}
                      amount={vendorPaymentNext / 100}
                      variant="fullDynamic"
                      size="sm"
                    />
                  }
                />
              </div>
            </GroupedSurface>
            <p className="text-support leading-relaxed text-on-surface-variant">
              Owner memutus pengajuan mulai dari nominal ambang. Nol berarti semua pengajuan
              terkait. Berlaku untuk pengajuan baru; pengajuan berjalan memakai keputusan awal.
            </p>
          </div>
        }
        dismissal={{
          mode: "confirm",
          dirty,
          onDiscard: () => {
            setFieldCost(String(fieldCostCents / 100));
            setVendorPayment(String(vendorPaymentCents / 100));
          },
          description: "Perubahan ambang persetujuan yang belum disimpan akan hilang.",
        }}
        open={open}
        title="Ubah ambang persetujuan"
        submitLabel="Simpan ambang"
        submittingLabel="Menyimpan…"
        pending={pending}
        disabled={!dirty}
        disabledReason={dirty ? undefined : "Belum ada perubahan."}
        statusText={
          desktop
            ? undefined
            : "Perubahan hanya menilai pengajuan baru, bukan yang sedang menunggu."
        }
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
    </MainSection>
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
        <p className="text-row font-bold text-on-surface">{title}</p>
        <p className="mt-1 text-[10px] leading-[1.35] text-on-surface-variant">{description}</p>
      </div>
      <MoneyValue amount={amount} variant="fullDynamic" align="right" className="max-w-[45%]" />
    </div>
  );
}
