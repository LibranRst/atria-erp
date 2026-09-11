"use client";

import React from "react";

import {
  AppIcon,
  DatePickerField,
  FinanceUnsavedChangesModal,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyImpactRow,
  MoneyInput,
  MoneyValue,
  AdaptiveSelect,
  TextInput,
  useSheetPresenceValue,
  WorkflowFormSheet,
} from "@/components/ui";
import { derivePaymentReference } from "@atria/core/finance/invoice-prefill";
import type { BankAccountItem, ClientInvoiceItem } from "../../types/project-invoices-types";
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
  projectName,
  clientName,
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
  readonly projectName?: string;
  readonly clientName?: string;
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

  const handleExit = React.useCallback((): void => {
    handleExitComplete();
    setReviewing(false);
    setConfirmClose(false);
  }, [handleExitComplete]);

  const prevInvoiceIdRef = React.useRef(selectedInvoice?.id);
  React.useEffect(() => {
    if (selectedInvoice?.id !== prevInvoiceIdRef.current) {
      prevInvoiceIdRef.current = selectedInvoice?.id;
      setReviewing(false);
      setConfirmClose(false);
    }
  }, [selectedInvoice?.id]);

  const selectedAccount = React.useMemo(
    () => bankAccounts.find((account) => account.id === selectedBankId),
    [bankAccounts, selectedBankId],
  );
  const suggestedRef = React.useMemo(() => {
    if (!invoice) return "";
    return derivePaymentReference({
      bankName: selectedAccount?.bankName || selectedAccount?.name,
      invoiceNumber: invoice.invoiceNumber,
      projectName,
      clientName,
      stage: invoice.stage,
    });
  }, [invoice, selectedAccount, projectName, clientName]);

  if (!invoice) return null;
  const invoiceAmount = Number(invoice.amount);
  const paidAmount = Number(amountPaid || 0);
  const paidBefore = invoice.payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);
  const remaining = Math.max(0, invoiceAmount - paidBefore);
  const accountBefore = Number(selectedAccount?.balance ?? 0);
  const overpayment = paidAmount > remaining;
  const remainingAfter = Math.max(0, remaining - paidAmount);
  const accountAfter = accountBefore + paidAmount;

  const stageLabel = getInvoiceStageLabel(invoice.stage);
  const formattedPaymentDate = formatPaymentDateLabel(paymentDate);

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
        dismissal={{ mode: "managed" }}
        open={open}
        onExitComplete={handleExit}
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
              <AppIcon name="error" className="icon-md text-error" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs font-medium text-primary">
              <AppIcon name="check_circle" className="icon-md text-primary" />
              <div className="leading-relaxed">{success}</div>
            </div>
          )}

          {reviewing ? (
            <div className="space-y-4">
              {/* Focal Summary Card */}
              <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-eyebrow font-bold tracking-[0.16em] text-on-surface-variant uppercase">
                      Penerimaan Dana Masuk
                    </p>
                    <div className="mt-1">
                      <MoneyValue
                        amount={paidAmount}
                        variant="fullDynamic"
                        size="lg"
                        className="font-bold text-primary"
                      />
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant truncate">
                      Invoice {invoice.invoiceNumber} · Termin {stageLabel}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {overpayment ? (
                      <span className="rounded-full bg-warning/10 px-3 py-1 font-mono text-xs font-bold text-warning ring-1 ring-warning/20">
                        LEBIH BAYAR
                      </span>
                    ) : remainingAfter === 0 ? (
                      <span className="rounded-full bg-success/10 px-3 py-1 font-mono text-xs font-bold text-success ring-1 ring-success/20">
                        LUNAS
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container-low px-3 py-1 font-mono text-xs font-bold text-on-surface ring-1 ring-ring-subtle">
                        SEBAGIAN
                      </span>
                    )}
                  </div>
                </div>

                {/* Inset Metric Cells: Sisa Tagihan & Total Invoice */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-outline-variant/15 pt-3">
                  <div className="rounded-2xl bg-surface-container-low p-2.5">
                    <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Sisa Tagihan
                    </p>
                    <div className="mt-1">
                      {remainingAfter === 0 ? (
                        <p className="text-xs font-bold text-success">Rp 0 (Lunas)</p>
                      ) : (
                        <MoneyValue
                          amount={remainingAfter}
                          variant="fullDynamic"
                          size="sm"
                          className="font-bold text-on-surface"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant truncate">
                      Sebelumnya Rp {remaining.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-surface-container-low p-2.5">
                    <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                      Total Tagihan
                    </p>
                    <div className="mt-1">
                      <MoneyValue
                        amount={invoiceAmount}
                        variant="fullDynamic"
                        size="sm"
                        className="font-bold text-on-surface"
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant truncate">
                      {paidBefore > 0
                        ? `Sudah diterima Rp ${paidBefore.toLocaleString("id-ID")}`
                        : "Termin pertama"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rincian Transaksi */}
              <FormSection
                title="Rincian Pembayaran"
                helper="Penerimaan dana kas masuk yang akan dicatat ke buku besar."
              >
                <ReviewFact label="Nomor Invoice" value={invoice.invoiceNumber} />
                <ReviewFact label="Tahap Termin" value={stageLabel} />
                {clientName || projectName ? (
                  <ReviewFact
                    label="Klien / Proyek"
                    value={[clientName, projectName].filter(Boolean).join(" · ")}
                  />
                ) : null}
                <ReviewFact
                  label="No. Referensi Bukti"
                  value={
                    <span className="font-mono text-xs font-bold text-on-surface">
                      {refNumber}
                    </span>
                  }
                />
                <ReviewFact label="Tanggal Transaksi" value={formattedPaymentDate} />
                <ReviewFact
                  label="Status Invoice"
                  value={
                    remainingAfter === 0 ? (
                      <span className="font-bold text-success">Lunas (PAID)</span>
                    ) : (
                      <span className="font-bold text-on-surface">Terbayar Sebagian</span>
                    )
                  }
                />
              </FormSection>

              {/* Dampak Saldo Rekening (Standalone Impact Card) */}
              <MoneyImpactRow
                label={selectedAccount?.name ?? "Rekening Penerima (DEBIT)"}
                sublabel={
                  selectedAccount
                    ? `${selectedAccount.bankName} · ${selectedAccount.accountNumber}`
                    : "Kas Masuk Proyek"
                }
                before={accountBefore}
                delta={paidAmount}
                after={accountAfter}
                note={
                  <p className="text-meta text-on-surface-variant">
                    Saldo bertambah otomatis pada akun kas penerima setelah pembayaran dikonfirmasi.
                  </p>
                }
              />

              {/* Notice Risiko / Konfirmasi */}
              <FormRiskNotice
                title={
                  overpayment
                    ? "Periksa kelebihan pembayaran"
                    : "Pencatatan kas riil & buku besar"
                }
                tone={overpayment ? "warning" : "default"}
              >
                {overpayment
                  ? `Nominal pembayaran melebihi sisa invoice sebesar Rp ${(paidAmount - remaining).toLocaleString("id-ID")}. Pastikan kelebihan bayar ini telah sesuai kesepakatan dengan pihak klien.`
                  : `Setelah dikonfirmasi, saldo rekening ${selectedAccount?.name ?? "penerima"} bertambah Rp ${paidAmount.toLocaleString("id-ID")} dan status invoice ${invoice.invoiceNumber} diperbarui bersama dalam satu transaksi.`}
              </FormRiskNotice>
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
              {/* Context card in input mode */}
              <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-eyebrow font-bold tracking-[0.16em] text-on-surface-variant uppercase">
                      Sisa Tagihan Invoice
                    </p>
                    <div className="mt-1">
                      <MoneyValue
                        amount={remaining}
                        variant="fullDynamic"
                        size="lg"
                        className="font-bold text-primary"
                      />
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant truncate">
                      Invoice {invoice.invoiceNumber} · Total Rp {invoiceAmount.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="rounded-full bg-surface-container-low px-3 py-1 font-mono text-xs font-bold text-on-surface ring-1 ring-ring-subtle">
                      {stageLabel}
                    </span>
                  </div>
                </div>
                {paidBefore > 0 && (
                  <div className="mt-3.5 border-t border-outline-variant/15 pt-3 text-xs text-on-surface-variant">
                    Sudah diterima sebelumnya:{" "}
                    <span className="font-semibold text-on-surface">
                      Rp {paidBefore.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              <FormSection
                title="Dana masuk"
                helper="Rekening dan nominal yang benar-benar diterima."
              >
                <AdaptiveSelect
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
              </FormSection>

              <FormSection
                title="Referensi transaksi"
                helper="Format standar disiapkan. Ganti dengan no. referensi struk bank jika ingin rekonsiliasi mutasi otomatis cocok."
              >
                <FormField label="Nomor Referensi Bukti Transfer" required>
                  <TextInput
                    value={refNumber}
                    disabled={isPending}
                    onChange={setRefNumber}
                    placeholder="Contoh: TRANSFER-KLIEN-0238"
                  />
                </FormField>
                {suggestedRef && refNumber !== suggestedRef && (
                  <div className="flex items-center justify-between bg-surface-container-low/50 px-4 py-2 text-meta">
                    <span className="text-on-surface-variant">
                      Format standar:{" "}
                      <strong className="font-mono text-on-surface">{suggestedRef}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRefNumber(suggestedRef)}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary hover:bg-primary/15 active:scale-[0.98]"
                    >
                      Terapkan
                    </button>
                  </div>
                )}

                <DatePickerField
                  label="Tanggal Transaksi Diterima"
                  value={paymentDate}
                  disabled={isPending}
                  onChange={setPaymentDate}
                  required
                />
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

function getInvoiceStageLabel(stage?: string | null): string {
  if (!stage) return "Tagihan Termin";
  switch (stage.toUpperCase()) {
    case "DP":
      return "Uang Muka (DP)";
    case "PROGRESS_1":
      return "Termin Progress 1";
    case "PROGRESS_2":
      return "Termin Progress 2";
    case "PELUNASAN":
      return "Pelunasan";
    case "RETENTION":
      return "Retensi";
    default:
      return stage;
  }
}

function formatPaymentDateLabel(paymentDate?: string | null): string {
  if (!paymentDate) return "–";
  try {
    const d = new Date(paymentDate);
    if (Number.isNaN(d.getTime())) return paymentDate;
    return d.toLocaleDateString("id-ID", { dateStyle: "long" });
  } catch {
    return paymentDate;
  }
}

function ReviewFact({
  label,
  value,
  stacked = false,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly stacked?: boolean;
}): React.JSX.Element {
  if (stacked) {
    return (
      <div className="px-4 py-3 text-xs">
        <span className="text-on-surface-variant font-medium">{label}</span>
        <p className="mt-1 font-medium text-on-surface leading-relaxed whitespace-pre-wrap">
          {value}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant font-medium">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
