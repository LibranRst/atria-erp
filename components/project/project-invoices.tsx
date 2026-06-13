"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { recordClientPayment } from "@/app/actions/finance/record-client-payment";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";

export interface InvoicePaymentItem {
  id: string;
  amountPaid: string;
  paymentDate: Date;
  referenceNumber: string;
}

export interface ClientInvoiceItem {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  dueDate: Date;
  createdAt: Date;
  payments: InvoicePaymentItem[];
}

export interface BankAccountItem {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: string;
}

interface ProjectInvoicesProps {
  invoices: ClientInvoiceItem[];
  bankAccounts: BankAccountItem[];
  userRole: string;
}

export function ProjectInvoices({
  invoices,
  bankAccounts,
  userRole,
}: ProjectInvoicesProps): React.JSX.Element {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoiceItem | null>(null);
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [refNumber, setRefNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";

  const handleRecordPaymentClick = (invoice: ClientInvoiceItem) => {
    // Calculate remaining unpaid amount
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amountPaid),
      0
    );
    const remaining = Number(invoice.amount) - totalPaid;

    setSelectedInvoice(invoice);
    setAmountPaid(remaining.toFixed(2));
    setError(null);
    setSuccess(null);
    setRefNumber("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    if (bankAccounts.length > 0) {
      setSelectedBankId(bankAccounts[0].id);
    } else {
      setSelectedBankId("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (!selectedBankId) {
      setError("Silakan pilih rekening bank tujuan.");
      return;
    }
    if (!amountPaid || Number(amountPaid) <= 0) {
      setError("Nominal pembayaran harus lebih besar dari Rp 0.");
      return;
    }
    if (!refNumber.trim()) {
      setError("Nomor referensi bukti transfer wajib diisi.");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await recordClientPayment({
          clientInvoiceId: selectedInvoice.id,
          bankAccountId: selectedBankId,
          amountPaid: Number(amountPaid),
          paymentDate: new Date(paymentDate),
          referenceNumber: refNumber,
        });

        if (!res.success) {
          setError(res.error.message || "Gagal mencatat pembayaran termin.");
          return;
        }

        setSuccess(
          `Berhasil mencatatkan kas masuk sebesar Rp ${Number(amountPaid).toLocaleString("id-ID")}`
        );

        // Refresh database state
        router.refresh();

        // Close modal
        setTimeout(() => {
          setSelectedInvoice(null);
          setSuccess(null);
        }, 1500);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  return (
    <div className="space-y-md px-1 select-none">
      <h2 className="font-label-caps text-on-surface-variant">Tagihan Klien (Invoices)</h2>

      {invoices.length === 0 ? (
        <div className="premium-card p-md flex flex-col items-center justify-center py-10 text-center border border-outline-variant/30">
          <div className="h-10 w-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[24px]">receipt_long</span>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            Tidak ada invoice/tagihan klien yang terbit untuk proyek ini.
          </p>
        </div>
      ) : (
        <div className="space-y-sm">
          {invoices.map((inv) => {
            const amountNum = Number(inv.amount);
            const totalPaid = inv.payments.reduce(
              (sum, p) => sum + Number(p.amountPaid),
              0
            );
            const remaining = amountNum - totalPaid;

            return (
              <div
                key={inv.id}
                className="premium-card p-md border border-outline-variant/30 bg-surface/60 space-y-md"
              >
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div className="space-y-xs">
                    <span className="font-label-caps text-[9px] text-on-surface-variant">Nomor Invoice</span>
                    <h3 className="font-body-sm font-bold text-on-surface">{inv.invoiceNumber}</h3>
                  </div>
                  <Badge status={inv.status}>{inv.status}</Badge>
                </div>

                {/* Amount details */}
                <div className="grid grid-cols-2 gap-md pt-base border-t border-outline-variant/10">
                  <div className="space-y-xs">
                    <span className="font-label-caps text-[8px] text-on-surface-variant">Nominal Tagihan</span>
                    <div className="font-numeral-md text-on-surface font-bold financial-amount">
                      Rp {amountNum.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="space-y-xs">
                    <span className="font-label-caps text-[8px] text-on-surface-variant">Sisa Tagihan</span>
                    <div className={`font-numeral-md font-bold financial-amount ${remaining > 0 ? "text-error" : "text-primary"}`}>
                      Rp {remaining.toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                {/* Termín / Payments History */}
                {inv.payments.length > 0 && (
                  <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-sm space-y-xs text-xs font-semibold">
                    <span className="font-label-caps text-[8px] text-on-surface-variant block pb-base border-b border-outline-variant/10">
                      Riwayat Pembayaran Termin
                    </span>
                    <div className="space-y-base pt-xs">
                      {inv.payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-[11px]">
                          <span className="text-on-surface-variant truncate max-w-[180px]">
                            {new Date(p.paymentDate).toLocaleDateString("id-ID")} ({p.referenceNumber})
                          </span>
                          <span className="text-primary font-numeral">
                            +Rp {Number(p.amountPaid).toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Button Action */}
                {remaining > 0 && isOwnerOrFinance && (
                  <div className="flex justify-end border-t border-outline-variant/10 pt-sm">
                    <button
                      type="button"
                      onClick={() => handleRecordPaymentClick(inv)}
                      className="px-sm py-2 bg-primary text-on-primary rounded-full text-xs font-bold shadow active:scale-95 transition-all flex items-center gap-1 hover:bg-primary/95 cursor-pointer h-10 min-w-[120px] justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_card</span>
                      Catat Pembayaran
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Record Payment Dialog */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-surface border border-outline-variant/30 rounded-t-3xl md:rounded-2xl max-w-md w-full p-md space-y-md shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h2 className="font-headline-md text-[18px] text-on-surface">Penerimaan Kas Termin</h2>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                disabled={isPending}
                className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <div className="leading-relaxed">{error}</div>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                <div className="leading-relaxed">{success}</div>
              </div>
            )}

            {/* Details Panel */}
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-sm space-y-xs text-xs font-semibold text-on-surface">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Nomor Invoice:</span>
                <span>{selectedInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Total Nilai Invoice:</span>
                <span className="font-numeral">Rp {Number(selectedInvoice.amount).toLocaleString("id-ID")}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-md">
              {/* Select Bank Account */}
              <div className="space-y-xs">
                <label htmlFor="bankSelect" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Rekening Penerima Dana (DEBIT)
                </label>
                <div className="relative">
                  <select
                    id="bankSelect"
                    value={selectedBankId}
                    disabled={isPending}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary active:bg-surface-container-low disabled:opacity-50 cursor-pointer"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} - {acc.name} (Saldo: Rp {Number(acc.balance).toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </div>
                </div>
              </div>

              {/* Amount Paid */}
              <div className="space-y-xs">
                <label htmlFor="amountInput" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Nominal Diterima (Rp)
                </label>
                <input
                  id="amountInput"
                  type="number"
                  step="any"
                  value={amountPaid}
                  disabled={isPending}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Masukkan nominal transfer"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Reference Number */}
              <div className="space-y-xs">
                <label htmlFor="refInput" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Nomor Referensi Bukti Transfer (Klien)
                </label>
                <input
                  id="refInput"
                  type="text"
                  value={refNumber}
                  disabled={isPending}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Contoh: TRANSFER-KLIEN-0238"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Payment Date */}
              <div className="space-y-xs">
                <label htmlFor="dateInput" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Tanggal Transaksi Diterima
                </label>
                <input
                  id="dateInput"
                  type="date"
                  value={paymentDate}
                  disabled={isPending}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-md pt-xs">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  disabled={isPending}
                  className="flex-1 h-12 bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 rounded-full text-xs font-bold text-on-surface transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-12 bg-primary text-on-primary rounded-full text-xs font-bold shadow-md hover:bg-primary/95 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white mr-1" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Simpan Pembayaran
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
