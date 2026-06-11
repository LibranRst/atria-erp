"use client";

import React, { useState } from "react";
import { Badge, Card, CardContent } from "@/components/ui";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { Check, X, AlertTriangle, AlertCircle, Sparkles, User, FileText, CheckCircle2 } from "lucide-react";

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
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan internal.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Alert Banners */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-critical/30 bg-critical-light/15 p-3.5 text-sm text-critical">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-light/15 p-3.5 text-sm text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      {approvals.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CardContent className="space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h3 className="text-lg font-bold text-text-primary">Semua Selesai!</h3>
            <p className="text-sm text-secondary">
              Tidak ada antrean persetujuan baru yang menunggu otorisasi Anda saat ini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((item) => {
            const nextSpent = item.actualSpent + item.amount;
            const utilizationPercent = item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
            const isPending = processingId === item.id;

            return (
              <Card key={item.id} className="p-4" variant="elevated">
                <div className="flex flex-col gap-4">
                  {/* Badge & Meta */}
                  <div className="flex items-center justify-between">
                    <Badge status={item.type === "project_cost" ? "WARNING" : "PRIMARY"}>
                      {item.type === "project_cost" ? "Dana Lapangan" : "Vendor Payment"}
                    </Badge>
                    <div className="text-[10px] text-muted font-medium">
                      Diajukan: {new Date(item.createdAt).toLocaleDateString("id-ID", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>

                  {/* Nominal & Justifikasi */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-secondary">Nilai Pengajuan</div>
                      <div className="text-xl font-bold text-text-primary tabular-nums">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </div>
                      <div className="text-xs text-secondary mt-1.5 leading-relaxed">
                        <span className="font-semibold">Justifikasi:</span> {item.description}
                      </div>
                    </div>

                    {/* Receipt Thumbnail */}
                    {item.receiptImageUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveImage(item.receiptImageUrl)}
                        className="h-16 w-16 rounded-xl overflow-hidden border border-border bg-surface shrink-0 active:scale-95"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.receiptImageUrl}
                          alt="Nota Receipt"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    )}
                  </div>

                  {/* Proyek & Budget Overrun check */}
                  <div className="border-t border-border pt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-secondary font-medium">Proyek Konstruksi:</span>
                      <span className="font-bold text-text-primary">{item.projectName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary font-medium">Kategori RAB:</span>
                      <span className="font-bold text-text-primary">{item.budgetItemName}</span>
                    </div>

                    {/* Budget Utilization Comparison */}
                    <div className="rounded-xl bg-surface border border-border p-3 space-y-2">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-muted tracking-wider">
                        <span>Plafon: Rp {item.allocatedAmount.toLocaleString("id-ID")}</span>
                        <span>Realisasi: Rp {item.actualSpent.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-full rounded-full bg-elevated overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.budgetOverrun || utilizationPercent >= 100 ? "bg-critical" : "bg-warning"}`}
                            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold shrink-0 ${item.budgetOverrun || utilizationPercent >= 100 ? "text-critical" : "text-warning"}`}>
                          {utilizationPercent.toFixed(0)}%
                        </span>
                      </div>
                      {(item.budgetOverrun || utilizationPercent >= 100) && (
                        <div className="text-[10px] text-critical font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Peringatan: Pengajuan ini menyebabkan pembengkakan anggaran (Budget Overrun).</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pengaju & Tombol Tindakan */}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      <User className="h-4 w-4 text-muted" />
                      <span>Oleh: <span className="font-bold text-text-primary">{item.requestedBy}</span></span>
                    </div>

                    <div className="flex gap-2">
                      {/* Button Reject */}
                      <button
                        type="button"
                        onClick={() => handleAction(item, "REJECTED")}
                        disabled={isPending}
                        aria-label="Tolak Pengajuan"
                        className="h-12 w-12 flex items-center justify-center rounded-full bg-critical-light/25 text-critical border border-critical/30 hover:bg-critical-light/40 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5.5 w-5.5" strokeWidth={2.5} />}
                      </button>

                      {/* Button Approve */}
                      <button
                        type="button"
                        onClick={() => handleAction(item, "APPROVED")}
                        disabled={isPending}
                        aria-label="Setujui Pengajuan"
                        className="h-12 w-12 flex items-center justify-center rounded-full bg-success-light/25 text-success border border-success/30 hover:bg-success-light/40 transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5.5 w-5.5" strokeWidth={2.5} />}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Zoom Foto Nota */}
      {activeImage && (
        <div
          onClick={() => setActiveImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 transition-opacity duration-200"
        >
          <div className="relative max-w-full max-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt="Receipt Zoom"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <p className="text-center text-xs text-muted mt-3">Ketuk di mana saja untuk menutup gambar.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Loader icon helper
function Loader2({ className, ...props }: React.ComponentPropsWithoutRef<"svg">): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className ?? ""}`}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
