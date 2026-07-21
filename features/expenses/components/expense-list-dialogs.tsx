"use client";

import React from "react";

import {
  FieldContextLine,
  FormField,
  FormRiskNotice,
  FormSection,
  SheetSelect,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import {
  FinanceUnsavedChangesModal,
  MoneyImpactRow,
} from "@/features/finance/components/finance-form-patterns";
import type {
  BankAccountItem,
  ExpenseCostItem,
} from "@/features/expenses/components/expense-list-types";

type ReceiptImageLightboxProps = {
  readonly imageUrl: string | null;
  readonly onClose: () => void;
};

export function ReceiptImageLightbox({
  imageUrl,
  onClose,
}: ReceiptImageLightboxProps): React.JSX.Element | null {
  if (!imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="p-md fixed inset-0 z-100 flex items-center justify-center bg-black/95 transition-opacity duration-200"
    >
      <div className="relative max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Receipt Zoomed"
          className="max-h-[80vh] max-w-full rounded-2xl border border-white/5 object-contain shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition-transform active:scale-90"
          aria-label="Tutup nota"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <p className="mt-md text-center font-sans text-[8px] font-bold tracking-wider text-white/70 uppercase">
          Ketuk di luar gambar untuk menutup
        </p>
      </div>
    </div>
  );
}

type FieldDisbursementSheetProps = {
  readonly selectedCost: ExpenseCostItem | null;
  readonly bankAccounts: readonly BankAccountItem[];
  readonly selectedBankId: string;
  readonly refNumber: string;
  readonly isDirty: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSubmit: () => void;
  readonly onBankChange: (value: string) => void;
  readonly onRefNumberChange: (value: string) => void;
};

export function FieldDisbursementSheet({
  selectedCost,
  bankAccounts,
  selectedBankId,
  refNumber,
  isDirty,
  pending,
  error,
  success,
  onClose,
  onDiscard,
  onSubmit,
  onBankChange,
  onRefNumberChange,
}: FieldDisbursementSheetProps): React.JSX.Element | null {
  const {
    presentedValue: presentedCost,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedCost, selectedCost?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  if (!presentedCost) return null;
  const amount = Number(presentedCost.amount);
  const selectedAccount = bankAccounts.find((account) => account.id === selectedBankId);
  const before = Number(selectedAccount?.balance ?? 0);
  const after = before - amount;
  const canContinue = Boolean(selectedBankId && refNumber.trim()) && after >= 0;
  const disabledReason = !selectedBankId
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
        title={reviewing ? "Tinjau pencairan dana" : "Pencairan dana"}
        onClose={requestClose}
        pending={pending}
        pendingLabel="Mencairkan…"
        disabled={!canContinue}
        disabledReason={disabledReason}
        danger={reviewing}
        primaryLabel={reviewing ? "Cairkan" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        onPrimary={() => (reviewing ? onSubmit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {error && (
            <div className="border-error/30 bg-error-container/20 text-error flex items-start gap-3 rounded-xl border p-3.5 text-xs font-medium">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              <div className="leading-relaxed">{error}</div>
            </div>
          )}
          {success ? <FieldContextLine tone="success">{success}</FieldContextLine> : null}

          <FormSection title="Rincian Pengeluaran">
            <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
              <ReviewFact
                label="Jumlah Pencairan"
                value={
                  <span className="font-numeral text-primary text-[14px] font-bold">
                    Rp {Number(presentedCost.amount).toLocaleString("id-ID")}
                  </span>
                }
              />
              <ReviewFact label="Proyek" value={presentedCost.project?.name ?? "–"} />
              <ReviewFact label="Pengaju (PM)" value={presentedCost.requestedBy?.name ?? "–"} />
              {presentedCost.description && (
                <ReviewFact label="Keterangan" value={presentedCost.description} />
              )}
            </div>
          </FormSection>

          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Dampak Keuangan"
                helper="Periksa dampak pencairan dana pada saldo kas rekening."
              >
                <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
                  <ReviewFact label="Rekening Sumber" value={selectedAccount?.name ?? "–"} />
                  <ReviewFact
                    label="Saldo Rekening"
                    value={
                      <span
                        className={after < 0 ? "text-error font-bold" : "text-primary font-bold"}
                      >
                        Rp {before.toLocaleString("id-ID")} → Rp {after.toLocaleString("id-ID")}
                      </span>
                    }
                  />
                  <ReviewFact label="Referensi transfer" value={refNumber} />
                </div>
              </FormSection>
              <FormRiskNotice title="Pencairan final" tone="warning">
                Sistem menandai pengeluaran lunas, mencatat ledger rekonsiliasi, dan menyinkronkan
                budget. Koreksi dilakukan melalui transaksi pembalik.
              </FormRiskNotice>
            </div>
          ) : (
            <form
              id="expense-disburse-form"
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Pencairan Pengeluaran"
                helper="Pilih rekening bank sumber kas kecil proyek dan isi nomor referensi transfer."
              >
                <div className="divide-outline-variant/20 grid grid-cols-1 divide-y">
                  <SheetSelect
                    label="Rekening Sumber Dana"
                    value={selectedBankId}
                    disabled={pending}
                    onChange={onBankChange}
                    options={bankAccounts.map((acc) => ({
                      value: acc.id,
                      label: `${acc.bankName} - ${acc.name}`,
                      description: `Saldo Rp ${Number(acc.balance).toLocaleString("id-ID")}`,
                    }))}
                    required
                  />

                  <FormField label="Nomor Referensi Bukti Transfer" required>
                    <TextInput
                      value={refNumber}
                      disabled={pending}
                      onChange={onRefNumberChange}
                      placeholder="Contoh: TRF-BCA-10294"
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

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-on-surface text-right font-bold">{value}</span>
    </div>
  );
}
