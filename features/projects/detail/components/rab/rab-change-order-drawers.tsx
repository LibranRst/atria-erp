"use client";

import React from "react";
import { motion } from "framer-motion";

import {
  BottomSheet,
  ConfirmationModal,
  ConfirmationSheet,
  DatePickerField,
  FormField,
  FormRiskNotice,
  FormSection,
  OperationalFormSheet,
  Textarea,
  TextInput,
  ValuePreviewStrip,
} from "@/components/ui";
import { MetricGrid } from "@/components/ui/page-primitives";
import {
  MiniMoneyMetric,
  RabMoneyBlock,
} from "../shared/rap-rab-primitives";
import type {
  ChangeOrderHistoryView,
  RabRevisionHistoryView,
} from "../shared/rap-rab-manager";
import type { RabChangeOrderForm } from "./rab-drawer-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
  readonly setChangeOrderForm: React.Dispatch<
    React.SetStateAction<RabChangeOrderForm>
  >;
  readonly handleApproveChangeOrder: () => void;
  readonly isPending: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
}): React.JSX.Element {
  const [confirmApprove, setConfirmApprove] = React.useState(false);
  const formValid = changeOrderForm.reason.trim().length >= 10
    && changeOrderForm.scopeSummary.trim().length >= 10
    && changeOrderForm.clientReference.trim().length >= 3;
  const valueDelta = visibleRabValue - (approvedBaseline?.value ?? 0);

  return (
    <>
    <OperationalFormSheet
      open={changeOrderOpen}
      title="Proses Change Order"
      onClose={() => setChangeOrderOpen(false)}
      submitLabel="Tinjau Change Order"
      submittingLabel="Memproses…"
      pending={isPending}
      disabled={!formValid}
      disabledReason={!formValid ? "Lengkapi alasan, ringkasan lingkup, dan referensi persetujuan klien." : undefined}
      onSubmit={() => setConfirmApprove(true)}
      statusText={`Nilai baru Rp ${visibleRabValue.toLocaleString("id-ID")} · Selisih Rp ${valueDelta.toLocaleString("id-ID")}`}
      statusTone={!formValid || valueDelta > 0 ? "warning" : "success"}
    >
      <div className="space-y-md">
        <FormSection title="1 · Dampak nilai" helper="Perbandingan ini akan menjadi baseline kontrak baru setelah persetujuan final.">
        <ValuePreviewStrip items={[{ label: "Sebelum", amount: approvedBaseline?.value ?? 0 }, { label: "Sesudah", amount: visibleRabValue, tone: "success" }, { label: "Selisih", amount: valueDelta, tone: valueDelta > 0 ? "warning" : "default" }]} />
        </FormSection>
        <FormSection title="2 · Alasan & lingkup" helper="Jelaskan perubahan secara spesifik agar riwayat revisi mudah diaudit.">
        <FormField label="Alasan perubahan" helper="Minimal 10 karakter.">
          <Textarea
            rows={3}
            value={changeOrderForm.reason}
            onChange={(value) =>
              setChangeOrderForm((curr) => ({ ...curr, reason: value }))
            }
          />
        </FormField>
        <FormField label="Ringkasan lingkup lama ke baru">
          <Textarea
            rows={4}
            value={changeOrderForm.scopeSummary}
            onChange={(value) =>
              setChangeOrderForm((curr) => ({
                ...curr,
                scopeSummary: value,
              }))
            }
          />
        </FormField>
        </FormSection>
        <FormSection title="3 · Bukti persetujuan klien" helper="Pastikan persetujuan klien sudah tersedia sebelum meninjau Change Order.">
        <FormField label="Referensi persetujuan klien">
          <TextInput
            value={changeOrderForm.clientReference}
            onChange={(value) =>
              setChangeOrderForm((curr) => ({
                ...curr,
                clientReference: value,
              }))
            }
            placeholder="Contoh: Email 22 Juni 2026"
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
        <FormRiskNotice title="Belum mengubah kontrak" tone="default">Form ini hanya menyiapkan review. Nilai kontrak berubah setelah konfirmasi final di popup berikutnya.</FormRiskNotice>
        </FormSection>
      </div>
    </OperationalFormSheet>
    <ConfirmationModal
      open={confirmApprove}
      title="Setujui Change Order?"
      description="Nilai RAB dan kontrak proyek akan diperbarui. Revisi yang disetujui menjadi baseline baru dan tidak diedit langsung."
      tone="warning"
      onClose={() => setConfirmApprove(false)}
      actions={(
        <div className="grid grid-cols-2 gap-2">
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmApprove(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface">Kembali</motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending} onClick={() => { setConfirmApprove(false); handleApproveChangeOrder(); }} className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">Setujui Perubahan</motion.button>
        </div>
      )}
    >
      <MetricGrid>
        <MiniMoneyMetric label="Nilai sebelumnya" value={approvedBaseline?.value ?? 0} />
        <MiniMoneyMetric label="Nilai baru" value={visibleRabValue} />
        <MiniMoneyMetric label="Selisih" value={valueDelta} />
      </MetricGrid>
    </ConfirmationModal>
    </>
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
    <ConfirmationSheet
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
      <FormField
        label="Alasan pembatalan"
        helper="Wajib diisi, minimal 3 karakter."
      >
        <Textarea
          autoFocus
          rows={3}
          value={voidReason}
          onChange={setVoidReason}
          placeholder="Contoh: Klien membatalkan perubahan lingkup"
        />
      </FormField>
    </ConfirmationSheet>
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
  const order = changeOrders.find((item) => item.id === historyDetailId);
  if (!order) return null;

  return (
    <BottomSheet
      open={Boolean(historyDetailId)}
      title="Detail Change Order"
      onClose={() => setHistoryDetailId(null)}
    >
      <div className="space-y-sm">
        <MetricGrid>
          <RabMoneyBlock
            label="Sebelum"
            value={Number(order.previousContractValue)}
          />
          <RabMoneyBlock label="Selisih" value={Number(order.valueDelta)} />
          <RabMoneyBlock
            label="Sesudah"
            value={Number(order.revisedContractValue)}
          />
        </MetricGrid>
        <div className="rounded-2xl bg-primary/5 p-3 text-xs font-bold text-primary">
          Sumber: {order.sourceRevisionSummary}
        </div>
        <div className="rounded-2xl bg-surface-container-low p-3">
          <p className="text-[9px] font-bold uppercase text-on-surface-variant">
            Alasan
          </p>
          <p className="mt-1 text-xs leading-5">{order.reason}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-3">
          <p className="text-[9px] font-bold uppercase text-on-surface-variant">
            Scope R{order.baseRevision} → R{order.revisedRevision}
          </p>
          <p className="mt-1 text-xs leading-5">{order.scopeSummary}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-3 text-xs leading-5">
          <p>
            <strong>Bukti persetujuan klien:</strong>{" "}
            {order.clientConfirmationReference ?? "Belum ada"}
          </p>
          <p>
            <strong>Tanggal persetujuan klien:</strong>{" "}
            {order.clientConfirmedAt
              ? new Date(order.clientConfirmedAt).toLocaleDateString("id-ID")
              : "Belum"}
          </p>
          <p>
            <strong>Dibuat oleh:</strong> {order.createdByName} ·{" "}
            {new Date(order.createdAt).toLocaleDateString("id-ID")}
          </p>
          <p>
            <strong>Disetujui oleh:</strong> {order.approvedByName ?? "Belum"}
            {order.approvedAt
              ? ` · ${new Date(order.approvedAt).toLocaleDateString("id-ID")}`
              : ""}
          </p>
          <p>
            <strong>Status:</strong> {order.status}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
