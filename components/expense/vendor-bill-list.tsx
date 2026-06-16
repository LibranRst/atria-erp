"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";
import { submitVendorBill } from "@/app/actions/finance/submit-vendor-bill";
import { scheduleVendorBillPayment } from "@/app/actions/finance/schedule-vendor-bill";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";

export interface VendorListVendor {
  readonly id: string;
  readonly name: string;
}

export interface VendorListBudgetItem {
  readonly id: string;
  readonly name: string;
  readonly allocatedAmount: string;
  readonly actualSpent: string;
}

export interface VendorListProject {
  readonly id: string;
  readonly name: string;
  readonly budget?: {
    readonly items?: VendorListBudgetItem[];
  } | null;
  readonly canonicalBudgets?: Array<{
    readonly id: string;
    readonly status: string;
    readonly categories?: Array<{
      readonly id: string;
      readonly code: string;
      readonly name: string;
      readonly allocatedAmount: string;
      readonly pendingAmount: string;
      readonly actualAmount: string;
      readonly paidAmount: string;
      readonly remainingAmount: string;
      readonly usedPercentage: string;
      readonly status: string;
      readonly sortOrder: number;
    }>;
  }>;
  readonly categoryPlanItems?: Array<{
    readonly id: string;
    readonly projectBudgetCategoryId: string;
    readonly expenseCategoryCode: string;
    readonly label: string;
    readonly area: string;
    readonly quantity: string;
    readonly unit: string;
    readonly estimatedTotalCost: string;
    readonly status: string;
  }>;
}

export interface VendorListBankAccount {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly balance: string;
}

export interface VendorListPayment {
  readonly id: string;
  readonly vendorBillId: string;
  readonly bankAccountId: string;
  readonly amountPaid: string;
  readonly status: string;
  readonly paymentDate: Date;
  readonly referenceNumber: string | null;
  readonly approvalStatus?: string;
  readonly bankAccount?: {
    readonly name: string;
  } | null;
  readonly vendorBill?: {
    readonly billNumber: string;
    readonly vendor?: {
      readonly name: string;
    } | null;
    readonly project?: {
      readonly name: string;
    } | null;
  } | null;
}

export interface VendorListBill {
  readonly id: string;
  readonly vendorId: string;
  readonly projectId: string;
  readonly projectBudgetItemId: string | null;
  readonly projectBudgetCategoryId: string;
  readonly billNumber: string;
  readonly amount: string;
  readonly status: string;
  readonly dueDate: Date;
  readonly notes: string | null;
  readonly vendor?: {
    readonly name: string;
  } | null;
  readonly project?: {
    readonly name: string;
  } | null;
  readonly budgetItem?: {
    readonly name: string;
  } | null;
  readonly payments?: VendorListPayment[];
}

interface VendorBillListProps {
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projects: VendorListProject[];
  readonly bankAccounts: VendorListBankAccount[];
  readonly userRole: string;
}

export function VendorBillList({
  vendorBills,
  vendorPayments,
  vendors,
  projects,
  bankAccounts,
  userRole,
}: VendorBillListProps): React.JSX.Element {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"BILLS" | "PAYMENTS">("BILLS");
  const [isPending, startTransition] = useTransition();

  // Modal / Drawer visibility states
  const [showAddBill, setShowAddBill] = useState(false);
  const [selectedBillForSchedule, setSelectedBillForSchedule] = useState<VendorListBill | null>(null);
  const [selectedPaymentForDisburse, setSelectedPaymentForDisburse] = useState<VendorListPayment | null>(null);

  // Error / Success feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Bill Form States
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBudgetCategoryId, setSelectedBudgetCategoryId] = useState("");
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState("");
  const [selectedCategoryPlanItemId, setSelectedCategoryPlanItemId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDate, setBillDueDate] = useState("");
  const [billNotes, setBillNotes] = useState("");

  // Schedule Form States
  const [selectedBankId, setSelectedBankId] = useState("");
  const [scheduleAmount, setScheduleAmount] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

  // Disburse Form States
  const [refNumber, setRefNumber] = useState("");
  const [disburseBankId, setDisburseBankId] = useState("");

  // Derived states
  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const isPM = userRole === "PROJECT_MANAGER";

  // Dynamic budget items lookup based on selected project
  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const budgetCategories = activeProject?.canonicalBudgets?.[0]?.categories
    ?.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const selectedBudgetCategory = budgetCategories.find((category) => category.id === selectedBudgetCategoryId);
  const packageOptions = activeProject?.categoryPlanItems
    ?.filter((item) => item.projectBudgetCategoryId === selectedBudgetCategoryId) ?? [];

  // Reset form helper
  const resetAddBillForm = () => {
    setSelectedVendorId("");
    setSelectedProjectId("");
    setSelectedBudgetCategoryId("");
    setSelectedBudgetItemId("");
    setSelectedCategoryPlanItemId("");
    setBillNumber("");
    setBillAmount("");
    setBillDueDate("");
    setBillNotes("");
  };

  // Action: Add Vendor Bill
  const handleAddBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedVendorId || !selectedProjectId || !selectedBudgetCategoryId || !billNumber.trim() || !billAmount || !billDueDate) {
      setError("Silakan isi semua kolom formulir wajib.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitVendorBill({
          vendorId: selectedVendorId,
          projectId: selectedProjectId,
          projectBudgetCategoryId: selectedBudgetCategoryId,
          projectBudgetItemId: selectedBudgetItemId || undefined,
          projectCategoryPlanItemId: selectedCategoryPlanItemId || undefined,
          billNumber: billNumber.trim(),
          amount: Number(billAmount),
          dueDate: new Date(billDueDate),
          notes: billNotes.trim() || undefined,
        });

        if (!res.success) {
          setError(res.error.message || "Gagal mengajukan tagihan vendor.");
          return;
        }

        setSuccess(`Tagihan ${billNumber} berhasil disimpan.`);
        router.refresh();
        setTimeout(() => {
          setShowAddBill(false);
          resetAddBillForm();
          setSuccess(null);
        }, 1500);
      } catch (err) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  // Action: Schedule Payment Trigger
  const handleScheduleClick = (bill: VendorListBill) => {
    setSelectedBillForSchedule(bill);
    
    // Hitung sisa tagihan yang belum dijadwalkan atau dibayar
    const pendingAmount = bill.payments
      ?.filter((p: VendorListPayment) => p.status === "PENDING" || p.status === "PROCESSING")
      ?.reduce((sum: number, p: VendorListPayment) => sum + Number(p.amountPaid), 0) || 0;

    const completedAmount = bill.payments
      ?.filter((p: VendorListPayment) => p.status === "COMPLETED")
      ?.reduce((sum: number, p: VendorListPayment) => sum + Number(p.amountPaid), 0) || 0;

    const remaining = Number(bill.amount) - (pendingAmount + completedAmount);
    setScheduleAmount(remaining > 0 ? remaining.toFixed(2) : Number(bill.amount).toFixed(2));
    
    setScheduleDate(new Date().toISOString().split("T")[0]);
    if (bankAccounts.length > 0) {
      setSelectedBankId(bankAccounts[0].id);
    } else {
      setSelectedBankId("");
    }
    setError(null);
    setSuccess(null);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const billForSchedule = selectedBillForSchedule;

    if (!selectedBankId || !scheduleAmount || !scheduleDate) {
      setError("Silakan lengkapi formulir penjadwalan.");
      return;
    }

    if (!billForSchedule) {
      setError("Tagihan vendor tidak ditemukan.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await scheduleVendorBillPayment({
          vendorBillId: billForSchedule.id,
          bankAccountId: selectedBankId,
          paymentDate: new Date(scheduleDate),
          amountPaid: Number(scheduleAmount),
        });

        if (!res.success) {
          setError(res.error.message || "Gagal menjadwalkan pembayaran.");
          return;
        }

        setSuccess("Pembayaran vendor berhasil dijadwalkan.");
        router.refresh();
        setTimeout(() => {
          setSelectedBillForSchedule(null);
          setSuccess(null);
        }, 1500);
      } catch (err) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  // Action: Disburse Payment Trigger
  const handleDisburseClick = (payment: VendorListPayment) => {
    setSelectedPaymentForDisburse(payment);
    setDisburseBankId(payment.bankAccountId); // Pre-populate with the scheduled account
    setRefNumber("");
    setError(null);
    setSuccess(null);
  };

  const handleDisburseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const paymentForDisburse = selectedPaymentForDisburse;

    if (!refNumber.trim()) {
      setError("Nomor referensi bukti transfer wajib diisi.");
      return;
    }

    if (!paymentForDisburse) {
      setError("Rencana pembayaran vendor tidak ditemukan.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await payVendorBill({
          vendorPaymentId: paymentForDisburse.id,
          referenceNumber: refNumber.trim(),
          bankAccountId: disburseBankId || undefined, // Pass the chosen bank account override
        });

        if (!res.success) {
          setError(res.error.message || "Gagal memproses pelunasan.");
          return;
        }

        setSuccess("Kewajiban tagihan vendor berhasil dilunasi.");
        router.refresh();
        setTimeout(() => {
          setSelectedPaymentForDisburse(null);
          setSuccess(null);
        }, 1500);
      } catch (err) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  return (
    <div className="space-y-md select-none">
      {/* Tab Swapper Internal */}
      <div className="flex gap-md border-b border-outline-variant/10 pb-2 pt-2 justify-between items-center">
        <div className="flex gap-md">
          <button
            type="button"
            onClick={() => setSubTab("BILLS")}
            className={`text-xs font-bold transition-all relative py-1 cursor-pointer ${
              subTab === "BILLS" 
                ? "text-primary border-b-2 border-primary" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Tagihan ({vendorBills.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("PAYMENTS")}
            className={`text-xs font-bold transition-all relative py-1 cursor-pointer ${
              subTab === "PAYMENTS" 
                ? "text-primary border-b-2 border-primary" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Rencana Bayar ({vendorPayments.length})
          </button>
        </div>

        {/* Add Vendor Bill FAB trigger */}
        {(isOwnerOrFinance || isPM) && (
          <button
            type="button"
            onClick={() => {
              setShowAddBill(true);
              setError(null);
              setSuccess(null);
            }}
            className="h-8 px-sm rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center gap-1 hover:bg-primary/95 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Tambah Tagihan</span>
          </button>
        )}
      </div>

      {/* 1. Tagihan View */}
      {subTab === "BILLS" && (
        <div className="space-y-md">
          {vendorBills.length === 0 ? (
            <div className="premium-card p-md flex flex-col items-center justify-center py-16 text-center border border-outline-variant/30 space-y-md">
              <div className="h-14 w-14 rounded-full bg-surface-container flex items-center justify-center text-primary border border-outline-variant/10 shadow-sm">
                <span className="material-symbols-outlined text-primary text-[28px]">payments</span>
              </div>
              <div className="space-y-base">
                <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[16px] text-on-surface">Tidak Ada Tagihan</h3>
                <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant leading-relaxed">
                  Belum ada tagihan pembelian material/vendor yang tercatat.
                </p>
              </div>
            </div>
          ) : (
            vendorBills.map((bill) => {
              const amountNum = Number(bill.amount);
              // Map database status to badge statuses
              let statusMapping: "UNPAID" | "PAID" | "PARTIALLY_PAID" | "VOID" = "UNPAID";
              if (bill.status === "PAID") statusMapping = "PAID";
              if (bill.status === "VOID") statusMapping = "VOID";
              if (bill.status === "PARTIALLY_PAID") statusMapping = "PARTIALLY_PAID";

              const pendingPaymentAmount = bill.payments
                ?.filter((p: VendorListPayment) => p.status === "PENDING" || p.status === "PROCESSING")
                ?.reduce((sum: number, p: VendorListPayment) => sum + Number(p.amountPaid), 0) || 0;

              const completedPaymentAmount = bill.payments
                ?.filter((p: VendorListPayment) => p.status === "COMPLETED")
                ?.reduce((sum: number, p: VendorListPayment) => sum + Number(p.amountPaid), 0) || 0;

              const totalScheduledOrPaid = pendingPaymentAmount + completedPaymentAmount;
              const isFullyScheduledOrPaid = totalScheduledOrPaid >= amountNum;
              const hasPending = pendingPaymentAmount > 0;

              return (
                <div
                  key={bill.id}
                  className="premium-card p-md border border-outline-variant/30 hover:border-outline-variant/50 transition-colors space-y-md"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate max-w-[200px]">
                          {bill.vendor?.name}
                        </h3>
                        <Badge status={statusMapping} />
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        Nomor: <span className="font-bold text-on-surface">{bill.billNumber}</span>
                      </p>
                    </div>
                    <div className="text-right font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold">
                      Rp {amountNum.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-sm bg-surface-container-low p-sm rounded-lg border border-outline-variant/10 text-[11px] font-semibold text-on-surface">
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Proyek</span>
                      <p className="truncate">{bill.project?.name}</p>
                    </div>
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Item Budget BoQ</span>
                      <p className="truncate">{bill.budgetItem?.name}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-outline-variant/10 pt-sm">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      <span>Jatuh Tempo: {new Date(bill.dueDate).toLocaleDateString("id-ID", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>

                    {/* Schedule action trigger */}
                    {isOwnerOrFinance && (bill.status !== "PAID" && bill.status !== "VOID") && (
                      isFullyScheduledOrPaid ? (
                        <Badge status="PENDING">
                          {hasPending ? "Dalam Antrean" : "Sudah Dijadwalkan"}
                        </Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleScheduleClick(bill)}
                          className="h-8 px-sm bg-secondary text-on-secondary text-[11px] font-bold rounded-full hover:bg-secondary/95 active:scale-95 transition-all cursor-pointer"
                        >
                          {totalScheduledOrPaid > 0 ? "Jadwalkan Sisa" : "Jadwalkan Bayar"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. Rencana Bayar View */}
      {subTab === "PAYMENTS" && (
        <div className="space-y-md">
          {vendorPayments.length === 0 ? (
            <div className="premium-card p-md flex flex-col items-center justify-center py-16 text-center border border-outline-variant/30 space-y-md">
              <div className="h-14 w-14 rounded-full bg-surface-container flex items-center justify-center text-primary border border-outline-variant/10 shadow-sm">
                <span className="material-symbols-outlined text-primary text-[28px]">schedule</span>
              </div>
              <div className="space-y-base">
                <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[16px] text-on-surface">Tidak Ada Rencana Pembayaran</h3>
                <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant leading-relaxed">
                  Belum ada rencana atau mutasi pembayaran vendor yang terdaftar.
                </p>
              </div>
            </div>
          ) : (
            vendorPayments.map((pay) => {
              const amountPaidNum = Number(pay.amountPaid);
              const isCompleted = pay.status === "COMPLETED";

              // Verify if this payment has a linked approval PENDING
              return (
                <div
                  key={pay.id}
                  className={`premium-card p-md border transition-colors space-y-md ${
                    isCompleted 
                      ? "border-outline-variant/15 bg-surface-container-low/40" 
                      : "border-outline-variant/30 hover:border-outline-variant/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate max-w-[200px]">
                          {pay.vendorBill?.vendor?.name}
                        </h4>
                        <Badge status={isCompleted ? "PAID" : pay.approvalStatus === "PENDING" ? "PENDING" : pay.approvalStatus === "REJECTED" ? "REJECTED" : "APPROVED"}>
                          {isCompleted ? "Lunas" : pay.approvalStatus === "PENDING" ? "Menunggu" : pay.approvalStatus === "REJECTED" ? "Ditolak" : "Disetujui"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        Tagihan: <span className="font-bold text-on-surface">{pay.vendorBill?.billNumber}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold">
                        Rp {amountPaidNum.toLocaleString("id-ID")}
                      </div>
                      <span className="text-[9px] text-on-surface-variant">Sumber: {pay.bankAccount?.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-sm bg-surface-container-low/50 p-sm rounded-lg border border-outline-variant/10 text-[11px] font-semibold text-on-surface">
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Proyek</span>
                      <p className="truncate">{pay.vendorBill?.project?.name}</p>
                    </div>
                    <div className="space-y-base">
                      <span className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Tanggal Rencana Bayar</span>
                      <p>{new Date(pay.paymentDate).toLocaleDateString("id-ID", { month: "short", day: "numeric" })}</p>
                    </div>
                  </div>

                  {/* Disburse actions or approval checks */}
                  {!isCompleted && (
                    <div className="flex justify-end items-center border-t border-outline-variant/10 pt-sm">
                      {pay.approvalStatus === "PENDING" ? (
                        <span className="text-[10px] font-bold bg-warning-light text-warning border border-warning/30 px-2.5 py-1 rounded-full uppercase">
                          Menunggu Approval Owner
                        </span>
                      ) : pay.approvalStatus === "REJECTED" ? (
                        <span className="text-[10px] font-bold bg-critical-light text-critical border border-critical/30 px-2.5 py-1 rounded-full uppercase">
                          Ditolak Owner
                        </span>
                      ) : isOwnerOrFinance ? (
                        <button
                          type="button"
                          onClick={() => handleDisburseClick(pay)}
                          className="h-8 px-sm bg-primary text-on-primary text-[11px] font-bold rounded-full hover:bg-primary/95 active:scale-95 transition-all cursor-pointer"
                        >
                          Cairkan / Bayar
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold bg-success-light text-success border border-success/30 px-2.5 py-1 rounded-full uppercase">
                          Proses Antrean
                        </span>
                      )}
                    </div>
                  )}

                  {isCompleted && pay.referenceNumber && (
                    <div className="text-[10px] font-semibold text-on-surface-variant border-t border-outline-variant/10 pt-sm flex justify-between">
                      <span>Referensi Transfer:</span>
                      <span className="font-bold text-on-surface">{pay.referenceNumber}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Tambah Tagihan Vendor (Add Vendor Bill) */}
      {showAddBill && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-surface border border-outline-variant/30 rounded-t-3xl md:rounded-2xl max-w-md w-full p-md space-y-md shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h2 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Tagihan Vendor Baru</h2>
              <button
                type="button"
                onClick={() => setShowAddBill(false)}
                disabled={isPending}
                className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-error font-medium">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <div className="leading-relaxed">{error}</div>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3 text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                <div className="leading-relaxed">{success}</div>
              </div>
            )}

            <form onSubmit={handleAddBillSubmit} className="space-y-md">
              {/* Select Vendor */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Nama Vendor/Supplier</label>
                <div className="relative">
                  <select
                    value={selectedVendorId}
                    disabled={isPending}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </div>
                </div>
              </div>

              {/* Select Project */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Proyek Anggaran</label>
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    disabled={isPending}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setSelectedBudgetCategoryId("");
                      setSelectedBudgetItemId("");
                      setSelectedCategoryPlanItemId("");
                    }}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Proyek --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </div>
                </div>
              </div>

              {/* Select Budget Category */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Kategori Budget</label>
                <div className="relative">
                  <select
                    value={selectedBudgetCategoryId}
                    disabled={isPending || !selectedProjectId}
                    onChange={(e) => {
                      setSelectedBudgetCategoryId(e.target.value);
                      setSelectedBudgetItemId("");
                      setSelectedCategoryPlanItemId("");
                    }}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {budgetCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} (Sisa: Rp {Number(category.remainingAmount).toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                  </div>
                </div>
              </div>

              {["TUKANG", "SUBCON"].includes(selectedBudgetCategory?.code ?? "") && (
                <div className="space-y-xs rounded-2xl border border-outline-variant/15 bg-surface-container-low p-3">
                  <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">
                    {selectedBudgetCategory?.code === "SUBCON" ? "Subcon Package" : "Work Package"} (Opsional)
                  </label>
                  <select
                    value={selectedCategoryPlanItemId}
                    disabled={isPending || !selectedProjectId || !selectedBudgetCategoryId}
                    onChange={(e) => setSelectedCategoryPlanItemId(e.target.value)}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">Tidak link ke package</option>
                    {packageOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.area} - {item.label} ({item.quantity} {item.unit}, Rp {Number(item.estimatedTotalCost).toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-on-surface-variant">
                    Link ini membantu membandingkan tagihan vendor dengan estimasi internal Tukang/Subcon.
                  </p>
                </div>
              )}

              {/* Bill Number */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Nomor Tagihan (Bill Number)</label>
                <input
                  type="text"
                  value={billNumber}
                  disabled={isPending}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="Contoh: BILL-2026-99"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Amount */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Nominal Tagihan (Rupiah)</label>
                <input
                  type="number"
                  value={billAmount}
                  disabled={isPending}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="Masukkan nominal angka"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Due Date */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Tanggal Jatuh Tempo</label>
                <input
                  type="date"
                  value={billDueDate}
                  disabled={isPending}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Keterangan / Catatan</label>
                <textarea
                  value={billNotes}
                  disabled={isPending}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                  className="w-full p-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-md pt-xs">
                <button
                  type="button"
                  onClick={() => setShowAddBill(false)}
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
                  {isPending ? "Menyimpan..." : "Simpan Tagihan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Jadwalkan Pembayaran Tagihan (Schedule Payment) */}
      {selectedBillForSchedule && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-surface border border-outline-variant/30 rounded-t-3xl md:rounded-2xl max-w-md w-full p-md space-y-md shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h2 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Jadwalkan Bayar</h2>
              <button
                type="button"
                onClick={() => setSelectedBillForSchedule(null)}
                disabled={isPending}
                className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-error font-medium">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <div className="leading-relaxed">{error}</div>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3 text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                <div className="leading-relaxed">{success}</div>
              </div>
            )}

            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-sm space-y-xs text-xs font-semibold text-on-surface">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Vendor:</span>
                <span>{selectedBillForSchedule.vendor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Nomor Tagihan:</span>
                <span>{selectedBillForSchedule.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Total Tagihan:</span>
                <span className="font-bold">Rp {Number(selectedBillForSchedule.amount).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-md">
              {/* Select Bank Account */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Sumber Rekening Kas</label>
                <div className="relative">
                  <select
                    value={selectedBankId}
                    disabled={isPending}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Rekening --</option>
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

              {/* Schedule Date */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Tanggal Pembayaran</label>
                <input
                  type="date"
                  value={scheduleDate}
                  disabled={isPending}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Amount to Pay */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Nominal yang Dibayarkan (Rupiah)</label>
                <input
                  type="number"
                  value={scheduleAmount}
                  disabled={isPending}
                  onChange={(e) => setScheduleAmount(e.target.value)}
                  placeholder="Masukkan nominal"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-md pt-xs">
                <button
                  type="button"
                  onClick={() => setSelectedBillForSchedule(null)}
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
                  {isPending ? "Memproses..." : "Jadwalkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cairkan Pembayaran Terjadwal (Disburse Payment) */}
      {selectedPaymentForDisburse && (
        <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-surface border border-outline-variant/30 rounded-t-3xl md:rounded-2xl max-w-md w-full p-md space-y-md shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h2 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Cairkan Pembayaran Vendor</h2>
              <button
                type="button"
                onClick={() => setSelectedPaymentForDisburse(null)}
                disabled={isPending}
                className="h-8 w-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3 text-xs text-error font-medium">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <div className="leading-relaxed">{error}</div>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3 text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                <div className="leading-relaxed">{success}</div>
              </div>
            )}

            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-sm space-y-xs text-xs font-semibold text-on-surface">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Vendor:</span>
                <span>{selectedPaymentForDisburse.vendorBill?.vendor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Jumlah Pembayaran:</span>
                <span className="font-bold text-primary">Rp {Number(selectedPaymentForDisburse.amountPaid).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <form onSubmit={handleDisburseSubmit} className="space-y-md">
              {/* Select Bank Account Override */}
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Pilih Kantong / Sumber Kas</label>
                <div className="relative">
                  <select
                    value={disburseBankId}
                    disabled={isPending}
                    onChange={(e) => setDisburseBankId(e.target.value)}
                    className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] appearance-none focus:outline-none focus:border-primary disabled:opacity-50 cursor-pointer"
                    required
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
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant block">Nomor Referensi Bukti Transfer</label>
                <input
                  type="text"
                  value={refNumber}
                  disabled={isPending}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Contoh: TRF-BCA-55203"
                  className="w-full h-11 px-sm rounded-xl border border-outline-variant/50 bg-surface text-on-surface font-semibold text-[13px] focus:outline-none focus:border-primary disabled:opacity-50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-md pt-xs">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentForDisburse(null)}
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
                  {isPending ? "Memproses..." : "Konfirmasi Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
