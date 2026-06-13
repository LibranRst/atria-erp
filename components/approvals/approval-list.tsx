"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { getErrorMessage } from "@/lib/utils/error-message";

export interface ApprovalItem {
  id: string;
  createdAt: Date;
  notes: string | null;
  type: "project_cost" | "vendor_payment";
  referenceId: string;
  amount: number;
  description: string;
  receiptImageUrl: string | null;
  projectName: string;
  budgetItemName: string;
  allocatedAmount: number;
  actualSpent: number;
  requestedBy: string;
  budgetOverrun: boolean;
}

interface ApprovalListProps {
  initialApprovals: ApprovalItem[];
}

export function ApprovalList({ initialApprovals }: ApprovalListProps): React.JSX.Element {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(initialApprovals);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAction = async (item: ApprovalItem, action: "APPROVED" | "REJECTED") => {
    setProcessingId(item.id);
    setError(null);
    setSuccessMsg(null);

    try {
      if (item.type === "project_cost") {
        const res = await approveFieldRequest({
          projectCostId: item.referenceId,
          status: action,
          notes: action === "APPROVED" ? "Disetujui Owner" : "Ditolak Owner",
        });

        if (!res.success) {
          throw new Error(res.error.message || "Gagal memproses persetujuan biaya.");
        }
      } else {
        const res = await approveVendorPayment(
          item.referenceId,
          action === "APPROVED" ? "Disetujui Owner" : "Ditolak Owner",
          action
        );

        if (!res.success) {
          throw new Error(res.error.message || "Gagal memproses persetujuan pembayaran.");
        }
      }

      setSuccessMsg(`Berhasil ${action === "APPROVED" ? "menyetujui" : "menolak"} pengajuan senilai Rp ${item.amount.toLocaleString("id-ID")}.`);
      setApprovals((prev) => prev.filter((a) => a.id !== item.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Terjadi kesalahan internal."));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-md">
      {/* Feedback Alert Banners */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs text-primary font-medium">
          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
          <div className="leading-relaxed">{successMsg}</div>
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="premium-card p-md flex flex-col items-center justify-center py-16 text-center border border-outline-variant/30 space-y-md">
          <div className="h-14 w-14 rounded-full bg-surface-container flex items-center justify-center text-primary border border-outline-variant/10 shadow-sm">
            <span className="material-symbols-outlined text-primary text-[28px]">check_circle</span>
          </div>
          <div className="space-y-base">
            <h3 className="font-headline-md text-[16px] text-on-surface">Semua Selesai!</h3>
            <p className="font-body-sm text-on-surface-variant leading-relaxed max-w-[280px] mx-auto">
              Tidak ada antrean persetujuan baru yang menunggu otorisasi Anda saat ini.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-md">
          {approvals.map((item) => {
            const nextSpent = item.actualSpent + item.amount;
            const utilizationPercent = item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
            const isPending = processingId === item.id;

            return (
              <div key={item.id} className="premium-card p-md border border-outline-variant/30 hover:border-outline-variant/50 transition-colors space-y-md">
                {/* Badge & Meta */}
                <div className="flex items-center justify-between">
                  <Badge status={item.type === "project_cost" ? "WARNING" : "PRIMARY"}>
                    {item.type === "project_cost" ? "Dana Lapangan" : "Vendor Payment"}
                  </Badge>
                  <div className="font-label-caps text-[9px] text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    {new Date(item.createdAt).toLocaleDateString("id-ID", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </div>
                </div>

                {/* Nominal & Justifikasi */}
                <div className="flex justify-between items-start gap-md">
                  <div className="space-y-xs min-w-0">
                    <span className="font-label-caps text-[9px] text-on-surface-variant">Nilai Pengajuan</span>
                    <div className="font-numeral-lg text-on-surface font-bold financial-amount">
                      Rp {item.amount.toLocaleString("id-ID")}
                    </div>
                    <p className="font-body-sm text-on-surface-variant leading-relaxed pt-base">
                      <span className="font-bold text-on-surface">Keterangan:</span> {item.description}
                    </p>
                  </div>

                  {/* Receipt Thumbnail */}
                  {item.receiptImageUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveImage(item.receiptImageUrl)}
                      className="h-16 w-16 rounded-xl overflow-hidden border border-outline-variant bg-surface-container shrink-0 active:scale-95 transition-transform flex items-center justify-center relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.receiptImageUrl}
                        alt="Nota Receipt"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white text-[20px]">image</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Proyek & Budget Overrun check */}
                <div className="border-t border-outline-variant/10 pt-md space-y-sm text-[13px] font-semibold text-on-surface">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Proyek Konstruksi:</span>
                    <span className="text-on-surface text-right max-w-[200px] truncate">{item.projectName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Kategori RAB:</span>
                    <span className="text-on-surface text-right max-w-[200px] truncate">{item.budgetItemName}</span>
                  </div>

                  {/* Budget Utilization Comparison */}
                  <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-sm space-y-xs">
                    <div className="flex justify-between font-label-caps text-[9px] text-on-surface-variant">
                      <span>Plafon: Rp {item.allocatedAmount.toLocaleString("id-ID")}</span>
                      <span>Realisasi: Rp {item.actualSpent.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden border border-outline-variant/10">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${item.budgetOverrun || utilizationPercent >= 100 ? "bg-error" : "bg-secondary"}`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${item.budgetOverrun || utilizationPercent >= 100 ? "text-error" : "text-secondary"}`}>
                        {utilizationPercent.toFixed(0)}%
                      </span>
                    </div>
                    {(item.budgetOverrun || utilizationPercent >= 100) && (
                      <div className="text-[9px] text-error font-bold flex items-center gap-1 pt-base">
                        <span className="material-symbols-outlined text-error text-[14px]">warning</span>
                        <span>Perhatian: Anggaran Overrun!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pengaju & Tombol Tindakan */}
                <div className="border-t border-outline-variant/10 pt-md flex items-center justify-between">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <div className="h-7 w-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                    </div>
                    <span className="font-semibold text-[11px]">PM: <span className="font-bold text-on-surface">{item.requestedBy}</span></span>
                  </div>

                  <div className="flex gap-md">
                    {/* Button Reject */}
                    <button
                      type="button"
                      onClick={() => handleAction(item, "REJECTED")}
                      disabled={isPending}
                      aria-label="Tolak Pengajuan"
                      className="h-11 w-11 flex items-center justify-center rounded-full bg-error text-white shadow-md hover:bg-error/95 transition-all active:scale-90 disabled:opacity-50 cursor-pointer"
                    >
                      {isPending ? (
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className="material-symbols-outlined text-white text-[22px] font-bold">close</span>
                      )}
                    </button>

                    {/* Button Approve */}
                    <button
                      type="button"
                      onClick={() => handleAction(item, "APPROVED")}
                      disabled={isPending}
                      aria-label="Setujui Pengajuan"
                      className="h-11 w-11 flex items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/95 transition-all active:scale-90 disabled:opacity-50 cursor-pointer"
                    >
                      {isPending ? (
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className="material-symbols-outlined text-white text-[22px] font-bold">check</span>
                      )}
                    </button>
                  </div>
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
          <div className="relative max-w-full max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt="Receipt Zoom"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/5"
            />
            <p className="text-center font-label-caps text-white/70 mt-md">Ketuk di mana saja untuk menutup</p>
          </div>
        </div>
      )}
    </div>
  );
}
