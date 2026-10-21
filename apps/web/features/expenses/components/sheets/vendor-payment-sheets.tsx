"use client";
import {
  AppIcon,
  DatePickerField,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  FactRow,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  AdaptiveSelect,
  StatusBadge,
  type StatusBadgeTone,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
  Button,
} from "@/components/ui";
import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import type {
  VendorListBankAccount,
  VendorListBill,
  VendorListPayment,
} from "@/features/expenses/types/vendor-bill-list-types";
import { getBillPaymentSummary } from "@/features/expenses/utils/vendor-bill-list-utils";
import { deriveVendorPaymentReference } from "@atria/core/finance/invoice-prefill";

type VendorSchedulePaymentSheetProps = {
  readonly bill: VendorListBill | null;
  /** Ambang dari konfigurasi server; klien hanya menjelaskan, tidak memutuskan. */
  readonly ownerApprovalThreshold: number;
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
  ownerApprovalThreshold,
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
  const desktop = useWorkspacePresentation() === "desktop";
  const {
    presentedValue: presentedBill,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(bill, bill?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);

  const handleExit = React.useCallback((): void => {
    handleExitComplete();
    setReviewing(false);
    setConfirmClose(false);
  }, [handleExitComplete]);

  const prevBillIdRef = React.useRef(bill?.id);
  React.useEffect(() => {
    if (bill?.id !== prevBillIdRef.current) {
      prevBillIdRef.current = bill?.id;
      setReviewing(false);
      setConfirmClose(false);
    }
  }, [bill?.id]);

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
        dismissal={{ mode: "managed" }}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-ring-subtle">
              <FactRow
                layout="stacked"
                label="Tagihan"
                wrapLabel
                value={presentedBill.billNumber}
              />
              <FactRow
                layout="stacked"
                label="Vendor"
                wrapLabel
                value={presentedBill.vendor?.name ?? "–"}
              />
              <FactRow
                layout="stacked"
                label="Belum dijadwalkan"
                wrapLabel
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(remaining) ? 0 : 2}
                    variant="fullDynamic"
                    amount={remaining}
                  />
                }
              />
              <FactRow
                layout="stacked"
                label="Nominal rencana"
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
                label="Rekening rencana"
                wrapLabel
                value={
                  selectedAccount?.name ??
                  (selectedBankId ? "Rekening tidak tersedia" : "Belum dipilih")
                }
              />
              <FactRow
                layout="stacked"
                label="Tanggal rencana"
                wrapLabel
                value={
                  scheduleDate
                    ? new Date(scheduleDate).toLocaleDateString("id-ID", { dateStyle: "medium" })
                    : "Belum dipilih"
                }
              />
              <p className="px-4 py-3 text-support text-on-surface-variant">
                Penjadwalan belum mengurangi saldo rekening.
              </p>
            </div>
          </GroupedSurface>
        }
        open={open}
        onExitComplete={handleExit}
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
          {!desktop ? (
            <VendorBillScheduleContextCard
              bill={presentedBill}
              remaining={remaining}
              totalScheduledOrPaid={totalScheduledOrPaid}
            />
          ) : null}
          {reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Rencana yang akan dibuat"
                helper="Penjadwalan belum mengurangi saldo rekening."
              >
                <ReviewFact
                  label="Rekening rencana"
                  value={
                    selectedAccount ? `${selectedAccount.bankName} · ${selectedAccount.name}` : "–"
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
              </FormSection>
              <FormRiskNotice
                title={
                  amount >= ownerApprovalThreshold
                    ? "Memerlukan persetujuan Owner"
                    : "Saldo belum berubah"
                }
                tone={amount >= ownerApprovalThreshold ? "warning" : "default"}
              >
                {amount >= ownerApprovalThreshold
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
                <AdaptiveSelect
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
  const desktop = useWorkspacePresentation() === "desktop";
  const {
    presentedValue: presentedPayment,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(payment, payment?.id);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);

  const handleExit = React.useCallback((): void => {
    handleExitComplete();
    setReviewing(false);
    setConfirmClose(false);
  }, [handleExitComplete]);

  const prevPaymentIdRef = React.useRef(payment?.id);
  React.useEffect(() => {
    if (payment?.id !== prevPaymentIdRef.current) {
      prevPaymentIdRef.current = payment?.id;
      setReviewing(false);
      setConfirmClose(false);
    }
  }, [payment?.id]);

  if (!presentedPayment) return null;

  const amount = Number(presentedPayment.amountPaid);
  const selectedAccount = bankAccounts.find((account) => account.id === disburseBankId);
  const suggestedRef = presentedPayment
    ? deriveVendorPaymentReference({
        bankName: selectedAccount?.bankName || selectedAccount?.name,
        vendorName: presentedPayment.vendorBill?.vendor?.name,
        billNumber: presentedPayment.vendorBill?.billNumber,
        projectName: presentedPayment.vendorBill?.project?.name,
      })
    : "";
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
        dismissal={{ mode: "managed" }}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-ring-subtle">
              <FactRow
                layout="stacked"
                label="Tagihan"
                wrapLabel
                value={presentedPayment.vendorBill?.billNumber ?? "–"}
              />
              <FactRow
                layout="stacked"
                label="Vendor"
                wrapLabel
                value={presentedPayment.vendorBill?.vendor?.name ?? "–"}
              />
              <FactRow
                layout="stacked"
                label="Pembayaran"
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
                  (disburseBankId ? "Rekening tidak tersedia" : "Belum dipilih")
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
          {!desktop ? (
            <VendorPaymentDisburseContextCard payment={presentedPayment} amount={amount} />
          ) : null}
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
                helper="Pilih rekening bank sumber. Nomor referensi terisi otomatis sesuai vendor dan dapat disesuaikan."
              >
                <AdaptiveSelect
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
                    placeholder={
                      suggestedRef ? `Contoh: ${suggestedRef}` : "Contoh: TRF-BCA-VND-SA01"
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

function PaymentError({ error }: { readonly error: string | null }): React.JSX.Element | null {
  if (!error) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-2xl bg-error-container/20 p-3 text-xs font-medium text-error"
      role="alert"
    >
      <AppIcon name="error" className="icon-md" />
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

export function VendorBillScheduleContextCard({
  bill,
  remaining,
  totalScheduledOrPaid,
}: {
  readonly bill: VendorListBill;
  readonly remaining: number;
  readonly totalScheduledOrPaid: number;
}): React.JSX.Element {
  const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
  const hasValidDueDate = Boolean(dueDate && !Number.isNaN(dueDate.getTime()));
  const statusTone: StatusBadgeTone =
    bill.status === "PAID" ? "healthy" : bill.status === "PARTIALLY_PAID" ? "pending" : "warning";
  const statusLabel =
    bill.status === "PAID"
      ? "Lunas"
      : bill.status === "PARTIALLY_PAID"
        ? "Sebagian"
        : "Belum Bayar";

  return (
    <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Tagihan Vendor
          </p>
          <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
            {bill.vendor?.name ?? "Vendor"}
          </h3>
          <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
            Tagihan {bill.billNumber}
            {bill.project?.name ? ` · ${bill.project.name}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge tone={statusTone} label={statusLabel} />
          {hasValidDueDate && dueDate && (
            <p className="mt-1.5 text-eyebrow font-semibold text-on-surface-variant/70">
              Tempo{" "}
              {dueDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-outline-variant/15 pt-3">
        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Sisa Tagihan
          </p>
          <div className="mt-1">
            <MoneyValue
              amount={remaining}
              variant="fullDynamic"
              size="sm"
              className="font-bold text-primary"
            />
          </div>
          <p className="mt-0.5 truncate text-meta text-on-surface-variant">
            {totalScheduledOrPaid > 0
              ? `Sudah terjadwal Rp ${totalScheduledOrPaid.toLocaleString("id-ID")}`
              : "Belum ada rencana"}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Total Tagihan
          </p>
          <div className="mt-1">
            <MoneyValue
              amount={Number(bill.amount)}
              variant="fullDynamic"
              size="sm"
              className="font-bold text-on-surface"
            />
          </div>
          <p className="mt-0.5 truncate text-meta text-on-surface-variant">
            {bill.budgetItem?.name ? `Budget ${bill.budgetItem.name}` : "Nilai tagihan vendor"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function VendorPaymentDisburseContextCard({
  payment,
  amount,
}: {
  readonly payment: VendorListPayment;
  readonly amount: number;
}): React.JSX.Element {
  const bill = payment.vendorBill;
  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
  const hasValidPaymentDate = Boolean(paymentDate && !Number.isNaN(paymentDate.getTime()));

  return (
    <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Pencairan Tagihan
          </p>
          <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
            {bill?.vendor?.name ?? "Vendor"}
          </h3>
          <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
            Tagihan {bill?.billNumber ?? "–"}
            {bill?.project?.name ? ` · ${bill.project.name}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge tone="warning" label="Siap Cair" />
          {hasValidPaymentDate && paymentDate && (
            <p className="mt-1.5 text-eyebrow font-semibold text-on-surface-variant/70">
              Rencana{" "}
              {paymentDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 border-t border-outline-variant/15 pt-3">
        <div className="rounded-2xl bg-surface-container-low p-2.5">
          <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
            Nominal Pencairan
          </p>
          <div className="mt-1">
            <MoneyValue
              amount={amount}
              variant="fullDynamic"
              size="sm"
              className="font-bold text-primary"
            />
          </div>
          <p className="mt-0.5 truncate text-meta text-on-surface-variant">
            {payment.bankAccount?.name
              ? `Rekening sumber: ${payment.bankAccount.name}`
              : "Pencairan kas"}
          </p>
        </div>
      </div>
    </div>
  );
}
