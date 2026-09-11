"use client";

import React from "react";

import {
  DetailSheet,
  ConfirmationDialog,
  DatePickerField,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyValue,
  Textarea,
  TextInput,
  useSheetPresenceValue,
  useFormDirtySnapshot,
  WorkflowFormSheet,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { ChangeOrderHistoryView, RabRevisionHistoryView } from "../shared/rap-rab-manager";
import type { RabChangeOrderForm } from "../../types/rab-drawer-types";

function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "–";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ReviewRow({
  label,
  value,
  subvalue,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly subvalue?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 font-medium text-on-surface-variant">{label}</span>
      <div className="text-right">
        <span className="font-bold text-on-surface">{value}</span>
        {subvalue ? <p className="mt-0.5 text-[10px] text-on-surface-variant">{subvalue}</p> : null}
      </div>
    </div>
  );
}

export function ChangeOrderDrawer({
  changeOrderOpen,
  setChangeOrderOpen,
  changeOrderForm,
  setChangeOrderForm,
  handleApproveChangeOrder,
  isPending,
  approvedBaseline,
  visibleRabValue,
}: {
  readonly changeOrderOpen: boolean;
  readonly setChangeOrderOpen: (open: boolean) => void;
  readonly changeOrderForm: RabChangeOrderForm;
  readonly setChangeOrderForm: React.Dispatch<React.SetStateAction<RabChangeOrderForm>>;
  readonly handleApproveChangeOrder: () => void;
  readonly isPending: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
}): React.JSX.Element {
  const [reviewing, setReviewing] = React.useState(false);

  const formValid =
    changeOrderForm.reason.trim().length >= 10 &&
    changeOrderForm.scopeSummary.trim().length >= 10 &&
    changeOrderForm.clientReference.trim().length >= 3;

  const previousValue = approvedBaseline?.value ?? 0;
  const valueDelta = visibleRabValue - previousValue;
  const baseRevision = approvedBaseline?.revision ?? 1;
  const targetRevision = baseRevision + 1;

  const dirty = useFormDirtySnapshot(
    changeOrderOpen,
    "change-order",
    JSON.stringify(changeOrderForm),
  );

  function handleDiscard(): void {
    setReviewing(false);
    setChangeOrderForm({
      reason: "",
      scopeSummary: "",
      clientReference: "",
      clientConfirmedAt: "",
    });
  }

  function handleClose(): void {
    setReviewing(false);
    setChangeOrderOpen(false);
  }

  return (
    <WorkflowFormSheet
      dismissal={{
        mode: "confirm",
        dirty,
        onDiscard: handleDiscard,
        description: "Data Change Order yang belum diproses akan hilang.",
      }}
      open={changeOrderOpen}
      title={reviewing ? "Tinjau Change Order" : "Proses Change Order"}
      onClose={handleClose}
      primaryLabel={reviewing ? "Setujui Perubahan" : "Lanjut Tinjau"}
      secondaryLabel={reviewing ? "Ubah" : undefined}
      pending={isPending}
      pendingLabel="Memproses…"
      disabled={!formValid}
      disabledReason={
        !formValid
          ? "Lengkapi alasan (min 10 karakter), ringkasan lingkup, dan referensi persetujuan klien."
          : undefined
      }
      onPrimary={() => {
        if (reviewing) {
          handleApproveChangeOrder();
        } else {
          setReviewing(true);
        }
      }}
      onSecondary={() => setReviewing(false)}
      statusText={`Nilai baru Rp ${visibleRabValue.toLocaleString("id-ID")} · Selisih ${valueDelta >= 0 ? "+" : ""}Rp ${valueDelta.toLocaleString("id-ID")}`}
      statusTone={!formValid || valueDelta > 0 ? "warning" : "success"}
    >
      <div className="space-y-md">
        {/* Context Card: Perbandingan Nilai Kontrak */}
        <div className="rounded-3xl bg-surface-container-lowest p-4 ring-1 ring-ring-subtle shadow-surface">
          <div className="flex items-center justify-between gap-2">
            <span className="text-meta font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              Revisi Baseline Kontrak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-meta font-bold text-primary">
              R{baseRevision} → R{targetRevision}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-outline-variant/20 rounded-2xl bg-surface-container-low p-2.5">
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Sebelum
              </p>
              <div className="mt-1 flex justify-center font-mono text-xs font-bold tabular-nums text-on-surface">
                <MoneyValue amount={previousValue} variant="compact" size="xs" align="center" />
              </div>
            </div>
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Sesudah
              </p>
              <div className="mt-1 flex justify-center font-mono text-xs font-bold tabular-nums text-on-surface">
                <MoneyValue amount={visibleRabValue} variant="compact" size="xs" align="center" />
              </div>
            </div>
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Selisih
              </p>
              <div
                className={`mt-1 flex justify-center font-mono text-xs font-bold tabular-nums ${
                  valueDelta > 0
                    ? "text-warning"
                    : valueDelta < 0
                      ? "text-success"
                      : "text-on-surface-variant"
                }`}
              >
                <MoneyValue
                  amount={Math.abs(valueDelta)}
                  variant="compact"
                  size="xs"
                  align="center"
                  prefix={valueDelta > 0 ? "+ " : valueDelta < 0 ? "- " : ""}
                />
              </div>
            </div>
          </div>
        </div>

        {reviewing ? (
          /* Step 2: Review Mode */
          <div className="space-y-md">
            <FormSection
              title="Rincian pengajuan Change Order"
              helper="Periksa kembali detail revisi sebelum memperbarui baseline kontrak resmi."
            >
              <ReviewRow
                label="Target revisi"
                value={`R${baseRevision} → R${targetRevision}`}
              />
              <ReviewRow
                label="Alasan perubahan"
                value={changeOrderForm.reason}
              />
              <ReviewRow
                label="Ringkasan lingkup"
                value={changeOrderForm.scopeSummary}
              />
              <ReviewRow
                label="Referensi persetujuan"
                value={changeOrderForm.clientReference}
              />
              <ReviewRow
                label="Tanggal persetujuan"
                value={formatDateDisplay(changeOrderForm.clientConfirmedAt)}
              />
            </FormSection>

            <FormRiskNotice title="Persetujuan mengikat kontrak" tone="warning">
              Setelah disetujui, nilai kontrak dan baseline RAB proyek akan diperbarui menjadi R{targetRevision}. Revisi sebelumnya akan terkunci sebagai riwayat audit dan tidak dapat diedit langsung.
            </FormRiskNotice>
          </div>
        ) : (
          /* Step 1: Input Mode */
          <>
            <FormSection
              title="Alasan & lingkup revisi"
              helper="Jelaskan latar belakang dan perubahan pekerjaan secara spesifik untuk transparansi audit."
            >
              <FormField
                label="Alasan perubahan"
                required
                helper="Minimal 10 karakter latar belakang revisi"
              >
                <Textarea
                  rows={3}
                  value={changeOrderForm.reason}
                  onChange={(value) =>
                    setChangeOrderForm((curr) => ({ ...curr, reason: value }))
                  }
                  placeholder="Contoh: Permintaan penambahan pekerjaan partisi dan upgrade material lantai oleh klien."
                />
              </FormField>
              <FormField
                label="Ringkasan lingkup pekerjaan"
                required
                helper="Rincian pekerjaan tambah/kurang dari baseline sebelumnya"
              >
                <Textarea
                  rows={3}
                  value={changeOrderForm.scopeSummary}
                  onChange={(value) =>
                    setChangeOrderForm((curr) => ({
                      ...curr,
                      scopeSummary: value,
                    }))
                  }
                  placeholder="Contoh: Pekerjaan partisi gypsum 2 sisi R2 ditambah 24 m2, penyesuaian tipe vinyl flooring area living."
                />
              </FormField>
            </FormSection>

            <FormSection
              title="Persetujuan klien"
              helper="Pastikan persetujuan resmi klien sudah diterima sebelum memproses revisi kontrak."
            >
              <FormField
                label="Referensi persetujuan"
                required
                helper="Nomor surat, nomor SPK, judul email, atau bukti pesan resmi"
              >
                <TextInput
                  value={changeOrderForm.clientReference}
                  onChange={(value) =>
                    setChangeOrderForm((curr) => ({
                      ...curr,
                      clientReference: value,
                    }))
                  }
                  placeholder="Contoh: Email konfirmasi Pak Budi (22 Juni 2026)"
                />
              </FormField>
              <DatePickerField
                label="Tanggal persetujuan klien"
                value={changeOrderForm.clientConfirmedAt}
                onChange={(value) =>
                  setChangeOrderForm((curr) => ({
                    ...curr,
                    clientConfirmedAt: value,
                  }))
                }
              />
            </FormSection>

            <FormRiskNotice
              title="Perubahan baseline resmi"
              tone={valueDelta > 0 ? "warning" : "default"}
            >
              Form ini menyiapkan pengajuan perubahan kontrak. Baseline resmi proyek baru akan diperbarui setelah Anda meninjau dan menyetujui langkah berikutnya.
            </FormRiskNotice>
          </>
        )}
      </div>
    </WorkflowFormSheet>
  );
}

export function VoidRevisionDrawer({
  voidRevisionOpen,
  setVoidRevisionOpen,
  voidReason,
  setVoidReason,
  handleVoidRabRevision,
  isPending,
}: {
  readonly voidRevisionOpen: boolean;
  readonly setVoidRevisionOpen: (open: boolean) => void;
  readonly voidReason: string;
  readonly setVoidReason: (reason: string) => void;
  readonly handleVoidRabRevision: () => void;
  readonly isPending: boolean;
}): React.JSX.Element {
  return (
    <ConfirmationDialog
      open={voidRevisionOpen}
      title="Batalkan Revisi?"
      description="Revisi ini akan ditandai VOID. RAB approved, nilai kontrak, budget, RAP, dan paket tidak berubah."
      confirmLabel="Batalkan Revisi"
      danger
      pending={isPending}
      disabled={voidReason.trim().length < 3}
      onClose={() => setVoidRevisionOpen(false)}
      onConfirm={handleVoidRabRevision}
    >
      <FormField label="Alasan pembatalan" helper="Wajib diisi, minimal 3 karakter.">
        <Textarea
          autoFocus
          rows={3}
          value={voidReason}
          onChange={setVoidReason}
          placeholder="Contoh: Klien membatalkan perubahan lingkup"
        />
      </FormField>
    </ConfirmationDialog>
  );
}

export function ChangeOrderDetailDrawer({
  historyDetailId,
  setHistoryDetailId,
  changeOrders,
}: {
  readonly historyDetailId: string | null;
  readonly setHistoryDetailId: (id: string | null) => void;
  readonly changeOrders: readonly ChangeOrderHistoryView[];
}): React.JSX.Element | null {
  const selectedOrder = changeOrders.find((item) => item.id === historyDetailId);
  const {
    presentedValue: order,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedOrder, historyDetailId);
  if (!order) return null;

  return (
    <DetailSheet
      open={open}
      title="Detail Change Order"
      onClose={() => setHistoryDetailId(null)}
      onExitComplete={handleExitComplete}
    >
      <div className="space-y-md">
        {/* Comparison Header Card */}
        <div className="rounded-3xl bg-surface-container-lowest p-4 ring-1 ring-ring-subtle shadow-surface">
          <div className="flex items-center justify-between gap-2">
            <span className="text-meta font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              Riwayat Revisi Kontrak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-meta font-bold text-primary">
              R{order.baseRevision} → R{order.revisedRevision}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-outline-variant/20 rounded-2xl bg-surface-container-low p-2.5">
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Sebelum
              </p>
              <div className="mt-1 flex justify-center font-mono text-xs font-bold tabular-nums text-on-surface">
                <MoneyValue
                  amount={Number(order.previousContractValue)}
                  variant="compact"
                  size="xs"
                  align="center"
                />
              </div>
            </div>
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Sesudah
              </p>
              <div className="mt-1 flex justify-center font-mono text-xs font-bold tabular-nums text-on-surface">
                <MoneyValue
                  amount={Number(order.revisedContractValue)}
                  variant="compact"
                  size="xs"
                  align="center"
                />
              </div>
            </div>
            <div className="px-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                Selisih
              </p>
              <div
                className={`mt-1 flex justify-center font-mono text-xs font-bold tabular-nums ${
                  Number(order.valueDelta) > 0
                    ? "text-warning"
                    : Number(order.valueDelta) < 0
                      ? "text-success"
                      : "text-on-surface-variant"
                }`}
              >
                <MoneyValue
                  amount={Math.abs(Number(order.valueDelta))}
                  variant="compact"
                  size="xs"
                  align="center"
                  prefix={
                    Number(order.valueDelta) > 0
                      ? "+ "
                      : Number(order.valueDelta) < 0
                        ? "- "
                        : ""
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Audit Facts */}
        <div className="overflow-hidden rounded-3xl bg-surface-container-lowest divide-y divide-outline-variant/20 ring-1 ring-ring-subtle shadow-surface">
          <ReviewRow label="Status" value={formatBusinessLabel(order.status)} />
          <ReviewRow label="Sumber" value={order.sourceRevisionSummary} />
          <ReviewRow label="Alasan perubahan" value={order.reason} />
          <ReviewRow label="Lingkup pekerjaan" value={order.scopeSummary} />
          <ReviewRow
            label="Referensi persetujuan"
            value={order.clientConfirmationReference ?? "Belum ada"}
          />
          <ReviewRow
            label="Tanggal persetujuan klien"
            value={formatDateDisplay(order.clientConfirmedAt ? String(order.clientConfirmedAt) : null)}
          />
          <ReviewRow
            label="Dibuat oleh"
            value={order.createdByName}
            subvalue={new Date(order.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
          />
          {order.approvedByName ? (
            <ReviewRow
              label="Disetujui oleh"
              value={order.approvedByName}
              subvalue={order.approvedAt ? new Date(order.approvedAt).toLocaleDateString("id-ID", { dateStyle: "long" }) : undefined}
            />
          ) : null}
        </div>
      </div>
    </DetailSheet>
  );
}
