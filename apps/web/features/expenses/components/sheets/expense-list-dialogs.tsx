"use client";
import {
  AppIcon,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  FactRow,
  GroupedSurface,
  MoneyValue,
  MediaPreviewDialog,
  AdaptiveSelect,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
  Button,
} from "@/components/ui";
import React from "react";

import type {
  BankAccountItem,
  ExpenseCostItem,
} from "@/features/expenses/types/expense-list-types";
import { deriveExpensePaymentReference } from "@atria/core/finance/invoice-prefill";

type ReceiptImageLightboxProps = {
  readonly imageUrl: string | null;
  readonly onClose: () => void;
};

export function ReceiptImageLightbox({
  imageUrl,
  onClose,
}: ReceiptImageLightboxProps): React.JSX.Element | null {
  return (
    <MediaPreviewDialog
      open={Boolean(imageUrl)}
      title="Pratinjau nota"
      purpose="document"
      imageUrl={imageUrl}
      alt="Bukti nota pengeluaran"
      caption="Ketuk di luar dialog atau tekan Escape untuk menutup."
      onClose={onClose}
    />
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

  const handleExit = React.useCallback((): void => {
    handleExitComplete();
    setReviewing(false);
    setConfirmClose(false);
  }, [handleExitComplete]);

  const prevCostIdRef = React.useRef(selectedCost?.id);
  React.useEffect(() => {
    if (selectedCost?.id !== prevCostIdRef.current) {
      prevCostIdRef.current = selectedCost?.id;
      setReviewing(false);
      setConfirmClose(false);
    }
  }, [selectedCost?.id]);

  if (!presentedCost) return null;
  const amount = Number(presentedCost.amount);
  const selectedAccount = bankAccounts.find((account) => account.id === selectedBankId);
  const suggestedRef = presentedCost
    ? deriveExpensePaymentReference({
        bankName: selectedAccount?.bankName || selectedAccount?.name,
        projectName: presentedCost.project?.name,
        categoryCode:
          presentedCost.budgetCategory?.expenseCategory?.code ||
          presentedCost.budgetItem?.costCategory?.name ||
          presentedCost.budgetItem?.name,
        costTitle: presentedCost.description,
      })
    : "";
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
        dismissal={{ mode: "managed" }}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-ring-subtle">
              <FactRow
                layout="stacked"
                label="Proyek"
                wrapLabel
                value={presentedCost.project?.name ?? "–"}
              />
              <FactRow
                layout="stacked"
                label="Jumlah pencairan"
                wrapLabel
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(amount) ? 0 : 2}
                    variant="fullDynamic"
                    amount={amount}
                  />
                }
              />
              <FactRow
                layout="stacked"
                label="Sumber dana"
                wrapLabel
                value={
                  selectedAccount?.name ??
                  (selectedBankId ? "Rekening tidak tersedia" : "Belum dipilih")
                }
              />
              {selectedAccount ? (
                <>
                  <FactRow
                    layout="stacked"
                    label="Saldo saat ini"
                    wrapLabel
                    value={
                      <MoneyValue
                        fractionDigits={Number.isInteger(before) ? 0 : 2}
                        variant="fullDynamic"
                        amount={before}
                      />
                    }
                  />
                  <FactRow
                    layout="stacked"
                    label="Saldo pratinjau"
                    wrapLabel
                    value={
                      <MoneyValue
                        fractionDigits={Number.isInteger(after) ? 0 : 2}
                        variant="fullDynamic"
                        amount={after}
                        tone={after < 0 ? "danger" : "default"}
                      />
                    }
                  />
                </>
              ) : null}
            </div>
          </GroupedSurface>
        }
        open={open}
        onExitComplete={handleExit}
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
            <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs font-medium text-error">
              <AppIcon name="error" className="icon-md text-error" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}
          {success ? (
            <div className="flex items-start gap-3 rounded-2xl bg-success/10 p-3.5 text-xs font-medium text-success ring-1 ring-success/20">
              <AppIcon name="check-circle" className="icon-md shrink-0 text-success" />
              <div className="leading-relaxed">{success}</div>
            </div>
          ) : null}

          <FormSection title="Rincian Pengeluaran">
            <ReviewFact
              label="Jumlah Pencairan"
              value={
                <span className="font-numeral text-[14px] font-bold text-primary">
                  Rp {Number(presentedCost.amount).toLocaleString("id-ID")}
                </span>
              }
            />
            <ReviewFact label="Proyek" value={presentedCost.project?.name ?? "–"} />
            <ReviewFact label="Pengaju (PM)" value={presentedCost.requestedBy?.name ?? "–"} />
            {presentedCost.description && (
              <ReviewFact label="Keterangan" value={presentedCost.description} />
            )}
          </FormSection>

          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Dampak Keuangan"
                helper="Periksa dampak pencairan dana pada saldo kas rekening."
              >
                <ReviewFact label="Rekening Sumber" value={selectedAccount?.name ?? "–"} />
                <ReviewFact
                  label="Saldo Rekening"
                  value={
                    <span className={after < 0 ? "font-bold text-error" : "font-bold text-primary"}>
                      Rp {before.toLocaleString("id-ID")} → Rp {after.toLocaleString("id-ID")}
                    </span>
                  }
                />
                <ReviewFact label="Referensi transfer" value={refNumber} />
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
                helper="Pilih rekening bank sumber kas kecil proyek. Nomor referensi terisi otomatis dan dapat disesuaikan."
              >
                <AdaptiveSelect
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
                    placeholder={
                      suggestedRef ? `Contoh: ${suggestedRef}` : "Contoh: TRF-BCA-BSR-OPS"
                    }
                  />
                </FormField>
                {suggestedRef && refNumber !== suggestedRef ? (
                  <div className="flex items-center justify-between bg-surface-container-low/50 px-4 py-2 text-meta">
                    <span className="text-on-surface-variant">
                      Format standar:{" "}
                      <strong className="font-mono text-on-surface">{suggestedRef}</strong>
                    </span>
                    <Button
                      type="button"
                      onClick={() => onRefNumberChange(suggestedRef)}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/15 active:z-10 active:shadow-raised"
                      variant="secondary"
                      size="mini"
                    >
                      Gunakan
                    </Button>
                  </div>
                ) : null}
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
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
