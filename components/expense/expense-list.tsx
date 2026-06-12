"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { payFieldRequest } from "@/app/actions/finance/field-requests";
import { useRouter } from "next/navigation";

export interface ExpenseCostItem {
  id: string;
  amount: string;
  description: string;
  receiptImageUrl: string | null;
  status: "SUBMITTED" | "VERIFIED" | "APPROVED" | "REJECTED" | "PAID";
  budgetOverrun: boolean;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  } | null;
  budgetItem: {
    id: string;
    name: string;
    allocatedAmount: string;
    actualSpent: string;
    costCategory: {
      name: string;
    } | null;
  } | null;
  requestedBy: {
    name: string;
  } | null;
}

export interface BankAccountItem {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: string;
}

interface ExpenseListProps {
  initialCosts: ExpenseCostItem[];
  bankAccounts: BankAccountItem[];
  userRole: string;
}

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "PAID" | "REJECTED";

export function ExpenseList({
  initialCosts,
  bankAccounts,
  userRole,
}: ExpenseListProps): React.JSX.Element {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [activeImage, setActiveImage] = useState<string | null>(null);
  
  // Disbursement modal states
  const [selectedCost, setSelectedCost] = useState<ExpenseCostItem | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [refNumber, setRefNumber] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";

  // Filter logic
  const filteredCosts = initialCosts.filter((cost) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") {
      return cost.status === "SUBMITTED" || cost.status === "VERIFIED";
    }
    return cost.status === filter;
  });

  const handleDisburseClick = (cost: ExpenseCostItem) => {
    setSelectedCost(cost);
    setError(null);
    setSuccess(null);
    setRefNumber("");
    // Default to the first bank account if available
    if (bankAccounts.length > 0) {
      setSelectedBankId(bankAccounts[0].id);
    } else {
      setSelectedBankId("");
    }
  };

  const handleConfirmDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCost) return;
    if (!selectedBankId) {
      setError("Silakan pilih rekening bank pengirim.");
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
        const res = await payFieldRequest(selectedCost.id, selectedBankId, refNumber);
        if (!res.success) {
          setError(res.error.message || "Gagal mencairkan pengeluaran.");
          return;
        }

        setSuccess(`Berhasil mencairkan dana sebesar Rp ${Number(selectedCost.amount).toLocaleString("id-ID")}`);
        
        // Refresh the server-side data
        router.refresh();
        
        // Close modal after a short delay
        setTimeout(() => {
          setSelectedCost(null);
          setSuccess(null);
        }, 1500);
      } catch (err: any) {
        setError(err.message || "Terjadi kesalahan internal.");
      }
    });
  };

  return (
    <div className="space-y-md px-1 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-base">
          <p className="font-label-caps text-primary">Operasional Proyek</p>
          <h1 className="font-headline-lg text-on-surface">Daftar Pengajuan</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-xs overflow-x-auto pb-xs scrollbar-none border-b border-outline-variant/10">
        {(
          [
            { label: "Semua", value: "ALL" },
            { label: "Menunggu", value: "PENDING" },
            { label: "Disetujui", value: "APPROVED" },
            { label: "Lunas", value: "PAID" },
            { label: "Ditolak", value: "REJECTED" },
          ] as const
        ).map((tab) => {
          const isActive = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`px-sm py-xs text-xs font-semibold rounded-full border transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container text-on-surface-variant border-outline-variant/20 hover:border-outline-variant/40"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* List Content */}
      {filteredCosts.length === 0 ? (
        <div className="premium-card p-md flex flex-col items-center justify-center py-16 text-center border border-outline-variant/30 space-y-md">
          <div className="h-14 w-14 rounded-full bg-surface-container flex items-center justify-center text-primary border border-outline-variant/10 shadow-sm">
            <span className="material-symbols-outlined text-primary text-[28px]">receipt_long</span>
          </div>
          <div className="space-y-base">
            <h3 className="font-headline-md text-[16px] text-on-surface">Tidak Ada Pengajuan</h3>
            <p className="font-body-sm text-on-surface-variant leading-relaxed max-w-[280px] mx-auto">
              Tidak ada pengajuan pengeluaran biaya lapangan dalam kategori filter ini.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-md">
          {filteredCosts.map((cost) => {
            const amountNum = Number(cost.amount);
            const allocated = Number(cost.budgetItem?.allocatedAmount || 0);
            const spent = Number(cost.budgetItem?.actualSpent || 0);
            const utilizationPercent = allocated > 0 ? (spent / allocated) * 100 : 0;

            return (
              <div
                key={cost.id}
                className="premium-card p-md border border-outline-variant/30 hover:border-outline-variant/50 transition-colors space-y-md"
              >
                {/* Header Card */}
                <div className="flex items-center justify-between">
                  <Badge status={cost.status === "SUBMITTED" || cost.status === "VERIFIED" ? "PENDING" : cost.status}>
                    {cost.status === "SUBMITTED"
                      ? "MENUNGU VERIFIKASI"
                      : cost.status === "VERIFIED"
                      ? "MENUNGGU PERSETUJUAN"
                      : cost.status}
                  </Badge>
                  <div className="font-label-caps text-[9px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    {new Date(cost.createdAt).toLocaleDateString("id-ID", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Amount & Description */}
                <div className="flex justify-between items-start gap-md">
                  <div className="space-y-xs min-w-0">
                    <span className="font-label-caps text-[9px] text-on-surface-variant">Jumlah</span>
                    <div className="font-numeral-lg text-on-surface font-bold financial-amount">
                      Rp {amountNum.toLocaleString("id-ID")}
                    </div>
                    <p className="font-body-sm text-on-surface-variant leading-relaxed pt-base">
                      <span className="font-bold text-on-surface">Keterangan:</span> {cost.description}
                    </p>
                  </div>

                  {/* Attachment Thumbnail */}
                  {cost.receiptImageUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveImage(cost.receiptImageUrl)}
                      className="h-16 w-16 rounded-xl overflow-hidden border border-outline-variant bg-surface-container shrink-0 active:scale-95 transition-transform flex items-center justify-center relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cost.receiptImageUrl}
                        alt="Receipt Thumbnail"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white text-[20px]">image</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Project Details & Plafond */}
                <div className="border-t border-outline-variant/10 pt-md space-y-sm text-[13px] font-semibold text-on-surface">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Proyek:</span>
                    <span className="text-on-surface text-right max-w-[200px] truncate">
                      {cost.project?.name || "Proyek Tidak Dikenal"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Item Budget:</span>
                    <span className="text-on-surface text-right max-w-[200px] truncate">
                      {cost.budgetItem?.name || "Belum Ditentukan"}
                    </span>
                  </div>

                  {cost.budgetItem && (
                    <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-sm space-y-xs">
                      <div className="flex justify-between font-label-caps text-[9px] text-on-surface-variant">
                        <span>Plafon: Rp {allocated.toLocaleString("id-ID")}</span>
                        <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden border border-outline-variant/10">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              cost.budgetOverrun || utilizationPercent >= 100 ? "bg-error" : "bg-secondary"
                            }`}
                            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold shrink-0 ${
                            cost.budgetOverrun || utilizationPercent >= 100 ? "text-error" : "text-secondary"
                          }`}
                        >
                          {utilizationPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Bar: PM name and disburse button */}
                <div className="border-t border-outline-variant/10 pt-md flex items-center justify-between">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <div className="h-7 w-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                    </div>
                    <span className="font-semibold text-[11px]">
                      PM: <span className="font-bold text-on-surface">{cost.requestedBy?.name || "PM"}</span>
                    </span>
                  </div>

                  {/* Disburse Button */}
                  {cost.status === "APPROVED" && isOwnerOrFinance && (
                    <button
                      type="button"
                      onClick={() => handleDisburseClick(cost)}
                      className="px-sm py-2 bg-secondary text-on-secondary rounded-full text-xs font-bold shadow active:scale-95 transition-all flex items-center gap-1 hover:bg-secondary/95 cursor-pointer h-10 min-w-[90px] justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      Cairkan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Zoom Foto Nota */}
      {activeImage && (
        <div
          onClick={() => setActiveImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-md transition-opacity duration-200"
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt="Receipt Zoomed"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/5"
            />
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/10 active:scale-90 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <p className="text-center font-label-caps text-white/70 mt-md">Ketuk di luar gambar untuk menutup</p>
          </div>
        </div>
      )}

      {/* Disbursement Dialog */}
      {selectedCost && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-surface border border-outline-variant/30 rounded-t-3xl md:rounded-2xl max-w-md w-full p-md space-y-md shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h2 className="font-headline-md text-[18px] text-on-surface">Pencairan Dana</h2>
              <button
                type="button"
                onClick={() => setSelectedCost(null)}
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
              <div className="flex justify-between text-[14px]">
                <span className="text-on-surface-variant">Jumlah Pencairan:</span>
                <span className="font-bold font-numeral text-primary">
                  Rp {Number(selectedCost.amount).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Proyek:</span>
                <span className="max-w-[200px] truncate">{selectedCost.project?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Pengaju (PM):</span>
                <span>{selectedCost.requestedBy?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Keterangan:</span>
                <span className="max-w-[200px] truncate">{selectedCost.description}</span>
              </div>
            </div>

            {/* Disbursement Form */}
            <form onSubmit={handleConfirmDisburse} className="space-y-md">
              {/* Select Bank Account */}
              <div className="space-y-xs">
                <label htmlFor="bankSelect" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Rekening Sumber Dana
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

              {/* Reference Number */}
              <div className="space-y-xs">
                <label htmlFor="refInput" className="font-label-caps text-[10px] text-on-surface-variant block">
                  Nomor Referensi Bukti Transfer
                </label>
                <input
                  id="refInput"
                  type="text"
                  value={refNumber}
                  disabled={isPending}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Contoh: TRF-BCA-10294"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-md pt-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCost(null)}
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
                      Memproses...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Cairkan Dana
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
