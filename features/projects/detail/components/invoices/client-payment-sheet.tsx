"use client";

import React from "react";

import {
  DatePickerField,
  FieldContextLine,
  FormField,
  FormSection,
  MoneyInput,
  WorkflowFormSheet,
  SheetSelect,
  TextInput,
  useSheetPresenceValue,
} from "@/components/ui";
import {
  FinanceUnsavedChangesModal,
  MoneyImpactRow,
} from "@/features/finance-dashboard/components/shared/finance-form-patterns";
import type { BankAccountItem, ClientInvoiceItem } from "../../types/project-invoices-types";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function ClientPaymentSheet({
  selectedInvoice,
  bankAccounts,
  amountPaid,
  setAmountPaid,
  selectedBankId,
  setSelectedBankId,
  refNumber,
  setRefNumber,
  paymentDate,
  setPaymentDate,
  isDirty,
  isPending,
  error,
  success,
  onClose,
  onDiscard,
  onSubmit,
}: {
  readonly selectedInvoice: ClientInvoiceItem | null;
  readonly bankAccounts: readonly BankAccountItem[];
  readonly amountPaid: string;
  readonly setAmountPaid: (value: string) => void;
  readonly selectedBankId: string;
  readonly setSelectedBankId: (value: string) => void;
  readonly refNumber: string;
  readonly setRefNumber: (value: string) => void;
  readonly paymentDate: string;
  readonly setPaymentDate: (value: string) => void;
  readonly isDirty: boolean;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly onClose: () => void;
  readonly onDiscard: () => void;
  readonly onSubmit: () => void;
}): React.JSX.Element | null {
  const {
    presentedValue: invoice,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedInvoice, selectedInvoice?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  if (!invoice) return null;
  const invoiceAmount = Number(invoice.amount);
  const paidAmount = Number(amountPaid || 0);
  const paidBefore = invoice.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const remaining = Math.max(0, invoiceAmount - paidBefore);
  const selectedAccount = bankAccounts.find((account) => account.id === selectedBankId);
  const accountBefore = Number(selectedAccount?.balance ?? 0);
  const overpayment = paidAmount > remaining;
  const canSave =
    Boolean(selectedBankId) &&
    paidAmount > 0 &&
    refNumber.trim().length > 0 &&
    Boolean(paymentDate);
  const disabledReason = !selectedBankId
    ? "Pilih rekening penerima dana."
    : paidAmount <= 0
      ? "Isi nominal diterima lebih dari 0."
      : !refNumber.trim()
        ? "Isi nomor referensi bukti transfer."
        : !paymentDate
          ? "Isi tanggal transaksi diterima."
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
        title={reviewing ? "Tinjau penerimaan klien" : "Penerimaan kas termin"}
        onClose={requestClose}
        pending={isPending}
        disabled={!canSave}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Catat" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Mencatat…"
        statusText={
          overpayment
            ? `Nominal melebihi sisa invoice sebesar Rp ${(paidAmount - remaining).toLocaleString("id-ID")}.`
            : undefined
        }
        statusTone={overpayment ? "warning" : "default"}
        onPrimary={() => (reviewing ? onSubmit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs font-medium text-error">
              <AppIcon name="error" className="text-[18px] text-error" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs font-medium text-primary">
              <AppIcon name="check_circle" className="text-[18px] text-primary" />
              <div className="leading-relaxed">{success}</div>
            </div>
          )}

          <FieldContextLine>
            Invoice {invoice.invoiceNumber} · Sisa Rp {remaining.toLocaleString("id-ID")}
          </FieldContextLine>

          {reviewing ? (
            <div className="space-y-3">
              <MoneyImpactRow
                label={selectedAccount?.name ?? "Rekening penerima"}
                before={accountBefore}
                delta={paidAmount}
                after={accountBefore + paidAmount}
              />
              <FormSection
                title="Dampak invoice"
                helper="Kas masuk dan status invoice diperbarui bersama."
              >
                <FieldContextLine>
                  Terbayar sebelum: Rp {paidBefore.toLocaleString("id-ID")}
                </FieldContextLine>
                <FieldContextLine tone={overpayment ? "warning" : "success"}>
                  Sisa sesudah: Rp {Math.max(0, remaining - paidAmount).toLocaleString("id-ID")}
                  {overpayment ? " · periksa kelebihan bayar" : ""}
                </FieldContextLine>
                <FieldContextLine>
                  {paymentDate} · Referensi {refNumber}
                </FieldContextLine>
              </FormSection>
            </div>
          ) : (
            <form
              id="client-payment-form"
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Dana masuk"
                helper="Rekening dan nominal yang benar-benar diterima."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <SheetSelect
                    label="Rekening Penerima Dana (DEBIT)"
                    value={selectedBankId}
                    disabled={isPending}
                    onChange={setSelectedBankId}
                    options={bankAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.bankName} - ${account.name}`,
                      description: `Saldo Rp ${Number(account.balance).toLocaleString("id-ID")}`,
                    }))}
                    required
                  />

                  <FormField label="Nominal Diterima" required>
                    <MoneyInput
                      value={amountPaid}
                      disabled={isPending}
                      onChange={setAmountPaid}
                      placeholder="Masukkan nominal transfer"
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                title="Referensi transaksi"
                helper="Untuk rekonsiliasi bank dan audit kas."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <FormField label="Nomor Referensi Bukti Transfer" required>
                    <TextInput
                      value={refNumber}
                      disabled={isPending}
                      onChange={setRefNumber}
                      placeholder="Contoh: TRANSFER-KLIEN-0238"
                    />
                  </FormField>

                  <DatePickerField
                    label="Tanggal Transaksi Diterima"
                    value={paymentDate}
                    disabled={isPending}
                    onChange={setPaymentDate}
                    required
                  />
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
