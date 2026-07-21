"use client";

import React from "react";

import {
  DatePickerField,
  FieldContextLine,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  SheetSelect,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import { FinanceUnsavedChangesModal } from "@/features/finance/components/finance-form-patterns";
import type {
  VendorListBankAccount,
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/components/vendor-bill-list-types";
import { getBillPaymentSummary } from "@/features/expenses/components/vendor-bill-list-utils";

type VendorSchedulePaymentSheetProps = {
  readonly bill: VendorListBill | null;
  readonly bankAccounts: readonly VendorListBankAccount[];
  readonly isPending: boolean;
  readonly error: string | null;
  readonly selectedBankId: string;
  readonly scheduleAmount: string;
  readonly scheduleDate: string;
  readonly isDirty: boolean;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSubmit: () => void;
  readonly onSelectedBankIdChange: (value: string) => void;
  readonly onScheduleAmountChange: (value: string) => void;
  readonly onScheduleDateChange: (value: string) => void;
};

export function VendorSchedulePaymentSheet({
  bill,
  bankAccounts,
  isPending,
  error,
  selectedBankId,
  scheduleAmount,
  scheduleDate,
  isDirty,
  onClose,
  onDiscard,
  onSubmit,
  onSelectedBankIdChange,
  onScheduleAmountChange,
  onScheduleDateChange,
}: VendorSchedulePaymentSheetProps): React.JSX.Element | null {
  const {
    presentedValue: presentedBill,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(bill, bill?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  if (!presentedBill) return null;

  const amount = Number(scheduleAmount || 0);
  const { totalScheduledOrPaid } = getBillPaymentSummary(presentedBill);
  const remaining = Math.max(0, Number(presentedBill.amount) - totalScheduledOrPaid);
  const selectedAccount = bankAccounts.find((account) => account.id === selectedBankId);
  const canContinue = Boolean(selectedBankId && scheduleDate) && amount > 0 && amount <= remaining;
  const disabledReason = !selectedBankId
    ? "Pilih rekening yang direncanakan."
    : amount <= 0
      ? "Isi nominal pembayaran lebih dari Rp 0."
      : amount > remaining
        ? `Nominal melebihi sisa tagihan Rp ${remaining.toLocaleString("id-ID")}.`
        : !scheduleDate
          ? "Pilih tanggal pembayaran."
          : undefined;

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <WorkflowFormSheet
        open={open}
        onExitComplete={handleExitComplete}
        title={reviewing ? "Tinjau rencana pembayaran" : "Jadwalkan pembayaran vendor"}
        onClose={requestClose}
        pending={isPending}
        pendingLabel="Menjadwalkan…"
        disabled={!canContinue}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Jadwalkan" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        onPrimary={() => (reviewing ? onSubmit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          <PaymentError error={error} />
          <FieldContextLine>
            {presentedBill.vendor?.name} · Tagihan {presentedBill.billNumber} · Sisa Rp{" "}
            {remaining.toLocaleString("id-ID")}
          </FieldContextLine>
          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Rencana yang akan dibuat"
                helper="Penjadwalan belum mengurangi saldo rekening."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <ReviewFact
                    label="Rekening rencana"
                    value={
                      selectedAccount
                        ? `${selectedAccount.bankName} · ${selectedAccount.name}`
                        : "–"
                    }
                  />
                  <ReviewFact
                    label="Tanggal"
                    value={new Date(scheduleDate).toLocaleDateString("id-ID", {
                      dateStyle: "long",
                    })}
                  />
                  <ReviewFact label="Nominal" value={`Rp ${amount.toLocaleString("id-ID")}`} />
                  <ReviewFact
                    label="Sisa setelah dijadwalkan"
                    value={`Rp ${Math.max(0, remaining - amount).toLocaleString("id-ID")}`}
                  />
                </div>
              </FormSection>
              <FormRiskNotice
                title={amount >= 5_000_000 ? "Memerlukan persetujuan Owner" : "Saldo belum berubah"}
                tone={amount >= 5_000_000 ? "warning" : "default"}
              >
                {amount >= 5_000_000
                  ? "Nominal ini membuat approval sebelum pembayaran dapat dicairkan."
                  : "Saldo baru berkurang ketika pembayaran dicairkan dengan bukti transfer."}
              </FormRiskNotice>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Rencana Pembayaran"
                helper="Jadwalkan pembayaran untuk dicatat sebagai kewajiban kas masa depan."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <SheetSelect
                    label="Rekening Rencana"
                    value={selectedBankId}
                    disabled={isPending}
                    onChange={onSelectedBankIdChange}
                    options={bankAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.bankName} - ${account.name}`,
                      description: `Saldo Rp ${Number(account.balance).toLocaleString("id-ID")}`,
                    }))}
                    required
                  />
                  <DatePickerField
                    label="Tanggal Pembayaran"
                    value={scheduleDate}
                    disabled={isPending}
                    onChange={onScheduleDateChange}
                    required
                  />
                  <FormField label="Nominal Pembayaran" required>
                    <MoneyInput
                      value={scheduleAmount}
                      disabled={isPending}
                      onChange={onScheduleAmountChange}
                      placeholder="Masukkan nominal"
                    />
                  </FormField>
                </div>
              </FormSection>
            </form>
          )}
        </div>
      </WorkflowFormSheet>
      <FinanceUnsavedChangesModal
        open={confirmClose}
        onKeep={() => {
          setConfirmClose(false);
          onClose();
        }}
        onDiscard={() => {
          setConfirmClose(false);
          onDiscard();
        }}
        onContinue={() => setConfirmClose(false)}
      />
    </>
  );
}

type VendorDisbursePaymentSheetProps = {
  readonly payment: VendorListPayment | null;
  readonly bankAccounts: readonly VendorListBankAccount[];
  readonly isPending: boolean;
  readonly error: string | null;
  readonly disburseBankId: string;
  readonly refNumber: string;
  readonly isDirty: boolean;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSubmit: () => void;
  readonly onDisburseBankIdChange: (value: string) => void;
  readonly onRefNumberChange: (value: string) => void;
};

export function VendorDisbursePaymentSheet({
  payment,
  bankAccounts,
  isPending,
  error,
  disburseBankId,
  refNumber,
  isDirty,
  onClose,
  onDiscard,
  onSubmit,
  onDisburseBankIdChange,
  onRefNumberChange,
}: VendorDisbursePaymentSheetProps): React.JSX.Element | null {
  const {
    presentedValue: presentedPayment,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(payment, payment?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  if (!presentedPayment) return null;

  const amount = Number(presentedPayment.amountPaid);
  const selectedAccount = bankAccounts.find((account) => account.id === disburseBankId);
  const before = Number(selectedAccount?.balance ?? 0);
  const after = before - amount;
  const canContinue = Boolean(disburseBankId && refNumber.trim()) && after >= 0;
  const disabledReason = !disburseBankId
    ? "Pilih rekening sumber dana."
    : after < 0
      ? `Saldo kurang Rp ${Math.abs(after).toLocaleString("id-ID")}.`
      : !refNumber.trim()
        ? "Isi nomor referensi bukti transfer."
        : undefined;

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <WorkflowFormSheet
        open={open}
        onExitComplete={handleExitComplete}
        title={reviewing ? "Tinjau pembayaran vendor" : "Cairkan pembayaran vendor"}
        onClose={requestClose}
        pending={isPending}
        pendingLabel="Mencairkan…"
        disabled={!canContinue}
        disabledReason={disabledReason}
        danger={reviewing}
        primaryLabel={reviewing ? "Bayar" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        onPrimary={() => (reviewing ? onSubmit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          <PaymentError error={error} />
          <FieldContextLine>
            {presentedPayment.vendorBill?.vendor?.name} · {presentedPayment.vendorBill?.billNumber}{" "}
            · Rp {amount.toLocaleString("id-ID")}
          </FieldContextLine>
          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Dampak Keuangan"
                helper="Periksa dampak pencairan dana pada saldo kas rekening."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <ReviewFact label="Rekening Sumber" value={selectedAccount?.name ?? "–"} />
                  <ReviewFact
                    label="Saldo Rekening"
                    value={
                      <span
                        className={after < 0 ? "font-bold text-error" : "font-bold text-primary"}
                      >
                        Rp {before.toLocaleString("id-ID")} → Rp {after.toLocaleString("id-ID")}
                      </span>
                    }
                  />
                  <ReviewFact label="Referensi transfer" value={refNumber} />
                </div>
              </FormSection>
              <FormRiskNotice title="Transaksi kas final" tone="warning">
                Setelah dikonfirmasi, sistem mencatat ledger rekonsiliasi dan menandai pembayaran
                selesai. Koreksi dilakukan dengan transaksi pembalik, bukan mengedit mutasi ini.
              </FormRiskNotice>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Pencairan Pembayaran"
                helper="Pilih rekening bank sumber dan masukkan bukti transfer."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <SheetSelect
                    label="Rekening Sumber Dana"
                    value={disburseBankId}
                    disabled={isPending}
                    onChange={onDisburseBankIdChange}
                    options={bankAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.bankName} - ${account.name}`,
                      description: `Saldo Rp ${Number(account.balance).toLocaleString("id-ID")}`,
                    }))}
                    required
                  />
                  <FormField label="Nomor Referensi Bukti Transfer" required>
                    <TextInput
                      value={refNumber}
                      disabled={isPending}
                      onChange={onRefNumberChange}
                      placeholder="Contoh: TRF-BCA-55203"
                    />
                  </FormField>
                </div>
              </FormSection>
            </form>
          )}
        </div>
      </WorkflowFormSheet>
      <FinanceUnsavedChangesModal
        open={confirmClose}
        onKeep={() => {
          setConfirmClose(false);
          onClose();
        }}
        onDiscard={() => {
          setConfirmClose(false);
          onDiscard();
        }}
        onContinue={() => setConfirmClose(false)}
      />
    </>
  );
}

function PaymentError({ error }: { readonly error: string | null }): React.JSX.Element | null {
  if (!error) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-2xl bg-error-container/20 p-3 text-xs font-medium text-error"
      role="alert"
    >
      <span className="material-symbols-outlined text-[18px]">error</span>
      <div className="leading-relaxed">{error}</div>
    </div>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
